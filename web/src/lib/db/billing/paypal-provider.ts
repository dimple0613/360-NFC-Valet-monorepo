import { db, prismaWithoutTenantScoping } from "../client";
import { runWithTenant } from "../tenant-context";
import { getCurrentPlan } from "./plans";
import type { CheckoutSessionInput, CheckoutSessionResult, PaymentProvider, PaymentProviderConfigField, ProviderWebhookEvent } from "./payment-provider";
import {
  getPaymentProviderConfigValue,
  hasRequiredPaymentProviderConfig,
  isPaymentProviderEnabled,
  setPaymentProviderConfigValue,
} from "./payment-provider-config";
import { registerPaymentProviderAdapter } from "./payment-provider-registry";
import { createPayPalClient, type PayPalClient, type PayPalClientOptions, type PayPalRuntimeConfig } from "./paypal-client";
import { createSubscription, renewSubscription, terminateSubscription, pauseSubscription, resumeSubscription } from "./subscriptions";
import { createDraftInvoice, issueInvoice, markInvoicePaid } from "./invoices";

// FR-210–213's real second provider — the concrete proof that
// payment-provider.ts's widened PaymentProvider contract is a genuine
// abstraction and not just "whatever Stripe already happened to do". PayPal
// was chosen (per this round's brief) as a standard REST/webhook-based
// provider, deliberately NOT reusing Stripe's SDK-driven shape: its checkout
// flow needs a Product+Plan provisioned server-side before a Subscription
// can be created (Stripe's Checkout Session bundles that into one call), and
// its webhook authenticity check is a real network round-trip
// (verify-webhook-signature) rather than a local HMAC — both real
// differences the contract had to accommodate (see payment-provider.ts's
// header comment), not glossed over.
//
// Config is Settings-driven (payment-provider-config.ts), matching
// oauth-microsoft-entra-id.ts's precedent exactly — this is the config-driven
// half of the brief ("reuse the Settings pattern, do not invent a new
// mechanism"). No live PayPal sandbox/app credentials exist in this
// environment; every method here is spec-correct against PayPal's
// documented REST/webhook contract and unit-tested with an injected
// fetchImpl stub, but a real end-to-end round-trip against PayPal's servers
// is unverified — see TASKS.md.

export const ADAPTER_ID = "paypal";

export class MissingPayPalConfigError extends Error {
  constructor(missing: string) {
    super(`PayPal provider is not configured: missing ${missing}`);
    this.name = "MissingPayPalConfigError";
  }
}

export class PayPalInvalidWebhookSignatureError extends Error {
  constructor(reason: string) {
    super(`PayPal webhook signature verification failed: ${reason}`);
    this.name = "PayPalInvalidWebhookSignatureError";
  }
}

const CONFIG_FIELDS: PaymentProviderConfigField[] = [
  { key: "client_id", label: "Client ID", sensitive: false, required: true },
  { key: "client_secret", label: "Client secret", sensitive: true, required: true },
  { key: "webhook_id", label: "Webhook ID", sensitive: false, required: true },
  { key: "environment", label: 'Environment ("sandbox" or "live")', sensitive: false, required: false },
];

async function loadConfig(): Promise<PayPalRuntimeConfig> {
  const enabled = await isPaymentProviderEnabled(ADAPTER_ID);
  const hasRequired = await hasRequiredPaymentProviderConfig({ id: ADAPTER_ID, configFields: CONFIG_FIELDS });
  if (!enabled || !hasRequired) throw new MissingPayPalConfigError("client_id/client_secret/webhook_id, or the provider is not enabled");

  const [clientId, clientSecret, webhookId, environment] = await Promise.all([
    getPaymentProviderConfigValue(ADAPTER_ID, "client_id"),
    getPaymentProviderConfigValue(ADAPTER_ID, "client_secret"),
    getPaymentProviderConfigValue(ADAPTER_ID, "webhook_id"),
    getPaymentProviderConfigValue(ADAPTER_ID, "environment"),
  ]);
  // hasRequiredPaymentProviderConfig already guarantees these three are
  // non-empty — re-checked here only so TypeScript narrows away `undefined`.
  if (!clientId || !clientSecret || !webhookId) throw new MissingPayPalConfigError("client_id/client_secret/webhook_id");
  return { clientId, clientSecret, webhookId, environment: environment === "live" ? "live" : "sandbox" };
}

function planMapSettingKey(planKey: string): string {
  return `plan_map.${planKey}`;
}

