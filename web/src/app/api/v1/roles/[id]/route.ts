import { NextResponse } from "next/server";
import { db, deleteRole, getRoleWithPermissions, RoleNotFoundError, setRolePermissions } from "@saasclaude/db";
import { requireApiScope, withApiTenantContext } from "@/lib/tenant/api";

type RouteContext = { params: Promise<{ id: string }> };

function serializeRole(role: { id: string; name: string; slug: string; createdAt: Date; permissionKeys: string[] }) {
  return { id: role.id, name: role.name, slug: role.slug, createdAt: role.createdAt, permissionKeys: role.permissionKeys };
}

export const GET = withApiTenantContext<RouteContext>(async (_req, ctx, apiKey) => {
  const denied = requireApiScope(apiKey, "core.roles.manage");
  if (denied) return denied;

  const { id } = await ctx.params;
  try {
    const role = await getRoleWithPermissions(apiKey.organizationId, id);
    return NextResponse.json(serializeRole(role));
  } catch (error) {
    if (error instanceof RoleNotFoundError) return NextResponse.json({ error: "No role with that id." }, { status: 404 });
    throw error;
  }
});

/** Body: { permissionKeys: string[] } — a permission KEY list (e.g. "core.roles.manage"), not raw Permission ids, since a key is what an API client actually knows. */
export const PATCH = withApiTenantContext<RouteContext>(async (req, ctx, apiKey) => {
  const denied = requireApiScope(apiKey, "core.roles.manage");
  if (denied) return denied;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const permissionKeys: unknown = body?.permissionKeys;
  if (!Array.isArray(permissionKeys) || !permissionKeys.every((k) => typeof k === "string")) {
    return NextResponse.json({ error: "'permissionKeys' must be an array of strings." }, { status: 400 });
  }

  try {
    const permissions = await db.permission.findMany({ where: { key: { in: permissionKeys } } });
    const foundKeys = new Set(permissions.map((p) => p.key));
    const unknownKeys = permissionKeys.filter((k) => !foundKeys.has(k));
    if (unknownKeys.length > 0) {
      return NextResponse.json({ error: `Unknown permission keys: ${unknownKeys.join(", ")}` }, { status: 400 });
    }
    await setRolePermissions(
      apiKey.organizationId,
      id,
      permissions.map((p) => p.id),
    );
    const role = await getRoleWithPermissions(apiKey.organizationId, id);
    return NextResponse.json(serializeRole(role));
  } catch (error) {
    if (error instanceof RoleNotFoundError) return NextResponse.json({ error: "No role with that id." }, { status: 404 });
    throw error;
  }
});

export const DELETE = withApiTenantContext<RouteContext>(async (_req, ctx, apiKey) => {
  const denied = requireApiScope(apiKey, "core.roles.manage");
  if (denied) return denied;

  const { id } = await ctx.params;
  try {
    await deleteRole(apiKey.organizationId, id);
  } catch (error) {
    if (error instanceof RoleNotFoundError) return NextResponse.json({ error: "No role with that id." }, { status: 404 });
    throw error;
  }
  return new NextResponse(null, { status: 204 });
});
