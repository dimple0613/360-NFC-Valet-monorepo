import { afterAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import {
  getNotificationKind,
  listNotificationKinds,
  NotificationKindKeyConflictError,
  registerNotificationKinds,
} from "../notifications/notification-kind-registry";

// Direct structural mirror of __tests__/permission-registry.test.ts and
// __tests__/billing-resource-types.test.ts — NotificationKind is a global
// catalog (see schema.prisma), same self-registering, idempotent-upsert-by-key
// pattern.

const runId = Date.now().toString(36);
const key = `test-module-${runId}.thing_happened`;

describe("registerNotificationKinds", () => {
  afterAll(async () => {
    await prismaWithoutTenantScoping.notificationKind.deleteMany({ where: { key } });
  });

  it("creates a new notification kind", async () => {
    await registerNotificationKinds([
      {
        key,
        module: `test-module-${runId}`,
        description: "v1",
        subjectTemplate: "Thing happened",
        bodyTemplate: "The thing {{thing}} happened.",
      },
    ]);
    const found = await getNotificationKind(key);
    expect(found?.subjectTemplate).toBe("Thing happened");
    expect(found?.bodyTemplate).toBe("The thing {{thing}} happened.");
  });

  it("is idempotent: re-registering the same module updates in place instead of duplicating", async () => {
    await registerNotificationKinds([
      {
        key,
        module: `test-module-${runId}`,
        description: "v2",
        subjectTemplate: "Thing happened again",
        bodyTemplate: "The thing {{thing}} happened again.",
      },
    ]);
    const matches = await prismaWithoutTenantScoping.notificationKind.findMany({ where: { key } });
    expect(matches).toHaveLength(1);
    expect(matches[0]?.subjectTemplate).toBe("Thing happened again");
  });

  it("throws NotificationKindKeyConflictError when a different module claims an existing key", async () => {
    await expect(
      registerNotificationKinds([
        {
          key,
          module: `other-module-${runId}`,
          subjectTemplate: "x",
          bodyTemplate: "y",
        },
      ]),
    ).rejects.toThrow(NotificationKindKeyConflictError);
  });

  it("listNotificationKinds includes registered kinds", async () => {
    const kinds = await listNotificationKinds();
    expect(kinds.some((k) => k.key === key)).toBe(true);
  });

  it("defaults category to 'general' when omitted, and honors an explicit category (used by sendNotification's preference-opt-out gate)", async () => {
    const found = await getNotificationKind(key);
    expect(found?.category).toBe("general");

    const categorizedKey = `${key}.categorized`;
    await registerNotificationKinds([
      {
        key: categorizedKey,
        module: `test-module-${runId}`,
        subjectTemplate: "x",
        bodyTemplate: "y",
        category: "security_alerts",
      },
    ]);
    const categorized = await getNotificationKind(categorizedKey);
    expect(categorized?.category).toBe("security_alerts");
    await prismaWithoutTenantScoping.notificationKind.deleteMany({ where: { key: categorizedKey } });
  });
});
