"use server";

import { revalidatePath } from "next/cache";
import {
  DuplicateGlobalRoleNameError,
  createGlobalRole,
  deleteGlobalRole,
  setGlobalRolePermissions,
  updateGlobalRoleDetails,
} from "@saasclaude/db";
import { requirePlatformAccess } from "@/lib/auth/current-user";

const MANAGE_GLOBAL_ROLES_PERMISSION = "core.platform.manage_global_roles";

export interface GlobalRoleFormState {
  error: string | null;
  success: boolean;
}

function readPermissionIds(formData: FormData): string[] {
  return formData.getAll("permissionIds").map(String);
}

export async function createGlobalRoleAction(
  _prevState: GlobalRoleFormState,
  formData: FormData,
): Promise<GlobalRoleFormState> {
  try {
    await requirePlatformAccess(MANAGE_GLOBAL_ROLES_PERMISSION);
  } catch {
    return { error: "You don't have permission to do that.", success: false };
  }

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name) return { error: "Role name is required.", success: false };
  if (!description) return { error: "Description is required.", success: false };

  try {
    const role = await createGlobalRole({ name, description });
    await setGlobalRolePermissions(role.id, readPermissionIds(formData));
  } catch (error) {
    if (error instanceof DuplicateGlobalRoleNameError) return { error: error.message, success: false };
    console.error(error);
    return { error: "Something went wrong. Please try again.", success: false };
  }

  revalidatePath("/super-admin/roles");
  return { error: null, success: true };
}

export async function updateGlobalRoleAction(
  _prevState: GlobalRoleFormState,
  formData: FormData,
): Promise<GlobalRoleFormState> {
  const roleId = String(formData.get("roleId") ?? "");
  try {
    await requirePlatformAccess(MANAGE_GLOBAL_ROLES_PERMISSION);
  } catch {
    return { error: "You don't have permission to do that.", success: false };
  }

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name) return { error: "Role name is required.", success: false };
  if (!description) return { error: "Description is required.", success: false };

  try {
    await updateGlobalRoleDetails(roleId, { name, description });
    await setGlobalRolePermissions(roleId, readPermissionIds(formData));
  } catch (error) {
    console.error(error);
    return { error: error instanceof Error ? error.message : "Something went wrong. Please try again.", success: false };
  }

  revalidatePath("/super-admin/roles");
  return { error: null, success: true };
}

export async function deleteGlobalRoleAction(roleId: string): Promise<void> {
  await requirePlatformAccess(MANAGE_GLOBAL_ROLES_PERMISSION);
  await deleteGlobalRole(roleId);
  revalidatePath("/super-admin/roles");
}
