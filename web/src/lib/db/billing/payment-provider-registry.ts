import type { PaymentProvider } from "./payment-provider";

// The payment-provider half of CLAUDE.md's "provider adapter pattern"
// requirement — a plain in-process Map keyed by adapter id, structurally
// identical to auth/oauth-registry.ts (same rationale: which adapters
// *exist* is a code-level concern, a module ships its adapter and registers
// it; which of those registered adapters is actually *enabled/configured* is
// the data-level concern, handled by payment-provider-config.ts against the
// platform Settings service). Re-registering the same id (e.g. a
// hot-reloaded dev server re-evaluating the adapter module) is a harmless
// overwrite, not an error — no de-dup bookkeeping needed.
//
// Stripe is deliberately NOT registered here — see payment-provider.ts's
// header comment for why (env-var config, nothing for a registry-driven
// config UI to render, same as Google/Apple staying out of oauth-registry.ts).
// PayPal (paypal-provider.ts) self-registers on import.

const registry = new Map<string, PaymentProvider>();

export function registerPaymentProviderAdapter(adapter: PaymentProvider): void {
  registry.set(adapter.id, adapter);
}

export function getPaymentProviderAdapter(id: string): PaymentProvider | undefined {
  return registry.get(id);
}

export function listPaymentProviderAdapters(): PaymentProvider[] {
  return Array.from(registry.values());
}

/** Test/maintenance-only escape hatch — mirrors unregisterOAuthAdapter (oauth-registry.ts): needed so adapter registry tests don't leak dummy adapters into other test files sharing this module. Not exported from index.ts — internal to this package. */
export function unregisterPaymentProviderAdapter(id: string): void {
  registry.delete(id);
}
