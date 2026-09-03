import { redirect } from "next/navigation";
import { getPendingOrgNameUserId } from "@/lib/auth/pending-org-name";
import { OrganizationNameForm } from "./organization-name-form";

export default async function OrganizationNamePage() {
  const userId = await getPendingOrgNameUserId();
  if (!userId) redirect("/login");

  return <OrganizationNameForm />;
}
