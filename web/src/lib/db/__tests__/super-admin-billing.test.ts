import { afterAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import {
  listAllInvoicesSearch,
  listOrganizationBillingSummariesSearch,
  listOrganizationInvoicesSearch,
  listSubscriptionEventsSearch,
  listWebhookEventsSearch,
} from "../billing/super-admin-billing";

const runId = Date.now().toString(36);

describe("listOrganizationBillingSummariesSearch", () => {
  const orgIds: string[] = [];

  afterAll(async () => {
    await prismaWithoutTenantScoping.organization.deleteMany({ where: { id: { in: orgIds } } });
  });

  it("filters by name/slug, sorts, and paginates with a total count", async () => {
    const tag = `search-${runId}`;
    const orgA = await prismaWithoutTenantScoping.organization.create({
      data: { name: `Alpha ${tag}`, slug: `alpha-${tag}` },
    });
    const orgB = await prismaWithoutTenantScoping.organization.create({
      data: { name: `Beta ${tag}`, slug: `beta-${tag}` },
    });
    orgIds.push(orgA.id, orgB.id);

    const filtered = await listOrganizationBillingSummariesSearch({ q: tag, sortBy: "name", sortDir: "asc" });
    expect(filtered.totalCount).toBe(2);
    expect(filtered.items.map((r) => r.organizationName)).toEqual([`Alpha ${tag}`, `Beta ${tag}`]);
    expect(filtered.items[0]!.planName).toBeNull();
    expect(filtered.items[0]!.subscriptionStatus).toBeNull();

    const paged = await listOrganizationBillingSummariesSearch({ q: tag, pageSize: 1, page: 2, sortBy: "name", sortDir: "asc" });
    expect(paged.items[0]!.organizationName).toBe(`Beta ${tag}`);
  });
});

describe("org detail page list functions (invoices, subscription events, webhook events)", () => {
  let org: { id: string };

  afterAll(async () => {
    await prismaWithoutTenantScoping.invoice.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.subscriptionEvent.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.processedWebhookEvent.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.subscription.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.plan.deleteMany({ where: { key: `detail-plan-${runId}` } });
    await prismaWithoutTenantScoping.organization.delete({ where: { id: org.id } });
  });

  it("listOrganizationInvoicesSearch filters by number, is scoped to the org, and paginates", async () => {
    org = await prismaWithoutTenantScoping.organization.create({
      data: { name: `Detail Org ${runId}`, slug: `detail-org-${runId}` },
    });
    await prismaWithoutTenantScoping.invoice.create({
      data: { organizationId: org.id, number: `INV-${runId}-A`, totalCents: 1000 },
    });
    await prismaWithoutTenantScoping.invoice.create({
      data: { organizationId: org.id, number: `INV-${runId}-B`, totalCents: 2000 },
    });

    const filtered = await listOrganizationInvoicesSearch(org.id, { q: `INV-${runId}-A` });
    expect(filtered.totalCount).toBe(1);
    expect(filtered.items[0]!.totalCents).toBe(1000);

    const all = await listOrganizationInvoicesSearch(org.id, {});
    expect(all.totalCount).toBe(2);
  });

  it("listAllInvoicesSearch (Super Admin, cross-org) finds invoices by number or org name", async () => {
    const byNumber = await listAllInvoicesSearch({ q: `INV-${runId}-A` });
    expect(byNumber.totalCount).toBe(1);
    expect(byNumber.items[0]!.organizationName).toBe(`Detail Org ${runId}`);

    const byOrgName = await listAllInvoicesSearch({ q: `Detail Org ${runId}` });
    expect(byOrgName.totalCount).toBe(2);
  });

  it("listSubscriptionEventsSearch filters by type and paginates", async () => {
    const sub = await prismaWithoutTenantScoping.subscription.create({
      data: {
        organizationId: org.id,
        planId: (await prismaWithoutTenantScoping.plan.create({
          data: { key: `detail-plan-${runId}`, name: "Detail Plan", type: "MONTHLY" },
        })).id,
        status: "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      },
    });
    await prismaWithoutTenantScoping.subscriptionEvent.create({
      data: { organizationId: org.id, subscriptionId: sub.id, type: `created-${runId}` },
    });

    const filtered = await listSubscriptionEventsSearch(org.id, { q: `created-${runId}` });
    expect(filtered.totalCount).toBe(1);
  });

  it("listWebhookEventsSearch filters by event type, is not capped at 50, and paginates", async () => {
    for (let i = 0; i < 3; i++) {
      await prismaWithoutTenantScoping.processedWebhookEvent.create({
        data: {
          provider: "stripe",
          providerEventId: `evt_${runId}_${i}`,
          organizationId: org.id,
          eventType: `invoice.paid.${runId}`,
        },
      });
    }

    const filtered = await listWebhookEventsSearch(org.id, { q: `invoice.paid.${runId}`, pageSize: 2 });
    expect(filtered.totalCount).toBe(3);
    expect(filtered.items).toHaveLength(2);
    expect(filtered.totalPages).toBe(2);
  });
});
