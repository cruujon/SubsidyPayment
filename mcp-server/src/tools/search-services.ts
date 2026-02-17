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
  session_token: z.string().uuid().optional(),
});

const sessionTokenSchema = z.string().uuid();

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

function toSearchServicesResult(response: GptSearchResponse) {
  return {
    structuredContent: {
      services: response.services,
      total_count: response.total_count,
      applied_filters: response.applied_filters,
      available_categories: response.available_categories,
    },
    content: [{ type: 'text' as const, text: response.message }],
    _meta: {
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
      description: 'Search available sponsored services.',
      inputSchema: searchServicesInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        securitySchemes: [{ type: 'noauth' }],
        ui: { resourceUri: 'ui://widget/services-list.html' },
        'openai/toolInvocation/invoking': 'Searching services...',
        'openai/toolInvocation/invoked': 'Services found',
      },
    },
    async (input: SearchServicesParams, context: any) => {
      try {
        const sessionToken = resolveSessionToken(input, context);
        if (sessionToken && !sessionTokenSchema.safeParse(sessionToken).success) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'Invalid session_token format. Call authenticate_user and use the returned _meta.session_token.',
              },
            ],
            _meta: { code: 'invalid_session_token' },
            isError: true,
          };
        }

        const response = await client.searchServices({
          ...input,
          session_token: sessionToken ?? undefined,
        });
        return toSearchServicesResult(response);
      } catch (error) {
        if (error instanceof BackendClientError) {
          return {
            content: [{ type: 'text' as const, text: error.message }],
            _meta: { code: error.code, details: error.details },
            isError: true,
          };
        }

        return {
          content: [{ type: 'text' as const, text: 'An unexpected error occurred while searching services.' }],
          _meta: { code: 'unexpected_error' },
          isError: true,
        };
      }
    }
  );
}
