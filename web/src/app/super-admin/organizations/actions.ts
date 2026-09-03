"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  assignSubscriptionPlan,
  getOrganizationOwnerUserId,
  reactivateOrganization,
  scheduleOrganizationDeletion,
  startImpersonation,
  suspendOrganization,
} from "@saasclaude/db";
import { requirePlatformAccess } from "@/lib/auth/current-user";
import { rememberSessionForImpersonation, setSessionCookie } from "@/lib/auth/session";
import { setWsTokenCookie } from "@/lib/auth/ws-token";

const MANAGE_ORGS_PERMISSION = "core.platform.manage_organizations";
const IMPERSONATE_PERMISSION = "core.platform.impersonate_organization_admin";
const MANAGE_BILLING_PERMISSION = "core.platform.manage_billing";

export async function disableOrganizationAction(organizationId: string): Promise<void> {
  const identity = await requirePlatformAccess(MANAGE_ORGS_PERMISSION);
  await suspendOrganization(organizationId, { actorUserId: identity.user.id });
  revalidatePath("/super-admin/organizations");
}

export async function reactivateOrganizationAction(organizationId: string): Promise<void> {
  const identity = await requirePlatformAccess(MANAGE_ORGS_PERMISSION);
  await reactivateOrganization(organizationId, { actorUserId: identity.user.id });
  revalidatePath("/super-admin/organizations");
}

export async function deleteOrganizationAction(organizationId: string): Promise<void> {
  const identity = await requirePlatformAccess(MANAGE_ORGS_PERMISSION);
  await scheduleOrganizationDeletion(organizationId, { actorUserId: identity.user.id, gracePeriodDays: 30 });
  revalidatePath("/super-admin/organizations");
}

/**
 * Row-level "Login as" — unlike the org detail page's impersonateAction
 * (which impersonates an explicitly picked member), this resolves the
 * target itself (getOrganizationOwnerUserId) since the list row has no
 * member picker. Plain <form action>, not ActionButton: redirect() throws
 * internally and must not be swallowed by ActionButton's try/catch.
 */
export async function loginAsOrganizationAction(organizationId: string): Promise<void> {
  const identity = await requirePlatformAccess(IMPERSONATE_PERMISSION);
  const targetUserId = await getOrganizationOwnerUserId(organizationId);
  if (!targetUserId) throw new Error("This organization has no active member to log in as.");

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

export async function assignPlanAction(organizationId: string, formData: FormData): Promise<void> {
  const identity = await requirePlatformAccess(MANAGE_BILLING_PERMISSION);
  const planKey = String(formData.get("planKey") ?? "").trim();
  if (!planKey) throw new Error("Select a plan.");
  await assignSubscriptionPlan(organizationId, planKey, { actorUserId: identity.user.id });
  revalidatePath("/super-admin/organizations");
}
