import { NextResponse } from "next/server";
import { createRole, listRolesPage } from "@saasclaude/db";
import { requireApiScope, withApiTenantContext } from "@/lib/tenant/api";
import { parsePageParams } from "@/lib/tenant/pagination";

export const GET = withApiTenantContext(async (req, _ctx, apiKey) => {
  const denied = requireApiScope(apiKey, "core.roles.manage");
  if (denied) return denied;

  const { items, nextCursor } = await listRolesPage(apiKey.organizationId, parsePageParams(req));
  return NextResponse.json({
    roles: items.map((r) => ({ id: r.id, name: r.name, slug: r.slug, createdAt: r.createdAt })),
    nextCursor,
  });
});

export const POST = withApiTenantContext(async (req, _ctx, apiKey) => {
  const denied = requireApiScope(apiKey, "core.roles.manage");
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;
  if (!name) {
    return NextResponse.json({ error: "'name' is required and must be a non-empty string." }, { status: 400 });
  }

  const role = await createRole(apiKey.organizationId, name);
  return NextResponse.json({ id: role.id, name: role.name, slug: role.slug, createdAt: role.createdAt }, { status: 201 });
});
