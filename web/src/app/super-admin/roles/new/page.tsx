import { PlusIcon } from "lucide-react";
import { prismaWithoutTenantScoping } from "@saasclaude/db";
import { requirePlatformAccess } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleForm } from "../role-form";

export default async function NewGlobalRolePage() {
  await requirePlatformAccess("core.platform.manage_global_roles");
  const permissionCatalog = await prismaWithoutTenantScoping.permission.findMany({
    where: { scope: "TENANT" },
    orderBy: { key: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<PlusIcon className="size-5" />}
        title="Add role"
        description="Create a global role template that any organization can assign to its members."
      />

      <Card>
        <CardHeader>
          <CardTitle>Role details</CardTitle>
        </CardHeader>
        <CardContent>
          <RoleForm permissionCatalog={permissionCatalog} />
        </CardContent>
      </Card>
    </div>
  );
}
