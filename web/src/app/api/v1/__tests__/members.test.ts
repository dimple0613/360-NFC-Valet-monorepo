import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, prismaWithoutTenantScoping, runWithTenant } from "@saasclaude/db";
import { GET, POST } from "../members/route";
import { DELETE } from "../members/[id]/route";
import { apiRequest, routeCtx, seedApiKey, seedOrganization, jsonOf } from "./test-helpers";

const runId = Date.now().toString(36);

describe("/api/v1/members", () => {
  let org: { id: string };
  let otherOrg: { id: string };
  let readKey: string;
  let manageKey: string;
  let member: { id: string };

  beforeAll(async () => {
    org = await seedOrganization("REST Members Org");
    otherOrg = await seedOrganization("REST Members Other Org");
    readKey = (await seedApiKey(org.id, ["core.organization.read_members"])).rawKey;
    manageKey = (await seedApiKey(org.id, ["core.organization.manage_members"])).rawKey;

    const user = await prismaWithoutTenantScoping.user.create({
      data: { email: `member-${runId}@example.com` },
    });
    member = await runWithTenant(org.id, async () =>
      db.organizationMembership.create({ data: { organizationId: org.id, userId: user.id, status: "ACTIVE" } }),
    );
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.apiKey.deleteMany({ where: { organizationId: { in: [org.id, otherOrg.id] } } });
    await prismaWithoutTenantScoping.organizationInvite.deleteMany({ where: { organizationId: { in: [org.id, otherOrg.id] } } });
    await prismaWithoutTenantScoping.organizationMembership.deleteMany({ where: { organizationId: { in: [org.id, otherOrg.id] } } });
    await prismaWithoutTenantScoping.organization.deleteMany({ where: { id: { in: [org.id, otherOrg.id] } } });
    await prismaWithoutTenantScoping.user.deleteMany({ where: { email: { contains: runId } } });
  });

  describe("GET", () => {
    it("401s with no key", async () => {
      expect((await GET(apiRequest("/members"), {})).status).toBe(401);
    });

    it("403s without core.organization.read_members", async () => {
      expect((await GET(apiRequest("/members", { token: manageKey }), {})).status).toBe(403);
    });

    it("200s with the org's own members, never another org's", async () => {
      const res = await GET(apiRequest("/members", { token: readKey }), {});
      expect(res.status).toBe(200);
      const body = (await jsonOf(res)) as { members: { membershipId: string; user: { email: string } }[] };
      expect(body.members.some((m) => m.membershipId === member.id)).toBe(true);
      expect(body.members.every((m) => m.user.email.includes(runId))).toBe(true);
    });

    it("includes each member's mfaEnabled status (read-only MFA state, no new endpoint needed)", async () => {
      const res = await GET(apiRequest("/members", { token: readKey }), {});
      const body = (await jsonOf(res)) as { members: { membershipId: string; user: { mfaEnabled: boolean } }[] };
      const found = body.members.find((m) => m.membershipId === member.id);
      expect(found?.user.mfaEnabled).toBe(false);
    });
  });

  describe("POST", () => {
    it("401s with no key", async () => {
      expect((await POST(apiRequest("/members", { method: "POST", body: { email: "x@example.com" } }), {})).status).toBe(401);
    });

    it("403s without core.organization.manage_members", async () => {
      const res = await POST(
        apiRequest("/members", { method: "POST", token: readKey, body: { email: "x@example.com" } }),
        {},
      );
      expect(res.status).toBe(403);
    });

    it("400s on a missing email", async () => {
      const res = await POST(apiRequest("/members", { method: "POST", token: manageKey, body: {} }), {});
      expect(res.status).toBe(400);
    });

    it("400s on a roleId belonging to a different organization", async () => {
      const foreignRole = await runWithTenant(otherOrg.id, async () =>
        db.role.create({ data: { name: "Foreign", slug: `foreign-${runId}`, organizationId: otherOrg.id } }),
      );
      const res = await POST(
        apiRequest("/members", {
          method: "POST",
          token: manageKey,
          body: { email: `cross-${runId}@example.com`, roleId: foreignRole.id },
        }),
        {},
      );
      expect(res.status).toBe(400);
    });

    it("201s and creates a real invite", async () => {
      const res = await POST(
        apiRequest("/members", { method: "POST", token: manageKey, body: { email: `invited-${runId}@example.com` } }),
        {},
      );
      expect(res.status).toBe(201);
      const body = (await jsonOf(res)) as { inviteId: string };
      const invite = await prismaWithoutTenantScoping.organizationInvite.findUnique({ where: { id: body.inviteId } });
      expect(invite?.organizationId).toBe(org.id);
      expect(invite?.email).toBe(`invited-${runId}@example.com`);
    });

    it("409s inviting an email that already has a pending invite", async () => {
      const res = await POST(
        apiRequest("/members", { method: "POST", token: manageKey, body: { email: `invited-${runId}@example.com` } }),
        {},
      );
      expect(res.status).toBe(409);
    });
  });

  describe("DELETE /members/:id", () => {
    it("401s with no key", async () => {
      const res = await DELETE(apiRequest(`/members/${member.id}`, { method: "DELETE" }), routeCtx({ id: member.id }));
      expect(res.status).toBe(401);
    });

    it("403s without core.organization.manage_members", async () => {
      const res = await DELETE(
        apiRequest(`/members/${member.id}`, { method: "DELETE", token: readKey }),
        routeCtx({ id: member.id }),
      );
      expect(res.status).toBe(403);
    });

    it("404s for an id that doesn't exist", async () => {
      const res = await DELETE(
        apiRequest("/members/not-a-real-id", { method: "DELETE", token: manageKey }),
        routeCtx({ id: "not-a-real-id" }),
      );
      expect(res.status).toBe(404);
    });

    it("204s and actually removes the membership", async () => {
      const res = await DELETE(
        apiRequest(`/members/${member.id}`, { method: "DELETE", token: manageKey }),
        routeCtx({ id: member.id }),
      );
      expect(res.status).toBe(204);
      const row = await prismaWithoutTenantScoping.organizationMembership.findUnique({ where: { id: member.id } });
      expect(row).toBeNull();
    });
  });
});
