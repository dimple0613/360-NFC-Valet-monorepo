import { prismaWithoutTenantScoping } from "@saasclaude/db";
import { requireIdentity } from "@/lib/auth/current-user";
import { BuildingIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { ProfileForm } from "./profile-form";

export default async function GeneralSettingsPage() {
  const identity = await requireIdentity();
  const organizationId = identity.session.organizationId!;

  const organization = await prismaWithoutTenantScoping.organization.findUniqueOrThrow({
    where: { id: organizationId },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<BuildingIcon className="size-5" />}
        title="General settings"
        description="Your organization's identity and primary profile details."
      />
      <Card>
        <CardHeader>
          <CardTitle>Organization profile</CardTitle>
          <CardDescription>Identifier: {organization.slug}</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm currentName={organization.name} />
        </CardContent>
      </Card>
    </div>
  );
}