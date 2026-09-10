import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import { registerResourceTypes } from "../billing/resource-types";
import { createPlanVersion } from "../billing/plans";
import {
  ADAPTER_ID,
  MissingPayPalConfigError,
  PayPalInvalidWebhookSignatureError,
  createPayPalProvider,
  encodePayPalWebhookHeaders,
  paypalAdapter,
} from "../billing/paypal-provider";
import { setPaymentProviderConfigValue, setPaymentProviderEnabled } from "../billing/payment-provider-config";
import { getPaymentProviderAdapter, listPaymentProviderAdapters } from "../billing/payment-provider-registry";

// This adapter is the concrete proof of the widened PaymentProvider contract
// (payment-provider.ts) — a genuine second, config-driven payment provider
// added without touching the Stripe webhook route, the Tenant Admin billing
// actions, or any other core billing code (only payment-provider.ts's own
// interface — see its header comment for the deliberate, documented
// widening both providers now implement). As with the Microsoft/Entra ID
// OAuth suite, no live PayPal sandbox/app credentials exist in this
// environment (see TASKS.md) — every network call PayPal's REST/webhook
// contract requires is exercised against an injected `fetchImpl` stub that
// asserts the actual request shape (path, method, body, headers) matches
// PayPal's documented API, never a real network call.

const runId = Date.now().toString(36);
const planKey = `test-paypal-plan-${runId}`;
const webhookId = `WH-${runId}`;

async function clearConfig(): Promise<void> {
  await prismaWithoutTenantScoping.platformSetting.deleteMany({
    where: { key: { startsWith: `payment_provider.${ADAPTER_ID}.` } },
  });
}

