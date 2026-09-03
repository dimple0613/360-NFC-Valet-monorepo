import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, prismaWithoutTenantScoping, runWithTenant } from "@saasclaude/db";
import { GET as LIST_GET, POST as LIST_POST } from "../roles/route";
import { GET, PATCH, DELETE } from "../roles/[id]/route";
import { apiRequest, routeCtx, seedApiKey, seedOrganization, jsonOf } from "./test-helpers";

const runId = Date.now().toString(36);

describe("/api/v1/roles", () => {
  let org: { id: string };
  let manageKey: string;
  let noScopeKey: string;
  let role: { id: string };
  let permission: { id: string; key: string };

  beforeAll(async () => {
    org = await seedOrganization("REST Roles Org");
    manageKey = (await seedApiKey(org.id, ["core.roles.manage"])).rawKey;
    noScopeKey = (await seedApiKey(org.id, ["core.organization.read"])).rawKey;
    permission = await prismaWithoutTenantScoping.permission.create({
      data: { key: `test.rest-roles.${runId}.manage`, module: "test", scope: "TENANT" },
    });
    role = await runWithTenant(org.id, async () =>
      db.role.create({ data: { name: "Seed Role", slug: `seed-role-${runId}`, organizationId: org.id } }),
    );
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.apiKey.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.rolePermission.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.role.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.permission.deleteMany({ where: { id: permission.id } });
    await prismaWithoutTenantScoping.organization.delete({ where: { id: org.id } });
  });

  describe("GET/POST /roles", () => {
    it("401s with no key", async () => {
      expect((await LIST_GET(apiRequest("/roles"), {})).status).toBe(401);
    });

    it("403s without core.roles.manage", async () => {
      expect((await LIST_GET(apiRequest("/roles", { token: noScopeKey }), {})).status).toBe(403);
    });

    it("200s listing only this org's roles", async () => {
      const res = await LIST_GET(apiRequest("/roles", { token: manageKey }), {});
      expect(res.status).toBe(200);
      const body = (await jsonOf(res)) as { roles: { id: string }[] };
      expect(body.roles.some((r) => r.id === role.id)).toBe(true);
    });

    it("POST 400s on a missing name", async () => {
      const res = await LIST_POST(apiRequest("/roles", { method: "POST", token: manageKey, body: {} }), {});
      expect(res.status).toBe(400);
    });

    it("POST 201s and creates a real, slugified role", async () => {
      const res = await LIST_POST(
        apiRequest("/roles", { method: "POST", token: manageKey, body: { name: "New Role" } }),
        {},
      );
      expect(res.status).toBe(201);
      const body = (await jsonOf(res)) as { id: string; slug: string };
      expect(body.slug).toBe("new-role");
      const row = await prismaWithoutTenantScoping.role.findUnique({ where: { id: body.id } });
      expect(row?.organizationId).toBe(org.id);
    });
  });

  describe("GET/PATCH/DELETE /roles/:id", () => {
    it("GET 404s for an unknown id", async () => {
      const res = await GET(apiRequest("/roles/nope", { token: manageKey }), routeCtx({ id: "nope" }));
      expect(res.status).toBe(404);
    });

    it("GET 200s with the role's permission keys", async () => {
      const res = await GET(apiRequest(`/roles/${role.id}`, { token: manageKey }), routeCtx({ id: role.id }));
      expect(res.status).toBe(200);
      const body = (await jsonOf(res)) as { id: string; permissionKeys: string[] };
      expect(body.id).toBe(role.id);
    });

    it("PATCH 400s on a non-array permissionKeys", async () => {
      const res = await PATCH(
        apiRequest(`/roles/${role.id}`, { method: "PATCH", token: manageKey, body: { permissionKeys: "nope" } }),
        routeCtx({ id: role.id }),
      );
      expect(res.status).toBe(400);
    });

    it("PATCH 400s on an unknown permission key", async () => {
      const res = await PATCH(
        apiRequest(`/roles/${role.id}`, {
          method: "PATCH",
          token: manageKey,
          body: { permissionKeys: ["totally.made.up.key"] },
        }),
        routeCtx({ id: role.id }),
      );
      expect(res.status).toBe(400);
    });

    it("PATCH 200s and replaces the permission set (not appends)", async () => {
      const first = await PATCH(
        apiRequest(`/roles/${role.id}`, {
          method: "PATCH",
          token: manageKey,
          body: { permissionKeys: [permission.key] },
        }),
        routeCtx({ id: role.id }),
      );
      expect(first.status).toBe(200);
      const firstBody = (await jsonOf(first)) as { permissionKeys: string[] };
      expect(firstBody.permissionKeys).toEqual([permission.key]);

      const second = await PATCH(
        apiRequest(`/roles/${role.id}`, { method: "PATCH", token: manageKey, body: { permissionKeys: [] } }),
        routeCtx({ id: role.id }),
      );
      const secondBody = (await jsonOf(second)) as { permissionKeys: string[] };
      expect(secondBody.permissionKeys).toEqual([]);
    });

    it("DELETE 404s for an unknown id, 204s and actually deletes for a real one", async () => {
      const toDelete = await runWithTenant(org.id, async () =>
        db.role.create({ data: { name: "Delete Me", slug: `delete-me-${runId}`, organizationId: org.id } }),
      );

      const missing = await DELETE(apiRequest("/roles/nope", { method: "DELETE", token: manageKey }), routeCtx({ id: "nope" }));
      expect(missing.status).toBe(404);

      const ok = await DELETE(
        apiRequest(`/roles/${toDelete.id}`, { method: "DELETE", token: manageKey }),
        routeCtx({ id: toDelete.id }),
      );
      expect(ok.status).toBe(204);
      expect(await prismaWithoutTenantScoping.role.findUnique({ where: { id: toDelete.id } })).toBeNull();
    });
  });

  describe("GET /roles pagination", () => {
    it("?limit=1 returns one item + nextCursor; following the cursor returns the rest with no overlap", async () => {
      await LIST_POST(apiRequest("/roles", { method: "POST", token: manageKey, body: { name: "Page A" } }), {});
      await LIST_POST(apiRequest("/roles", { method: "POST", token: manageKey, body: { name: "Page B" } }), {});

      const first = await LIST_GET(apiRequest("/roles?limit=1", { token: manageKey }), {});
      const firstBody = (await jsonOf(first)) as { roles: { id: string }[]; nextCursor: string | null };
      expect(firstBody.roles).toHaveLength(1);
      expect(firstBody.nextCursor).not.toBeNull();

      const second = await LIST_GET(
        apiRequest(`/roles?limit=1&cursor=${firstBody.nextCursor}`, { token: manageKey }),
        {},
      );
      const secondBody = (await jsonOf(second)) as { roles: { id: string }[] };
      expect(secondBody.roles).toHaveLength(1);
      expect(secondBody.roles[0]!.id).not.toBe(firstBody.roles[0]!.id);
    });
  });

  describe("cross-tenant isolation", () => {
    it("a role in another org 404s under this org's key (FR-104)", async () => {
      const otherOrg = await seedOrganization("REST Roles Other Org");
      const otherRole = await runWithTenant(otherOrg.id, async () =>
        db.role.create({ data: { name: "Other", slug: `other-${runId}`, organizationId: otherOrg.id } }),
      );

      const res = await GET(apiRequest(`/roles/${otherRole.id}`, { token: manageKey }), routeCtx({ id: otherRole.id }));
      expect(res.status).toBe(404);

      await prismaWithoutTenantScoping.role.deleteMany({ where: { organizationId: otherOrg.id } });
      await prismaWithoutTenantScoping.organization.delete({ where: { id: otherOrg.id } });
    });
  });
});
