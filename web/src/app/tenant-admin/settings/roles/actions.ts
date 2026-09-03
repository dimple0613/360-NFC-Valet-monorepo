"use server";

import { revalidatePath } from "next/cache";
import {
  assignRoleToUser,
  createRole,
  deleteRole,
  ForbiddenError,
  requireOrganizationPermission,
  setRolePermissions,
  unassignRoleFromUser,
  UserNotAMemberError,
} from "@saasclaude/db";
import { requireIdentity } from "@/lib/auth/current-user";

const MANAGE_ROLES_PERMISSION = "core.roles.manage";

/** Throws a friendly error rather than silently no-op'ing — the fire-and-forget actions below have no other way to surface "you can't do that" to the caller. */
async function requireRolesManager(): Promise<{
  identity: Awaited<ReturnType<typeof requireIdentity>>;
  organizationId: string;
}> {
  const identity = await requireIdentity();
  const organizationId = identity.session.organizationId;
  if (!organizationId) throw new Error("No active organization.");
  try {
    await requireOrganizationPermission({
      userId: identity.user.id,
      organizationId,
      permissionKey: MANAGE_ROLES_PERMISSION,
    });
  } catch (error) {
    if (error instanceof ForbiddenError) throw new Error("You don't have permission to do that.");
    throw error;
  }
  return { identity, organizationId };
}

export interface CreateRoleFormState {
  error: string | null;
}

export async function createRoleAction(
  _prevState: CreateRoleFormState,
  formData: FormData,
): Promise<CreateRoleFormState> {
  let organizationId: string;
  try {
    ({ organizationId } = await requireRolesManager());
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Something went wrong." };
  }
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Role name is required." };

  await createRole(organizationId, name);

  revalidatePath("/tenant-admin/settings/roles");
  return { error: null };
}

export async function deleteRoleAction(roleId: string): Promise<void> {
  const { organizationId } = await requireRolesManager();
  await deleteRole(organizationId, roleId);
  revalidatePath("/tenant-admin/settings/roles");
}

export async function updateRolePermissionsAction(roleId: string, formData: FormData): Promise<void> {
  const { organizationId } = await requireRolesManager();
  const selectedPermissionIds = formData.getAll("permissionIds").map(String);

  await setRolePermissions(organizationId, roleId, selectedPermissionIds);

  revalidatePath("/tenant-admin/settings/roles");
}

export async function assignRoleAction(roleId: string, formData: FormData): Promise<void> {
  const { organizationId } = await requireRolesManager();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) throw new Error("Select a member to assign.");

  try {
    await assignRoleToUser(organizationId, roleId, userId);
  } catch (error) {
    if (error instanceof UserNotAMemberError) throw new Error("That user is no longer an active member.");
    throw error;
  }

  revalidatePath("/tenant-admin/settings/roles");
}

export async function unassignRoleAction(roleId: string, userId: string): Promise<void> {
  const { organizationId } = await requireRolesManager();
  await unassignRoleFromUser(organizationId, roleId, userId);
  revalidatePath("/tenant-admin/settings/roles");
}
