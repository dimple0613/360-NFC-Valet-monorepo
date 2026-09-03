import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, prismaWithoutTenantScoping, runWithTenant } from "@saasclaude/db";
import { GET } from "../organization/export/route";
import { apiRequest, seedApiKey, seedOrganization, jsonOf } from "./test-helpers";

describe("/api/v1/organization/export", () => {
  let org: { id: string };
  let exportKey: string;
  let noScopeKey: string;

  beforeAll(async () => {
    org = await seedOrganization("REST Export Org");
    exportKey = (await seedApiKey(org.id, ["core.organization.export_data"])).rawKey;
    noScopeKey = (await seedApiKey(org.id, ["core.organization.read"])).rawKey;
    await runWithTenant(org.id, async () => db.role.create({ data: { organizationId: org.id, name: "Export Test Role", slug: "export-test-role" } }));
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.apiKey.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.organization.deleteMany({ where: { id: org.id } });
  });

  it("401s with no key", async () => {
    expect((await GET(apiRequest("/organization/export"), {})).status).toBe(401);
  });

  it("403s without core.organization.export_data", async () => {
    expect((await GET(apiRequest("/organization/export", { token: noScopeKey }), {})).status).toBe(403);
  });

  it("200s with the org's own profile, roles, and memberships — never another org's", async () => {
    const res = await GET(apiRequest("/organization/export", { token: exportKey }), {});
    expect(res.status).toBe(200);
    const body = (await jsonOf(res)) as {
      organization: { id: string; name: string };
      roles: { name: string; organizationId: string }[];
      memberships: unknown[];
      exportedAt: string;
    };
    expect(body.organization.id).toBe(org.id);
    expect(body.roles.some((r) => r.name === "Export Test Role")).toBe(true);
    expect(body.roles.every((r) => r.organizationId === org.id)).toBe(true);
    expect(typeof body.exportedAt).toBe("string");
  });
});
