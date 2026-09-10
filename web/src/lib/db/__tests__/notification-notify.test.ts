import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import { registerNotificationChannel, unregisterNotificationChannel } from "../notifications/channel-registry";
import { registerNotificationKinds } from "../notifications/notification-kind-registry";
import { NotificationKindNotFoundError, renderNotificationTemplate, sendNotification } from "../notifications/notify";
import { setUserSetting } from "../settings";
import type { NotificationChannel } from "../notifications/channel";

const runId = Date.now().toString(36);
const kindKey = `test-module-${runId}.thing_happened`;

function fakeChannel(id: string, configured: boolean, send = vi.fn().mockResolvedValue({ ok: true })): NotificationChannel {
  return {
    id,
    displayName: id,
    configFields: [],
    isConfigured: async () => configured,
    send,
  };
}

describe("renderNotificationTemplate", () => {
  it("substitutes {{variable}} placeholders", () => {
    expect(renderNotificationTemplate("Hello {{name}}, welcome to {{org}}", { name: "Ada", org: "Acme" })).toBe(
      "Hello Ada, welcome to Acme",
    );
  });

  it("leaves an unresolved placeholder as empty string rather than throwing", () => {
    expect(renderNotificationTemplate("Hello {{name}}", {})).toBe("Hello ");
  });
});

describe("sendNotification", () => {
  afterEach(() => {
    unregisterNotificationChannel(`${kindKey}-a`);
    unregisterNotificationChannel(`${kindKey}-b`);
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.notificationKind.deleteMany({ where: { key: kindKey } });
  });

  it("throws NotificationKindNotFoundError for an unregistered kind", async () => {
    await expect(sendNotification({ kind: "not.a.real.kind" })).rejects.toThrow(NotificationKindNotFoundError);
  });

  it("renders the kind's templates and dispatches to every configured channel, skipping unconfigured ones", async () => {
    await registerNotificationKinds([
      {
        key: kindKey,
        module: `test-module-${runId}`,
        subjectTemplate: "Hi {{name}}",
        bodyTemplate: "Welcome to {{org}}, {{name}}.",
      },
    ]);

    const configuredSend = vi.fn().mockResolvedValue({ ok: true });
    const configured = fakeChannel(`${kindKey}-a`, true, configuredSend);
    const unconfigured = fakeChannel(`${kindKey}-b`, false);
    registerNotificationChannel(configured);
    registerNotificationChannel(unconfigured);

    const results = await sendNotification({
      kind: kindKey,
      organizationId: "org_1",
      userId: "user_1",
      email: "x@example.com",
      variables: { name: "Ada", org: "Acme" },
    });

    expect(configuredSend).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: kindKey,
        organizationId: "org_1",
        userId: "user_1",
        email: "x@example.com",
        subject: "Hi Ada",
        body: "Welcome to Acme, Ada.",
      }),
    );

    const configuredResult = results.find((r) => r.channelId === `${kindKey}-a`);
    expect(configuredResult).toEqual({ channelId: `${kindKey}-a`, ok: true });

    const unconfiguredResult = results.find((r) => r.channelId === `${kindKey}-b`);
    expect(unconfiguredResult?.ok).toBe(false);
    expect(unconfiguredResult?.skipped).toBe(true);
  });

  it("respects the `only` filter, dispatching solely to named channels", async () => {
    const sendA = vi.fn().mockResolvedValue({ ok: true });
    const sendB = vi.fn().mockResolvedValue({ ok: true });
    registerNotificationChannel(fakeChannel(`${kindKey}-a`, true, sendA));
    registerNotificationChannel(fakeChannel(`${kindKey}-b`, true, sendB));

    await sendNotification({ kind: kindKey, only: [`${kindKey}-a`] });

    expect(sendA).toHaveBeenCalled();
    expect(sendB).not.toHaveBeenCalled();
  });

  it("one channel's send() rejecting doesn't stop the others (defense in depth even though the contract says channels shouldn't throw)", async () => {
    const sendB = vi.fn().mockResolvedValue({ ok: true });
    registerNotificationChannel(fakeChannel(`${kindKey}-a`, true, vi.fn().mockRejectedValue(new Error("boom"))));
    registerNotificationChannel(fakeChannel(`${kindKey}-b`, true, sendB));

    const results = await sendNotification({ kind: kindKey, only: [`${kindKey}-a`, `${kindKey}-b`] });

    expect(sendB).toHaveBeenCalled();
    const failed = results.find((r) => r.channelId === `${kindKey}-a`);
    expect(failed?.ok).toBe(false);
    expect(failed?.error).toContain("boom");
  });

  it("skips every channel when the recipient has opted out of the kind's preference category, without even checking isConfigured", async () => {
    const categorizedKey = `${kindKey}.categorized`;
    await registerNotificationKinds([
      {
        key: categorizedKey,
        module: `test-module-${runId}`,
        subjectTemplate: "Hi",
        bodyTemplate: "Body",
        category: "security_alerts",
      },
    ]);
    const isConfigured = vi.fn().mockResolvedValue(true);
    const send = vi.fn().mockResolvedValue({ ok: true });
    const channel: NotificationChannel = { id: `${kindKey}-a`, displayName: "a", configFields: [], isConfigured, send };
    registerNotificationChannel(channel);

    const optedOutUser = await prismaWithoutTenantScoping.user.create({ data: { email: `opted-out-${runId}@example.com` } });
    await setUserSetting(optedOutUser.id, { category: "notifications", key: "notifications.security_alerts", value: false });

    const results = await sendNotification({ kind: categorizedKey, userId: optedOutUser.id, only: [`${kindKey}-a`] });

    expect(isConfigured).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(results).toEqual([{ channelId: `${kindKey}-a`, ok: false, skipped: true, reason: "opted_out" }]);

    await prismaWithoutTenantScoping.notificationKind.deleteMany({ where: { key: categorizedKey } });
    await prismaWithoutTenantScoping.user.delete({ where: { id: optedOutUser.id } });
  });

  it("still dispatches when the recipient has no explicit preference row (default-enabled) or the kind's category is 'general'", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true });
    registerNotificationChannel({ id: `${kindKey}-a`, displayName: "a", configFields: [], isConfigured: async () => true, send });

    const noPreferenceUser = await prismaWithoutTenantScoping.user.create({ data: { email: `no-preference-${runId}@example.com` } });

    // kindKey (registered in the earlier test) has no explicit category -> defaults to "general", never gated.
    await sendNotification({ kind: kindKey, userId: noPreferenceUser.id, only: [`${kindKey}-a`] });

    expect(send).toHaveBeenCalled();

    await prismaWithoutTenantScoping.user.delete({ where: { id: noPreferenceUser.id } });
  });
});
