"use server";

import { revalidatePath } from "next/cache";
import { prismaWithoutTenantScoping } from "@saasclaude/db";
import { requirePlatformAccess } from "@/lib/auth/current-user";

const MANAGE_PLATFORM_ADMINS_PERMISSION = "core.platform.manage_platform_admins";

export interface AssignAdminFormState {
  error: string | null;
}

export async function assignPlatformAdminAction(
  _prevState: AssignAdminFormState,
  formData: FormData,
): Promise<AssignAdminFormState> {
  await requirePlatformAccess(MANAGE_PLATFORM_ADMINS_PERMISSION);

  const email = String(formData.get("email") ?? "").trim();
  const platformRoleId = String(formData.get("platformRoleId") ?? "");
  if (!email || !platformRoleId) return { error: "Email and role are required." };

  const user = await prismaWithoutTenantScoping.user.findUnique({ where: { email } });
  if (!user) return { error: `No user with email ${email}.` };

  await prismaWithoutTenantScoping.platformUserRole.upsert({
    where: { userId_platformRoleId: { userId: user.id, platformRoleId } },
    create: { userId: user.id, platformRoleId },
    update: {},
  });

  revalidatePath("/super-admin/admins");
  return { error: null };
}

export async function revokePlatformAdminAction(platformUserRoleId: string): Promise<void> {
  await requirePlatformAccess(MANAGE_PLATFORM_ADMINS_PERMISSION);
  await prismaWithoutTenantScoping.platformUserRole.delete({ where: { id: platformUserRoleId } });
  revalidatePath("/super-admin/admins");
}
