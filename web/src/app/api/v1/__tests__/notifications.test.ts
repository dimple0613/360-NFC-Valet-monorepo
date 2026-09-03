import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, prismaWithoutTenantScoping, runWithTenant } from "@saasclaude/db";
import { GET } from "../notifications/route";
import { apiRequest, seedApiKey, seedOrganization, jsonOf } from "./test-helpers";

const runId = Date.now().toString(36);

describe("/api/v1/notifications", () => {
  let org: { id: string };
  let otherOrg: { id: string };
  let readKey: string;
  let noScopeKey: string;
  let user: { id: string };
  let notification: { id: string };

  beforeAll(async () => {
    org = await seedOrganization("REST Notifications Org");
    otherOrg = await seedOrganization("REST Notifications Other Org");
    readKey = (await seedApiKey(org.id, ["core.notifications.read"])).rawKey;
    noScopeKey = (await seedApiKey(org.id, ["core.organization.read"])).rawKey;

    user = await prismaWithoutTenantScoping.user.create({
      data: { email: `notifications-rest-${runId}@example.com` },
    });
    notification = await runWithTenant(org.id, async () =>
      db.inAppNotification.create({
        data: { organizationId: org.id, userId: user.id, kind: "test.kind", subject: "REST Test", body: "body" },
      }),
    );
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.inAppNotification.deleteMany({ where: { organizationId: { in: [org.id, otherOrg.id] } } });
    await prismaWithoutTenantScoping.apiKey.deleteMany({ where: { organizationId: { in: [org.id, otherOrg.id] } } });
    await prismaWithoutTenantScoping.organization.deleteMany({ where: { id: { in: [org.id, otherOrg.id] } } });
    await prismaWithoutTenantScoping.user.deleteMany({ where: { id: user.id } });
  });

  it("401s with no key", async () => {
    expect((await GET(apiRequest("/notifications"), {})).status).toBe(401);
  });

  it("403s without core.notifications.read", async () => {
    expect((await GET(apiRequest("/notifications", { token: noScopeKey }), {})).status).toBe(403);
  });

  it("200s with the org's notifications, never another org's", async () => {
    const res = await GET(apiRequest("/notifications", { token: readKey }), {});
    expect(res.status).toBe(200);
    const body = (await jsonOf(res)) as { notifications: { id: string; subject: string }[]; nextCursor: string | null };
    expect(body.notifications.some((n) => n.id === notification.id)).toBe(true);
  });

  it("?userId= narrows to one member", async () => {
    const otherUser = await prismaWithoutTenantScoping.user.create({
      data: { email: `notifications-rest-other-${runId}@example.com` },
    });
    await runWithTenant(org.id, async () =>
      db.inAppNotification.create({
        data: { organizationId: org.id, userId: otherUser.id, kind: "test.kind", subject: "Other", body: "body" },
      }),
    );

    const res = await GET(apiRequest(`/notifications?userId=${user.id}`, { token: readKey }), {});
    const body = (await jsonOf(res)) as { notifications: { id: string }[] };
    expect(body.notifications.map((n) => n.id)).toEqual([notification.id]);

    await prismaWithoutTenantScoping.inAppNotification.deleteMany({ where: { userId: otherUser.id } });
    await prismaWithoutTenantScoping.user.deleteMany({ where: { id: otherUser.id } });
  });
});
