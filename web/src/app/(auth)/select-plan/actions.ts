"use server";

import { redirect } from "next/navigation";
import {
  createSubscription,
  getCurrentPlan,
  MissingStripeConfigError,
  NoPaymentProviderConfiguredError,
  resolveCheckoutProvider,
} from "../../../lib/db";
import { requireIdentity } from "@/lib/auth/current-user";
import { resolveBaseUrl } from "@/lib/base-url";

function isFreeOrTrialPlan(priceCents: number | null, type: string): boolean {
  if (priceCents === null || priceCents === 0) return true;
  return ["FREE", "TRIAL"].includes(type);
}

// The onboarding/tenant-admin Checkout CTA shouldn't 500 on a fresh deployment
// that hasn't been given a payment provider yet. Covers resolveCheckoutProvider
// finding nothing (missing both a Settings-enabled adapter and STRIPE_SECRET_KEY),
// the no-apiKey case, plus a placeholder/invalid key (STRIPE_SECRET_KEY's default
// value is sk_test_REPLACE_ME_WITH_YOUR_TEST_KEY) surfacing as a Stripe auth error —
// all folded into the friendly "not_configured" state.
function isCheckoutNotConfiguredError(error: unknown): boolean {
  if (error instanceof NoPaymentProviderConfiguredError) return true;
  if (error instanceof MissingStripeConfigError) return true;
  if (error instanceof Error && /invalid api key|api key provided|stripe doesn't recognize/i.test(error.message)) return true;
  return false;
}

export async function onboardingSelectPlanAction(formData: FormData): Promise<void> {
  const planKey = String(formData.get("planKey") ?? "").trim();
  if (!planKey) redirect("/select-plan?error=no_plan");

  const identity = await requireIdentity();
  const organizationId = identity.session.organizationId;
  if (!organizationId) redirect("/select-plan?error=no_org");

  const plan = await getCurrentPlan(planKey);
  if (!plan) redirect("/select-plan?error=plan_not_found");

  if (isFreeOrTrialPlan(plan.priceCents, plan.type)) {
    await createSubscription({ organizationId, planKey });
    redirect("/tenant-admin");
  }

  const baseUrl = resolveBaseUrl();
  const provider = await resolveCheckoutProvider();

  try {
    const result = await provider.createCheckoutSession({
      organizationId,
      planKey,
      successUrl: `${baseUrl}/tenant-admin?checkout=success`,
      cancelUrl: `${baseUrl}/select-plan?checkout=cancelled`,
      customerEmail: identity.user.email,
    });
    redirect(result.checkoutUrl);
  } catch (error) {
    if (isCheckoutNotConfiguredError(error)) {
      redirect("/select-plan?checkout=not_configured");
    }
    throw error;
  }
}
