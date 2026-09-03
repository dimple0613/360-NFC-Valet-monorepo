"use server";

import { redirect } from "next/navigation";
import {
  acceptOrganizationInvite,
  createSession,
  InvalidOrExpiredInviteError,
  ResourceQuotaExceededError,
  WeakPasswordError,
} from "@saasclaude/db";
import { setSessionCookie } from "@/lib/auth/session";

export interface AcceptInviteFormState {
  error: string | null;
}

export async function acceptInviteAction(
  _prevState: AcceptInviteFormState,
  formData: FormData,
): Promise<AcceptInviteFormState> {
  const token = String(formData.get("token") ?? "");
  const name = String(formData.get("name") ?? "").trim() || undefined;
  const password = String(formData.get("password") ?? "");

  if (!token) return { error: "Missing invite token." };
  if (!password) return { error: "Choose a password to finish joining." };

  let organizationId: string;
  let userId: string;
  try {
    const result = await acceptOrganizationInvite({ rawToken: token, name, password });
    organizationId = result.organizationId;
    userId = result.userId;
  } catch (error) {
    if (error instanceof InvalidOrExpiredInviteError || error instanceof WeakPasswordError) {
      return { error: error.message };
    }
    if (error instanceof ResourceQuotaExceededError) {
      return { error: "This organization has reached its member limit on its current plan." };
    }
    console.error(error);
    return { error: "Something went wrong. Please try again." };
  }

  const { rawToken: sessionToken } = await createSession({ userId, organizationId });
  await setSessionCookie(sessionToken);
  redirect("/");
}
