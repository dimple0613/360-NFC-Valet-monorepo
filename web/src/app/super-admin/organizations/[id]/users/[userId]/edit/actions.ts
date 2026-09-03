"use server";

import { revalidatePath } from "next/cache";
import { prismaWithoutTenantScoping, setMemberSingleRole } from "@saasclaude/db";
import { requirePlatformAccess } from "@/lib/auth/current-user";

const MANAGE_ORGS_PERMISSION = "core.platform.manage_organizations";

export interface UpdateMemberFormState {
  error: string | null;
}

export async function updateMemberAction(
  _prevState: UpdateMemberFormState,
  formData: FormData,
): Promise<UpdateMemberFormState> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  try {
    await requirePlatformAccess(MANAGE_ORGS_PERMISSION);
  } catch {
    return { error: "You don't have permission to do that." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const roleId = String(formData.get("roleId") ?? "");
  if (!name || !roleId) return { error: "Name and role are required." };

  try {
    await prismaWithoutTenantScoping.user.update({ where: { id: userId }, data: { name } });
    await setMemberSingleRole(organizationId, userId, roleId);
  } catch (error) {
    console.error(error);
    return { error: error instanceof Error ? error.message : "Something went wrong. Please try again." };
  }

  revalidatePath(`/super-admin/organizations/${organizationId}`);
  return { error: null };
}
