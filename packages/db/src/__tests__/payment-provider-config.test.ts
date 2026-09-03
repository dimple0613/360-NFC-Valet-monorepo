import { afterAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import {
  getPaymentProviderConfigValue,
  hasRequiredPaymentProviderConfig,
  isPaymentProviderEnabled,
  listPaymentProviderStatuses,
  paymentProviderConfigSettingKey,
  setPaymentProviderConfigValue,
  setPaymentProviderEnabled,
} from "../billing/payment-provider-config";
import { registerPaymentProviderAdapter, unregisterPaymentProviderAdapter } from "../billing/payment-provider-registry";
import type { PaymentProvider } from "../billing/payment-provider";

// Generic Settings-backed config storage any PaymentProvider adapter can use
// — direct structural mirror of auth/__tests__/oauth-provider-config.test.ts.
// Tested against a throwaway dummy adapter id (not the real Stripe/PayPal
// ones) so this suite never touches real provider config. Reuses the exact
// same PlatformSetting rows settings.ts's own suite already covers — only
// the key-namespacing/status-aggregation logic here is new.

const runId = Date.now().toString(36);
const adapterId = `test-payment-adapter-${runId}`;

function dummyAdapter(): PaymentProvider {
  return {
    id: adapterId,
    displayName: "Test Payment Adapter",
    configFields: [
      { key: "client_id", label: "Client ID", sensitive: false, required: true },
      { key: "client_secret", label: "Client secret", sensitive: true, required: true },
      { key: "optional_hint", label: "Optional hint", sensitive: false, required: false },
    ],
    isConfigured: async () => false,
    createCheckoutSession: async () => ({ checkoutUrl: "https://example.com", providerSessionId: "sess" }),
    verifyWebhookEvent: async () => ({ type: "test.event", providerEventId: "evt", data: {} }),
    handleWebhookEvent: async () => undefined,
  };
}

describe("payment provider config (Settings-backed)", () => {
  afterAll(async () => {
    unregisterPaymentProviderAdapter(adapterId);
    await prismaWithoutTenantScoping.platformSetting.deleteMany({
      where: { key: { startsWith: `payment_provider.${adapterId}.` } },
    });
  });

  it("namespaces the settings key under payment_provider.<adapterId>.<field>", () => {
    expect(paymentProviderConfigSettingKey(adapterId, "client_id")).toBe(`payment_provider.${adapterId}.client_id`);
  });

  it("returns undefined for a field that was never set", async () => {
    await expect(getPaymentProviderConfigValue(adapterId, "client_id")).resolves.toBeUndefined();
  });

  it("round-trips a non-sensitive field value", async () => {
    await setPaymentProviderConfigValue({ adapterId, field: "client_id", value: "abc-123", sensitive: false });
    await expect(getPaymentProviderConfigValue(adapterId, "client_id")).resolves.toBe("abc-123");
  });

  it("round-trips a sensitive field value (encrypted at rest, same as settings.ts)", async () => {
    await setPaymentProviderConfigValue({ adapterId, field: "client_secret", value: "top-secret", sensitive: true });
    await expect(getPaymentProviderConfigValue(adapterId, "client_secret")).resolves.toBe("top-secret");
    const row = await prismaWithoutTenantScoping.platformSetting.findUniqueOrThrow({
      where: { key: paymentProviderConfigSettingKey(adapterId, "client_secret") },
    });
    expect(row.value).not.toContain("top-secret");
  });

  it("defaults to disabled until explicitly enabled", async () => {
    await expect(isPaymentProviderEnabled(adapterId)).resolves.toBe(false);
    await setPaymentProviderEnabled(adapterId, true);
    await expect(isPaymentProviderEnabled(adapterId)).resolves.toBe(true);
    await setPaymentProviderEnabled(adapterId, false);
    await expect(isPaymentProviderEnabled(adapterId)).resolves.toBe(false);
  });

  it("hasRequiredPaymentProviderConfig is false until every required field is set, ignores optional fields", async () => {
    const freshId = `${adapterId}-fresh`;
    const adapter: PaymentProvider = { ...dummyAdapter(), id: freshId };
    try {
      expect(await hasRequiredPaymentProviderConfig(adapter)).toBe(false);
      await setPaymentProviderConfigValue({ adapterId: freshId, field: "client_id", value: "id", sensitive: false });
      expect(await hasRequiredPaymentProviderConfig(adapter)).toBe(false); // client_secret still missing
      await setPaymentProviderConfigValue({ adapterId: freshId, field: "client_secret", value: "secret", sensitive: true });
      expect(await hasRequiredPaymentProviderConfig(adapter)).toBe(true); // optional_hint never set, doesn't block
    } finally {
      await prismaWithoutTenantScoping.platformSetting.deleteMany({
        where: { key: { startsWith: `payment_provider.${freshId}.` } },
      });
    }
  });

  it("listPaymentProviderStatuses reflects registered adapters, redacts sensitive values, and reports configured only when enabled + required fields present", async () => {
    const adapter = dummyAdapter();
    registerPaymentProviderAdapter(adapter);
    await setPaymentProviderEnabled(adapterId, true); // client_id/client_secret already set by earlier tests in this file

    let statuses = await listPaymentProviderStatuses();
    let mine = statuses.find((s) => s.id === adapterId);
    expect(mine).toBeDefined();
    expect(mine!.displayName).toBe("Test Payment Adapter");
    expect(mine!.enabled).toBe(true);
    expect(mine!.configured).toBe(true); // client_id + client_secret both set above

    const secretField = mine!.fields.find((f) => f.key === "client_secret")!;
    expect(secretField.hasValue).toBe(true);
    expect(secretField.value).toBeNull(); // sensitive — never handed back for display

    const idField = mine!.fields.find((f) => f.key === "client_id")!;
    expect(idField.value).toBe("abc-123"); // non-sensitive — real value shown

    await setPaymentProviderEnabled(adapterId, false);
    statuses = await listPaymentProviderStatuses();
    mine = statuses.find((s) => s.id === adapterId);
    expect(mine!.enabled).toBe(false);
    expect(mine!.configured).toBe(false); // disabled overrides having all fields present
  });
});
