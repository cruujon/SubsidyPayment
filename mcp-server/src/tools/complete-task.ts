import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { TokenVerifier } from '../auth/token-verifier.ts';
import { BackendClient, BackendClientError } from '../backend-client.ts';
import type { BackendConfig } from '../config.ts';
import type { CompleteTaskInput } from '../types.ts';
import { resolveOrCreateNoAuthSessionToken } from './session-manager.ts';

const completeTaskInputSchema = z.object({
  campaign_id: z.string().uuid(),
  task_name: z.string(),
  details: z.string().optional(),
  feedback: z
    .object({
      product_link: z.string().url(),
      feedback_rating: z.number().int().min(1).max(5),
      feedback_tags: z.string().min(1),
      feedback_reason: z.string().min(6),
    })
    .optional(),
  session_token: z.string().optional(),
  consent: z.object({
    data_sharing_agreed: z.boolean(),
    purpose_acknowledged: z.boolean(),
    contact_permission: z.boolean(),
  }),
});

function normalizeFeedbackDetails(taskName: string, details?: string): string | undefined {
  if (!details || !taskName.toLowerCase().includes('feedback')) {
    return details;
  }

  let parsed: Record<string, unknown>;
  try {
    const value = JSON.parse(details);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return details;
    }
    parsed = value as Record<string, unknown>;
  } catch {
    return details;
  }

  const next = { ...parsed };
  const existingRating = next.feedback_rating;
  const ratingFromAlias = next.rating;
  if (
    (existingRating === undefined || existingRating === null || existingRating === '') &&
    (typeof ratingFromAlias === 'number' || typeof ratingFromAlias === 'string')
  ) {
    next.feedback_rating = ratingFromAlias;
  }

  const existingReason = typeof next.feedback_reason === 'string' ? next.feedback_reason.trim() : '';
  if (!existingReason) {
    const summary = typeof next.summary === 'string' ? next.summary.trim() : '';
    const issues = Array.isArray(next.issues)
      ? next.issues.map((v) => String(v).trim()).filter(Boolean).join(' / ')
      : '';
    const fallbackReason = summary || issues;
    if (fallbackReason) {
      next.feedback_reason = fallbackReason;
    }
  }

  const existingTags = typeof next.feedback_tags === 'string' ? next.feedback_tags.trim() : '';
  if (!existingTags) {
    const fallbackTags = Array.isArray(next.feedback_tags)
      ? next.feedback_tags.map((v) => String(v).trim()).filter(Boolean).join(', ')
      : '';
    next.feedback_tags = fallbackTags || 'Usability, Features';
  }

  const existingLink = typeof next.product_link === 'string' ? next.product_link.trim() : '';
  if (!existingLink) {
    const githubRepo = typeof next.github_repo === 'string' ? next.github_repo.trim() : '';
    if (/^[^/\s]+\/[^/\s]+$/.test(githubRepo)) {
      next.product_link = `https://github.com/${githubRepo}`;
    } else {
      next.product_link = 'https://example.com/product';
    }
  }

  return JSON.stringify(next);
}

function buildNextActions() {
  return [
    {
      action: '実行可否を確認する',
      prompt: 'Please run get_user_status.',
      tool: 'get_user_status',
    },
    {
      action: 'サービスを実行する',
      prompt: 'Please run run_service using the selected service_key as service.',
      tool: 'run_service',
    },
  ];
}

function buildRecommendedNextPrompt(): string {
  return 'Please run get_user_status.';
}

function unauthorizedSessionResponse(publicUrl: string) {
  return {
    content: [{ type: 'text' as const, text: 'Login is required to perform this action. 次は「authenticate_user を実行してください」と入力してください。' }],
    _meta: {
      'mcp/www_authenticate': [
        `Bearer resource_metadata="${publicUrl}/.well-known/oauth-protected-resource"`,
      ],
    },
    isError: true,
  };
}

function resolveBearerToken(context: any): string | null {
  const authToken = context?.auth?.token ?? context?._meta?.auth?.token ?? null;
  if (typeof authToken === 'string' && authToken.length > 0) {
    return authToken;
  }
  const authorization = context?.headers?.authorization ?? context?._meta?.headers?.authorization ?? null;
  if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length);
  }
  return null;
}

