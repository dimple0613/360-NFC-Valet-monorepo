import { redirect } from "next/navigation";
import { getPendingMfaUserId } from "@/lib/auth/pending-mfa";
import { MfaForm } from "./mfa-form";

export default async function MfaChallengePage() {
  const userId = await getPendingMfaUserId();
  if (!userId) redirect("/login");
  return <MfaForm />;
}
