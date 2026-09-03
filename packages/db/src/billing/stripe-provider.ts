import Stripe from "stripe";
import { db, prismaWithoutTenantScoping } from "../client";
import { runWithTenant } from "../tenant-context";
import { getCurrentPlan } from "./plans";
import type { CheckoutSessionInput, CheckoutSessionResult, PaymentProvider, ProviderWebhookEvent } from "./payment-provider";
import {
  createSubscription,
  renewSubscription,
  terminateSubscription,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
} from "./subscriptions";
import { createDraftInvoice, issueInvoice, markInvoicePaid } from "./invoices";

// FR-210–213 Stripe adapter. A factory (not a singleton export) so tests can
// inject a stub `client`/`webhookSecret` and exercise the full contract
// without live Stripe credentials — see stripe-provider.test.ts, which never
// makes a network call (checkout creation is the only method that needs one,
// and it's the one method those tests don't exercise against a real client).

export class MissingStripeConfigError extends Error {
  constructor(missing: string) {
    super(`Stripe provider is not configured: missing ${missing}`);
    this.name = "MissingStripeConfigError";
  }
}

export class InvalidWebhookSignatureError extends Error {
  constructor(cause: unknown) {
    super(`Stripe webhook signature verification failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "InvalidWebhookSignatureError";
  }
}

const BILLING_CYCLE_TO_STRIPE_INTERVAL: Record<string, Stripe.Checkout.SessionCreateParams.LineItem.PriceData.Recurring.Interval> = {
  MONTHLY: "month",
  YEARLY: "year",
};

export interface StripeProviderOptions {
  apiKey?: string;
  webhookSecret?: string;
  client?: Stripe;
}

export function createStripeProvider(options: StripeProviderOptions = {}): PaymentProvider {
  const apiKey = options.apiKey ?? process.env.STRIPE_SECRET_KEY;
  const webhookSecret = options.webhookSecret ?? process.env.STRIPE_WEBHOOK_SECRET;
  // A client can be injected directly (tests); otherwise one is built lazily
  // from apiKey so constructing the provider never requires live credentials
  // (only calling createCheckoutSession, the one method that needs the network, does).
  const client = options.client ?? (apiKey ? new Stripe(apiKey) : undefined);

  async function createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    if (!client) throw new MissingStripeConfigError("apiKey");

    const plan = await getCurrentPlan(input.planKey);
    if (!plan) throw new Error(`Unknown plan key: ${input.planKey}`);

    const interval = plan.billingCycle ? BILLING_CYCLE_TO_STRIPE_INTERVAL[plan.billingCycle] : undefined;

    const session = await client.checkout.sessions.create({
      mode: "subscription",
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      customer_email: input.customerEmail,
      client_reference_id: input.organizationId,
      metadata: { organizationId: input.organizationId, planKey: input.planKey },
      subscription_data: {
        trial_period_days: input.trialDays ?? plan.trialDays ?? undefined,
        metadata: { organizationId: input.organizationId, planKey: input.planKey },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: plan.currency,
            unit_amount: plan.priceCents ?? 0,
            recurring: interval ? { interval } : undefined,
            product_data: { name: plan.name },
          },
        },
      ],
    });

    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { checkoutUrl: session.url, providerSessionId: session.id };
  }

  // Async only to satisfy the widened PaymentProvider contract (see
  // payment-provider.ts's header comment) — the actual verification below is
  // still a purely local, synchronous HMAC check; no network call is made.
  async function verifyWebhookEvent(rawBody: string | Buffer, signatureHeader: string): Promise<ProviderWebhookEvent> {
    if (!client) throw new MissingStripeConfigError("apiKey");
    if (!webhookSecret) throw new MissingStripeConfigError("webhookSecret");

    let event: Stripe.Event;
    try {
      event = client.webhooks.constructEvent(rawBody, signatureHeader, webhookSecret);
    } catch (cause) {
      throw new InvalidWebhookSignatureError(cause);
    }

    return { type: event.type, providerEventId: event.id, data: event.data.object };
  }

  async function handleWebhookEvent(event: ProviderWebhookEvent): Promise<void> {
    // event.data is already the unwrapped Stripe object (verifyWebhookEvent
    // set it to event.data.object) — do not unwrap again here.
    const object = (event.data as Record<string, unknown> | undefined) ?? {};
    // Resolved up front (pure read of already-parsed metadata, no side
    // effects) so the idempotency-guard insert below can record which org
    // this event belongs to — Super Admin's billing surface reads this
    // organizationId/eventType/payload for a per-org raw-event history.
    const organizationId = readMetadataOrganizationId(object);

    // FR-213 idempotency: Stripe retries delivery on failure/timeout, so the
    // same event can arrive more than once. The unique constraint on
    // (provider, providerEventId) makes the insert itself the idempotency
    // check — a P2002 conflict means we've already processed this event.
    try {
      await prismaWithoutTenantScoping.processedWebhookEvent.create({
        data: {
          provider: "stripe",
          providerEventId: event.providerEventId,
          organizationId,
          eventType: event.type,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          payload: object as any,
        },
      });
    } catch (cause) {
      if (cause instanceof Error && "code" in cause && (cause as { code?: string }).code === "P2002") {
        return;
      }
      throw cause;
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const planKey = readMetadataString(object, "planKey");
        if (!organizationId || !planKey) break;
        await createSubscription({ organizationId, planKey });
        break;
      }
      case "invoice.paid": {
        if (!organizationId) break;
        const subscription = await findActiveSubscription(organizationId);
        if (subscription) await renewSubscription(organizationId, subscription.id);
        await recordPaidInvoice(organizationId, subscription?.id, object);
        break;
      }
      case "customer.subscription.deleted": {
        if (!organizationId) break;
        const subscription = await findActiveSubscription(organizationId);
        if (subscription) await terminateSubscription(organizationId, subscription.id);
        break;
      }
      case "customer.subscription.paused": {
        if (!organizationId) break;
        const subscription = await findActiveSubscription(organizationId);
        if (subscription) await pauseSubscription(organizationId, subscription.id);
        break;
      }
      case "customer.subscription.resumed": {
        if (!organizationId) break;
        const subscription = await findActiveSubscription(organizationId);
        if (subscription) await resumeSubscription(organizationId, subscription.id);
        break;
      }
      case "customer.subscription.updated": {
        if (!organizationId || object.cancel_at_period_end !== true) break;
        const subscription = await findActiveSubscription(organizationId);
        if (subscription) await cancelSubscription(organizationId, subscription.id);
        break;
      }
      default:
        break;
    }
  }

  return {
    id: "stripe",
    displayName: "Stripe",
    // Env-var config (STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET), same
    // precedent as Google/Apple OAuth — nothing for a Settings-driven config
    // form to render. See payment-provider.ts's header comment.
    configFields: [],
    isConfigured: async () => Boolean(apiKey && webhookSecret),
    createCheckoutSession,
    verifyWebhookEvent,
    handleWebhookEvent,
  };
}

function readMetadataString(object: Record<string, unknown>, key: string): string | undefined {
  const metadata = object.metadata as Record<string, unknown> | undefined;
  const value = metadata?.[key];
  return typeof value === "string" ? value : undefined;
}

function readMetadataOrganizationId(object: Record<string, unknown>): string | undefined {
  return readMetadataString(object, "organizationId") ?? (typeof object.client_reference_id === "string" ? object.client_reference_id : undefined);
}

// Goes through the tenant-scoped `db` client inside runWithTenant, not
// prismaWithoutTenantScoping with a manual organizationId filter — every
// tenant-scoped access in this codebase is structurally forced through the
// scoping extension (CLAUDE.md: "multi-tenancy is automatic, not opt-in"),
// so this stays covered by that guarantee instead of depending on nobody
// ever deleting the manual filter during a future edit.
async function findActiveSubscription(organizationId: string) {
  return runWithTenant(organizationId, async () =>
    db.subscription.findFirst({
      where: { status: { in: ["ACTIVE", "TRIALING", "PAUSED"] } },
      orderBy: { createdAt: "desc" },
    }),
  );
}

// FR-200/213: mirrors Stripe's paid invoice into our own immutable Invoice
// record. Phase 1 doesn't reproduce Stripe's line-item/tax detail (the tax
// engine is deferred per ROADMAP.md) — one summary line item carrying the
// amount actually paid is enough to give every paid invoice a durable,
// queryable, immutable record on our side. stripeInvoiceId's unique
// constraint makes this idempotent on top of the outer ProcessedWebhookEvent
// guard (belt-and-suspenders: a retry after a partial failure here would
// otherwise create a second Invoice for the same Stripe invoice).
async function recordPaidInvoice(
  organizationId: string,
  subscriptionId: string | undefined,
  object: Record<string, unknown>,
): Promise<void> {
  const stripeInvoiceId = typeof object.id === "string" ? object.id : undefined;
  if (!stripeInvoiceId) return;

  const existing = await prismaWithoutTenantScoping.invoice.findUnique({ where: { stripeInvoiceId } });
  if (existing) return;

  const amountPaid = typeof object.amount_paid === "number" ? object.amount_paid : 0;
  const currency = typeof object.currency === "string" ? object.currency : "usd";

  const draft = await createDraftInvoice({
    organizationId,
    subscriptionId,
    currency,
    stripeInvoiceId,
    lineItems: [{ description: "Subscription charge", unitAmountCents: amountPaid }],
  });
  const issued = await issueInvoice(organizationId, draft.id);
  await markInvoicePaid(organizationId, issued.id);
}

