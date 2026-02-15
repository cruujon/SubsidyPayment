import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { BackendClient, BackendClientError } from '../backend-client.ts';
import type { BackendConfig } from '../config.ts';

const getTaskDetailsInputSchema = z.object({
  campaign_id: z.string().uuid(),
  session_token: z.string().optional(),
});

function unauthorizedSessionResponse(publicUrl: string) {
  return {
    content: [{ type: 'text' as const, text: 'このアクションを実行するにはログインが必要です。' }],
    _meta: {
      'mcp/www_authenticate': [
        `Bearer resource_metadata="${publicUrl}/.well-known/oauth-protected-resource"`,
      ],
    },
    isError: true,
  };
}

function resolveSessionToken(input: { session_token?: string }, context: any): string | null {
  const contextToken = context?._meta?.session_token ?? context?.session_token ?? null;
  if (typeof contextToken === 'string' && contextToken.length > 0) {
    return contextToken;
  }

  if (typeof input.session_token === 'string' && input.session_token.length > 0) {
    return input.session_token;
  }

  return null;
}

export function registerGetTaskDetailsTool(server: McpServer, config: BackendConfig): void {
  const client = new BackendClient(config);

  registerAppTool(
    server,
    'get_task_details',
    {
      title: 'タスク詳細取得',
      description: 'キャンペーンの必要タスク詳細を取得する。',
      inputSchema: getTaskDetailsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      securitySchemes: [{ type: 'oauth2', scopes: ['tasks.read'] }],
      _meta: {
        ui: { resourceUri: 'ui://widget/task-form.html' },
        'openai/toolInvocation/invoking': 'タスク情報を取得中...',
        'openai/toolInvocation/invoked': 'タスク情報を取得しました',
      },
    },
    async (input, context: any) => {
      const sessionToken = resolveSessionToken(input, context);
      if (!sessionToken) {
        return unauthorizedSessionResponse(config.publicUrl);
      }

      try {
        const response = await client.getTaskDetails(input.campaign_id, sessionToken);
        return {
          structuredContent: {
            campaign_id: response.campaign_id,
            campaign_name: response.campaign_name,
            sponsor: response.sponsor,
            required_task: response.required_task,
            task_description: response.task_description,
            task_input_format: response.task_input_format,
            already_completed: response.already_completed,
            subsidy_amount_cents: response.subsidy_amount_cents,
          },
          content: [{ type: 'text' as const, text: response.message }],
          _meta: {
            full_response: response,
          },
        };
      } catch (error) {
        if (error instanceof BackendClientError) {
          return {
            content: [{ type: 'text' as const, text: error.message }],
            _meta: { code: error.code, details: error.details },
            isError: true,
          };
        }

        return {
          content: [{ type: 'text' as const, text: 'タスク情報取得中に予期しないエラーが発生しました。' }],
          _meta: { code: 'unexpected_error' },
          isError: true,
        };
      }
    }
  );
}
