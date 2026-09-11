import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import { inAppNotificationChannel, listInAppNotifications, listInAppNotificationsPage } from "../notifications/in-app-channel";

// Real DB, no mocks (this repo's convention) — the in-app channel's whole
// job is writing/reading a tenant-scoped table, so there's nothing
// meaningful to fake here.

const runId = Date.now().toString(36);
let orgAId: string;
let orgBId: string;
let userId: string;

describe("in-app notification channel", () => {
  beforeAll(async () => {
    const orgA = await prismaWithoutTenantScoping.organization.create({
      data: { name: `In-App Test Org A ${runId}`, slug: `in-app-test-org-a-${runId}` },
    });
    const orgB = await prismaWithoutTenantScoping.organization.create({
      data: { name: `In-App Test Org B ${runId}`, slug: `in-app-test-org-b-${runId}` },
    });
    const user = await prismaWithoutTenantScoping.user.create({
      data: { email: `in-app-test-${runId}@example.com` },
    });
    orgAId = orgA.id;
    orgBId = orgB.id;
    userId = user.id;
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.inAppNotification.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prismaWithoutTenantScoping.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
    await prismaWithoutTenantScoping.user.deleteMany({ where: { id: userId } });
  });

  it("has no config fields and is always configured — no external account needed", async () => {
    expect(inAppNotificationChannel.configFields).toEqual([]);
    await expect(inAppNotificationChannel.isConfigured()).resolves.toBe(true);
  });

  it("skips delivery (does not throw) when organizationId or userId is missing", async () => {
    await expect(
      inAppNotificationChannel.send({ kind: "test.kind", subject: "s", body: "b" }),
    ).resolves.toEqual({ ok: false, skipped: true, error: expect.any(String) });
    await expect(
      inAppNotificationChannel.send({ kind: "test.kind", organizationId: orgAId, subject: "s", body: "b" }),
    ).resolves.toEqual({ ok: false, skipped: true, error: expect.any(String) });
  });

  it("writes a real row and reports ok:true", async () => {
    const result = await inAppNotificationChannel.send({
      kind: "test.kind",
      organizationId: orgAId,
      userId,
      subject: "Hello",
      body: "World",
    });
    expect(result).toEqual({ ok: true });

    const rows = await listInAppNotifications(orgAId, userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.subject).toBe("Hello");
    expect(rows[0]?.body).toBe("World");
    expect(rows[0]?.kind).toBe("test.kind");
  });

  it("is tenant-scoped — another org's list doesn't see it", async () => {
    const rows = await listInAppNotifications(orgBId, userId);
    expect(rows).toHaveLength(0);
  });

  it("lists newest-first", async () => {
    await inAppNotificationChannel.send({ kind: "test.kind.2", organizationId: orgAId, userId, subject: "Second", body: "b" });
    const rows = await listInAppNotifications(orgAId, userId);
    expect(rows[0]?.subject).toBe("Second");
    expect(rows[1]?.subject).toBe("Hello");
  });

  it("listInAppNotificationsPage paginates within the org and can be narrowed to one userId, tenant-scoped", async () => {
    const otherUser = await prismaWithoutTenantScoping.user.create({
      data: { email: `in-app-test-other-${runId}@example.com` },
    });
    await inAppNotificationChannel.send({ kind: "test.kind.3", organizationId: orgAId, userId: otherUser.id, subject: "Third", body: "b" });

    const page = await listInAppNotificationsPage(orgAId, { limit: 1 });
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).not.toBeNull();

    const mine = await listInAppNotificationsPage(orgAId, { userId });
    expect(mine.items.every((n) => n.userId === userId)).toBe(true);

    const otherOrg = await listInAppNotificationsPage(orgBId, {});
    expect(otherOrg.items).toHaveLength(0);

    await prismaWithoutTenantScoping.inAppNotification.deleteMany({ where: { userId: otherUser.id } });
    await prismaWithoutTenantScoping.user.delete({ where: { id: otherUser.id } });
  });
});
