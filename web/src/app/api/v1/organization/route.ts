import { NextResponse } from "next/server";
import { db, prismaWithoutTenantScoping } from "@saasclaude/db";
import { requireApiScope, withApiTenantContext } from "@/lib/tenant/api";

function serializeOrganization(organization: { id: string; name: string; slug: string; status: string; createdAt: Date }) {
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    status: organization.status,
    createdAt: organization.createdAt,
  };
}

export const GET = withApiTenantContext(async (_req, _ctx, apiKey) => {
  const denied = requireApiScope(apiKey, "core.organization.read");
  if (denied) return denied;

  const organization = await db.organization.findUniqueOrThrow({ where: { id: apiKey.organizationId } });
  return NextResponse.json(serializeOrganization(organization));
});

export const PATCH = withApiTenantContext(async (req, _ctx, apiKey) => {
  const denied = requireApiScope(apiKey, "core.organization.manage_profile");
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;
  if (!name) {
    return NextResponse.json({ error: "'name' is required and must be a non-empty string." }, { status: 400 });
  }

  // Organization itself isn't tenant-scoped (it IS the tenant) — same pattern
  // as the Tenant Admin UI's updateProfileAction (settings/general/actions.ts).
  const organization = await prismaWithoutTenantScoping.organization.update({
    where: { id: apiKey.organizationId },
    data: { name },
  });
  return NextResponse.json(serializeOrganization(organization));
});
