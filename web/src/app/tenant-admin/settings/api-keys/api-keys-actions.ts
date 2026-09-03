"use server";

import { revalidatePath } from "next/cache";
import { createApiKey, ForbiddenError, requireOrganizationPermission, revokeApiKey } from "@saasclaude/db";
import { requireIdentity } from "@/lib/auth/current-user";

const MANAGE_API_KEYS_PERMISSION = "core.api_keys.manage";

async function requireIdentityAndOrg() {
  const identity = await requireIdentity();
  const organizationId = identity.session.organizationId;
  if (!organizationId) throw new Error("No active organization.");
  return { identity, organizationId };
}

export interface CreateApiKeyState {
  error: string | null;
  createdKey: { name: string; rawKey: string } | null;
}

export async function createApiKeyAction(
  _prevState: CreateApiKeyState,
  formData: FormData,
): Promise<CreateApiKeyState> {
  const { identity, organizationId } = await requireIdentityAndOrg();
  try {
    await requireOrganizationPermission({ userId: identity.user.id, organizationId, permissionKey: MANAGE_API_KEYS_PERMISSION });
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: "You don't have permission to do that.", createdKey: null };
    throw error;
  }

  const name = String(formData.get("name") ?? "").trim();
  const scopes = formData.getAll("scopes").map(String);
  if (!name) return { error: "Give the key a name.", createdKey: null };
  if (scopes.length === 0) return { error: "Select at least one scope.", createdKey: null };

  const { rawKey } = await createApiKey({ organizationId, name, scopes, createdByUserId: identity.user.id });
  revalidatePath("/tenant-admin/settings/api-keys");
  return { error: null, createdKey: { name, rawKey } };
}

export async function revokeApiKeyAction(apiKeyId: string): Promise<void> {
  const { identity, organizationId } = await requireIdentityAndOrg();
  try {
    await requireOrganizationPermission({ userId: identity.user.id, organizationId, permissionKey: MANAGE_API_KEYS_PERMISSION });
  } catch (error) {
    if (error instanceof ForbiddenError) throw new Error("You don't have permission to do that.");
    throw error;
  }

  await revokeApiKey(organizationId, apiKeyId);
  revalidatePath("/tenant-admin/settings/api-keys");
}
