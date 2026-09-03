import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "@saasclaude/db";
import { GET as LIST_GET } from "../settings/route";
import { GET, PUT } from "../settings/[key]/route";
import { apiRequest, routeCtx, seedApiKey, seedOrganization, jsonOf } from "./test-helpers";

describe("/api/v1/settings", () => {
  let org: { id: string };
  let readKey: string;
  let manageKey: string;

  beforeAll(async () => {
    org = await seedOrganization("REST Settings Org");
    readKey = (await seedApiKey(org.id, ["core.settings.read"])).rawKey;
    manageKey = (await seedApiKey(org.id, ["core.settings.manage"])).rawKey;
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.apiKey.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.organizationSetting.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.organization.delete({ where: { id: org.id } });
  });

  describe("GET /settings", () => {
    it("401s with no key", async () => {
      expect((await LIST_GET(apiRequest("/settings"), {})).status).toBe(401);
    });

    it("403s without core.settings.read", async () => {
      expect((await LIST_GET(apiRequest("/settings", { token: manageKey }), {})).status).toBe(403);
    });

    it("200s with an empty list when nothing is set", async () => {
      const res = await LIST_GET(apiRequest("/settings", { token: readKey }), {});
      expect(res.status).toBe(200);
      const body = (await jsonOf(res)) as { settings: unknown[] };
      expect(body.settings).toEqual([]);
    });
  });

  describe("PUT /settings/:key", () => {
    it("401s with no key", async () => {
      const res = await PUT(
        apiRequest("/settings/theme", { method: "PUT", body: { category: "ui", value: "dark" } }),
        routeCtx({ key: "theme" }),
      );
      expect(res.status).toBe(401);
    });

    it("403s without core.settings.manage", async () => {
      const res = await PUT(
        apiRequest("/settings/theme", { method: "PUT", token: readKey, body: { category: "ui", value: "dark" } }),
        routeCtx({ key: "theme" }),
      );
      expect(res.status).toBe(403);
    });

    it("400s on a missing category", async () => {
      const res = await PUT(
        apiRequest("/settings/theme", { method: "PUT", token: manageKey, body: { value: "dark" } }),
        routeCtx({ key: "theme" }),
      );
      expect(res.status).toBe(400);
    });

    it("400s on a missing value", async () => {
      const res = await PUT(
        apiRequest("/settings/theme", { method: "PUT", token: manageKey, body: { category: "ui" } }),
        routeCtx({ key: "theme" }),
      );
      expect(res.status).toBe(400);
    });

    it("200s, actually persists, and is readable back via GET /settings/:key and GET /settings", async () => {
      const res = await PUT(
        apiRequest("/settings/theme", { method: "PUT", token: manageKey, body: { category: "ui", value: "dark" } }),
        routeCtx({ key: "theme" }),
      );
      expect(res.status).toBe(200);

      const single = await GET(apiRequest("/settings/theme", { token: readKey }), routeCtx({ key: "theme" }));
      expect(single.status).toBe(200);
      const singleBody = (await jsonOf(single)) as { key: string; value: string; category: string };
      expect(singleBody).toMatchObject({ key: "theme", value: "dark", category: "ui" });

      const list = await LIST_GET(apiRequest("/settings", { token: readKey }), {});
      const listBody = (await jsonOf(list)) as { settings: { key: string; value: string }[] };
      expect(listBody.settings.some((s) => s.key === "theme" && s.value === "dark")).toBe(true);
    });

    it("upsert replaces the previous value rather than erroring on conflict", async () => {
      await PUT(
        apiRequest("/settings/theme", { method: "PUT", token: manageKey, body: { category: "ui", value: "light" } }),
        routeCtx({ key: "theme" }),
      );
      const single = await GET(apiRequest("/settings/theme", { token: readKey }), routeCtx({ key: "theme" }));
      const body = (await jsonOf(single)) as { value: string };
      expect(body.value).toBe("light");
    });

    it("a sensitive value is redacted on read but genuinely encrypted at rest (not plaintext in the DB)", async () => {
      await PUT(
        apiRequest("/settings/api_secret", {
          method: "PUT",
          token: manageKey,
          body: { category: "integrations", value: "super-secret-value", isSensitive: true },
        }),
        routeCtx({ key: "api_secret" }),
      );

      const single = await GET(apiRequest("/settings/api_secret", { token: readKey }), routeCtx({ key: "api_secret" }));
      const body = (await jsonOf(single)) as { value: string };
      expect(body.value).toBe("[REDACTED]");

      const row = await prismaWithoutTenantScoping.organizationSetting.findUniqueOrThrow({
        where: { organizationId_key: { organizationId: org.id, key: "api_secret" } },
      });
      expect(row.value).not.toContain("super-secret-value");
    });
  });

  describe("GET /settings/:key", () => {
    it("401s with no key", async () => {
      const res = await GET(apiRequest("/settings/nope"), routeCtx({ key: "nope" }));
      expect(res.status).toBe(401);
    });

    it("403s without core.settings.read", async () => {
      const res = await GET(apiRequest("/settings/nope", { token: manageKey }), routeCtx({ key: "nope" }));
      expect(res.status).toBe(403);
    });

    it("404s for a key that was never set", async () => {
      const res = await GET(apiRequest("/settings/never-set", { token: readKey }), routeCtx({ key: "never-set" }));
      expect(res.status).toBe(404);
    });
  });

  describe("cross-tenant isolation", () => {
    it("a setting in another org is invisible under this org's key", async () => {
      const otherOrg = await seedOrganization("REST Settings Other Org");
      const otherKey = (await seedApiKey(otherOrg.id, ["core.settings.manage", "core.settings.read"])).rawKey;
      await PUT(
        apiRequest("/settings/shared-key-name", { method: "PUT", token: otherKey, body: { category: "x", value: "other org's value" } }),
        routeCtx({ key: "shared-key-name" }),
      );

      const res = await GET(apiRequest("/settings/shared-key-name", { token: readKey }), routeCtx({ key: "shared-key-name" }));
      expect(res.status).toBe(404);

      await prismaWithoutTenantScoping.organizationSetting.deleteMany({ where: { organizationId: otherOrg.id } });
      await prismaWithoutTenantScoping.apiKey.deleteMany({ where: { organizationId: otherOrg.id } });
      await prismaWithoutTenantScoping.organization.delete({ where: { id: otherOrg.id } });
    });
  });
});
