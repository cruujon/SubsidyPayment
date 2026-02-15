import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { BackendClient, BackendClientError } from '../backend-client.ts';
import type { BackendConfig } from '../config.ts';

const runServiceInputSchema = z.object({
  service: z.string(),
  input: z.string(),
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

export function registerRunServiceTool(server: McpServer, config: BackendConfig): void {
  const client = new BackendClient(config);

  registerAppTool(
    server,
    'run_service',
    {
      title: 'サービス実行',
      description: 'スポンサー支払い付きでサービスを実行する。',
      inputSchema: runServiceInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
      securitySchemes: [{ type: 'oauth2', scopes: ['services.execute'] }],
      _meta: {
        'openai/toolInvocation/invoking': 'サービスを実行中...',
        'openai/toolInvocation/invoked': 'サービスの実行が完了しました',
      },
    },
    async (input, context: any) => {
      const sessionToken = resolveSessionToken(input, context);
      if (!sessionToken) {
        return unauthorizedSessionResponse(config.publicUrl);
      }

      try {
        const response = await client.runService(input.service, {
          service: input.service,
          session_token: sessionToken,
          input: input.input,
        });

        return {
          structuredContent: {
            service: response.service,
            payment_mode: response.payment_mode,
            sponsored_by: response.sponsored_by,
            tx_hash: response.tx_hash,
          },
          content: [{ type: 'text' as const, text: response.message }],
          _meta: {
            output: response.output,
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
          content: [{ type: 'text' as const, text: 'サービス実行中に予期しないエラーが発生しました。' }],
          _meta: { code: 'unexpected_error' },
          isError: true,
        };
      }
    }
  );
}