/**
 * PayPal Subscriptions require a pre-existing Product + Billing Plan (unlike
 * Stripe's Checkout Session, which bundles pricing inline) — created lazily,
 * once, on first checkout for a given platform Plan.key, and cached via the
 * same Settings-backed config store every other per-adapter value uses
 * (payment-provider-config.ts's arbitrary-key support, not a new storage
 * mechanism).
 */
async function ensurePayPalPlanId(
  client: PayPalClient,
  plan: { key: string; name: string; priceCents: number | null; currency: string; billingCycle: string | null },
): Promise<string> {
  const cached = await getPaymentProviderConfigValue(ADAPTER_ID, planMapSettingKey(plan.key));
  if (cached) return cached;

  const product = await client.request<{ id: string }>("/v1/catalogs/products", {
    method: "POST",
    body: JSON.stringify({ name: plan.name, type: "SERVICE", category: "SOFTWARE" }),
  });

  const intervalUnit = plan.billingCycle === "YEARLY" ? "YEAR" : "MONTH";
  const billingPlan = await client.request<{ id: string }>("/v1/billing/plans", {
    method: "POST",
    body: JSON.stringify({
      product_id: product.id,
      name: plan.name,
      billing_cycles: [
        {
          frequency: { interval_unit: intervalUnit, interval_count: 1 },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: { value: ((plan.priceCents ?? 0) / 100).toFixed(2), currency_code: plan.currency.toUpperCase() },
          },
        },
      ],
      payment_preferences: { auto_bill_outstanding: true, setup_fee_failure_action: "CONTINUE", payment_failure_threshold: 1 },
    }),
  });

  await setPaymentProviderConfigValue({ adapterId: ADAPTER_ID, field: planMapSettingKey(plan.key), value: billingPlan.id, sensitive: false });
  return billingPlan.id;
}

/**
 * PayPal Subscriptions carry a single `custom_id` string (256 chars, no
 * structured metadata object the way Stripe's `metadata` is) — a genuine
 * per-provider difference from Stripe's richer metadata bag, so both
 * organizationId and our own planKey are packed into it (`orgId::planKey`)
 * rather than just organizationId, since PayPal's own webhook payloads never
 * expose our planKey any other way (they only know PayPal's own plan_id).
 */
function encodeCustomId(organizationId: string, planKey: string): string {
  return `${organizationId}::${planKey}`;
}

function decodeCustomId(customId: string | undefined): { organizationId?: string; planKey?: string } {
  if (!customId) return {};
  const [organizationId, planKey] = customId.split("::");
  return { organizationId, planKey };
}

async function doCreateCheckoutSession(client: PayPalClient, input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
  const plan = await getCurrentPlan(input.planKey);
  if (!plan) throw new Error(`Unknown plan key: ${input.planKey}`);

  const paypalPlanId = await ensurePayPalPlanId(client, plan);

  const response = await client.request<{ id: string; links: { rel: string; href: string }[] }>("/v1/billing/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: paypalPlanId,
      custom_id: encodeCustomId(input.organizationId, input.planKey),
      subscriber: input.customerEmail ? { email_address: input.customerEmail } : undefined,
      application_context: {
        return_url: input.successUrl,
        cancel_url: input.cancelUrl,
        user_action: "SUBSCRIBE_NOW",
      },
    }),
  });

  const approveLink = response.links.find((link) => link.rel === "approve")?.href;
  if (!approveLink) throw new Error("PayPal did not return an approval link for this subscription");
  return { checkoutUrl: approveLink, providerSessionId: response.id };
}

/**
 * The headers PayPal's webhook delivery sends (`paypal-transmission-id` etc.)
 * — there are five of them, unlike Stripe's single `stripe-signature` header,
 * so the PaymentProvider contract's single `signatureHeader` string carries
 * a JSON-encoded object of all five. `encodePayPalWebhookHeaders` is exported
 * so the webhook route can build it directly from the real request headers.
 */
export interface PayPalWebhookHeaders {
  transmissionId: string;
  transmissionTime: string;
  certUrl: string;
  authAlgo: string;
  transmissionSig: string;
}

export function encodePayPalWebhookHeaders(headers: PayPalWebhookHeaders): string {
  return JSON.stringify(headers);
}

