import Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import { signUp } from "../auth/local-provider";
import { createOrganization } from "../organization-lifecycle";
import { registerResourceTypes } from "../billing/resource-types";
import { recordResourceUsageEnforced } from "../billing/subscriptions";
import { ResourceQuotaExceededError } from "../billing/resource-consumption";
import { createPlanVersion } from "../billing/plans";
import { registerFeatures, isFeatureEnabled } from "../billing/features";
import { createStripeProvider } from "../billing/stripe-provider";

// Task 8 (TASKS.md Phase 1C): a single narrative test walking the full
// signup -> paid-plan-subscription -> quota-enforced -> webhook-driven
// lifecycle path, to catch integration gaps between the per-service unit
// tests (which each mock/construct just enough state to exercise their own
// module) — this one wires the real services together the way the actual
// app would. Scoped down per TASKS.md: no live Stripe test-mode account is
// available in this environment, so the checkout/webhook side is exercised
// via constructed, correctly-signed payloads (Stripe.webhooks.
// generateTestHeaderString) rather than a real Stripe Checkout redirect —
// that's a genuine, documented gap, not a shortcut taken silently.

const runId = Date.now().toString(36);
const webhookSecret = "whsec_e2e_test";
const stripeClient = new Stripe("sk_test_dummy");

function signedWebhook(payload: object) {
  const body = JSON.stringify(payload);
  const header = Stripe.webhooks.generateTestHeaderString({ payload: body, secret: webhookSecret });
  return { body, header };
}

describe("end-to-end billing flow (signup -> subscribe -> quota -> webhooks)", () => {
  const resourceKey = `test-e2e-${runId}.seats`;
  const featureKey = `test-e2e-${runId}.priority-support`;
  const planKey = `test-e2e-plan-${runId}`;
  const email = `e2e-${runId}@example.com`;

  let userId: string;
  let orgId: string;

  beforeAll(async () => {
    await registerResourceTypes([
      {
        key: resourceKey,
        module: `test-e2e-${runId}`,
        displayName: "Seats",
        unit: "seats",
        aggregation: "GAUGE",
        resetCycle: "NEVER",
        overagePolicy: "BLOCK",
      },
    ]);
    await registerFeatures([{ key: featureKey, module: `test-e2e-${runId}`, name: "Priority Support", defaultEnabled: false }]);
    await createPlanVersion({
      key: planKey,
      name: "E2E Pro Plan",
      type: "MONTHLY",
      priceCents: 4900,
      currency: "usd",
      billingCycle: "MONTHLY",
      resources: [{ resourceTypeKey: resourceKey, limit: 3 }],
      features: [{ featureKey, enabled: true }],
    });
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.invoiceLineItem.deleteMany({ where: { organizationId: orgId } });
    await prismaWithoutTenantScoping.invoice.deleteMany({ where: { organizationId: orgId } });
    await prismaWithoutTenantScoping.subscriptionEvent.deleteMany({ where: { organizationId: orgId } });
    await prismaWithoutTenantScoping.subscription.deleteMany({ where: { organizationId: orgId } });
    await prismaWithoutTenantScoping.resourceUsageEvent.deleteMany({ where: { organizationId: orgId } });
    await prismaWithoutTenantScoping.plan.deleteMany({ where: { key: planKey } });
    await prismaWithoutTenantScoping.feature.deleteMany({ where: { key: featureKey } });
    await prismaWithoutTenantScoping.processedWebhookEvent.deleteMany({ where: { provider: "stripe" } });
    await prismaWithoutTenantScoping.organization.delete({ where: { id: orgId } });
    await prismaWithoutTenantScoping.user.delete({ where: { id: userId } });
  });

  it("step 1: signup creates the user and the organization", async () => {
    const { userId: newUserId } = await signUp({ email, password: "correct horse battery staple 9!" });
    const org = await createOrganization({ name: "E2E Org", slug: `e2e-org-${runId}` });
    userId = newUserId;
    orgId = org.id;

    expect(userId).toBeTruthy();
    expect(org.status).toBe("ACTIVE");
  });

  it("step 2: checkout.session.completed webhook creates the subscription (no membership/role plumbing needed for billing)", async () => {
    const provider = createStripeProvider({ client: stripeClient, webhookSecret });
    const { body, header } = signedWebhook({
      id: `evt_checkout_${runId}`,
      type: "checkout.session.completed",
      data: { object: { metadata: { organizationId: orgId, planKey } } },
    });

    const event = await provider.verifyWebhookEvent(body, header);
    await provider.handleWebhookEvent(event);

    const subscription = await prismaWithoutTenantScoping.subscription.findFirst({
      where: { organizationId: orgId, status: { in: ["ACTIVE", "TRIALING"] } },
    });
    expect(subscription).not.toBeNull();
  });

  it("step 3: the plan's feature grant is now resolvable for the organization", async () => {
    await expect(isFeatureEnabled({ featureKey, organizationId: orgId })).resolves.toBe(true);
  });

  it("step 4: resource usage is enforced against the plan's quota (3 seats)", async () => {
    await recordResourceUsageEnforced({ organizationId: orgId, resourceTypeKey: resourceKey, amount: 3 });

    await expect(
      recordResourceUsageEnforced({ organizationId: orgId, resourceTypeKey: resourceKey, amount: 1 }),
    ).rejects.toThrow(ResourceQuotaExceededError);
  });

  it("step 5: invoice.paid webhook renews the subscription and records a paid Invoice", async () => {
    const provider = createStripeProvider({ client: stripeClient, webhookSecret });
    const subscriptionBefore = await prismaWithoutTenantScoping.subscription.findFirstOrThrow({ where: { organizationId: orgId } });

    const { body, header } = signedWebhook({
      id: `evt_invoice_paid_${runId}`,
      type: "invoice.paid",
      data: {
        object: {
          id: `in_e2e_${runId}`,
          amount_paid: 4900,
          currency: "usd",
          metadata: { organizationId: orgId },
        },
      },
    });
    const event = await provider.verifyWebhookEvent(body, header);
    await provider.handleWebhookEvent(event);

    const subscriptionAfter = await prismaWithoutTenantScoping.subscription.findFirstOrThrow({ where: { organizationId: orgId } });
    expect(subscriptionAfter.currentPeriodEnd.getTime()).toBeGreaterThan(subscriptionBefore.currentPeriodEnd.getTime());

    const invoice = await prismaWithoutTenantScoping.invoice.findUnique({ where: { stripeInvoiceId: `in_e2e_${runId}` } });
    expect(invoice?.status).toBe("PAID");
    expect(invoice?.totalCents).toBe(4900);
  });

  it("step 6: customer.subscription.deleted webhook terminates the subscription", async () => {
    const provider = createStripeProvider({ client: stripeClient, webhookSecret });
    const { body, header } = signedWebhook({
      id: `evt_sub_deleted_${runId}`,
      type: "customer.subscription.deleted",
      data: { object: { metadata: { organizationId: orgId } } },
    });
    const event = await provider.verifyWebhookEvent(body, header);
    await provider.handleWebhookEvent(event);

    const subscription = await prismaWithoutTenantScoping.subscription.findFirstOrThrow({ where: { organizationId: orgId } });
    expect(subscription.status).toBe("TERMINATED");

    // The plan-granted feature no longer resolves true once there's no
    // active subscription backing it — falls back to the global default.
    await expect(isFeatureEnabled({ featureKey, organizationId: orgId })).resolves.toBe(false);
  });
});
