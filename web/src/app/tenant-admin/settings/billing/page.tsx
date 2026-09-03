import {
  getActiveSubscription,
  getPlanById,
  getUserOrganizationPermissions,
  listPlans,
} from "@saasclaude/db";
import { CreditCardIcon, CheckIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireIdentity } from "@/lib/auth/current-user";
import { formatPrice, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { startCheckoutAction } from "./actions";
import { CheckoutRefresh } from "./checkout-refresh";
import { SubscriptionStatusBadge } from "@/app/super-admin/organizations/subscription-row";

const MANAGE_BILLING_PERMISSION = "core.billing.manage";

function formatPriceWithCycle(priceCents: number | null, currency: string, billingCycle: string | null): string {
  if (priceCents === null || priceCents === 0) return "Free";
  const amount = formatPrice(priceCents, currency);
  return billingCycle === "YEARLY" ? `${amount}/year` : billingCycle === "MONTHLY" ? `${amount}/month` : amount;
}

const CHECKOUT_MESSAGES: Record<string, { variant: "default" | "destructive"; text: string }> = {
  success: { variant: "default", text: "Subscription started — it may take a moment to appear below once Stripe's webhook lands." },
  cancelled: { variant: "default", text: "Checkout was cancelled." },
  not_configured: {
    variant: "destructive",
    text: "Stripe isn't configured on this server yet (STRIPE_SECRET_KEY is unset) — checkout can't start until it is.",
  },
  forbidden: { variant: "destructive", text: "You don't have permission to manage billing for this organization." },
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout } = await searchParams;
  const identity = await requireIdentity();
  const organizationId = identity.session.organizationId!;

  const [plans, subscription, permissions] = await Promise.all([
    listPlans({ visibility: ["PUBLIC"] }),
    getActiveSubscription(organizationId),
    getUserOrganizationPermissions(identity.user.id, organizationId),
  ]);
  const canManageBilling = permissions.includes(MANAGE_BILLING_PERMISSION);
  const currentPlan = subscription ? await getPlanById(subscription.planId) : null;
  const message = checkout ? CHECKOUT_MESSAGES[checkout] : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<CreditCardIcon className="size-5" />}
        title="Billing"
        description="Your subscription, plan and usage limits, and renewals."
      />
      <CheckoutRefresh active={checkout === "success" && !subscription} />
      {message ? (
        <Alert variant={message.variant}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}

      {subscription ? (
        <Card>
          <CardContent>
            <div className="mb-1 flex items-center gap-2 text-[15px] font-extrabold">
              Current subscription
              <SubscriptionStatusBadge status={subscription.status} />
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-3 pt-1">
              <div>
                <div className="text-[13.5px] font-extrabold text-[#1c2b46]">{currentPlan?.name ?? subscription.planId}</div>
                <div className="text-[12px] font-semibold text-[#6c7a93]">Plan</div>
              </div>
              <div>
                <div className="text-[13.5px] font-extrabold text-[#1c2b46]">{formatDate(subscription.currentPeriodEnd)}</div>
                <div className="text-[12px] font-semibold text-[#6c7a93]">Next billing</div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Alert>
          <AlertDescription>No active subscription — choose a plan below to get started.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = currentPlan?.id === plan.id;
          return (
            <div
              key={plan.id}
              className="flex flex-col gap-4"
              style={{
                background: "#fff",
                border: `1px solid ${isCurrent ? "var(--brand-sunset)" : "#E7EAF0"}`,
                borderRadius: 16,
                padding: "18px 20px",
                boxShadow: "0 20px 50px rgba(16,22,35,0.06)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#6C7A93", fontWeight: 700 }}>{plan.name}</span>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 11,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: "none",
                    background: isCurrent ? "#FDF3E3" : "#FEEFF0",
                  }}
                >
                  <CreditCardIcon size={17} strokeWidth={2} color={isCurrent ? "#B97B17" : "#F4531F"} />
                </div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px", color: "#16213a" }}>
                {isCurrent ? <Badge variant="secondary" className="mr-2 align-middle">Current plan</Badge> : null}
                {formatPriceWithCycle(plan.priceCents, plan.currency, plan.billingCycle)}
              </div>
              <div className="flex flex-1 flex-col gap-2">
                {plan.description ? <p className="text-sm text-muted-foreground">{plan.description}</p> : null}
                <ul className="flex flex-col gap-1.5 text-sm">
                  {plan.resources.map((resource) => (
                    <li key={resource.resourceTypeKey} className="flex items-center gap-2 text-muted-foreground">
                      <CheckIcon className="size-3.5 shrink-0" style={{ color: "var(--brand-sunset)" }} />
                      {resource.resourceTypeKey}: {resource.limit === null ? "Unlimited" : resource.limit}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                {!isCurrent && canManageBilling ? (
                  <form action={startCheckoutAction.bind(null, plan.key)}>
                    <button type="submit" className="btn-primary w-full">
                      Subscribe
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
