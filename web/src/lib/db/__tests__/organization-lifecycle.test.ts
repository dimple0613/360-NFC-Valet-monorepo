import { afterEach, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import { eventBus } from "../event-bus";
import {
  archiveOrganization,
  cancelScheduledDeletion,
  createOrganization,
  executeDueOrganizationDeletions,
  exportOrganizationData,
  InvalidOrganizationTransitionError,
  listOrganizationsSearch,
  OrganizationNotFoundError,
  reactivateOrganization,
  scheduleOrganizationDeletion,
  suspendOrganization,
} from "../organization-lifecycle";
import { runWithTenant } from "../tenant-context";
import { db } from "../client";

const runId = Date.now().toString(36);
let counter = 0;
function nextSlug() {
  counter += 1;
  return `lifecycle-org-${runId}-${counter}`;
}

describe("organization lifecycle service", () => {
  const createdOrgIds: string[] = [];

  afterEach(async () => {
    if (createdOrgIds.length === 0) return;
    await prismaWithoutTenantScoping.auditLog.deleteMany({
      where: { organizationId: { in: createdOrgIds } },
    });
    await prismaWithoutTenantScoping.organization.deleteMany({
      where: { id: { in: createdOrgIds } },
    });
    createdOrgIds.length = 0;
  });

  it("listOrganizationsSearch filters by name/slug, sorts, and paginates with a total count", async () => {
    const tag = `search-${runId}`;
    const orgA = await createOrganization({ name: `Alpha ${tag}`, slug: nextSlug() });
    const orgB = await createOrganization({ name: `Beta ${tag}`, slug: nextSlug() });
    createdOrgIds.push(orgA.id, orgB.id);

    const filtered = await listOrganizationsSearch({ q: tag, sortBy: "name", sortDir: "asc" });
    expect(filtered.totalCount).toBe(2);
    expect(filtered.items.map((o) => o.name)).toEqual([`Alpha ${tag}`, `Beta ${tag}`]);

    const paged = await listOrganizationsSearch({ q: tag, pageSize: 1, page: 2, sortBy: "name", sortDir: "asc" });
    expect(paged.items[0]!.name).toBe(`Beta ${tag}`);

    const noMatch = await listOrganizationsSearch({ q: "no-such-org-prefix" });
    expect(noMatch.totalCount).toBe(0);
  });

  it("createOrganization creates ACTIVE, audit-logs, and emits organization.created", async () => {
    const events: unknown[] = [];
    const off = eventBus.on("organization.created", (payload) => {
      events.push(payload);
    });
    try {
      const org = await createOrganization({ name: "Acme", slug: nextSlug() });
      createdOrgIds.push(org.id);

      expect(org.status).toBe("ACTIVE");
      expect(events).toEqual([{ organizationId: org.id }]);

      const logs = await prismaWithoutTenantScoping.auditLog.findMany({
        where: { organizationId: org.id, action: "organization.created" },
      });
      expect(logs).toHaveLength(1);
    } finally {
      off();
    }
  });

  it("suspend -> reactivate round-trips", async () => {
    const org = await createOrganization({ name: "RoundTrip", slug: nextSlug() });
    createdOrgIds.push(org.id);

    const suspended = await suspendOrganization(org.id, { reason: "billing" });
    expect(suspended.status).toBe("SUSPENDED");

    const reactivated = await reactivateOrganization(org.id);
    expect(reactivated.status).toBe("ACTIVE");
  });

  it("rejects invalid transitions instead of silently applying them", async () => {
    const org = await createOrganization({ name: "Invalid", slug: nextSlug() });
    createdOrgIds.push(org.id);

    // Can't reactivate an org that's already ACTIVE.
    await expect(reactivateOrganization(org.id)).rejects.toThrow(InvalidOrganizationTransitionError);

    await suspendOrganization(org.id);
    // Can't suspend an already-SUSPENDED org.
    await expect(suspendOrganization(org.id)).rejects.toThrow(InvalidOrganizationTransitionError);
  });

  it("throws OrganizationNotFoundError for an unknown id", async () => {
    await expect(suspendOrganization("does-not-exist")).rejects.toThrow(OrganizationNotFoundError);
  });

  it("archive sets archivedAt and is a terminal-ish state reachable from ACTIVE or SUSPENDED", async () => {
    const org = await createOrganization({ name: "Archived", slug: nextSlug() });
    createdOrgIds.push(org.id);

    const archived = await archiveOrganization(org.id);
    expect(archived.status).toBe("ARCHIVED");
    expect(archived.archivedAt).not.toBeNull();
  });

  it("scheduleOrganizationDeletion sets a future deletionScheduledFor, cancel clears it", async () => {
    const org = await createOrganization({ name: "ToDelete", slug: nextSlug() });
    createdOrgIds.push(org.id);

    const scheduled = await scheduleOrganizationDeletion(org.id, { gracePeriodDays: 7 });
    expect(scheduled.status).toBe("PENDING_DELETION");
    expect(scheduled.deletionScheduledFor).not.toBeNull();
    expect(scheduled.deletionScheduledFor!.getTime()).toBeGreaterThan(Date.now());

    const cancelled = await cancelScheduledDeletion(org.id);
    expect(cancelled.status).toBe("ACTIVE");
    expect(cancelled.deletionScheduledFor).toBeNull();
  });

  it("exportOrganizationData bundles the org's own tenant-scoped data", async () => {
    const org = await createOrganization({ name: "Exportable", slug: nextSlug() });
    createdOrgIds.push(org.id);
    await runWithTenant(org.id, async () =>
      db.role.create({ data: { name: "R", slug: "r", organizationId: org.id } }),
    );

    const exported = await exportOrganizationData(org.id);
    expect(exported.organization.id).toBe(org.id);
    expect(exported.roles).toHaveLength(1);
  });

  it("executeDueOrganizationDeletions purges only past-due orgs and preserves the audit trail", async () => {
    const org = await createOrganization({ name: "DueForDeletion", slug: nextSlug() });
    createdOrgIds.push(org.id);
    // Grace period already in the past.
    await scheduleOrganizationDeletion(org.id, { gracePeriodDays: -1 });

    const deletedIds = await executeDueOrganizationDeletions();
    expect(deletedIds).toContain(org.id);

    const gone = await prismaWithoutTenantScoping.organization.findUnique({ where: { id: org.id } });
    expect(gone).toBeNull();

    const logs = await prismaWithoutTenantScoping.auditLog.findMany({
      where: { organizationId: org.id, action: "organization.deleted" },
    });
    expect(logs).toHaveLength(1);
  });
});
