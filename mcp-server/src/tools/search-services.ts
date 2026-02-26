import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { BackendClient, BackendClientError } from '../backend-client.ts';
import type { BackendConfig } from '../config.ts';
import type { GptSearchResponse, SearchServicesParams } from '../types.ts';

const searchServicesInputSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  max_budget_cents: z.number().int().nonnegative().optional(),
  intent: z.string().optional(),
  campaign_id: z.string().optional(),
});

function buildNextActions(serviceKey?: string) {
  const keyword = typeof serviceKey === 'string' && serviceKey.trim().length > 0 ? serviceKey.trim() : '';
  if (!keyword) {
    return [
      {
        action: 'Open guided flow',
        prompt: 'Please run get_prompt_guide_flow with context_step=2.',
        tool: 'get_prompt_guide_flow',
      },
    ];
  }
  return [
    {
      action: 'Check tasks for a selected service',
      prompt: `Please run get_service_tasks with service_key=${keyword}.`,
      tool: 'get_service_tasks',
    },
  ];
}

function pickRecommendedServiceKey(response: GptSearchResponse, input: SearchServicesParams): string | null {
  const fromCandidate = response.candidate_services?.find((c) => c.service_key?.trim())?.service_key?.trim();
  if (fromCandidate) return fromCandidate;

  const fromCatalog = response.service_catalog?.find((c) => c.service_key?.trim())?.service_key?.trim();
  if (fromCatalog) return fromCatalog;

  const fromServiceCategory = response.services
    .find((service) => service.service_type === 'campaign' && service.category.some((c) => c.trim().length > 0))
    ?.category.find((c) => c.trim().length > 0)?.trim();
  if (fromServiceCategory) return fromServiceCategory;

  const fallback = input.q ?? input.category;
  return typeof fallback === 'string' && fallback.trim().length > 0 ? fallback.trim() : null;
}

function toSearchServicesResult(response: GptSearchResponse, input: SearchServicesParams) {
  const services = response.services.filter((service) => service.service_type === 'campaign');
  const candidateServices = response.candidate_services ?? [];
  const serviceCatalog = response.service_catalog ?? [];
  const sponsorCatalog = response.sponsor_catalog ?? [];
  const totalCount = services.length;
  const recommendedServiceKey = pickRecommendedServiceKey(response, input);
  const nextActions = buildNextActions(recommendedServiceKey ?? undefined);
  const recommendedNextPrompt = nextActions[0]?.prompt ?? 'Please run get_prompt_guide_flow with context_step=2.';
  const message =
    totalCount === 0
      ? 'No campaign-backed sponsored services found. Please create or activate a sponsor campaign first.'
      : `Interactive sponsored services list ready in the widget. Next: ${recommendedNextPrompt}`;

  return {
    structuredContent: {
      flow_step: '2',
      services,
      total_count: totalCount,
      candidate_services: candidateServices,
      service_catalog: serviceCatalog,
      sponsor_catalog: sponsorCatalog,
      applied_filters: response.applied_filters,
      available_categories: response.available_categories,
      recommended_service_key: recommendedServiceKey,
      recommended_next_prompt: recommendedNextPrompt,
      next_actions: nextActions,
    },
    content: [
      { type: 'text' as const, text: message },
    ],
    _meta: {
      'openai/outputTemplate': 'ui://widget/services-list.html',
      'openai/widgetDescription':
        'Use the widget as the primary UI. After selection, ask the user to continue in chat with: "get_service_tasks を実行してください。service_key を指定します。"',
      full_response: response,
    },
  };
}

export function registerSearchServicesTool(server: McpServer, config: BackendConfig): void {
  const client = new BackendClient(config);

  registerAppTool(
    server,
    'search_services',
    {
      title: 'Search Services',
      description:
        'Search available sponsored services and return a guided next step to continue the flow without confusion.',
      inputSchema: searchServicesInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        securitySchemes: [{ type: 'noauth' }],
        ui: { resourceUri: 'ui://widget/services-list.html' },
        'openai/resultCanProduceWidget': true,
        'openai/widgetAccessible': true,
        'openai/widgetDescription':
          'Interactive sponsored services list. After selecting a card, continue in chat using get_service_tasks or get_task_details.',
        'openai/toolInvocation/invoking': 'Searching services...',
        'openai/toolInvocation/invoked': 'Services found. Next prompt is ready.',
        'openai/outputTemplate': 'ui://widget/services-list.html',
      },
    },
    async (input: SearchServicesParams) => {
      try {
        const response = await client.searchServices(input);
        return toSearchServicesResult(response, input);
      } catch (error) {
        if (error instanceof BackendClientError) {
          return {
            content: [{ type: 'text' as const, text: `${error.message} 次は「get_prompt_guide_flow を実行してください」と入力してください。` }],
            _meta: { code: error.code, details: error.details },
            isError: true,
          };
        }

        return {
          content: [{ type: 'text' as const, text: 'An unexpected error occurred while searching services. 次は「get_prompt_guide_flow を実行してください」と入力してください。' }],
          _meta: { code: 'unexpected_error' },
          isError: true,
        };
      }
    }
  );
}