async function configureAdapter(): Promise<void> {
  await setPaymentProviderEnabled(ADAPTER_ID, true);
  await setPaymentProviderConfigValue({ adapterId: ADAPTER_ID, field: "client_id", value: `client-${runId}`, sensitive: false });
  await setPaymentProviderConfigValue({ adapterId: ADAPTER_ID, field: "client_secret", value: `secret-${runId}`, sensitive: true });
  await setPaymentProviderConfigValue({ adapterId: ADAPTER_ID, field: "webhook_id", value: webhookId, sensitive: false });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

interface RecordedCall {
  url: string;
  method: string;
  body: Record<string, unknown> | undefined;
  headers: Record<string, string>;
}

/** Dispatches by pathname; records every call for request-shape assertions. Token calls are answered from a fixed handler so every test doesn't need to special-case it. */
function createMockFetch(handlers: Record<string, (call: RecordedCall) => Response>) {
  const calls: RecordedCall[] = [];
  const impl = (async (input: string | URL, init: RequestInit = {}) => {
    const url = input.toString();
    const path = new URL(url).pathname;
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    const contentType = headers["content-type"] ?? "";
    const body =
      typeof init.body === "string" && contentType.includes("application/json")
        ? (JSON.parse(init.body) as Record<string, unknown>)
        : undefined;
    const call: RecordedCall = { url, method: init.method ?? "GET", body, headers };
    calls.push(call);

    if (path === "/v1/oauth2/token") {
      return jsonResponse({ access_token: `token-${runId}`, expires_in: 3600 });
    }
    const handler = handlers[path];
    if (!handler) throw new Error(`Unhandled mock PayPal call: ${path}`);
    return handler(call);
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("paypalAdapter (FR-210–213, real second PaymentProvider)", () => {
  let org: { id: string };

  beforeAll(async () => {
    org = await prismaWithoutTenantScoping.organization.create({
      data: { name: "PayPal Org", slug: `paypal-org-${runId}` },
    });
    await registerResourceTypes([
      {
        key: `test-paypal-${runId}.seats`,
        module: `test-paypal-${runId}`,
        displayName: "Seats",
        unit: "seats",
        aggregation: "GAUGE",
        resetCycle: "NEVER",
        overagePolicy: "ALLOW",
      },
    ]);
    await createPlanVersion({
      key: planKey,
      name: "PayPal Test Plan",
      type: "MONTHLY",
      priceCents: 3900,
      currency: "usd",
      billingCycle: "MONTHLY",
      resources: [{ resourceTypeKey: `test-paypal-${runId}.seats`, limit: 5 }],
    });
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.invoiceLineItem.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.invoice.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.subscriptionEvent.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.subscription.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.plan.deleteMany({ where: { key: planKey } });
    await prismaWithoutTenantScoping.processedWebhookEvent.deleteMany({ where: { provider: "paypal" } });
    await prismaWithoutTenantScoping.organization.delete({ where: { id: org.id } });
    await clearConfig();
  });

  beforeEach(async () => {
    await clearConfig();
  });

  describe("registration + declared config", () => {
    it("self-registers the real paypalAdapter singleton into the shared registry under its id", () => {
      expect(getPaymentProviderAdapter(ADAPTER_ID)).toBe(paypalAdapter);
      expect(listPaymentProviderAdapters().some((a) => a.id === ADAPTER_ID)).toBe(true);
    });

    it("declares exactly the config fields the Super Admin UI needs, no more", () => {
      const keys = paypalAdapter.configFields.map((f) => f.key).sort();
      expect(keys).toEqual(["client_id", "client_secret", "environment", "webhook_id"]);
      expect(paypalAdapter.configFields.find((f) => f.key === "client_secret")!.sensitive).toBe(true);
      expect(paypalAdapter.configFields.filter((f) => f.required).map((f) => f.key).sort()).toEqual([
        "client_id",
        "client_secret",
        "webhook_id",
      ]);
      expect(paypalAdapter.configFields.find((f) => f.key === "environment")!.required).toBe(false);
    });
  });

  describe("configured/enabled gating (mirrors microsoftEntraIdAdapter's suite)", () => {
    it("isConfigured() is false with no config at all", async () => {
      await expect(paypalAdapter.isConfigured()).resolves.toBe(false);
    });

    it("isConfigured() is false with all required fields set but not enabled", async () => {
      await setPaymentProviderConfigValue({ adapterId: ADAPTER_ID, field: "client_id", value: "c", sensitive: false });
      await setPaymentProviderConfigValue({ adapterId: ADAPTER_ID, field: "client_secret", value: "s", sensitive: true });
      await setPaymentProviderConfigValue({ adapterId: ADAPTER_ID, field: "webhook_id", value: "w", sensitive: false });
      await expect(paypalAdapter.isConfigured()).resolves.toBe(false);
    });

    it("isConfigured() is false when enabled but a required field is missing", async () => {
      await setPaymentProviderEnabled(ADAPTER_ID, true);
      await setPaymentProviderConfigValue({ adapterId: ADAPTER_ID, field: "client_id", value: "c", sensitive: false });
      // client_secret/webhook_id deliberately not set
      await expect(paypalAdapter.isConfigured()).resolves.toBe(false);
    });

    it("isConfigured() is true once every required field is set AND enabled", async () => {
      await configureAdapter();
      await expect(paypalAdapter.isConfigured()).resolves.toBe(true);
    });

    it("createCheckoutSession throws MissingPayPalConfigError when not configured, without ever reaching the network", async () => {
      const provider = createPayPalProvider({
        fetchImpl: vi.fn(() => {
          throw new Error("must not be called");
        }) as unknown as typeof fetch,
      });
      await expect(
        provider.createCheckoutSession({
          organizationId: org.id,
          planKey,
          successUrl: "https://example.com/ok",
          cancelUrl: "https://example.com/cancel",
        }),
      ).rejects.toThrow(MissingPayPalConfigError);
    });

    it("verifyWebhookEvent throws MissingPayPalConfigError when not configured, without ever reaching the network", async () => {
      const provider = createPayPalProvider({
        fetchImpl: vi.fn(() => {
          throw new Error("must not be called");
        }) as unknown as typeof fetch,
      });
      await expect(
        provider.verifyWebhookEvent("{}", encodePayPalWebhookHeaders({ transmissionId: "t", transmissionTime: "t", certUrl: "c", authAlgo: "a", transmissionSig: "s" })),
      ).rejects.toThrow(MissingPayPalConfigError);
    });
  });

  describe("createCheckoutSession (spec-correct request shape against PayPal's REST contract)", () => {
    beforeEach(configureAdapter);

    it("provisions a Product + Billing Plan, then a Subscription, and returns the approve link", async () => {
      const { impl, calls } = createMockFetch({
        "/v1/catalogs/products": () => jsonResponse({ id: `PROD-${runId}` }),
        "/v1/billing/plans": () => jsonResponse({ id: `PLAN-${runId}` }),
        "/v1/billing/subscriptions": () =>
          jsonResponse({
            id: `SUB-${runId}`,
            links: [
              { rel: "self", href: "https://api-m.sandbox.paypal.com/v1/billing/subscriptions/x" },
              { rel: "approve", href: `https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=${runId}` },
            ],
          }),
      });
      const provider = createPayPalProvider({ fetchImpl: impl });

      const result = await provider.createCheckoutSession({
        organizationId: org.id,
        planKey,
        successUrl: "https://example.com/ok",
        cancelUrl: "https://example.com/cancel",
        customerEmail: "buyer@example.com",
      });

      expect(result.checkoutUrl).toBe(`https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=${runId}`);
      expect(result.providerSessionId).toBe(`SUB-${runId}`);

      const tokenCall = calls.find((c) => c.url.includes("/v1/oauth2/token"))!;
      expect(tokenCall.headers.authorization).toMatch(/^Basic /);

      const productCall = calls.find((c) => c.url.includes("/v1/catalogs/products"))!;
      expect(productCall.method).toBe("POST");
      expect(productCall.body).toMatchObject({ name: "PayPal Test Plan", type: "SERVICE" });

      const planCall = calls.find((c) => c.url.includes("/v1/billing/plans"))!;
      expect(planCall.method).toBe("POST");
      expect(planCall.body).toMatchObject({ product_id: `PROD-${runId}` });
      const cycle = (planCall.body!.billing_cycles as Record<string, unknown>[])[0]!;
      expect((cycle.frequency as Record<string, unknown>).interval_unit).toBe("MONTH");
      expect((cycle.pricing_scheme as Record<string, unknown>).fixed_price).toMatchObject({ value: "39.00", currency_code: "USD" });

      const subCall = calls.find((c) => c.url.includes("/v1/billing/subscriptions"))!;
      expect(subCall.method).toBe("POST");
      expect(subCall.body).toMatchObject({
        plan_id: `PLAN-${runId}`,
        custom_id: `${org.id}::${planKey}`,
        subscriber: { email_address: "buyer@example.com" },
        application_context: { return_url: "https://example.com/ok", cancel_url: "https://example.com/cancel" },
      });
    });

    it("caches the Product/Plan mapping — a second checkout for the same planKey doesn't recreate them", async () => {
      let productCalls = 0;
      let planCalls = 0;
      const { impl } = createMockFetch({
        "/v1/catalogs/products": () => {
          productCalls += 1;
          return jsonResponse({ id: `PROD-cache-${runId}` });
        },
        "/v1/billing/plans": () => {
          planCalls += 1;
          return jsonResponse({ id: `PLAN-cache-${runId}` });
        },
        "/v1/billing/subscriptions": () =>
          jsonResponse({ id: `SUB-cache-${runId}`, links: [{ rel: "approve", href: "https://example.com/approve" }] }),
      });
      const provider = createPayPalProvider({ fetchImpl: impl });

      const input = {
        organizationId: org.id,
        planKey,
        successUrl: "https://example.com/ok",
        cancelUrl: "https://example.com/cancel",
      };
      await provider.createCheckoutSession(input);
      await provider.createCheckoutSession(input);

      expect(productCalls).toBe(1);
      expect(planCalls).toBe(1);
    });

    it("throws when the plan_id has no approve link", async () => {
      const { impl } = createMockFetch({
        "/v1/catalogs/products": () => jsonResponse({ id: `PROD-noapprove-${runId}` }),
        "/v1/billing/plans": () => jsonResponse({ id: `PLAN-noapprove-${runId}` }),
        "/v1/billing/subscriptions": () => jsonResponse({ id: `SUB-noapprove-${runId}`, links: [] }),
      });
      const provider = createPayPalProvider({ fetchImpl: impl });
      await expect(
        provider.createCheckoutSession({
          organizationId: org.id,
          planKey,
          successUrl: "https://example.com/ok",
          cancelUrl: "https://example.com/cancel",
        }),
      ).rejects.toThrow(/approval link/);
    });
  });

  describe("verifyWebhookEvent (real network call to PayPal's verify-webhook-signature endpoint)", () => {
    beforeEach(configureAdapter);

    const headers = encodePayPalWebhookHeaders({
      transmissionId: "TX-1",
      transmissionTime: "2026-01-01T00:00:00Z",
      certUrl: "https://api.sandbox.paypal.com/cert",
      authAlgo: "SHA256withRSA",
      transmissionSig: "sig==",
    });

    it("sends the documented verify-webhook-signature request body and accepts SUCCESS", async () => {
      const { impl, calls } = createMockFetch({
        "/v1/notifications/verify-webhook-signature": () => jsonResponse({ verification_status: "SUCCESS" }),
      });
      const provider = createPayPalProvider({ fetchImpl: impl });
      const body = JSON.stringify({ id: "WH-EVT-1", event_type: "BILLING.SUBSCRIPTION.ACTIVATED", resource: { id: "SUB-x" } });

      const event = await provider.verifyWebhookEvent(body, headers);
      expect(event).toEqual({ type: "BILLING.SUBSCRIPTION.ACTIVATED", providerEventId: "WH-EVT-1", data: { id: "SUB-x" } });

      const verifyCall = calls.find((c) => c.url.includes("/v1/notifications/verify-webhook-signature"))!;
      expect(verifyCall.body).toMatchObject({
        auth_algo: "SHA256withRSA",
        cert_url: "https://api.sandbox.paypal.com/cert",
        transmission_id: "TX-1",
        transmission_sig: "sig==",
        transmission_time: "2026-01-01T00:00:00Z",
        webhook_id: webhookId,
      });
    });

    it("rejects when PayPal reports a non-SUCCESS verification_status", async () => {
      const { impl } = createMockFetch({
        "/v1/notifications/verify-webhook-signature": () => jsonResponse({ verification_status: "FAILURE" }),
      });
      const provider = createPayPalProvider({ fetchImpl: impl });
      const body = JSON.stringify({ id: "WH-EVT-2", event_type: "BILLING.SUBSCRIPTION.ACTIVATED", resource: {} });
      await expect(provider.verifyWebhookEvent(body, headers)).rejects.toThrow(PayPalInvalidWebhookSignatureError);
    });

    it("rejects a malformed (non-JSON) signature header without reaching the network", async () => {
      const provider = createPayPalProvider({
        fetchImpl: vi.fn(async () => {
          throw new Error("must not be called for the token/verify endpoints when the header itself is malformed");
        }) as unknown as typeof fetch,
      });
      // Config-gated calls (getAccessToken) would still run before header
      // parsing failed if header parsing weren't first — assert it never
      // gets that far by using a fetchImpl that throws on ANY call.
      await expect(provider.verifyWebhookEvent("{}", "not-json")).rejects.toThrow(PayPalInvalidWebhookSignatureError);
    });

    it("rejects a malformed (non-JSON) request body", async () => {
      const { impl } = createMockFetch({});
      const provider = createPayPalProvider({ fetchImpl: impl });
      await expect(provider.verifyWebhookEvent("not-json", headers)).rejects.toThrow(PayPalInvalidWebhookSignatureError);
    });
  });

  describe("handleWebhookEvent (idempotent, status-mapping — mirrors stripe-provider.ts's structure)", () => {
    it("BILLING.SUBSCRIPTION.ACTIVATED creates a subscription and links paypalSubscriptionId, idempotently", async () => {
      const paypalSubscriptionId = `SUB-activated-${runId}`;
      const event = {
        providerEventId: `evt-activated-${runId}`,
        type: "BILLING.SUBSCRIPTION.ACTIVATED",
        data: { id: paypalSubscriptionId, custom_id: `${org.id}::${planKey}` },
      };

      await paypalAdapter.handleWebhookEvent(event);

      const sub = await prismaWithoutTenantScoping.subscription.findFirst({
        where: { organizationId: org.id, paypalSubscriptionId },
      });
      expect(sub).not.toBeNull();
      expect(sub!.status === "ACTIVE" || sub!.status === "TRIALING").toBe(true);

      const before = await prismaWithoutTenantScoping.subscription.count({ where: { organizationId: org.id } });
      await paypalAdapter.handleWebhookEvent(event); // replay, same providerEventId
      const after = await prismaWithoutTenantScoping.subscription.count({ where: { organizationId: org.id } });
      expect(after).toBe(before);
    });

    it("PAYMENT.SALE.COMPLETED renews the subscription and records a paid Invoice, idempotently", async () => {
      const captureId = `CAPTURE-${runId}`;
      const subscriptionBefore = await prismaWithoutTenantScoping.subscription.findFirstOrThrow({ where: { organizationId: org.id } });
      // Payment/sale resources don't carry our custom_id (only the
      // subscription resource does) — organizationId must resolve via
      // billing_agreement_id -> our own paypalSubscriptionId link instead,
      // exactly like a real PAYMENT.SALE.COMPLETED payload would require.
      const event = {
        providerEventId: `evt-sale-${runId}`,
        type: "PAYMENT.SALE.COMPLETED",
        data: { id: captureId, billing_agreement_id: subscriptionBefore.paypalSubscriptionId, amount: { total: "39.00", currency: "USD" } },
      };

      await paypalAdapter.handleWebhookEvent(event);

      const invoice = await prismaWithoutTenantScoping.invoice.findUnique({ where: { paypalCaptureId: captureId } });
      expect(invoice?.status).toBe("PAID");
      expect(invoice?.totalCents).toBe(3900);

      const subscriptionAfter = await prismaWithoutTenantScoping.subscription.findFirstOrThrow({ where: { organizationId: org.id } });
      expect(subscriptionAfter.currentPeriodEnd.getTime()).toBeGreaterThan(subscriptionBefore.currentPeriodEnd.getTime());

      // Replaying under a new PayPal event id (webhook redelivery) must not create a second Invoice.
      await paypalAdapter.handleWebhookEvent({ ...event, providerEventId: `evt-sale-retry-${runId}` });
      const count = await prismaWithoutTenantScoping.invoice.count({ where: { paypalCaptureId: captureId } });
      expect(count).toBe(1);
    });

    it("BILLING.SUBSCRIPTION.SUSPENDED pauses and RE-ACTIVATED resumes the subscription", async () => {
      const sub = await prismaWithoutTenantScoping.subscription.findFirstOrThrow({ where: { organizationId: org.id } });

      await paypalAdapter.handleWebhookEvent({
        providerEventId: `evt-suspended-${runId}`,
        type: "BILLING.SUBSCRIPTION.SUSPENDED",
        data: { id: sub.paypalSubscriptionId, custom_id: `${org.id}::${planKey}` },
      });
      let updated = await prismaWithoutTenantScoping.subscription.findUniqueOrThrow({ where: { id: sub.id } });
      expect(updated.status).toBe("PAUSED");

      await paypalAdapter.handleWebhookEvent({
        providerEventId: `evt-reactivated-${runId}`,
        type: "BILLING.SUBSCRIPTION.RE-ACTIVATED",
        data: { id: sub.paypalSubscriptionId, custom_id: `${org.id}::${planKey}` },
      });
      updated = await prismaWithoutTenantScoping.subscription.findUniqueOrThrow({ where: { id: sub.id } });
      expect(updated.status).toBe("ACTIVE");
    });

    it("BILLING.SUBSCRIPTION.CANCELLED terminates the subscription", async () => {
      const sub = await prismaWithoutTenantScoping.subscription.findFirstOrThrow({ where: { organizationId: org.id } });

      await paypalAdapter.handleWebhookEvent({
        providerEventId: `evt-cancelled-${runId}`,
        type: "BILLING.SUBSCRIPTION.CANCELLED",
        data: { id: sub.paypalSubscriptionId, custom_id: `${org.id}::${planKey}` },
      });
      const updated = await prismaWithoutTenantScoping.subscription.findUniqueOrThrow({ where: { id: sub.id } });
      expect(updated.status).toBe("TERMINATED");
    });

    it("an event with no resolvable organizationId is recorded (for idempotency) but triggers no state change", async () => {
      const before = await prismaWithoutTenantScoping.subscription.count();
      await paypalAdapter.handleWebhookEvent({
        providerEventId: `evt-orphan-${runId}`,
        type: "BILLING.SUBSCRIPTION.ACTIVATED",
        data: { id: `SUB-orphan-${runId}` }, // no custom_id, no matching linked subscription
      });
      const after = await prismaWithoutTenantScoping.subscription.count();
      expect(after).toBe(before);

      const recorded = await prismaWithoutTenantScoping.processedWebhookEvent.findUnique({
        where: { provider_providerEventId: { provider: "paypal", providerEventId: `evt-orphan-${runId}` } },
      });
      expect(recorded).not.toBeNull();
      expect(recorded!.organizationId).toBeNull();
    });
  });
});
