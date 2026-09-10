import { createStripeProvider } from "./stripe-provider";
import { listPaymentProviderAdapters } from "./payment-provider-registry";
import type { PaymentProvider } from "./payment-provider";

// Checkout-provider resolution for the two subscription entry points (the
// signup "select-a-plan" flow and the Tenant Admin billing page). Historically
// both hard-coded `createStripeProvider()` — which is why the Settings-driven
// "Payment providers" page (payment-provider-config.ts, PayPal) had zero
// effect on what checkout actually did. Resolution precedence:
//
//  1. Any *registered* adapter that `isConfigured()` (e.g. PayPal enabled AND
//     every required field stored via the Super Admin Settings page) — first
//     registered match wins. A Super Admin explicitly enabling + completing a
//     Settings-driven provider is the highest-intent signal we have, so it
//     outranks the env-var fallback below.
//  2. Stripe from env vars (`STRIPE_SECRET_KEY`), the Phase-1 provider.
//  3. Otherwise throw — callers fold that into a friendly "not configured"
//     redirect, never a 500.
//
// Stripe's checkout gate here is deliberately just "apiKey present", matching
// `createCheckoutSession`'s own guard (it only needs the API key to make the
// session; `STRIPE_WEBHOOK_SECRET` is only relevant to webhook verification,
// not checkout initiation), so an api-key-only deployment keeps working
// exactly as before. Registered adapters gate on their full `isConfigured()`,
// because for Settings-driven providers "enabled + all required fields" *is*
// the definition of usable (payment-provider-config.ts, paypal-provider.ts).
export class NoPaymentProviderConfiguredError extends Error {
  constructor() {
    super("No payment provider is configured (no Settings-enabled adapter, and STRIPE_SECRET_KEY is unset)");
    this.name = "NoPaymentProviderConfiguredError";
  }
}

export async function resolveCheckoutProvider(): Promise<PaymentProvider> {
  for (const adapter of listPaymentProviderAdapters()) {
    if (await adapter.isConfigured()) return adapter;
  }

  const stripe = createStripeProvider();
  if (process.env.STRIPE_SECRET_KEY) return stripe;

  throw new NoPaymentProviderConfiguredError();
}