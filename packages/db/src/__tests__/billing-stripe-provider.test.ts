import Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import { registerResourceTypes } from "../billing/resource-types";
import { createPlanVersion } from "../billing/plans";
import { createSubscription } from "../billing/subscriptions";
import {
  createStripeProvider,
  InvalidWebhookSignatureError,
  MissingStripeConfigError,
} from "../billing/stripe-provider";

// Signature verification and idempotency are exercised entirely offline via
// Stripe's local test-signing helper (`Stripe.webhooks.generateTestHeaderString`)
// — no live Stripe account or network access is needed for any test here.
// `createCheckoutSession` (the one method that does call the network) is
// covered only for its config-guard path; there's no live-Stripe test for it
// in this environment (see TASKS.md for the flagged gap).

const runId = Date.now().toString(36);
const planKey = `test-stripe-plan-${runId}`;
const webhookSecret = "whsec_test_secret";
// Any Stripe instance works for constructEvent — it only does local HMAC
// verification, no network call, so a dummy key is fine.
const stripeClient = new Stripe("sk_test_dummy");

function signedWebhook(payload: object) {
  const body = JSON.stringify(payload);
  const header = Stripe.webhooks.generateTestHeaderString({ payload: body, secret: webhookSecret });
  return { body, header };
}

describe("Stripe payment provider (FR-210–213)", () => {
  let org: { id: string };

  beforeAll(async () => {
    org = await prismaWithoutTenantScoping.organization.create({
      data: { name: "Stripe Org", slug: `stripe-org-${runId}` },
    });
    await registerResourceTypes([
      {
        key: `test-stripe-${runId}.seats`,
        module: `test-stripe-${runId}`,
        displayName: "Seats",
        unit: "seats",
        aggregation: "GAUGE",
        resetCycle: "NEVER",
        overagePolicy: "ALLOW",
      },
    ]);
    await createPlanVersion({
      key: planKey,
      name: "Stripe Test Plan",
      type: "MONTHLY",
      priceCents: 2900,
      currency: "usd",
      billingCycle: "MONTHLY",
      resources: [{ resourceTypeKey: `test-stripe-${runId}.seats`, limit: 5 }],
    });
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.invoiceLineItem.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.invoice.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.subscriptionEvent.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.subscription.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.plan.deleteMany({ where: { key: planKey } });
    await prismaWithoutTenantScoping.processedWebhookEvent.deleteMany({ where: { provider: "stripe" } });
    await prismaWithoutTenantScoping.organization.delete({ where: { id: org.id } });
  });

  it("createCheckoutSession throws MissingStripeConfigError with no apiKey/client configured", async () => {
    // Explicit empty string, not just {} — packages/db/.env now carries a real
    // test-mode STRIPE_SECRET_KEY for local dev, which createStripeProvider({})
    // would otherwise silently pick up via its own env fallback, defeating
    // this test's actual point (no live network call needed to hit this path).
    const provider = createStripeProvider({ apiKey: "" });
    await expect(
      provider.createCheckoutSession({
        organizationId: org.id,
        planKey,
        successUrl: "https://example.com/ok",
        cancelUrl: "https://example.com/cancel",
      }),
    ).rejects.toThrow(MissingStripeConfigError);
  });

  it("verifyWebhookEvent throws MissingStripeConfigError with no webhookSecret configured", async () => {
    // Same env-fallback gotcha as the apiKey test above, now also true for
    // STRIPE_WEBHOOK_SECRET (packages/db/.env carries a real one once the
    // local Stripe CLI is forwarding webhooks) — explicit empty string so
    // this test stays independent of what's set in the environment.
    const provider = createStripeProvider({ client: stripeClient, webhookSecret: "" });
    await expect(provider.verifyWebhookEvent("{}", "t=1,v1=bad")).rejects.toThrow(MissingStripeConfigError);
  });

  it("verifyWebhookEvent rejects an invalid signature", async () => {
    const provider = createStripeProvider({ client: stripeClient, webhookSecret });
    await expect(provider.verifyWebhookEvent("{}", "t=1,v1=deadbeef")).rejects.toThrow(InvalidWebhookSignatureError);
  });

  it("verifyWebhookEvent accepts a correctly-signed payload and parses type/id", async () => {
    const provider = createStripeProvider({ client: stripeClient, webhookSecret });
    const { body, header } = signedWebhook({
      id: "evt_test_1",
      type: "checkout.session.completed",
      data: { object: { metadata: { organizationId: org.id, planKey } } },
    });

    const event = await provider.verifyWebhookEvent(body, header);
    expect(event.providerEventId).toBe("evt_test_1");
    expect(event.type).toBe("checkout.session.completed");
  });

  it("handleWebhookEvent creates a subscription from checkout.session.completed", async () => {
    const provider = createStripeProvider({ client: stripeClient, webhookSecret });
    await provider.handleWebhookEvent({
      providerEventId: `evt-checkout-${runId}`,
      type: "checkout.session.completed",
      data: { metadata: { organizationId: org.id, planKey } },
    });

    const sub = await prismaWithoutTenantScoping.subscription.findFirst({
      where: { organizationId: org.id, status: { in: ["ACTIVE", "TRIALING"] } },
    });
    expect(sub).not.toBeNull();
  });

  it("handleWebhookEvent is idempotent: replaying the same event id is a no-op", async () => {
    const provider = createStripeProvider({ client: stripeClient, webhookSecret });
    const before = await prismaWithoutTenantScoping.subscription.count({ where: { organizationId: org.id } });

    // Same providerEventId as the previous test — must not create a second subscription.
    await provider.handleWebhookEvent({
      providerEventId: `evt-checkout-${runId}`,
      type: "checkout.session.completed",
      data: { metadata: { organizationId: org.id, planKey } },
    });

    const after = await prismaWithoutTenantScoping.subscription.count({ where: { organizationId: org.id } });
    expect(after).toBe(before);
  });

  it("handleWebhookEvent records a paid Invoice on invoice.paid, idempotently", async () => {
    const provider = createStripeProvider({ client: stripeClient, webhookSecret });
    const stripeInvoiceId = `in_test_${runId}`;

    await provider.handleWebhookEvent({
      providerEventId: `evt-invoice-paid-${runId}`,
      type: "invoice.paid",
      data: { id: stripeInvoiceId, amount_paid: 2900, currency: "usd", metadata: { organizationId: org.id } },
    });

    const invoice = await prismaWithoutTenantScoping.invoice.findUnique({ where: { stripeInvoiceId } });
    expect(invoice?.status).toBe("PAID");
    expect(invoice?.totalCents).toBe(2900);

    // Replaying invoice.paid for the same Stripe invoice (different Stripe
    // event id, e.g. a webhook redelivery under a new event) must not create
    // a second Invoice row for it.
    await provider.handleWebhookEvent({
      providerEventId: `evt-invoice-paid-retry-${runId}`,
      type: "invoice.paid",
      data: { id: stripeInvoiceId, amount_paid: 2900, currency: "usd", metadata: { organizationId: org.id } },
    });
    const count = await prismaWithoutTenantScoping.invoice.count({ where: { stripeInvoiceId } });
    expect(count).toBe(1);
  });

  it("handleWebhookEvent terminates the subscription on customer.subscription.deleted", async () => {
    const provider = createStripeProvider({ client: stripeClient, webhookSecret });
    await provider.handleWebhookEvent({
      providerEventId: `evt-deleted-${runId}`,
      type: "customer.subscription.deleted",
      data: { metadata: { organizationId: org.id } },
    });

    const sub = await prismaWithoutTenantScoping.subscription.findFirst({
      where: { organizationId: org.id },
      orderBy: { createdAt: "desc" },
    });
    expect(sub?.status).toBe("TERMINATED");
  });
});
