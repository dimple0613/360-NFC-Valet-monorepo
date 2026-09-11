import { afterAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import {
  getNotificationChannelConfigValue,
  hasRequiredNotificationChannelConfig,
  isNotificationChannelEnabled,
  listNotificationChannelStatuses,
  notificationChannelConfigSettingKey,
  setNotificationChannelConfigValue,
  setNotificationChannelEnabled,
} from "../notifications/channel-config";
import { registerNotificationChannel, unregisterNotificationChannel } from "../notifications/channel-registry";
import type { NotificationChannel } from "../notifications/channel";

// Generic Settings-backed config storage any NotificationChannel can use —
// tested against a throwaway dummy channel id (not the real email/webhook
// ones), direct structural mirror of
// auth/__tests__/oauth-provider-config.test.ts and
// __tests__/payment-provider-config.test.ts.

const runId = Date.now().toString(36);
const channelId = `test-channel-${runId}`;

function dummyChannel(): NotificationChannel {
  return {
    id: channelId,
    displayName: "Test Channel",
    configFields: [
      { key: "target", label: "Target", sensitive: false, required: true },
      { key: "secret", label: "Secret", sensitive: true, required: true },
      { key: "optional_hint", label: "Optional hint", sensitive: false, required: false },
    ],
    isConfigured: async () => false,
    send: async () => ({ ok: true }),
  };
}

describe("notification channel config (Settings-backed)", () => {
  afterAll(async () => {
    unregisterNotificationChannel(channelId);
    await prismaWithoutTenantScoping.platformSetting.deleteMany({
      where: { key: { startsWith: `notification_channel.${channelId}.` } },
    });
  });

  it("namespaces the settings key under notification_channel.<channelId>.<field>", () => {
    expect(notificationChannelConfigSettingKey(channelId, "target")).toBe(`notification_channel.${channelId}.target`);
  });

  it("returns undefined for a field that was never set", async () => {
    await expect(getNotificationChannelConfigValue(channelId, "target")).resolves.toBeUndefined();
  });

  it("round-trips a non-sensitive field value", async () => {
    await setNotificationChannelConfigValue({ channelId, field: "target", value: "https://example.com/hook", sensitive: false });
    await expect(getNotificationChannelConfigValue(channelId, "target")).resolves.toBe("https://example.com/hook");
  });

  it("round-trips a sensitive field value (encrypted at rest, same as settings.ts)", async () => {
    await setNotificationChannelConfigValue({ channelId, field: "secret", value: "top-secret", sensitive: true });
    await expect(getNotificationChannelConfigValue(channelId, "secret")).resolves.toBe("top-secret");
    const row = await prismaWithoutTenantScoping.platformSetting.findUniqueOrThrow({
      where: { key: notificationChannelConfigSettingKey(channelId, "secret") },
    });
    expect(row.value).not.toContain("top-secret");
  });

  it("defaults to disabled until explicitly enabled", async () => {
    await expect(isNotificationChannelEnabled(channelId)).resolves.toBe(false);
    await setNotificationChannelEnabled(channelId, true);
    await expect(isNotificationChannelEnabled(channelId)).resolves.toBe(true);
    await setNotificationChannelEnabled(channelId, false);
    await expect(isNotificationChannelEnabled(channelId)).resolves.toBe(false);
  });

  it("hasRequiredNotificationChannelConfig is false until every required field is set, ignores optional fields", async () => {
    const freshId = `${channelId}-fresh`;
    const channel: NotificationChannel = { ...dummyChannel(), id: freshId };
    try {
      expect(await hasRequiredNotificationChannelConfig(channel)).toBe(false);
      await setNotificationChannelConfigValue({ channelId: freshId, field: "target", value: "t", sensitive: false });
      expect(await hasRequiredNotificationChannelConfig(channel)).toBe(false); // secret still missing
      await setNotificationChannelConfigValue({ channelId: freshId, field: "secret", value: "s", sensitive: true });
      expect(await hasRequiredNotificationChannelConfig(channel)).toBe(true); // optional_hint never set, doesn't block
    } finally {
      await prismaWithoutTenantScoping.platformSetting.deleteMany({
        where: { key: { startsWith: `notification_channel.${freshId}.` } },
      });
    }
  });

  it("listNotificationChannelStatuses reflects registered channels, redacts sensitive values, and reports configured only when enabled + required fields present", async () => {
    const channel = dummyChannel();
    registerNotificationChannel(channel);
    await setNotificationChannelEnabled(channelId, true); // target/secret already set by earlier tests in this file

    let statuses = await listNotificationChannelStatuses();
    let mine = statuses.find((s) => s.id === channelId);
    expect(mine).toBeDefined();
    expect(mine!.displayName).toBe("Test Channel");
    expect(mine!.enabled).toBe(true);
    expect(mine!.configured).toBe(true);

    const secretField = mine!.fields.find((f) => f.key === "secret")!;
    expect(secretField.hasValue).toBe(true);
    expect(secretField.value).toBeNull(); // sensitive — never handed back for display

    const targetField = mine!.fields.find((f) => f.key === "target")!;
    expect(targetField.value).toBe("https://example.com/hook"); // non-sensitive — real value shown

    await setNotificationChannelEnabled(channelId, false);
    statuses = await listNotificationChannelStatuses();
    mine = statuses.find((s) => s.id === channelId);
    expect(mine!.enabled).toBe(false);
    expect(mine!.configured).toBe(false); // disabled overrides having all fields present
  });
});
