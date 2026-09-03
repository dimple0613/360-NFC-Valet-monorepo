import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, prismaWithoutTenantScoping, runWithTenant } from "@saasclaude/db";
import { POST } from "../roles/[id]/assignments/route";
import { DELETE } from "../roles/[id]/assignments/[userId]/route";
import { apiRequest, routeCtx, seedApiKey, seedOrganization } from "./test-helpers";

const runId = Date.now().toString(36);

describe("/api/v1/roles/:id/assignments", () => {
  let org: { id: string };
  let otherOrg: { id: string };
  let manageKey: string;
  let noScopeKey: string;
  let role: { id: string };
  let member: { id: string };
  let outsider: { id: string };

  beforeAll(async () => {
    org = await seedOrganization("REST Role Assign Org");
    otherOrg = await seedOrganization("REST Role Assign Other Org");
    manageKey = (await seedApiKey(org.id, ["core.roles.manage"])).rawKey;
    noScopeKey = (await seedApiKey(org.id, ["core.organization.read"])).rawKey;
    role = await runWithTenant(org.id, async () =>
      db.role.create({ data: { name: "Assign Target", slug: `assign-target-${runId}`, organizationId: org.id } }),
    );
    member = await prismaWithoutTenantScoping.user.create({ data: { email: `assign-member-${runId}@example.com` } });
    outsider = await prismaWithoutTenantScoping.user.create({ data: { email: `assign-outsider-${runId}@example.com` } });
    await runWithTenant(org.id, async () => {
      await db.organizationMembership.create({ data: { organizationId: org.id, userId: member.id, status: "ACTIVE" } });
    });
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.userRole.deleteMany({ where: { organizationId: { in: [org.id, otherOrg.id] } } });
    await prismaWithoutTenantScoping.organizationMembership.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.role.deleteMany({ where: { organizationId: { in: [org.id, otherOrg.id] } } });
    await prismaWithoutTenantScoping.apiKey.deleteMany({ where: { organizationId: { in: [org.id, otherOrg.id] } } });
    await prismaWithoutTenantScoping.organization.deleteMany({ where: { id: { in: [org.id, otherOrg.id] } } });
    await prismaWithoutTenantScoping.user.deleteMany({ where: { id: { in: [member.id, outsider.id] } } });
  });

  describe("POST", () => {
    it("401s with no key", async () => {
      const res = await POST(
        apiRequest(`/roles/${role.id}/assignments`, { method: "POST", body: { userId: member.id } }),
        routeCtx({ id: role.id }),
      );
      expect(res.status).toBe(401);
    });

    it("403s without core.roles.manage", async () => {
      const res = await POST(
        apiRequest(`/roles/${role.id}/assignments`, { method: "POST", token: noScopeKey, body: { userId: member.id } }),
        routeCtx({ id: role.id }),
      );
      expect(res.status).toBe(403);
    });

    it("400s on a missing userId", async () => {
      const res = await POST(
        apiRequest(`/roles/${role.id}/assignments`, { method: "POST", token: manageKey, body: {} }),
        routeCtx({ id: role.id }),
      );
      expect(res.status).toBe(400);
    });

    it("404s for a role that doesn't exist / belongs to another org", async () => {
      const foreignRole = await runWithTenant(otherOrg.id, async () =>
        db.role.create({ data: { name: "Foreign", slug: `foreign-${runId}`, organizationId: otherOrg.id } }),
      );
      const res = await POST(
        apiRequest(`/roles/${foreignRole.id}/assignments`, { method: "POST", token: manageKey, body: { userId: member.id } }),
        routeCtx({ id: foreignRole.id }),
      );
      expect(res.status).toBe(404);
    });

    it("400s when the userId isn't an active member of the org", async () => {
      const res = await POST(
        apiRequest(`/roles/${role.id}/assignments`, { method: "POST", token: manageKey, body: { userId: outsider.id } }),
        routeCtx({ id: role.id }),
      );
      expect(res.status).toBe(400);
    });

    it("204s and actually creates the grant", async () => {
      const res = await POST(
        apiRequest(`/roles/${role.id}/assignments`, { method: "POST", token: manageKey, body: { userId: member.id } }),
        routeCtx({ id: role.id }),
      );
      expect(res.status).toBe(204);
      const row = await prismaWithoutTenantScoping.userRole.findUniqueOrThrow({
        where: { userId_roleId: { userId: member.id, roleId: role.id } },
      });
      expect(row.organizationId).toBe(org.id);
    });
  });

  describe("DELETE", () => {
    it("401s with no key", async () => {
      const res = await DELETE(
        apiRequest(`/roles/${role.id}/assignments/${member.id}`, { method: "DELETE" }),
        routeCtx({ id: role.id, userId: member.id }),
      );
      expect(res.status).toBe(401);
    });

    it("403s without core.roles.manage", async () => {
      const res = await DELETE(
        apiRequest(`/roles/${role.id}/assignments/${member.id}`, { method: "DELETE", token: noScopeKey }),
        routeCtx({ id: role.id, userId: member.id }),
      );
      expect(res.status).toBe(403);
    });

    it("404s when there's no such grant", async () => {
      const res = await DELETE(
        apiRequest(`/roles/${role.id}/assignments/${outsider.id}`, { method: "DELETE", token: manageKey }),
        routeCtx({ id: role.id, userId: outsider.id }),
      );
      expect(res.status).toBe(404);
    });

    it("204s and actually removes the grant created above", async () => {
      const res = await DELETE(
        apiRequest(`/roles/${role.id}/assignments/${member.id}`, { method: "DELETE", token: manageKey }),
        routeCtx({ id: role.id, userId: member.id }),
      );
      expect(res.status).toBe(204);
      const row = await prismaWithoutTenantScoping.userRole.findUnique({
        where: { userId_roleId: { userId: member.id, roleId: role.id } },
      });
      expect(row).toBeNull();
    });
  });
});
