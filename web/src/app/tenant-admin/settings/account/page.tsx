import { UserIcon } from "lucide-react";
import { prismaWithoutTenantScoping } from "@saasclaude/db";
import { requireIdentity } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { AccountForm } from "./account-form";

export default async function AccountPage() {
  const identity = await requireIdentity();
  const user = await prismaWithoutTenantScoping.user.findUniqueOrThrow({ where: { id: identity.user.id } });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<UserIcon className="size-5" />}
        title="Account"
        description="Your own profile — not the organization&apos;s."
      />
      <div className="rounded-xl border border-[#e7eaf0] bg-white p-6 shadow-[0_20px_50px_rgba(16,22,35,0.06)]">
        <AccountForm currentName={user.name} email={user.email} />
      </div>
    </div>
  );
}
