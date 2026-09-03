import { notFound } from "next/navigation";
import { PencilIcon } from "lucide-react";
import { getGlobalRoleWithPermissions, prismaWithoutTenantScoping, RoleNotFoundError } from "@saasclaude/db";
import { requirePlatformAccess } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleForm } from "../../role-form";
import { DeleteRoleButton } from "./delete-role-button";

export default async function EditGlobalRolePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAccess("core.platform.manage_global_roles");
  const { id } = await params;

  const [role, permissionCatalog] = await Promise.all([
    getGlobalRoleWithPermissions(id).catch((error) => {
      if (error instanceof RoleNotFoundError) return null;
      throw error;
    }),
    prismaWithoutTenantScoping.permission.findMany({ where: { scope: "TENANT" }, orderBy: { key: "asc" } }),
  ]);
  if (!role) notFound();

  const permissionIdByKey = new Map(permissionCatalog.map((p) => [p.key, p.id]));
  const grantedPermissionIds = new Set(
    role.permissionKeys.map((key) => permissionIdByKey.get(key)).filter((id): id is string => id !== undefined),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<PencilIcon className="size-5" />}
        title={role.name}
        description="Edit this global role's details and permissions. Changes apply live to all assigned members."
        actions={<DeleteRoleButton roleId={role.id} roleName={role.name} />}
      />

      <Card>
        <CardHeader>
          <CardTitle>Role details</CardTitle>
        </CardHeader>
        <CardContent>
          <RoleForm
            roleId={role.id}
            defaults={{ name: role.name, description: role.description ?? "", grantedPermissionIds }}
            permissionCatalog={permissionCatalog}
          />
        </CardContent>
      </Card>
    </div>
  );
}
