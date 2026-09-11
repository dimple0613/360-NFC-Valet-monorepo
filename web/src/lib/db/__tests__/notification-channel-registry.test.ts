import { afterEach, describe, expect, it } from "vitest";
import {
  getNotificationChannel,
  listNotificationChannels,
  registerNotificationChannel,
  unregisterNotificationChannel,
} from "../notifications/channel-registry";
import type { NotificationChannel } from "../notifications/channel";

// Pure registry logic — no DB involved. Direct structural mirror of
// auth/__tests__/oauth-registry.test.ts and
// __tests__/payment-provider-registry.test.ts, proving the
// notification-channel registry is the third instance of the same contract.

function dummyChannel(id: string): NotificationChannel {
  return {
    id,
    displayName: `Dummy ${id}`,
    configFields: [],
    isConfigured: async () => true,
    send: async () => ({ ok: true }),
  };
}

describe("notification channel registry", () => {
  afterEach(() => {
    unregisterNotificationChannel("dummy-a");
    unregisterNotificationChannel("dummy-b");
  });

  it("returns undefined for an unregistered id", () => {
    expect(getNotificationChannel("dummy-a")).toBeUndefined();
  });

  it("registers a channel and makes it retrievable by id", () => {
    const channel = dummyChannel("dummy-a");
    registerNotificationChannel(channel);
    expect(getNotificationChannel("dummy-a")).toBe(channel);
  });

  it("lists every registered channel", () => {
    registerNotificationChannel(dummyChannel("dummy-a"));
    registerNotificationChannel(dummyChannel("dummy-b"));
    const ids = listNotificationChannels().map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(["dummy-a", "dummy-b"]));
  });

  it("re-registering the same id overwrites rather than duplicating", () => {
    registerNotificationChannel(dummyChannel("dummy-a"));
    const replacement = dummyChannel("dummy-a");
    registerNotificationChannel(replacement);
    expect(getNotificationChannel("dummy-a")).toBe(replacement);
    expect(listNotificationChannels().filter((c) => c.id === "dummy-a")).toHaveLength(1);
  });

  it("unregistering removes the channel", () => {
    registerNotificationChannel(dummyChannel("dummy-a"));
    unregisterNotificationChannel("dummy-a");
    expect(getNotificationChannel("dummy-a")).toBeUndefined();
  });
});
