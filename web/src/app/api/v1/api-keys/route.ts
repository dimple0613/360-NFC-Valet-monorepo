import { NextResponse } from "next/server";
import { apiKeyHasScope, createApiKey, listApiKeys } from "@saasclaude/db";
import { requireApiScope, withApiTenantContext } from "@/lib/tenant/api";

export const GET = withApiTenantContext(async (_req, _ctx, apiKey) => {
  const denied = requireApiScope(apiKey, "core.api_keys.manage");
  if (denied) return denied;

  const keys = await listApiKeys(apiKey.organizationId);
  return NextResponse.json({ apiKeys: keys });
});

/** Body: { name: string, scopes: string[], expiresAt?: string }. */
export const POST = withApiTenantContext(async (req, _ctx, apiKey) => {
  const denied = requireApiScope(apiKey, "core.api_keys.manage");
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;
  const scopes: unknown = body?.scopes;
  if (!name || !Array.isArray(scopes) || scopes.length === 0 || !scopes.every((s) => typeof s === "string")) {
    return NextResponse.json({ error: "'name' (string) and 'scopes' (non-empty string array) are required." }, { status: 400 });
  }

  // Self-escalation guard: a key may only mint a new key whose scopes are a
  // subset of its own — otherwise a leaked key with just core.api_keys.manage
  // could mint itself a broader-scoped replacement. List/revoke don't need
  // this (not privilege-escalating), only creation does.
  const excessScopes = scopes.filter((s) => !apiKeyHasScope(apiKey, s));
  if (excessScopes.length > 0) {
    return NextResponse.json(
      { error: `Cannot grant scopes the requesting key doesn't itself have: ${excessScopes.join(", ")}` },
      { status: 403 },
    );
  }

  let expiresAt: Date | undefined;
  if (body?.expiresAt !== undefined) {
    const parsed = new Date(body.expiresAt);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "'expiresAt' must be a valid date string." }, { status: 400 });
    }
    expiresAt = parsed;
  }

  const { rawKey, apiKey: created } = await createApiKey({
    organizationId: apiKey.organizationId,
    name,
    scopes,
    expiresAt,
  });
  return NextResponse.json(
    {
      id: created.id,
      name: created.name,
      keyPrefix: created.keyPrefix,
      scopes: created.scopes,
      expiresAt: created.expiresAt,
      createdAt: created.createdAt,
      // Shown exactly once — the same rule as the Tenant Admin UI's key creation.
      rawKey,
    },
    { status: 201 },
  );
});
