import { notFound } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { listRolesVisibleToOrganization, prismaWithoutTenantScoping } from "@saasclaude/db";
import { requirePlatformAccess } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { NewMemberForm } from "./new-member-form";

export default async function NewMemberPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAccess("core.platform.manage_organizations");
  const { id } = await params;
  const organization = await prismaWithoutTenantScoping.organization.findUnique({ where: { id } });
  if (!organization) notFound();

  const roles = await listRolesVisibleToOrganization(id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<PlusIcon className="size-5" />}
        title="Add user"
        description={`A new member account for ${organization.name}.`}
      />

      <NewMemberForm
        organizationId={id}
        roles={roles.map((r) => ({ id: r.id, name: r.scope === "GLOBAL" ? `${r.name} (Global)` : r.name }))}
      />
    </div>
  );
}