export function registerCompleteTaskTool(server: McpServer, config: BackendConfig): void {
  const client = new BackendClient(config);
  const verifier = new TokenVerifier({
    domain: config.auth0Domain,
    audience: config.auth0Audience,
  });

  registerAppTool(
    server,
    'complete_task',
    {
      title: 'Complete Task',
      description:
        'Record task completion details and consent data, then return the next prompt for status check and service run.',
      inputSchema: completeTaskInputSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        securitySchemes: config.authEnabled
          ? [{ type: 'oauth2', scopes: ['tasks.write'] }]
          : [{ type: 'noauth' }],
        'openai/widgetDescription':
          'Completes the selected task. After completion, continue in chat with get_user_status and run_service.',
        'openai/toolInvocation/invoking': 'Recording task completion...',
        'openai/toolInvocation/invoked': 'Task completed. Next prompt is ready.',
      },
    },
    async (input, context: any) => {
      if (config.authEnabled) {
        const bearerToken = resolveBearerToken(context);
        const authInfo = bearerToken ? await verifier.verify(bearerToken) : null;
        if (!authInfo) {
          return unauthorizedSessionResponse(config.publicUrl);
        }
      }

      try {
        const sessionToken = await resolveOrCreateNoAuthSessionToken(client, config, input, context);
        if (!sessionToken) {
          return unauthorizedSessionResponse(config.publicUrl);
        }

        const payload: CompleteTaskInput = {
          campaign_id: input.campaign_id,
          session_token: sessionToken,
          task_name: input.task_name,
          details: normalizeFeedbackDetails(
            input.task_name,
            input.details ??
              (input.feedback
                ? JSON.stringify({
                    product_link: input.feedback.product_link,
                    feedback_rating: input.feedback.feedback_rating,
                    feedback_tags: input.feedback.feedback_tags,
                    feedback_reason: input.feedback.feedback_reason,
                  })
                : undefined)
          ),
          consent: input.consent,
        };

        const response = await client.completeTask(input.campaign_id, payload);

        // Enrich with campaign metadata for the verification/payment screen
        let taskName: string | null = input.task_name;
        let sponsor: string | null = null;
        let campaignName: string | null = null;
        let subsidyAmountCents: number | null = null;

        try {
          const taskDetails = await client.getTaskDetails(input.campaign_id, sessionToken);
          taskName = taskDetails.required_task ?? taskName;
          sponsor = taskDetails.sponsor;
          campaignName = taskDetails.campaign_name;
          subsidyAmountCents = taskDetails.subsidy_amount_cents;
        } catch {
          // Non-critical: proceed with partial data from input
        }

        const recommendedNextPrompt = buildRecommendedNextPrompt();
        return {
          structuredContent: {
            flow_step: '5',
            task_completion_id: response.task_completion_id,
            campaign_id: response.campaign_id,
            consent_recorded: response.consent_recorded,
            can_use_service: response.can_use_service,
            task_name: taskName,
            sponsor,
            campaign_name: campaignName,
            subsidy_amount_cents: subsidyAmountCents,
            recommended_next_prompt: recommendedNextPrompt,
            next_actions: buildNextActions(),
          },
          content: [{ type: 'text' as const, text: `${response.message} Next: ${recommendedNextPrompt}` }],
          _meta: {
            full_response: response,
          },
        };
      } catch (error) {
        if (error instanceof BackendClientError) {
          return {
            content: [{ type: 'text' as const, text: `${error.message} 次は「get_prompt_guide_flow を実行してください」と入力してください。` }],
            _meta: { code: error.code, details: error.details },
            isError: true,
          };
        }

        return {
          content: [{ type: 'text' as const, text: 'An unexpected error occurred while recording task completion. 次は「get_prompt_guide_flow を実行してください」と入力してください。' }],
          _meta: { code: 'unexpected_error' },
          isError: true,
        };
      }
    }
  );
}
