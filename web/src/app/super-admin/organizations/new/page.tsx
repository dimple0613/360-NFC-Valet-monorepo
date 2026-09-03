import { PlusIcon } from "lucide-react";
import { requirePlatformAccess } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { NewCustomerForm } from "./new-customer-form";

export default async function NewCustomerPage() {
  await requirePlatformAccess("core.platform.manage_organizations");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<PlusIcon className="size-5" />}
        title="New customer"
        description="Create an organization that owns its own tenant workspace, users, and subscription."
      />

      <NewCustomerForm />
    </div>
  );
}
