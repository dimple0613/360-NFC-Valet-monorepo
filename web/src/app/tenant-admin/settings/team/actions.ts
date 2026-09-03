"use server";

import { revalidatePath } from "next/cache";
import {
  AlreadyMemberError,
  ForbiddenError,
  inviteUserToOrganization,
  InviteAlreadyPendingError,
  removeOrganizationMember,
  requireOrganizationPermission,
  resolveEmailSender,
  revokeInvite,
  RoleNotFoundError,
} from "@saasclaude/db";
import { requireIdentity } from "@/lib/auth/current-user";
import { resolveBaseUrl } from "@/lib/base-url";

const MANAGE_MEMBERS_PERMISSION = "core.organization.manage_members";

export interface InviteMemberFormState {
  error: string | null;
  inviteLink: string | null;
}

export async function inviteMemberAction(
  _prevState: InviteMemberFormState,
  formData: FormData,
): Promise<InviteMemberFormState> {
  const identity = await requireIdentity();
  const organizationId = identity.session.organizationId;
  if (!organizationId) return { error: "No active organization.", inviteLink: null };

  try {
    await requireOrganizationPermission({
      userId: identity.user.id,
      organizationId,
      permissionKey: MANAGE_MEMBERS_PERMISSION,
    });
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: "You don't have permission to do that.", inviteLink: null };
    throw error;
  }

  const email = String(formData.get("email") ?? "").trim();
  const roleId = String(formData.get("roleId") ?? "") || undefined;
  if (!email) return { error: "Email is required.", inviteLink: null };

  let rawToken: string;
  try {
    ({ rawToken } = await inviteUserToOrganization(
      { organizationId, email, roleId, invitedByUserId: identity.user.id },
      await resolveEmailSender(),
    ));
  } catch (error) {
    if (error instanceof RoleNotFoundError) return { error: "That role no longer exists.", inviteLink: null };
    if (error instanceof AlreadyMemberError) return { error: "This person is already a member.", inviteLink: null };
    if (error instanceof InviteAlreadyPendingError) {
      return { error: "This person already has a pending invite — revoke it first to send a new one.", inviteLink: null };
    }
    throw error;
  }

  revalidatePath("/tenant-admin/settings/team");
  return { error: null, inviteLink: `${resolveBaseUrl()}/invite/accept?token=${rawToken}` };
}

export async function revokeInviteAction(inviteId: string): Promise<void> {
  const identity = await requireIdentity();
  const organizationId = identity.session.organizationId;
  if (!organizationId) throw new Error("No active organization.");
  try {
    await requireOrganizationPermission({
      userId: identity.user.id,
      organizationId,
      permissionKey: MANAGE_MEMBERS_PERMISSION,
    });
  } catch (error) {
    if (error instanceof ForbiddenError) throw new Error("You don't have permission to do that.");
    throw error;
  }
  await revokeInvite(inviteId);
  revalidatePath("/tenant-admin/settings/team");
}

export async function removeMemberAction(membershipId: string): Promise<void> {
  const identity = await requireIdentity();
  const organizationId = identity.session.organizationId;
  if (!organizationId) throw new Error("No active organization.");
  try {
    await requireOrganizationPermission({
      userId: identity.user.id,
      organizationId,
      permissionKey: MANAGE_MEMBERS_PERMISSION,
    });
  } catch (error) {
    if (error instanceof ForbiddenError) throw new Error("You don't have permission to do that.");
    throw error;
  }
  await removeOrganizationMember(organizationId, membershipId);
  revalidatePath("/tenant-admin/settings/team");
}
