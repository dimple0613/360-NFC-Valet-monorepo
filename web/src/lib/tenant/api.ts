import { NextRequest, NextResponse } from "next/server";
import {
  apiKeyHasScope,
  enforceRateLimit,
  InvalidApiKeyError,
  RateLimitExceededError,
  runWithTenant,
  verifyApiKey,
  type ResolvedApiKey,
} from "@saasclaude/db";
import { extractBearerToken } from "./resolve-tenant";

const API_KEY_RATE_LIMIT = { limit: 100, windowSeconds: 60 };

/**
 * Wraps a versioned REST API route handler (app/api/**\/route.ts) so it runs
 * with the requesting organization as the active tenant for every DB call it
 * makes (FR-103), authenticated by a real API key (FR-322) rather than a
 * trusted header — replaces the Phase 1A placeholder that took
 * X-Organization-Id at face value with no verification. Missing/invalid
 * credentials are 401; FR-104's 404-not-403 rule is about a *resolved*
 * tenant reaching for another org's resource, which is enforced
 * independently by the scoping layer in packages/db, not here.
 */
export function withApiTenantContext<Ctx = unknown>(
  handler: (req: NextRequest, ctx: Ctx, apiKey: ResolvedApiKey) => Promise<Response>,
) {
  return async (req: NextRequest, ctx: Ctx): Promise<Response> => {
    const rawKey = extractBearerToken(req.headers);
    if (!rawKey) {
      return NextResponse.json({ error: "Missing Authorization: Bearer <api key> header" }, { status: 401 });
    }

    let apiKey: ResolvedApiKey;
    try {
      apiKey = await verifyApiKey(rawKey);
    } catch (error) {
      if (error instanceof InvalidApiKeyError) return NextResponse.json({ error: error.message }, { status: 401 });
      throw error;
    }

    try {
      // FR-322 "per-key rate limits" — same Redis-backed primitive as the auth-endpoint throttling.
      await enforceRateLimit(`apikey:${apiKey.id}`, API_KEY_RATE_LIMIT);
    } catch (error) {
      if (error instanceof RateLimitExceededError) {
        return NextResponse.json({ error: error.message }, { status: 429 });
      }
      throw error;
    }

    return runWithTenant(apiKey.organizationId, async () => handler(req, ctx, apiKey));
  };
}

/** Returns a 403 Response if the key lacks the scope, or null if the caller should proceed. */
export function requireApiScope(apiKey: ResolvedApiKey, scopeKey: string): Response | null {
  if (apiKeyHasScope(apiKey, scopeKey)) return null;
  return NextResponse.json({ error: `Missing required scope: ${scopeKey}` }, { status: 403 });
}
