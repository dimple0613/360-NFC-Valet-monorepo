import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, prismaWithoutTenantScoping } from "../client";
import { listAllAuditLogsSearch, listAuditLogsForOrganizationPage, listRecentAuditLogs, writeAuditLog } from "../audit-log";
import { ImmutableRecordError } from "../tenant-scoping";
import { runWithTenant } from "../tenant-context";

const runId = Date.now().toString(36);

describe("audit log: immutable and tenant-scoped", () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let entryInA: { id: string };

  beforeAll(async () => {
    orgA = await prismaWithoutTenantScoping.organization.create({
      data: { name: "Audit Org A", slug: `audit-org-a-${runId}` },
    });
    orgB = await prismaWithoutTenantScoping.organization.create({
      data: { name: "Audit Org B", slug: `audit-org-b-${runId}` },
    });

    entryInA = await runWithTenant(orgA.id, async () =>
      writeAuditLog({ module: "core", action: "test.event", resourceType: "Widget", resourceId: "t1" }),
    );
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.auditLog.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prismaWithoutTenantScoping.organization.deleteMany({
      where: { id: { in: [orgA.id, orgB.id] } },
    });
  });

  it("writeAuditLog attributes the entry to the active tenant", async () => {
    const stored = await prismaWithoutTenantScoping.auditLog.findUnique({ where: { id: entryInA.id } });
    expect(stored?.organizationId).toBe(orgA.id);
  });

  it("another org can't see this org's audit entries", async () => {
    const foundFromB = await runWithTenant(orgB.id, async () =>
      db.auditLog.findUnique({ where: { id: entryInA.id } }),
    );
    expect(foundFromB).toBeNull();
  });

  it("update always throws ImmutableRecordError, even for the owning org", async () => {
    await expect(
      runWithTenant(orgA.id, async () =>
        db.auditLog.update({ where: { id: entryInA.id }, data: { action: "tampered" } }),
      ),
    ).rejects.toThrow(ImmutableRecordError);
  });

  it("delete always throws ImmutableRecordError", async () => {
    await expect(
      runWithTenant(orgA.id, async () => db.auditLog.delete({ where: { id: entryInA.id } })),
    ).rejects.toThrow(ImmutableRecordError);
  });

  it("listRecentAuditLogs returns only the active org's entries, newest first", async () => {
    await runWithTenant(orgA.id, async () =>
      writeAuditLog({ module: "core", action: "test.event.2", resourceType: "Widget", resourceId: "t2" }),
    );

    const entries = await runWithTenant(orgA.id, async () => listRecentAuditLogs(5));
    expect(entries.every((e) => e.organizationId === orgA.id)).toBe(true);
    expect(entries[0]!.action).toBe("test.event.2");

    const fromB = await runWithTenant(orgB.id, async () => listRecentAuditLogs(5));
    expect(fromB).toHaveLength(0);
  });

  it("listAuditLogsForOrganizationPage: cursor-paginates the active org's own entries only, never another org's", async () => {
    const pageA = await runWithTenant(orgA.id, async () => listAuditLogsForOrganizationPage(orgA.id, { limit: 1 }));
    expect(pageA.items).toHaveLength(1);
    expect(pageA.items[0]!.organizationId).toBe(orgA.id);
    expect(pageA.nextCursor).not.toBeNull();

    const pageB = await runWithTenant(orgB.id, async () => listAuditLogsForOrganizationPage(orgB.id, { limit: 20 }));
    expect(pageB.items.every((e) => e.organizationId === orgB.id)).toBe(true);
  });

  it("listAllAuditLogsSearch sees across every org, resolves org/actor names, and searches by module/action/org name", async () => {
    const actor = await prismaWithoutTenantScoping.user.create({
      data: { email: `audit-actor-${runId}@example.com` },
    });
    await runWithTenant(orgB.id, async () =>
      writeAuditLog({ module: "billing", action: "invoice.issued", actorUserId: actor.id }),
    );

    try {
      const all = await listAllAuditLogsSearch({ pageSize: 50 });
      const orgAEntry = all.items.find((e) => e.organizationId === orgA.id);
      const orgBEntry = all.items.find((e) => e.organizationId === orgB.id && e.action === "invoice.issued");
      expect(orgAEntry?.organizationName).toBe("Audit Org A");
      expect(orgBEntry?.organizationName).toBe("Audit Org B");
      expect(orgBEntry?.actorEmail).toBe(actor.email);

      const byAction = await listAllAuditLogsSearch({ q: "invoice.issued" });
      expect(byAction.items.every((e) => e.action === "invoice.issued")).toBe(true);
      expect(byAction.totalCount).toBeGreaterThanOrEqual(1);

      const byOrgName = await listAllAuditLogsSearch({ q: "Audit Org B" });
      expect(byOrgName.items.every((e) => e.organizationId === orgB.id)).toBe(true);
      expect(byOrgName.totalCount).toBeGreaterThanOrEqual(1);
    } finally {
      await prismaWithoutTenantScoping.auditLog.deleteMany({ where: { actorUserId: actor.id } });
      await prismaWithoutTenantScoping.user.delete({ where: { id: actor.id } });
    }
  });
});
