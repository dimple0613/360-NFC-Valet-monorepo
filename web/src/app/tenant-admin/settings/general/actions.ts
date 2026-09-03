"use server";

import { revalidatePath } from "next/cache";
import { ForbiddenError, prismaWithoutTenantScoping, requireOrganizationPermission } from "@saasclaude/db";
import { requireIdentity } from "@/lib/auth/current-user";

const MANAGE_PROFILE_PERMISSION = "core.organization.manage_profile";

export interface UpdateProfileFormState {
  error: string | null;
  success: boolean;
}

export async function updateProfileAction(
  _prevState: UpdateProfileFormState,
  formData: FormData,
): Promise<UpdateProfileFormState> {
  const identity = await requireIdentity();
  const organizationId = identity.session.organizationId;
  if (!organizationId) return { error: "No active organization.", success: false };

  try {
    await requireOrganizationPermission({
      userId: identity.user.id,
      organizationId,
      permissionKey: MANAGE_PROFILE_PERMISSION,
    });
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: "You don't have permission to do that.", success: false };
    throw error;
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required.", success: false };

  // Organization itself isn't tenant-scoped (it IS the tenant) — same as
  // everywhere else in this codebase, mutating it goes through the raw client.
  await prismaWithoutTenantScoping.organization.update({ where: { id: organizationId }, data: { name } });

  revalidatePath("/tenant-admin/settings/general");
  return { error: null, success: true };
}
