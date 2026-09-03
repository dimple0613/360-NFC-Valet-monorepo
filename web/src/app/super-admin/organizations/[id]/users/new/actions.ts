"use server";

import { revalidatePath } from "next/cache";
import {
  EmailAlreadyRegisteredError,
  ResourceQuotaExceededError,
  WeakPasswordError,
  assertPasswordStrength,
  assignRoleToUser,
  db,
  prismaWithoutTenantScoping,
  recordResourceUsageEnforced,
  resolveEmailSender,
  runWithTenant,
  signUp,
} from "@saasclaude/db";
import { requirePlatformAccess } from "@/lib/auth/current-user";

const MANAGE_ORGS_PERMISSION = "core.platform.manage_organizations";

export interface CreateMemberFormState {
  error: string | null;
}

/**
 * Super Admin's "Add new User" — adds a founding-member-style user to an
 * EXISTING org (unlike the New customer form's createCustomerAction, which
 * also creates the org itself). Composes the same signUp() as every other
 * account-creation path plus a direct membership/role/seat write, since
 * there's no existing "add a member to an org I don't administer" service —
 * every other membership-creation path in this codebase goes through an
 * invite (organization-invites.ts), which requires the invitee to accept;
 * Super Admin provisioning an account on someone's behalf skips that.
 */
export async function createMemberAction(
  _prevState: CreateMemberFormState,
  formData: FormData,
): Promise<CreateMemberFormState> {
  const organizationId = String(formData.get("organizationId") ?? "");
  try {
    await requirePlatformAccess(MANAGE_ORGS_PERMISSION);
  } catch {
    return { error: "You don't have permission to do that." };
  }

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const roleId = String(formData.get("roleId") ?? "");

  if (!firstName || !lastName || !email || !password || !roleId) {
    return { error: "First/last name, email, password, and role are all required." };
  }
  if (password !== confirmPassword) {
    return { error: "Password and confirm password don't match." };
  }

  try {
    // Fail before creating anything: reject a weak password or a taken email
    // up front, and enforce the org's seat quota the same way the invite path
    // does (organization-invites.ts) — a Super Admin shouldn't be able to push
    // an org past its plan's seat limit silently.
    await assertPasswordStrength(password);
    const existing = await prismaWithoutTenantScoping.user.findUnique({ where: { email } });
    if (existing) throw new EmailAlreadyRegisteredError(email);
    await recordResourceUsageEnforced({ organizationId, resourceTypeKey: "core.seats", amount: 1 });

    const { userId } = await signUp({ email, password, name: `${firstName} ${lastName}` }, await resolveEmailSender());

    await runWithTenant(organizationId, async () => {
      await db.organizationMembership.create({ data: { organizationId, userId, status: "ACTIVE" } });
    });
    await assignRoleToUser(organizationId, roleId, userId);
  } catch (error) {
    if (
      error instanceof EmailAlreadyRegisteredError ||
      error instanceof WeakPasswordError ||
      error instanceof ResourceQuotaExceededError
    ) {
      return { error: error.message };
    }
    console.error(error);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath(`/super-admin/organizations/${organizationId}`);
  return { error: null };
}
