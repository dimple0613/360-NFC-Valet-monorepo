import { afterAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import {
  getOAuthProviderConfigValue,
  hasRequiredOAuthProviderConfig,
  isOAuthProviderEnabled,
  listOAuthProviderStatuses,
  oauthConfigSettingKey,
  setOAuthProviderConfigValue,
  setOAuthProviderEnabled,
} from "../auth/oauth-provider-config";
import { registerOAuthAdapter, unregisterOAuthAdapter } from "../auth/oauth-registry";
import type { OAuthAdapter } from "../auth/oauth-adapter";

// Generic Settings-backed config storage any OAuthAdapter can use — tested
// against a throwaway dummy adapter id (not the real Microsoft one) so this
// suite never touches real provider config. Reuses the exact same
// PlatformSetting rows the settings.ts service (and its own test suite)
// already covers — only the key-namespacing/status-aggregation logic here is
// new, so that's what's actually under test.

const runId = Date.now().toString(36);
const adapterId = `test-oauth-adapter-${runId}`;

function dummyAdapter(): OAuthAdapter {
  return {
    id: adapterId,
    displayName: "Test Adapter",
    configFields: [
      { key: "client_id", label: "Client ID", sensitive: false, required: true },
      { key: "client_secret", label: "Client secret", sensitive: true, required: true },
      { key: "optional_hint", label: "Optional hint", sensitive: false, required: false },
    ],
    isConfigured: async () => false,
    beginAuth: async () => ({ url: "https://example.com", state: "s" }),
    completeAuth: async () => ({ provider: adapterId, providerUserId: "sub", email: "x@example.com", emailVerified: true }),
  };
}

describe("oauth provider config (Settings-backed)", () => {
  afterAll(async () => {
    unregisterOAuthAdapter(adapterId);
    await prismaWithoutTenantScoping.platformSetting.deleteMany({
      where: { key: { startsWith: `oauth_provider.${adapterId}.` } },
    });
  });

  it("namespaces the settings key under oauth_provider.<adapterId>.<field>", () => {
    expect(oauthConfigSettingKey(adapterId, "client_id")).toBe(`oauth_provider.${adapterId}.client_id`);
  });

  it("returns undefined for a field that was never set", async () => {
    await expect(getOAuthProviderConfigValue(adapterId, "client_id")).resolves.toBeUndefined();
  });

  it("round-trips a non-sensitive field value", async () => {
    await setOAuthProviderConfigValue({ adapterId, field: "client_id", value: "abc-123", sensitive: false });
    await expect(getOAuthProviderConfigValue(adapterId, "client_id")).resolves.toBe("abc-123");
  });

  it("round-trips a sensitive field value (encrypted at rest, same as settings.ts)", async () => {
    await setOAuthProviderConfigValue({ adapterId, field: "client_secret", value: "top-secret", sensitive: true });
    await expect(getOAuthProviderConfigValue(adapterId, "client_secret")).resolves.toBe("top-secret");
    const row = await prismaWithoutTenantScoping.platformSetting.findUniqueOrThrow({
      where: { key: oauthConfigSettingKey(adapterId, "client_secret") },
    });
    expect(row.value).not.toContain("top-secret");
  });

  it("defaults to disabled until explicitly enabled", async () => {
    await expect(isOAuthProviderEnabled(adapterId)).resolves.toBe(false);
    await setOAuthProviderEnabled(adapterId, true);
    await expect(isOAuthProviderEnabled(adapterId)).resolves.toBe(true);
    await setOAuthProviderEnabled(adapterId, false);
    await expect(isOAuthProviderEnabled(adapterId)).resolves.toBe(false);
  });

  it("hasRequiredOAuthProviderConfig is false until every required field is set, ignores optional fields", async () => {
    const freshId = `${adapterId}-fresh`;
    const adapter: OAuthAdapter = { ...dummyAdapter(), id: freshId };
    try {
      expect(await hasRequiredOAuthProviderConfig(adapter)).toBe(false);
      await setOAuthProviderConfigValue({ adapterId: freshId, field: "client_id", value: "id", sensitive: false });
      expect(await hasRequiredOAuthProviderConfig(adapter)).toBe(false); // client_secret still missing
      await setOAuthProviderConfigValue({ adapterId: freshId, field: "client_secret", value: "secret", sensitive: true });
      expect(await hasRequiredOAuthProviderConfig(adapter)).toBe(true); // optional_hint never set, doesn't block
    } finally {
      await prismaWithoutTenantScoping.platformSetting.deleteMany({
        where: { key: { startsWith: `oauth_provider.${freshId}.` } },
      });
    }
  });

  it("listOAuthProviderStatuses reflects registered adapters, redacts sensitive values, and reports configured only when enabled + required fields present", async () => {
    const adapter = dummyAdapter();
    registerOAuthAdapter(adapter);
    await setOAuthProviderEnabled(adapterId, true); // client_id/client_secret already set by earlier tests in this file

    let statuses = await listOAuthProviderStatuses();
    let mine = statuses.find((s) => s.id === adapterId);
    expect(mine).toBeDefined();
    expect(mine!.displayName).toBe("Test Adapter");
    expect(mine!.enabled).toBe(true);
    expect(mine!.configured).toBe(true); // client_id + client_secret both set above

    const secretField = mine!.fields.find((f) => f.key === "client_secret")!;
    expect(secretField.hasValue).toBe(true);
    expect(secretField.value).toBeNull(); // sensitive — never handed back for display

    const idField = mine!.fields.find((f) => f.key === "client_id")!;
    expect(idField.value).toBe("abc-123"); // non-sensitive — real value shown

    await setOAuthProviderEnabled(adapterId, false);
    statuses = await listOAuthProviderStatuses();
    mine = statuses.find((s) => s.id === adapterId);
    expect(mine!.enabled).toBe(false);
    expect(mine!.configured).toBe(false); // disabled overrides having all fields present
  });
});