async function doVerifyWebhookEvent(
  client: PayPalClient,
  config: PayPalRuntimeConfig,
  rawBody: string | Buffer,
  signatureHeader: string,
): Promise<ProviderWebhookEvent> {
  let headers: PayPalWebhookHeaders;
  try {
    headers = JSON.parse(signatureHeader) as PayPalWebhookHeaders;
  } catch {
    throw new PayPalInvalidWebhookSignatureError("malformed webhook header payload (expected JSON-encoded PayPalWebhookHeaders)");
  }

  const bodyString = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
  let webhookEvent: Record<string, unknown>;
  try {
    webhookEvent = JSON.parse(bodyString) as Record<string, unknown>;
  } catch {
    throw new PayPalInvalidWebhookSignatureError("malformed webhook body (expected JSON)");
  }

  // PayPal's documented, supported verification path — unlike Stripe there
  // is no published local-HMAC equivalent, so this is a real network call.
  const verification = await client.request<{ verification_status: string }>("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify({
      auth_algo: headers.authAlgo,
      cert_url: headers.certUrl,
      transmission_id: headers.transmissionId,
      transmission_sig: headers.transmissionSig,
      transmission_time: headers.transmissionTime,
      webhook_id: config.webhookId,
      webhook_event: webhookEvent,
    }),
  });

  if (verification.verification_status !== "SUCCESS") {
    throw new PayPalInvalidWebhookSignatureError(`verification_status was "${verification.verification_status}"`);
  }

  const providerEventId = typeof webhookEvent.id === "string" ? webhookEvent.id : "";
  const type = typeof webhookEvent.event_type === "string" ? webhookEvent.event_type : "";
  return { type, providerEventId, data: webhookEvent.resource };
}

async function findSubscriptionByPaypalId(paypalSubscriptionId: string | undefined) {
  if (!paypalSubscriptionId) return null;
  return prismaWithoutTenantScoping.subscription.findUnique({ where: { paypalSubscriptionId } });
}

// Same reasoning as stripe-provider.ts's own private findActiveSubscription:
// goes through the tenant-scoped `db` client inside runWithTenant rather
// than a manual organizationId filter on the unscoped client, so this stays
// covered by the tenant-scoping guarantee structurally, not by convention.
async function findActiveSubscription(organizationId: string) {
  return runWithTenant(organizationId, async () =>
    db.subscription.findFirst({
      where: { status: { in: ["ACTIVE", "TRIALING", "PAUSED"] } },
      orderBy: { createdAt: "desc" },
    }),
  );
}

async function recordPaidCapture(organizationId: string, subscriptionId: string | undefined, resource: Record<string, unknown>): Promise<void> {
  const captureId = typeof resource.id === "string" ? resource.id : undefined;
  if (!captureId) return;

  const existing = await prismaWithoutTenantScoping.invoice.findUnique({ where: { paypalCaptureId: captureId } });
  if (existing) return;

  const amount = resource.amount as Record<string, unknown> | undefined;
  const amountValue =
    typeof amount?.total === "string" ? amount.total : typeof amount?.value === "string" ? amount.value : "0";
  const currency =
    typeof amount?.currency === "string" ? amount.currency : typeof amount?.currency_code === "string" ? amount.currency_code : "usd";
  const amountCents = Math.round(Number.parseFloat(amountValue) * 100) || 0;

  const draft = await createDraftInvoice({
    organizationId,
    subscriptionId,
    currency: currency.toLowerCase(),
    paypalCaptureId: captureId,
    lineItems: [{ description: "Subscription charge", unitAmountCents: amountCents }],
  });
  const issued = await issueInvoice(organizationId, draft.id);
  await markInvoicePaid(organizationId, issued.id);
}

