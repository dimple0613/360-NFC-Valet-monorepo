"use server";

import { revalidatePath } from "next/cache";
import { prismaWithoutTenantScoping } from "@saasclaude/db";
import { requireIdentity } from "@/lib/auth/current-user";

export interface UpdateAccountFormState {
  error: string | null;
  success: boolean;
}

// Personal profile for the logged-in user themselves — distinct from the
// organization profile (settings/general). No permission check beyond being
// authenticated: this only ever touches the caller's own User row, never
// another member's, so there's no privilege to gate. Email is intentionally
// not editable here — changing it has real implications (uniqueness,
// re-verification) that are out of scope for this pass.
export async function updateAccountAction(
  _prevState: UpdateAccountFormState,
  formData: FormData,
): Promise<UpdateAccountFormState> {
  const identity = await requireIdentity();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required.", success: false };

  await prismaWithoutTenantScoping.user.update({ where: { id: identity.user.id }, data: { name } });

  revalidatePath("/tenant-admin/settings/account");
  return { error: null, success: true };
}
