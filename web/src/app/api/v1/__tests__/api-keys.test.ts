import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "@saasclaude/db";
import { GET as LIST_GET, POST } from "../api-keys/route";
import { DELETE } from "../api-keys/[id]/route";
import { apiRequest, routeCtx, seedApiKey, seedOrganization, jsonOf } from "./test-helpers";

describe("/api/v1/api-keys", () => {
  let org: { id: string };
  let broadKey: string; // holds manage + an extra scope, to test the escalation guard
  let narrowKey: string; // holds only manage
  let noScopeKey: string;

  beforeAll(async () => {
    org = await seedOrganization("REST ApiKeys Org");
    broadKey = (await seedApiKey(org.id, ["core.api_keys.manage", "core.organization.read", "core.billing.read"])).rawKey;
    narrowKey = (await seedApiKey(org.id, ["core.api_keys.manage"])).rawKey;
    noScopeKey = (await seedApiKey(org.id, ["core.organization.read"])).rawKey;
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.apiKey.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.organization.delete({ where: { id: org.id } });
  });

  describe("GET", () => {
    it("401s with no key", async () => {
      expect((await LIST_GET(apiRequest("/api-keys"), {})).status).toBe(401);
    });

    it("403s without core.api_keys.manage", async () => {
      expect((await LIST_GET(apiRequest("/api-keys", { token: noScopeKey }), {})).status).toBe(403);
    });

    it("200s listing the org's keys, never a keyHash field", async () => {
      const res = await LIST_GET(apiRequest("/api-keys", { token: broadKey }), {});
      expect(res.status).toBe(200);
      const body = (await jsonOf(res)) as { apiKeys: Record<string, unknown>[] };
      expect(body.apiKeys.length).toBeGreaterThanOrEqual(3);
      expect(body.apiKeys.every((k) => !("keyHash" in k))).toBe(true);
    });
  });

  describe("POST", () => {
    it("401s with no key", async () => {
      const res = await POST(apiRequest("/api-keys", { method: "POST", body: { name: "x", scopes: ["core.organization.read"] } }), {});
      expect(res.status).toBe(401);
    });

    it("403s without core.api_keys.manage", async () => {
      const res = await POST(
        apiRequest("/api-keys", { method: "POST", token: noScopeKey, body: { name: "x", scopes: ["core.organization.read"] } }),
        {},
      );
      expect(res.status).toBe(403);
    });

    it("400s on a missing name", async () => {
      const res = await POST(
        apiRequest("/api-keys", { method: "POST", token: broadKey, body: { scopes: ["core.organization.read"] } }),
        {},
      );
      expect(res.status).toBe(400);
    });

    it("400s on empty/missing scopes", async () => {
      const res = await POST(apiRequest("/api-keys", { method: "POST", token: broadKey, body: { name: "x", scopes: [] } }), {});
      expect(res.status).toBe(400);
    });

    it("403s when requesting a scope the caller key doesn't itself have (self-escalation guard)", async () => {
      const res = await POST(
        apiRequest("/api-keys", {
          method: "POST",
          token: narrowKey, // only has core.api_keys.manage
          body: { name: "escalated", scopes: ["core.organization.manage_profile"] },
        }),
        {},
      );
      expect(res.status).toBe(403);
      const created = await prismaWithoutTenantScoping.apiKey.findFirst({ where: { organizationId: org.id, name: "escalated" } });
      expect(created).toBeNull();
    });

    it("201s and returns the raw key exactly once, when scopes are a subset of the caller's own", async () => {
      const res = await POST(
        apiRequest("/api-keys", {
          method: "POST",
          token: broadKey,
          body: { name: "subset-ok", scopes: ["core.organization.read"] },
        }),
        {},
      );
      expect(res.status).toBe(201);
      const body = (await jsonOf(res)) as { id: string; rawKey: string; scopes: string[] };
      expect(body.rawKey).toMatch(/^sk_/);
      expect(body.scopes).toEqual(["core.organization.read"]);

      const row = await prismaWithoutTenantScoping.apiKey.findUniqueOrThrow({ where: { id: body.id } });
      expect(row.organizationId).toBe(org.id);
    });

    it("400s on an invalid expiresAt", async () => {
      const res = await POST(
        apiRequest("/api-keys", {
          method: "POST",
          token: broadKey,
          body: { name: "bad-expiry", scopes: ["core.organization.read"], expiresAt: "not-a-date" },
        }),
        {},
      );
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api-keys/:id", () => {
    it("401s with no key", async () => {
      const res = await DELETE(apiRequest("/api-keys/nope", { method: "DELETE" }), routeCtx({ id: "nope" }));
      expect(res.status).toBe(401);
    });

    it("403s without core.api_keys.manage", async () => {
      const res = await DELETE(
        apiRequest("/api-keys/nope", { method: "DELETE", token: noScopeKey }),
        routeCtx({ id: "nope" }),
      );
      expect(res.status).toBe(403);
    });

    it("404s for an id that doesn't exist", async () => {
      const res = await DELETE(
        apiRequest("/api-keys/not-a-real-id", { method: "DELETE", token: broadKey }),
        routeCtx({ id: "not-a-real-id" }),
      );
      expect(res.status).toBe(404);
    });

    it("204s and actually revokes a real key", async () => {
      const { apiKey: created } = await seedApiKey(org.id, ["core.organization.read"]);

      const res = await DELETE(
        apiRequest(`/api-keys/${created.id}`, { method: "DELETE", token: broadKey }),
        routeCtx({ id: created.id }),
      );
      expect(res.status).toBe(204);

      const row = await prismaWithoutTenantScoping.apiKey.findUniqueOrThrow({ where: { id: created.id } });
      expect(row.revokedAt).not.toBeNull();
    });
  });
});
