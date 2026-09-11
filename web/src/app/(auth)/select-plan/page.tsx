import type { Plan, PlanResource } from "../../../lib/db";
import { listPlans, prismaWithoutTenantScoping } from "../../../lib/db";
import { CheckIcon, CreditCardIcon, ArrowRightIcon } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { onboardingSelectPlanAction } from "./actions";
import { CheckoutRefresh } from "@/app/tenant-admin/settings/billing/checkout-refresh";
import { AUTH_HEADLINE, AuthLeftContent } from "../auth-left";
import { CheckoutToast } from "./checkout-toast";
import { requireIdentity } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";

function formatPriceWithCycle(priceCents: number | null, currency: string, billingCycle: string | null): string {
  if (priceCents === null || priceCents === 0) return "Free";
  const amount = formatPrice(priceCents, currency);
  return billingCycle === "YEARLY" ? `${amount}/year` : billingCycle === "MONTHLY" ? `${amount}/month` : amount;
}

const CHECKOUT_MESSAGES: Record<string, { variant: "default" | "destructive"; text: string }> = {
  cancelled: { variant: "default", text: "Checkout was cancelled. You can try again." },
  not_configured: {
    variant: "destructive",
    text: "No payment provider is configured yet — the admin needs to enable one (e.g. PayPal with its credentials) or add Stripe keys.",
  },
  no_plan: { variant: "destructive", text: "No plan was selected." },
  no_org: { variant: "destructive", text: "No active organization found." },
  plan_not_found: { variant: "destructive", text: "The selected plan could not be found." },
};

export default async function SelectPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; error?: string }>;
}) {
  // If user already has an active subscription, redirect them to tenant-admin.
  // This prevents users from being stuck on /select-plan after they've already
  // chosen a plan (e.g., navigating back from tenant-admin, or refreshing).
  const identity = await requireIdentity();
  if (identity.session.organizationId) {
    const existingSubscription = await prismaWithoutTenantScoping.subscription.findFirst({
      where: { 
        organizationId: identity.session.organizationId,
        status: "ACTIVE",
      },
    });
    if (existingSubscription) {
      redirect("/tenant-admin");
    }
  }

  const { checkout, error } = await searchParams;
  const plans = await listPlans({ visibility: ["PUBLIC"] });
  const message = error ? CHECKOUT_MESSAGES[error] : checkout ? CHECKOUT_MESSAGES[checkout] : null;

  return (
    <>
      <AuthLeftContent
        headline={AUTH_HEADLINE}
        sub="Choose a plan to activate your organization. Free plans activate instantly — paid plans continue to a secure checkout for payment."
        showStats={false}
      />
      <div className="onboarding-plan">
        <CheckoutRefresh active={checkout === "success"} />
        <CheckoutToast message={message} />

        <div className="text-center">
          <div className="plan-eyebrow">Plans & pricing</div>
          <h1 className="plan-title">Choose your plan</h1>
          <p className="plan-desc">
            Select a plan to get started. Free plans activate instantly — upgrades take you to a secure checkout.
          </p>
        </div>

        <div className="plan-grid">
          {plans.map((plan: Plan & { resources: PlanResource[] }) => {
            const free = plan.priceCents === null || plan.priceCents === 0;
            return (
              <div key={plan.id} className="plan-card">
                <div className="plan-card-head">
                  <span className="plan-card-name">{plan.name}</span>
                  <div
                    className="plan-card-icon"
                    style={{
                      background: free ? "#E8F5E9" : "#FEEFF0",
                    }}
                  >
                    <CreditCardIcon size={17} strokeWidth={2} color={free ? "#2E7D32" : "#F4531F"} />
                  </div>
                </div>

                <div className="plan-card-price">{formatPriceWithCycle(plan.priceCents, plan.currency, plan.billingCycle)}</div>

                <div className="flex flex-1 flex-col gap-2">
                  {plan.description ? <p className="plan-card-desc">{plan.description}</p> : null}
                  <ul className="plan-card-list">
                    {plan.resources.map((resource: PlanResource) => (
                      <li key={resource.resourceTypeKey}>
                        <CheckIcon className="size-3.5 shrink-0" style={{ color: "var(--brand-sunset)" }} />
                        {resource.resourceTypeKey.replace(/([a-z])([A-Z])/g, "$1 $2")}: {resource.limit === null ? "Unlimited" : resource.limit}
                      </li>
                    ))}
                    {plan.trialDays ? (
                      <li>
                        <CheckIcon className="size-3.5 shrink-0" style={{ color: "var(--brand-sunset)" }} />
                        {plan.trialDays}-day free trial
                      </li>
                    ) : null}
                  </ul>
                </div>

                <div className="plan-card-cta">
                  <form action={onboardingSelectPlanAction}>
                    <input type="hidden" name="planKey" value={plan.key} />
                    <button type="submit" className="btn-login inline-flex items-center justify-center gap-1.5">
                      {free ? (
                        <>Get Started <ArrowRightIcon className="inline size-4 ml-1" /></>
                      ) : (
                        <>Subscribe & Pay <ArrowRightIcon className="inline size-4 ml-1" /></>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>

        {plans.length === 0 ? (
          <div className="plan-empty">No plans are available yet. Please contact an administrator.</div>
        ) : null}
      </div>
    </>
  );
}