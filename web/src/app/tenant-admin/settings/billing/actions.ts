"use server";

import { redirect } from "next/navigation";
import {
  createSubscription,
  ForbiddenError,
  getCurrentPlan,
  MissingStripeConfigError,
  NoPaymentProviderConfiguredError,
  requireOrganizationPermission,
  resolveCheckoutProvider,
} from "../../../../lib/db";
import { requireIdentity } from "@/lib/auth/current-user";
import { resolveBaseUrl } from "@/lib/base-url";

const MANAGE_BILLING_PERMISSION = "core.billing.manage";

function isFreeOrTrialPlan(priceCents: number | null, type: string): boolean {
  if (priceCents === null || priceCents === 0) return true;
  return ["FREE", "TRIAL"].includes(type);
}

// Same folding as select-plan/actions.ts — a fresh deployment with no payment
// provider (no Settings-enabled adapter and no STRIPE_SECRET_KEY), Stripe's
// placeholder key (sk_test_REPLACE_ME_WITH_YOUR_TEST_KEY), or any other
// missing-key state hits a not-configured path instead of a 500.
function isCheckoutNotConfiguredError(error: unknown): boolean {
  if (error instanceof NoPaymentProviderConfiguredError) return true;
  if (error instanceof MissingStripeConfigError) return true;
  if (error instanceof Error && /invalid api key|api key provided|stripe doesn't recognize/i.test(error.message)) return true;
  return false;
}

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
  const provider = await resolveCheckoutProvider();

  const plan = await getCurrentPlan(planKey);
  if (plan && isFreeOrTrialPlan(plan.priceCents, plan.type)) {
    await createSubscription({ organizationId, planKey });
    redirect("/tenant-admin/settings/billing?checkout=success");
  }

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
    // Expected until a payment provider is configured (a Settings-enabled
    // adapter, e.g. PayPal with its required fields, or STRIPE_SECRET_KEY) —
    // surfaced as a query param the page reads, not a 500, since this is a
    // known/likely state for a fresh deployment, not a bug.
    if (isCheckoutNotConfiguredError(error)) {
      redirect("/tenant-admin/settings/billing?checkout=not_configured");
    }
    throw error;
  }

  redirect(checkoutUrl);
}
