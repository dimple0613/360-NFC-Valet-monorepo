import { NextResponse } from "next/server";
import { listOrganizationSettings, setOrganizationSetting } from "@saasclaude/db";
import { requireApiScope, withApiTenantContext } from "@/lib/tenant/api";

type RouteContext = { params: Promise<{ key: string }> };

export const GET = withApiTenantContext<RouteContext>(async (_req, ctx, apiKey) => {
  const denied = requireApiScope(apiKey, "core.settings.read");
  if (denied) return denied;

  const { key } = await ctx.params;
  // Uses the same redacted summary as GET /settings — a sensitive setting's
  // plaintext isn't handed back out to a generic API key just because it
  // asked for one key instead of the whole list (see listOrganizationSettings'
  // own doc comment on why encryption-at-rest would be pointless otherwise).
  const settings = await listOrganizationSettings(apiKey.organizationId);
  const setting = settings.find((s) => s.key === key);
  if (!setting) {
    return NextResponse.json({ error: `No setting with key '${key}'.` }, { status: 404 });
  }
  return NextResponse.json(setting);
});

/** Body: { category: string, value: unknown, isSensitive?: boolean } — upserts, same semantics as the Tenant Admin UI's setting writes. */
export const PUT = withApiTenantContext<RouteContext>(async (req, ctx, apiKey) => {
  const denied = requireApiScope(apiKey, "core.settings.manage");
  if (denied) return denied;

  const { key } = await ctx.params;
  const body = await req.json().catch(() => null);
  const category = typeof body?.category === "string" ? body.category.trim() : undefined;
  if (!category || !("value" in (body ?? {}))) {
    return NextResponse.json({ error: "'category' (string) and 'value' are required." }, { status: 400 });
  }
  const isSensitive = typeof body?.isSensitive === "boolean" ? body.isSensitive : undefined;

  await setOrganizationSetting(apiKey.organizationId, { category, key, value: body.value, isSensitive });
  // Echo back what was just submitted rather than re-reading — the caller
  // already knows their own plaintext; no need to round-trip through
  // decryption (or redaction) for a value they just supplied themselves.
  return NextResponse.json({ category, key, value: body.value, isSensitive: Boolean(isSensitive) });
});
