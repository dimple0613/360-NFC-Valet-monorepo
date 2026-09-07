import { redirect } from "next/navigation";
import { getPendingMfaUserId } from "@/lib/auth/pending-mfa";
import { EnrollMfaForm } from "./enroll-form";

export default async function EnrollMfaPage() {
  const userId = await getPendingMfaUserId();
  if (!userId) redirect("/login");
  return <EnrollMfaForm />;
}