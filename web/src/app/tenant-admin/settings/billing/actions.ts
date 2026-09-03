"use server";

import { redirect } from "next/navigation";
import { createStripeProvider, ForbiddenError, MissingStripeConfigError, requireOrganizationPermission } from "@saasclaude/db";
import { requireIdentity } from "@/lib/auth/current-user";
import { resolveBaseUrl } from "@/lib/base-url";

const MANAGE_BILLING_PERMISSION = "core.billing.manage";

export async function startCheckoutAction(planKey: string): Promise<void> {
  const identity = await requireIdentity();
  const organizationId = identity.session.organizationId;
  if (!organizationId) throw new Error("No active organization.");
  try {
    await requireOrganizationPermission({ userId: identity.user.id, organizationId, permissionKey: MANAGE_BILLING_PERMISSION });
  } catch (error) {
    if (error instanceof ForbiddenError) redirect("/tenant-admin/settings/billing?checkout=forbidden");
    throw error;
  }

  const baseUrl = resolveBaseUrl();
  const provider = createStripeProvider();

  let checkoutUrl: string;
  try {
    const result = await provider.createCheckoutSession({
      organizationId,
      planKey,
      successUrl: `${baseUrl}/tenant-admin/settings/billing?checkout=success`,
      cancelUrl: `${baseUrl}/tenant-admin/settings/billing?checkout=cancelled`,
      customerEmail: identity.user.email,
    });
    checkoutUrl = result.checkoutUrl;
  } catch (error) {
    // Expected until real Stripe keys are configured (STRIPE_SECRET_KEY) —
    // surfaced as a query param the page reads, not a 500, since this is a
    // known/likely state for a fresh deployment, not a bug.
    if (error instanceof MissingStripeConfigError) {
      redirect("/tenant-admin/settings/billing?checkout=not_configured");
    }
    throw error;
  }

  redirect(checkoutUrl);
}
