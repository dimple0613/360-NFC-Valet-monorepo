import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping, runWithTenant, writeAuditLog } from "@saasclaude/db";
import { GET } from "../audit-logs/route";
import { apiRequest, seedApiKey, seedOrganization, jsonOf } from "./test-helpers";

describe("/api/v1/audit-logs", () => {
  let org: { id: string };
  let otherOrg: { id: string };
  let readKey: string;
  let noScopeKey: string;

  beforeAll(async () => {
    org = await seedOrganization("REST Audit Logs Org");
    otherOrg = await seedOrganization("REST Audit Logs Other Org");
    readKey = (await seedApiKey(org.id, ["core.audit_log.read"])).rawKey;
    noScopeKey = (await seedApiKey(org.id, ["core.organization.read"])).rawKey;

    await runWithTenant(org.id, async () => writeAuditLog({ module: "core", action: "rest.audit_log.test", resourceType: "Widget", resourceId: "w1" }));
    await runWithTenant(otherOrg.id, async () => writeAuditLog({ module: "core", action: "rest.audit_log.other_org" }));
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.auditLog.deleteMany({ where: { organizationId: { in: [org.id, otherOrg.id] } } });
    await prismaWithoutTenantScoping.apiKey.deleteMany({ where: { organizationId: { in: [org.id, otherOrg.id] } } });
    await prismaWithoutTenantScoping.organization.deleteMany({ where: { id: { in: [org.id, otherOrg.id] } } });
  });

  it("401s with no key", async () => {
    expect((await GET(apiRequest("/audit-logs"), {})).status).toBe(401);
  });

  it("403s without core.audit_log.read", async () => {
    expect((await GET(apiRequest("/audit-logs", { token: noScopeKey }), {})).status).toBe(403);
  });

  it("200s with the org's own entries only, never another org's", async () => {
    const res = await GET(apiRequest("/audit-logs", { token: readKey }), {});
    expect(res.status).toBe(200);
    const body = (await jsonOf(res)) as { auditLogs: { action: string }[]; nextCursor: string | null };
    expect(body.auditLogs.some((e) => e.action === "rest.audit_log.test")).toBe(true);
    expect(body.auditLogs.some((e) => e.action === "rest.audit_log.other_org")).toBe(false);
  });

  it("omits before/after/ipAddress/userAgent/metadata (not exposed over REST)", async () => {
    const res = await GET(apiRequest("/audit-logs", { token: readKey }), {});
    const body = (await jsonOf(res)) as { auditLogs: Record<string, unknown>[] };
    const entry = body.auditLogs.find((e) => e.action === "rest.audit_log.test");
    expect(entry).toBeDefined();
    expect(Object.keys(entry!).sort()).toEqual(["action", "actorUserId", "createdAt", "id", "module", "resourceId", "resourceType"]);
  });

  it("?limit= is respected", async () => {
    const res = await GET(apiRequest("/audit-logs?limit=1", { token: readKey }), {});
    const body = (await jsonOf(res)) as { auditLogs: unknown[] };
    expect(body.auditLogs).toHaveLength(1);
  });
});
