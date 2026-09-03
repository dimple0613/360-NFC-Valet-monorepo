"use server";

import { redirect } from "next/navigation";
import { createSession } from "@saasclaude/db";
import { createOrganizationForExistingUser } from "@/lib/auth/signup-flow";
import { setSessionCookie } from "@/lib/auth/session";
import { clearPendingOrgNameCookie, getPendingOrgNameUserId } from "@/lib/auth/pending-org-name";

export interface OrganizationNameFormState {
  error: string | null;
}

export async function nameOrganizationAction(
  _prevState: OrganizationNameFormState,
  formData: FormData,
): Promise<OrganizationNameFormState> {
  const userId = await getPendingOrgNameUserId();
  if (!userId) return { error: "Your sign-in attempt expired. Please sign in again." };

  const organizationName = String(formData.get("organizationName") ?? "").trim();
  if (!organizationName) return { error: "Organization name is required." };

  const { organizationId } = await createOrganizationForExistingUser(userId, organizationName);

  await clearPendingOrgNameCookie();
  const { rawToken } = await createSession({ userId, organizationId });
  await setSessionCookie(rawToken);
  redirect("/");
}