async function doHandleWebhookEvent(event: ProviderWebhookEvent): Promise<void> {
  const resource = (event.data as Record<string, unknown> | undefined) ?? {};
  const { organizationId: organizationIdFromCustomId, planKey } = decodeCustomId(
    typeof resource.custom_id === "string" ? resource.custom_id : undefined,
  );
  // Payment-capture events on an existing subscription don't carry our
  // custom_id (PayPal's own transaction resources don't propagate the
  // subscription's custom_id) — fall back to the subscription this org
  // already linked via paypalSubscriptionId (set below, on ACTIVATED).
  // `billing_agreement_id` (present on PAYMENT.SALE.COMPLETED /
  // PAYMENT.CAPTURE.COMPLETED resources) is checked FIRST and deliberately
  // takes priority over `resource.id` — for those event types `resource.id`
  // is the capture/sale id, not a subscription id, and would otherwise
  // silently mismatch against paypalSubscriptionId.
  const paypalSubscriptionId =
    typeof resource.billing_agreement_id === "string" ? resource.billing_agreement_id : typeof resource.id === "string" ? resource.id : undefined;
  const linkedSubscription = organizationIdFromCustomId ? null : await findSubscriptionByPaypalId(paypalSubscriptionId);
  const organizationId = organizationIdFromCustomId ?? linkedSubscription?.organizationId;

  // FR-213 idempotency: same ProcessedWebhookEvent table/guard Stripe uses,
  // keyed by (provider, providerEventId) — a retried PayPal delivery is a
  // no-op past this point.
  try {
    await prismaWithoutTenantScoping.processedWebhookEvent.create({
      data: {
        provider: "paypal",
        providerEventId: event.providerEventId,
        organizationId,
        eventType: event.type,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payload: resource as any,
      },
    });
  } catch (cause) {
    if (cause instanceof Error && "code" in cause && (cause as { code?: string }).code === "P2002") return;
    throw cause;
  }

  if (!organizationId) return;

  switch (event.type) {
    case "BILLING.SUBSCRIPTION.ACTIVATED": {
      const existing = await findSubscriptionByPaypalId(paypalSubscriptionId);
      if (existing) {
        if (existing.status === "PAUSED") await resumeSubscription(organizationId, existing.id);
        break;
      }
      if (!planKey) break;
      const created = await createSubscription({ organizationId, planKey });
      if (paypalSubscriptionId) {
        await runWithTenant(organizationId, async () =>
          db.subscription.update({ where: { id: created.id }, data: { paypalSubscriptionId } }),
        );
      }
      break;
    }
    case "PAYMENT.SALE.COMPLETED":
    case "PAYMENT.CAPTURE.COMPLETED": {
      const subscription = await findActiveSubscription(organizationId);
      if (subscription) await renewSubscription(organizationId, subscription.id);
      await recordPaidCapture(organizationId, subscription?.id, resource);
      break;
    }
    case "BILLING.SUBSCRIPTION.CANCELLED": {
      const subscription = await findActiveSubscription(organizationId);
      if (subscription) await terminateSubscription(organizationId, subscription.id);
      break;
    }
    case "BILLING.SUBSCRIPTION.SUSPENDED": {
      const subscription = await findActiveSubscription(organizationId);
      if (subscription) await pauseSubscription(organizationId, subscription.id);
      break;
    }
    case "BILLING.SUBSCRIPTION.RE-ACTIVATED": {
      const subscription = await findActiveSubscription(organizationId);
      if (subscription) await resumeSubscription(organizationId, subscription.id);
      break;
    }
    default:
      break;
  }
}

export interface PayPalProviderOptions {
  /** Injected in tests so no real HTTP request ever leaves the process — mirrors stripe-provider.ts's `options.client`. */
  fetchImpl?: PayPalClientOptions["fetchImpl"];
}

/** Factory (not a bare singleton export) so tests can inject a stub fetch and exercise the full contract without live PayPal credentials — same reasoning as createStripeProvider. */
export function createPayPalProvider(options: PayPalProviderOptions = {}): PaymentProvider {
  async function withClient<T>(fn: (client: PayPalClient, config: PayPalRuntimeConfig) => Promise<T>): Promise<T> {
    const config = await loadConfig();
    const client = createPayPalClient(config, { fetchImpl: options.fetchImpl });
    return fn(client, config);
  }

  return {
    id: ADAPTER_ID,
    displayName: "PayPal",
    configFields: CONFIG_FIELDS,
    async isConfigured(): Promise<boolean> {
      const [enabled, hasRequired] = await Promise.all([
        isPaymentProviderEnabled(ADAPTER_ID),
        hasRequiredPaymentProviderConfig({ id: ADAPTER_ID, configFields: CONFIG_FIELDS }),
      ]);
      return enabled && hasRequired;
    },
    createCheckoutSession: (input) => withClient((client) => doCreateCheckoutSession(client, input)),
    verifyWebhookEvent: (rawBody, signatureHeader) => withClient((client, config) => doVerifyWebhookEvent(client, config, rawBody, signatureHeader)),
    handleWebhookEvent: (event) => doHandleWebhookEvent(event),
  };
}

// Self-registration: importing this module (which packages/db/src/index.ts
// does, to re-export the adapter) is enough to make it reachable at
// `/api/webhooks/paypal` and configurable at
// `/super-admin/settings/payment-providers` — no other file needs to change.
// Uses the real global `fetch` (no fetchImpl override) since this is the
// production-facing instance.
export const paypalAdapter: PaymentProvider = createPayPalProvider();
registerPaymentProviderAdapter(paypalAdapter);
