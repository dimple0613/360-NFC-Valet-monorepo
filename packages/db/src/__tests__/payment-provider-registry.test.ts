import { afterEach, describe, expect, it } from "vitest";
import {
  getPaymentProviderAdapter,
  listPaymentProviderAdapters,
  registerPaymentProviderAdapter,
  unregisterPaymentProviderAdapter,
} from "../billing/payment-provider-registry";
import type { PaymentProvider } from "../billing/payment-provider";

// Pure registry logic — no DB involved. Direct structural mirror of
// auth/__tests__/oauth-registry.test.ts, proving the payment-provider
// registry has the exact same contract. Uses a dummy adapter (not the real
// Stripe/PayPal ones) so this file's assertions stay independent of either.

function dummyAdapter(id: string): PaymentProvider {
  return {
    id,
    displayName: `Dummy ${id}`,
    configFields: [],
    isConfigured: async () => true,
    createCheckoutSession: async () => ({ checkoutUrl: `https://example.com/checkout/${id}`, providerSessionId: "sess" }),
    verifyWebhookEvent: async () => ({ type: "test.event", providerEventId: "evt", data: {} }),
    handleWebhookEvent: async () => undefined,
  };
}

describe("payment provider adapter registry", () => {
  afterEach(() => {
    unregisterPaymentProviderAdapter("dummy-a");
    unregisterPaymentProviderAdapter("dummy-b");
  });

  it("returns undefined for an unregistered id", () => {
    expect(getPaymentProviderAdapter("dummy-a")).toBeUndefined();
  });

  it("registers an adapter and makes it retrievable by id", () => {
    const adapter = dummyAdapter("dummy-a");
    registerPaymentProviderAdapter(adapter);
    expect(getPaymentProviderAdapter("dummy-a")).toBe(adapter);
  });

  it("lists every registered adapter", () => {
    registerPaymentProviderAdapter(dummyAdapter("dummy-a"));
    registerPaymentProviderAdapter(dummyAdapter("dummy-b"));
    const ids = listPaymentProviderAdapters().map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(["dummy-a", "dummy-b"]));
  });

  it("re-registering the same id overwrites rather than duplicating", () => {
    registerPaymentProviderAdapter(dummyAdapter("dummy-a"));
    const replacement = dummyAdapter("dummy-a");
    registerPaymentProviderAdapter(replacement);
    expect(getPaymentProviderAdapter("dummy-a")).toBe(replacement);
    expect(listPaymentProviderAdapters().filter((a) => a.id === "dummy-a")).toHaveLength(1);
  });

  it("unregistering removes the adapter", () => {
    registerPaymentProviderAdapter(dummyAdapter("dummy-a"));
    unregisterPaymentProviderAdapter("dummy-a");
    expect(getPaymentProviderAdapter("dummy-a")).toBeUndefined();
  });
});
