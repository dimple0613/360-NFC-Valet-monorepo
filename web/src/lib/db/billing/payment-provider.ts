// FR-210–213: payment processing is provider-adapter based; multiple
// providers can be active simultaneously (Phase 1 implemented exactly one —
// Stripe, per DECISIONS.md D-004 — behind this same contract, mirroring how
// auth/provider.ts is deliberately narrow so future adapters are pure
// additions). Webhook handling is split into two steps on purpose:
// verifying+parsing the raw payload (signature-checked) is separate from
// acting on it (idempotency-checked) — a caller can verify early (e.g. in an
// HTTP handler, before committing to a 200 response) and act afterward.
//
// This round (a real second provider, PayPal, proving the abstraction —
// mirroring how oauth-adapter.ts/oauth-registry.ts/oauth-provider-config.ts
// proved OAuthAdapter with Microsoft/Entra ID) widened this contract in two
// ways, both applied to the existing Stripe adapter with minimal internal
// changes (adding fields to createStripeProvider's returned object, not a
// rewrite):
//
//  1. `displayName` / `configFields` / `isConfigured()` were added, mirroring
//     OAuthAdapter's shape exactly, so a registry-driven Super Admin UI can
//     render a config form for ANY registered provider without a hardcoded
//     provider list. Stripe keeps its pre-existing env-var config (like
//     Google/Apple did for OAuth) — `configFields` is empty and
//     `isConfigured()` just checks `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`
//     are set — so Stripe is a real, registrable PaymentProvider but is
//     deliberately NOT registered into payment-provider-registry.ts (same
//     reasoning oauth-adapter.ts documents for Google/Apple staying out of
//     oauth-registry.ts): its config isn't Settings-driven, so it has nothing
//     for a registry-driven config UI to render. PayPal (paypal-provider.ts)
//     IS registered — it's the genuine proof of the config-driven half of
//     this contract, using payment-provider-config.ts (the Settings-backed
//     pattern, mirroring oauth-provider-config.ts) exactly as instructed:
//     reuse the existing pattern, don't invent a new one.
//  2. `verifyWebhookEvent` became async (`Promise<ProviderWebhookEvent>`).
//     Stripe's verification is a pure local HMAC check (no network call) and
//     stays that way — wrapping it in `async` changes nothing about its
//     behavior, only its call sites (now `await`ed). PayPal's verification is
//     NOT local: PayPal's documented, supported way to verify a webhook is a
//     server-to-server call to `/v1/notifications/verify-webhook-signature`
//     (there's no publicly documented local-HMAC equivalent the way Stripe
//     has one), so a synchronous contract would have forced PayPal's adapter
//     to lie about being synchronous. Widening the contract (rather than
//     inventing a parallel async-only adapter type) keeps exactly one
//     PaymentProvider shape for every provider, same principle as
//     OAuthAuthorizeResult's optional `codeVerifier` accommodating both
//     PKCE and non-PKCE providers without a second interface.
//
// Deliberately NOT added to this contract: a `cancelSubscription`/
// `updateSubscription` method some payment-adapter designs include. This
// codebase's Subscription lifecycle (subscriptions.ts, FR-160–163) is already
// provider-agnostic by design — it mutates our own Subscription row directly
// and is invoked either from a Tenant Admin action or from a provider's
// webhook handler reacting to a status change that already happened at the
// provider. Neither Stripe nor PayPal's adapter here calls out to the
// provider to *initiate* a cancellation (Stripe never did; nothing in Tenant
// Admin's billing UI calls it either) — adding an unused method to the
// contract just for symmetry would be speculative surface, not a real
// capability, so it's left out and flagged here rather than silently added.
// "Map provider-specific status -> canonical state" already happens inline,
// in both adapters' `handleWebhookEvent` (the `switch` on `event.type`).

/** One piece of per-provider configuration (API key/secret/environment/etc.) an adapter needs — declared, not hardcoded, so the Super Admin UI can render a config form for any registered adapter without knowing its provider-specific field names ahead of time. Identical shape to OAuthConfigField (oauth-adapter.ts) — kept as its own type rather than a shared import so the payment and auth adapter contracts stay independently evolvable, matching how this codebase already keeps its platform-role and tenant-role RBAC systems structurally similar but textually separate. */
export interface PaymentProviderConfigField {
  /** Stored under `payment_provider.<adapter.id>.<key>` via payment-provider-config.ts. */
  key: string;
  label: string;
  /** Encrypted at rest + redacted in listings, same convention as the Settings service (settings.ts). */
  sensitive: boolean;
  required: boolean;
}

export interface CheckoutSessionInput {
  organizationId: string;
  planKey: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  trialDays?: number;
}

export interface CheckoutSessionResult {
  checkoutUrl: string;
  providerSessionId: string;
}

export interface ProviderWebhookEvent {
  /** Provider-specific event type string, e.g. Stripe's "customer.subscription.updated". */
  type: string;
  /** Stable id for idempotency (FR-213) — this provider's unique event identifier. */
  providerEventId: string;
  data: unknown;
}

export interface PaymentProvider {
  /** URL-safe, stable identifier — "stripe" / "paypal" — never rename once deployed (ProcessedWebhookEvent/Invoice/Subscription rows key provider-specific data off it). */
  readonly id: string;
  /** Shown on the Super Admin config form/status card. */
  readonly displayName: string;
  readonly configFields: PaymentProviderConfigField[];
  /** True only when every required config field is set AND (for Settings-driven adapters) the provider has been explicitly enabled — mirrors OAuthAdapter.isConfigured(). Stripe's env-var-only implementation just checks its env vars are present (no separate enable flag exists for it, same as Google/Apple). */
  isConfigured(): Promise<boolean>;
  createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult>;
  /** Verifies the webhook signature/authenticity and parses the payload. Throws (rejects) on an invalid/unverifiable signature — never trust an unverified payload. Async: see this file's header comment for why (PayPal's verification is a real network call; Stripe's stays a local, synchronous-under-the-hood HMAC check). */
  verifyWebhookEvent(rawBody: string | Buffer, signatureHeader: string): Promise<ProviderWebhookEvent>;
  /** Idempotent (FR-213): safe to call more than once for the same event (provider retries on failure). */
  handleWebhookEvent(event: ProviderWebhookEvent): Promise<void>;
}
