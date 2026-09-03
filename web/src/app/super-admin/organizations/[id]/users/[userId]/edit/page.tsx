import { notFound } from "next/navigation";
import { PencilIcon } from "lucide-react";
import { db, listRolesVisibleToOrganization, prismaWithoutTenantScoping, runWithTenant } from "@saasclaude/db";
import { requirePlatformAccess } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { EditMemberForm } from "./edit-member-form";

export default async function EditMemberPage({ params }: { params: Promise<{ id: string; userId: string }> }) {
  await requirePlatformAccess("core.platform.manage_organizations");
  const { id, userId } = await params;

  const [organization, user, roles, currentUserRole] = await Promise.all([
    prismaWithoutTenantScoping.organization.findUnique({ where: { id } }),
    prismaWithoutTenantScoping.user.findUnique({ where: { id: userId } }),
    listRolesVisibleToOrganization(id),
    runWithTenant(id, async () => db.userRole.findFirst({ where: { userId } })),
  ]);
  if (!organization || !user) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<PencilIcon className="size-5" />}
        title={user.name ?? user.email}
        description={`Member of ${organization.name}.`}
      />

      <EditMemberForm
        organizationId={id}
        userId={userId}
        currentName={user.name ?? user.email}
        currentRoleId={currentUserRole?.roleId}
        roles={roles.map((r) => ({ id: r.id, name: r.scope === "GLOBAL" ? `${r.name} (Global)` : r.name }))}
      />
    </div>
  );
}
