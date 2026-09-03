"use server";

import { revalidatePath } from "next/cache";
import { EmailAlreadyRegisteredError, WeakPasswordError, resolveEmailSender, signUp } from "@saasclaude/db";
import { createOrganizationForExistingUser } from "@/lib/auth/signup-flow";
import { requirePlatformAccess } from "@/lib/auth/current-user";

const MANAGE_ORGS_PERMISSION = "core.platform.manage_organizations";
const FOUNDER_ROLE_NAMES = ["Owner", "Admin", "Member", "Viewer"] as const;

export interface CreateCustomerFormState {
  error: string | null;
  success: boolean;
  organizationId?: string;
}

/**
 * Super Admin's "New customer" form — creates an organization AND its
 * founding member's login in one step. Deliberately does NOT sign the Super
 * Admin into the new account (unlike self-serve signupAction, which does):
 * this is a different actor creating an account on someone else's behalf, so
 * the admin's own session must be untouched. Reuses signUp (packages/db) and
 * createOrganizationForExistingUser (the same composition self-serve signup
 * uses) rather than duplicating that org+membership+role+seat logic.
 */
export async function createCustomerAction(
  _prevState: CreateCustomerFormState,
  formData: FormData,
): Promise<CreateCustomerFormState> {
  try {
    await requirePlatformAccess(MANAGE_ORGS_PERMISSION);
  } catch {
    return { error: "You don't have permission to do that.", success: false };
  }

  const organizationName = String(formData.get("organizationName") ?? "").trim();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const founderRoleNameRaw = String(formData.get("founderRoleName") ?? "Owner");
  const founderRoleName = FOUNDER_ROLE_NAMES.includes(founderRoleNameRaw as (typeof FOUNDER_ROLE_NAMES)[number])
    ? (founderRoleNameRaw as (typeof FOUNDER_ROLE_NAMES)[number])
    : "Owner";

  if (!organizationName || !firstName || !lastName || !email || !password) {
    return { error: "Customer name, first/last name, email, and password are all required.", success: false };
  }
  if (password !== confirmPassword) {
    return { error: "Password and confirm password don't match.", success: false };
  }

  let organizationId: string;
  try {
    const { userId } = await signUp(
      { email, password, name: `${firstName} ${lastName}` },
      await resolveEmailSender(),
    );
    ({ organizationId } = await createOrganizationForExistingUser(userId, organizationName, founderRoleName));
  } catch (error) {
    if (error instanceof EmailAlreadyRegisteredError || error instanceof WeakPasswordError) {
      return { error: error.message, success: false };
    }
    console.error(error);
    return { error: "Something went wrong. Please try again.", success: false };
  }

  revalidatePath("/super-admin/organizations");
  return { error: null, success: true, organizationId };
}
