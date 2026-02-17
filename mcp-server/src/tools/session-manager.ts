import { createHash, randomUUID } from 'node:crypto';

import { BackendClient } from '../backend-client.ts';
import type { BackendConfig } from '../config.ts';

type SessionLikeInput = {
  session_token?: string;
  email?: string;
  region?: string;
  roles?: string[];
  tools_used?: string[];
};

type SessionRecord = {
  sessionToken: string;
  email: string;
  updatedAt: number;
};

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const sessionCache = new Map<string, SessionRecord>();

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function cleanupExpiredSessions(now: number): void {
  for (const [key, record] of sessionCache.entries()) {
    if (now - record.updatedAt > SESSION_TTL_MS) {
      sessionCache.delete(key);
    }
  }
}

function contextHeader(context: any, key: string): string | null {
  const direct = asString(context?.headers?.[key]) ?? asString(context?._meta?.headers?.[key]);
  if (direct) return direct;

  const lower = key.toLowerCase();
  return asString(context?.headers?.[lower]) ?? asString(context?._meta?.headers?.[lower]);
}

function resolveSessionKey(context: any): string | null {
  const candidates: Array<string | null> = [
    asString(context?._meta?.openai?.user_id),
    asString(context?._meta?.openai?.conversation_id),
    asString(context?._meta?.conversation_id),
    asString(context?._meta?.session_id),
    asString(context?.sessionId),
    asString(context?.auth?.sub),
    asString(context?.auth?.email),
    asString(context?._meta?.auth?.email),
    contextHeader(context, 'x-openai-user-id'),
    contextHeader(context, 'x-openai-conversation-id'),
  ];

  for (const candidate of candidates) {
    if (candidate) return `ctx:${candidate}`;
  }

  return null;
}

function syntheticEmailForKey(sessionKey: string): string {
  const hash = createHash('sha256').update(sessionKey).digest('hex').slice(0, 16);
  return `mcp-user-${hash}@noauth.local`;
}

function resolveEmail(input: SessionLikeInput, context: any, sessionKey: string | null): string {
  const directEmail = asString(input?.email) ?? asString(context?.auth?.email) ?? asString(context?._meta?.auth?.email);
  if (directEmail) return directEmail;
  if (sessionKey) return syntheticEmailForKey(sessionKey);
  return `mcp-guest-${randomUUID()}@noauth.local`;
}

export function rememberSessionToken(context: any, sessionToken: string, email: string): void {
  const now = Date.now();
  cleanupExpiredSessions(now);

  const key = resolveSessionKey(context);
  const normalizedEmail = email.trim().toLowerCase();
  const record: SessionRecord = {
    sessionToken,
    email: normalizedEmail,
    updatedAt: now,
  };

  if (key) {
    sessionCache.set(key, record);
  }
  if (normalizedEmail) {
    sessionCache.set(`email:${normalizedEmail}`, record);
  }
}

export function resolveSessionToken(input: SessionLikeInput, context: any): string | null {
  const explicit =
    asString(context?._meta?.session_token) ?? asString(context?.session_token) ?? asString(input?.session_token);
  if (explicit) return explicit;

  const now = Date.now();
  cleanupExpiredSessions(now);

  const key = resolveSessionKey(context);
  if (key) {
    const byContext = sessionCache.get(key);
    if (byContext) {
      byContext.updatedAt = now;
      return byContext.sessionToken;
    }
  }

  const email = asString(input?.email) ?? asString(context?.auth?.email) ?? asString(context?._meta?.auth?.email);
  if (email) {
    const byEmail = sessionCache.get(`email:${email.toLowerCase()}`);
    if (byEmail) {
      byEmail.updatedAt = now;
      return byEmail.sessionToken;
    }
  }

  return null;
}

export async function resolveOrCreateNoAuthSessionToken(
  client: BackendClient,
  config: BackendConfig,
  input: SessionLikeInput,
  context: any
): Promise<string | null> {
  const existing = resolveSessionToken(input, context);
  if (existing) return existing;

  if (config.authEnabled) return null;

  const sessionKey = resolveSessionKey(context);
  const email = resolveEmail(input, context, sessionKey);
  const region = asString(input?.region) ?? 'auto';
  const roles = asStringArray(input?.roles);
  const toolsUsed = asStringArray(input?.tools_used);

  const authResponse = await client.authenticateUser({
    email,
    region,
    roles,
    tools_used: toolsUsed,
  });

  rememberSessionToken(context, authResponse.session_token, authResponse.email);
  return authResponse.session_token;
}
