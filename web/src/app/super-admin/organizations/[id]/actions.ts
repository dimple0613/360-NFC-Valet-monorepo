"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  archiveOrganization,
  cancelScheduledDeletion,
  prismaWithoutTenantScoping,
  reactivateOrganization,
  removeOrganizationMember,
  scheduleOrganizationDeletion,
  startImpersonation,
  suspendOrganization,
} from "@saasclaude/db";
import { requirePlatformAccess } from "@/lib/auth/current-user";
import { rememberSessionForImpersonation, setSessionCookie } from "@/lib/auth/session";
import { clearWsTokenCookie, setWsTokenCookie } from "@/lib/auth/ws-token";

const MANAGE_ORGS_PERMISSION = "core.platform.manage_organizations";
const IMPERSONATE_PERMISSION = "core.platform.impersonate_organization_admin";

export interface UpdateOrganizationFormState {
  error: string | null;
  success: boolean;
}

/**
 * Super Admin's counterpart to Tenant Admin's own updateProfileAction
 * (general/actions.ts) — same direct prismaWithoutTenantScoping.organization.update,
 * gated on manage_organizations instead of the org's own manage_profile since
 * this edits ANY org. organizationId travels as a hidden form field (not a
 * bound first arg) — same convention as ProviderConfigForm's adapterId, since
 * useActionState's action signature is fixed to (state, formData).
 */
export async function updateOrganizationProfileAction(
  _prevState: UpdateOrganizationFormState,
  formData: FormData,
): Promise<UpdateOrganizationFormState> {
  const organizationId = String(formData.get("organizationId") ?? "");
  try {
    await requirePlatformAccess(MANAGE_ORGS_PERMISSION);
  } catch {
    return { error: "You don't have permission to do that.", success: false };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Customer name is required.", success: false };

  try {
    await prismaWithoutTenantScoping.organization.update({ where: { id: organizationId }, data: { name } });
  } catch {
    return { error: "That customer no longer exists.", success: false };
  }
  revalidatePath(`/super-admin/organizations/${organizationId}`);
  return { error: null, success: true };
}

const CONTACT_FIELDS = [
  "contactEmail",
  "contactPhone",
  "addressLine1",
  "addressLine2",
  "city",
  "region",
  "postalCode",
  "country",
] as const;

export async function updateOrganizationContactAction(
  _prevState: UpdateOrganizationFormState,
  formData: FormData,
): Promise<UpdateOrganizationFormState> {
  const organizationId = String(formData.get("organizationId") ?? "");
  try {
    await requirePlatformAccess(MANAGE_ORGS_PERMISSION);
  } catch {
    return { error: "You don't have permission to do that.", success: false };
  }

  const data = Object.fromEntries(
    CONTACT_FIELDS.map((field) => [field, String(formData.get(field) ?? "").trim() || null]),
  );

  try {
    await prismaWithoutTenantScoping.organization.update({ where: { id: organizationId }, data });
  } catch {
    return { error: "That customer no longer exists.", success: false };
  }
  revalidatePath(`/super-admin/organizations/${organizationId}`);
  return { error: null, success: true };
}

export async function suspendOrganizationAction(organizationId: string): Promise<void> {
  const identity = await requirePlatformAccess(MANAGE_ORGS_PERMISSION);
  await suspendOrganization(organizationId, { actorUserId: identity.user.id });
  revalidatePath(`/super-admin/organizations/${organizationId}`);
}

export async function reactivateOrganizationAction(organizationId: string): Promise<void> {
  const identity = await requirePlatformAccess(MANAGE_ORGS_PERMISSION);
  await reactivateOrganization(organizationId, { actorUserId: identity.user.id });
  revalidatePath(`/super-admin/organizations/${organizationId}`);
}

export async function archiveOrganizationAction(organizationId: string): Promise<void> {
  const identity = await requirePlatformAccess(MANAGE_ORGS_PERMISSION);
  await archiveOrganization(organizationId, { actorUserId: identity.user.id });
  revalidatePath(`/super-admin/organizations/${organizationId}`);
}

export async function scheduleDeletionAction(organizationId: string): Promise<void> {
  const identity = await requirePlatformAccess(MANAGE_ORGS_PERMISSION);
  await scheduleOrganizationDeletion(organizationId, { actorUserId: identity.user.id, gracePeriodDays: 30 });
  revalidatePath(`/super-admin/organizations/${organizationId}`);
}

export async function cancelDeletionAction(organizationId: string): Promise<void> {
  const identity = await requirePlatformAccess(MANAGE_ORGS_PERMISSION);
  await cancelScheduledDeletion(organizationId, { actorUserId: identity.user.id });
  revalidatePath(`/super-admin/organizations/${organizationId}`);
}

export async function impersonateAction(organizationId: string, targetUserId: string): Promise<void> {
  const identity = await requirePlatformAccess(IMPERSONATE_PERMISSION);
  const { rawToken, session } = await startImpersonation({
    impersonatorUserId: identity.user.id,
    targetUserId,
    organizationId,
  });
  await rememberSessionForImpersonation();
  await setSessionCookie(rawToken);
  await setWsTokenCookie(session.id);
  redirect("/tenant-admin");
}

export async function removeOrganizationMemberAction(organizationId: string, membershipId: string): Promise<void> {
  await requirePlatformAccess(MANAGE_ORGS_PERMISSION);
  await removeOrganizationMember(organizationId, membershipId);
  revalidatePath(`/super-admin/organizations/${organizationId}`);
}
