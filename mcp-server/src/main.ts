import cors from 'cors';
import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import {
  oauthAuthorizationServerRedirectHandler,
  oauthProtectedResourceHandler,
} from './auth/oauth-metadata.ts';
import { loadConfig } from './config.ts';
import { loadEnvFromFiles } from './env.ts';
import { logger } from './logger.ts';
import { createServer } from './server.ts';

const ALLOWED_ORIGINS = [
  'https://chatgpt.com',
  'https://chat.openai.com',
  'https://cdn.oaistatic.com',
  'https://web-sandbox.oaiusercontent.com',
];

type ZkpassportVerifyRequestBody = {
  proofs: unknown;
  query_result?: unknown;
};

type ZkpassportVerifyResult = {
  verified?: boolean;
  uniqueIdentifier?: string;
  queryResult?: unknown;
  queryResultErrors?: unknown;
  message?: string;
};

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

function resolveVerifierDomain(publicUrl: string): string {
  const envDomain = process.env.ZKPASSPORT_DOMAIN?.trim();
  if (envDomain && envDomain.length > 0) {
    return envDomain;
  }
  try {
    return new URL(publicUrl).hostname;
  } catch {
    return 'localhost';
  }
}

export function createApp() {
  loadEnvFromFiles();
  const config = loadConfig();
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.use(
    cors({
      origin: ALLOWED_ORIGINS,
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      // Streamable HTTP MCP clients send protocol/session headers after initialize.
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Mcp-Session-Id',
        'MCP-Session-Id',
        'Mcp-Protocol-Version',
        'MCP-Protocol-Version',
        'Last-Event-ID',
      ],
      exposedHeaders: ['Mcp-Session-Id', 'MCP-Session-Id', 'Mcp-Protocol-Version', 'MCP-Protocol-Version'],
    })
  );

  const healthHandler = (_req: express.Request, res: express.Response) => {
    res.json({
      status: 'ok',
      version: process.env.npm_package_version ?? '0.1.0',
      uptime: process.uptime(),
    });
  };

  app.get('/', healthHandler);
  app.get('/health', healthHandler);

  app.get('/.well-known/oauth-protected-resource', oauthProtectedResourceHandler(config));
  app.get('/.well-known/oauth-authorization-server', oauthAuthorizationServerRedirectHandler(config));

  app.get('/internal/qr', async (req, res) => {
    try {
      const rawData = typeof req.query.data === 'string' ? req.query.data : '';
      if (!rawData) {
        return res.status(400).json({
          error: {
            code: 'qr_invalid_request',
            message: 'Missing "data" query parameter.',
          },
        });
      }

      const rawSize = typeof req.query.size === 'string' ? Number.parseInt(req.query.size, 10) : 320;
      const size = Number.isFinite(rawSize) ? Math.min(600, Math.max(120, rawSize)) : 320;
      const upstreamUrl = new URL('https://api.qrserver.com/v1/create-qr-code/');
      upstreamUrl.searchParams.set('size', `${size}x${size}`);
      upstreamUrl.searchParams.set('data', rawData);

      const upstream = await fetch(upstreamUrl, { method: 'GET' });
      if (!upstream.ok) {
        return res.status(502).json({
          error: {
            code: 'qr_upstream_error',
            message: `QR provider request failed (${upstream.status}).`,
          },
        });
      }

      const contentType = upstream.headers.get('content-type') || 'image/png';
      const cacheControl = upstream.headers.get('cache-control') || 'public, max-age=300';
      const body = Buffer.from(await upstream.arrayBuffer());
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', cacheControl);
      return res.status(200).send(body);
    } catch (error) {
      logger.error({ err: error }, 'qr proxy route failed');
      return res.status(500).json({
        error: {
          code: 'qr_proxy_failed',
          message: 'Unexpected error while generating QR image.',
        },
      });
    }
  });

  const zkpassportVerifyHandler: express.RequestHandler = async (req, res) => {
    try {
      const expectedKey = process.env.ZKPASSPORT_VERIFIER_API_KEY?.trim() ?? '';
      if (expectedKey.length > 0) {
        const providedKey = req.header('x-zkpassport-verifier-key') ?? '';
        if (providedKey !== expectedKey) {
          return res.status(401).json({
            error: {
              code: 'zkpassport_unauthorized',
              message: 'Missing or invalid verifier API key.',
            },
          });
        }
      }

      const body = (req.body ?? {}) as Partial<ZkpassportVerifyRequestBody>;
      if (!('proofs' in body)) {
        return res.status(400).json({
          error: {
            code: 'zkpassport_invalid_request',
            message: 'Field "proofs" is required.',
          },
        });
      }

      const sdkModuleName = process.env.ZKPASSPORT_SDK_MODULE?.trim() || '@zkpassport/sdk';
      let sdkModule: unknown;
      try {
        sdkModule = await import(sdkModuleName);
      } catch (error) {
        logger.error({ err: error, sdkModuleName }, 'failed to import zkPassport SDK');
        return res.status(500).json({
          error: {
            code: 'zkpassport_sdk_unavailable',
            message:
              'zkPassport SDK is unavailable. Install @zkpassport/sdk or set ZKPASSPORT_SDK_MODULE.',
          },
        });
      }

      const ZKPassport = resolveZkpassportConstructor(sdkModule);
      if (!ZKPassport) {
        return res.status(500).json({
          error: {
            code: 'zkpassport_sdk_invalid',
            message: 'Could not resolve ZKPassport constructor from SDK module.',
          },
        });
      }

      const verifierDomain = resolveVerifierDomain(config.publicUrl);
      const zkPassport = new ZKPassport(verifierDomain);
      const result = (await zkPassport.verify({
        proofs: body.proofs,
        queryResult: body.query_result,
      })) as ZkpassportVerifyResult;

      const verified = Boolean(result?.verified);
      const uniqueIdentifier =
        typeof result?.uniqueIdentifier === 'string' && result.uniqueIdentifier.length > 0
          ? result.uniqueIdentifier
          : null;
      const queryResult = (result?.queryResult ?? body.query_result ?? null) as unknown;
      const queryResultErrors = Array.isArray(result?.queryResultErrors) ? result.queryResultErrors : [];
      const message =
        typeof result?.message === 'string' && result.message.length > 0
          ? result.message
          : verified
            ? 'zkPassport proof verified.'
            : 'zkPassport proof did not verify.';

      return res.status(200).json({
        verified,
        unique_identifier: uniqueIdentifier,
        query_result: queryResult,
        query_result_errors: queryResultErrors,
        message,
      });
    } catch (error) {
      logger.error({ err: error }, 'zkPassport verifier route failed');
      return res.status(500).json({
        error: {
          code: 'zkpassport_verify_failed',
          message: 'Unexpected error while verifying zkPassport proof.',
        },
      });
    }
  };

  app.post('/internal/zkpassport/verify', zkpassportVerifyHandler);

  const mcpHandler: express.RequestHandler = async (req, res) => {
    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      const server = createServer(config);

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error({ err: error }, 'failed to handle /mcp request');
      res.status(500).json({
        error: {
          code: 'mcp_internal_error',
          message: 'Failed to handle MCP request',
        },
      });
    }
  };

  app.get('/mcp', mcpHandler);
  app.post('/mcp', mcpHandler);
  app.delete('/mcp', mcpHandler);

  return { app, config };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { app, config } = createApp();
  app.listen(config.port, () => {
    logger.info({ port: config.port }, 'MCP server started');
    logger.info(
      { authEnabled: config.authEnabled },
      config.authEnabled
        ? 'OAuth authentication is ENABLED (Auth0)'
        : 'OAuth authentication is DISABLED (MVP mode)',
    );
  });
}
