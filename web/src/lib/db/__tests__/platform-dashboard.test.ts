import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping, db } from "../client";
import { runWithTenant } from "../tenant-context";
import { writeAuditLog } from "../audit-log";
import { createPlanVersion } from "../billing/plans";
import {
  getOrganizationGrowth,
  getPlanDistribution,
  listRecentActivity,
  listRecentCustomers,
  listRecentSubscriptions,
} from "../platform-dashboard";

const runId = Date.now().toString(36);

describe("platform dashboard (cross-org, Super Admin)", () => {
  let org: { id: string; name: string };
  let plan: { id: string; name: string };
  let actor: { id: string; email: string };

  beforeAll(async () => {
    org = await prismaWithoutTenantScoping.organization.create({
      data: { name: `Dashboard Org ${runId}`, slug: `dashboard-org-${runId}` },
    });
    actor = await prismaWithoutTenantScoping.user.create({ data: { email: `dashboard-actor-${runId}@example.com` } });
    const planVersion = await createPlanVersion({
      key: `dashboard-plan-${runId}`,
      name: `Dashboard Plan ${runId}`,
      type: "MONTHLY",
      visibility: "PUBLIC",
    });
    plan = { id: planVersion.id, name: planVersion.name };

    await prismaWithoutTenantScoping.subscription.create({
      data: {
        organizationId: org.id,
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await runWithTenant(org.id, async () =>
      writeAuditLog({ module: "core", action: "dashboard.test.event", actorUserId: actor.id }),
    );
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.auditLog.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.subscription.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.plan.deleteMany({ where: { id: plan.id } });
    await prismaWithoutTenantScoping.organization.delete({ where: { id: org.id } });
    await prismaWithoutTenantScoping.user.delete({ where: { id: actor.id } });
  });

  it("getOrganizationGrowth returns a cumulative, non-decreasing series including today's total", async () => {
    const points = await getOrganizationGrowth(7);
    expect(points.length).toBe(8);
    for (let i = 1; i < points.length; i++) {
      expect(points[i]!.totalOrganizations).toBeGreaterThanOrEqual(points[i - 1]!.totalOrganizations);
    }
    const totalNow = await prismaWithoutTenantScoping.organization.count();
    expect(points.at(-1)!.totalOrganizations).toBe(totalNow);
  });

  it("getPlanDistribution counts active subscriptions per plan, sorted descending", async () => {
    const distribution = await getPlanDistribution();
    const entry = distribution.find((d) => d.planName === plan.name);
    expect(entry?.activeSubscriptions).toBe(1);
    for (let i = 1; i < distribution.length; i++) {
      expect(distribution[i - 1]!.activeSubscriptions).toBeGreaterThanOrEqual(distribution[i]!.activeSubscriptions);
    }
  });

  it("listRecentSubscriptions resolves the organization name for each row", async () => {
    const rows = await listRecentSubscriptions(50);
    const row = rows.find((r) => r.organizationName === org.name);
    expect(row).toBeDefined();
    expect(row!.planName).toBe(plan.name);
  });

  it("listRecentCustomers includes newly created organizations", async () => {
    const rows = await listRecentCustomers(50);
    expect(rows.some((r) => r.id === org.id)).toBe(true);
  });

  it("listRecentActivity resolves organization name and actor email across orgs", async () => {
    const rows = await listRecentActivity(50);
    const row = rows.find((r) => r.action === "dashboard.test.event");
    expect(row).toBeDefined();
    expect(row!.organizationName).toBe(org.name);
    expect(row!.actorEmail).toBe(actor.email);
  });
});
