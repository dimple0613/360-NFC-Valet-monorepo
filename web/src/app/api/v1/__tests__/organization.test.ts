import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "@saasclaude/db";
import { GET, PATCH } from "../organization/route";
import { apiRequest, seedApiKey, seedOrganization, jsonOf } from "./test-helpers";

describe("GET/PATCH /api/v1/organization", () => {
  let org: { id: string; name: string };
  let readKey: string;
  let manageKey: string;

  beforeAll(async () => {
    org = await seedOrganization("REST Org");
    readKey = (await seedApiKey(org.id, ["core.organization.read"])).rawKey;
    manageKey = (await seedApiKey(org.id, ["core.organization.manage_profile"])).rawKey;
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.apiKey.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.organization.delete({ where: { id: org.id } });
  });

  it("401s with no Authorization header", async () => {
    const res = await GET(apiRequest("/organization"), {});
    expect(res.status).toBe(401);
  });

  it("401s with a bogus key", async () => {
    const res = await GET(apiRequest("/organization", { token: "sk_not_real" }), {});
    expect(res.status).toBe(401);
  });

  it("403s when the key lacks core.organization.read", async () => {
    const res = await GET(apiRequest("/organization", { token: manageKey }), {});
    expect(res.status).toBe(403);
  });

  it("200s with the org's own profile, scoped to the key's org", async () => {
    const res = await GET(apiRequest("/organization", { token: readKey }), {});
    expect(res.status).toBe(200);
    const body = (await jsonOf(res)) as { id: string; name: string };
    expect(body.id).toBe(org.id);
    expect(body.name).toBe(org.name);
  });

  it("PATCH 400s on a missing name", async () => {
    const res = await PATCH(apiRequest("/organization", { method: "PATCH", token: manageKey, body: {} }), {});
    expect(res.status).toBe(400);
  });

  it("PATCH 403s without core.organization.manage_profile", async () => {
    const res = await PATCH(
      apiRequest("/organization", { method: "PATCH", token: readKey, body: { name: "Nope" } }),
      {},
    );
    expect(res.status).toBe(403);
  });

  it("PATCH 200s and actually updates the name", async () => {
    const res = await PATCH(
      apiRequest("/organization", { method: "PATCH", token: manageKey, body: { name: "Renamed Org" } }),
      {},
    );
    expect(res.status).toBe(200);
    const body = (await jsonOf(res)) as { name: string };
    expect(body.name).toBe("Renamed Org");

    const row = await prismaWithoutTenantScoping.organization.findUniqueOrThrow({ where: { id: org.id } });
    expect(row.name).toBe("Renamed Org");
  });
});
