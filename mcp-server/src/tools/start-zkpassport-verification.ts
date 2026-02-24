import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { TokenVerifier } from '../auth/token-verifier.ts';
import { BackendClient, BackendClientError } from '../backend-client.ts';
import type { BackendConfig } from '../config.ts';
import { resolveOrCreateNoAuthSessionToken } from './session-manager.ts';
import type { ZkpassportSessionResponse } from '../types.ts';

const startZkpassportVerificationInputSchema = z.object({
  campaign_id: z.string().uuid(),
  consent: z.object({
    data_sharing_agreed: z.boolean(),
    purpose_acknowledged: z.boolean(),
    contact_permission: z.boolean(),
  }),
  session_token: z.string().optional(),
});

function unauthorizedSessionResponse(publicUrl: string) {
  return {
    content: [{ type: 'text' as const, text: 'Login is required to perform this action.' }],
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

function resolveZkpassportConstructor(moduleValue: unknown): (new (domain: string) => any) | null {
  if (!moduleValue || typeof moduleValue !== 'object') return null;
  const mod = moduleValue as Record<string, unknown>;
  const fromNamed = mod.ZKPassport;
  if (typeof fromNamed === 'function') return fromNamed as new (domain: string) => any;
  const fromDefault = (mod.default as Record<string, unknown> | undefined)?.ZKPassport;
  if (typeof fromDefault === 'function') return fromDefault as new (domain: string) => any;
  if (typeof mod.default === 'function') return mod.default as new (domain: string) => any;
  return null;
}

function resolveZkpassportDomain(config: BackendConfig): string {
  const envDomain = process.env.ZKPASSPORT_DOMAIN?.trim();
  if (envDomain) return envDomain;
  try {
    return new URL(config.rustBackendUrl).hostname;
  } catch {
    return 'localhost';
  }
}

function buildLogoUrl(config: BackendConfig): string {
  try {
    return new URL('/favicon.ico', config.rustBackendUrl).toString();
  } catch {
    return 'https://zkpassport.id/favicon.ico';
  }
}

function buildQrImageUrl(config: BackendConfig, value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL('/internal/qr', config.publicUrl);
    url.searchParams.set('data', value);
    url.searchParams.set('size', '320');
    return url.toString();
  } catch {
    return null;
  }
}

async function buildZkpassportRequestUrl(
  config: BackendConfig,
  session: ZkpassportSessionResponse
): Promise<string | null> {
  const sdkModuleName = process.env.ZKPASSPORT_SDK_MODULE?.trim() || '@zkpassport/sdk';
  let sdkModule: unknown;
  try {
    sdkModule = await import(sdkModuleName);
  } catch {
    return null;
  }

  const ZKPassport = resolveZkpassportConstructor(sdkModule);
  if (!ZKPassport) return null;

  try {
    const zkPassport = new ZKPassport(resolveZkpassportDomain(config));
    const requestBuilder = await zkPassport.request({
      name: 'SnapFuel',
      logo: buildLogoUrl(config),
      purpose:
        'Verify that you are age 18+ and from EU/USA/Japan to unlock sponsored service access.',
      scope: session.scope,
    });

    const request = requestBuilder
      .gte('age', Number(session.min_age || 18))
      .in('nationality', Array.isArray(session.allowed_country_labels) ? session.allowed_country_labels : [])
      .disclose('nationality')
      .done();

    return typeof request?.url === 'string' && request.url.length > 0 ? request.url : null;
  } catch {
    return null;
  }
}

export function registerStartZkpassportVerificationTool(server: McpServer, config: BackendConfig): void {
  const client = new BackendClient(config);
  const verifier = new TokenVerifier({
    domain: config.auth0Domain,
    audience: config.auth0Audience,
  });

  registerAppTool(
    server,
    'start_zkpassport_verification',
    {
      title: 'Start zkPassport Verification',
      description: 'Create a verification session for age and country proof.',
      inputSchema: startZkpassportVerificationInputSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
      _meta: {
        securitySchemes: config.authEnabled
          ? [{ type: 'oauth2', scopes: ['tasks.write'] }]
          : [{ type: 'noauth' }],
        'openai/toolInvocation/invoking': 'Creating verification session...',
        'openai/toolInvocation/invoked': 'Verification session ready',
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

        const response = await client.initZkpassportVerification(input.campaign_id, {
          campaign_id: input.campaign_id,
          session_token: sessionToken,
          consent: input.consent,
        });

        let zkpassportSession: ZkpassportSessionResponse | null = null;
        let zkpassportRequestUrl: string | null = null;
        try {
          zkpassportSession = await client.getZkpassportSession(response.verification_token);
          if (zkpassportSession?.status === 'pending') {
            zkpassportRequestUrl = await buildZkpassportRequestUrl(config, zkpassportSession);
          }
        } catch {
          // Do not fail session creation if session metadata/challenge URL generation is unavailable.
        }
        const qrImageUrl = buildQrImageUrl(config, zkpassportRequestUrl ?? response.verification_url);

        return {
          structuredContent: {
            verification_id: response.verification_id,
            verification_token: response.verification_token,
            campaign_id: response.campaign_id,
            verification_url: response.verification_url,
            zkpassport_request_url: zkpassportRequestUrl,
            qr_image_url: qrImageUrl,
            zkpassport_install_url: 'https://zkpassport.id/',
            session_status: zkpassportSession?.status ?? null,
            expires_at: response.expires_at,
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
          content: [{ type: 'text' as const, text: 'An unexpected error occurred while starting verification.' }],
          _meta: { code: 'unexpected_error' },
          isError: true,
        };
      }
    }
  );
}
