import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { consoleEmailSender, inviteUserToOrganization, prismaWithoutTenantScoping } from "@saasclaude/db";
import { GET } from "../members/invites/route";
import { DELETE } from "../members/invites/[id]/route";
import { apiRequest, routeCtx, seedApiKey, seedOrganization, jsonOf } from "./test-helpers";

const runId = Date.now().toString(36);

describe("/api/v1/members/invites", () => {
  let org: { id: string };
  let otherOrg: { id: string };
  let readKey: string;
  let manageKey: string;
  let invite: { inviteId: string };

  beforeAll(async () => {
    org = await seedOrganization("REST Invites Org");
    otherOrg = await seedOrganization("REST Invites Other Org");
    readKey = (await seedApiKey(org.id, ["core.organization.read_members"])).rawKey;
    manageKey = (await seedApiKey(org.id, ["core.organization.manage_members"])).rawKey;
    invite = await inviteUserToOrganization({ organizationId: org.id, email: `invite-rest-${runId}@example.com` }, consoleEmailSender);
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.organizationInvite.deleteMany({ where: { organizationId: { in: [org.id, otherOrg.id] } } });
    await prismaWithoutTenantScoping.apiKey.deleteMany({ where: { organizationId: { in: [org.id, otherOrg.id] } } });
    await prismaWithoutTenantScoping.organization.deleteMany({ where: { id: { in: [org.id, otherOrg.id] } } });
  });

  describe("GET", () => {
    it("401s with no key", async () => {
      expect((await GET(apiRequest("/members/invites"), {})).status).toBe(401);
    });

    it("403s without core.organization.read_members", async () => {
      expect((await GET(apiRequest("/members/invites", { token: manageKey }), {})).status).toBe(403);
    });

    it("200s with the org's pending invites, never another org's", async () => {
      const res = await GET(apiRequest("/members/invites", { token: readKey }), {});
      expect(res.status).toBe(200);
      const body = (await jsonOf(res)) as { invites: { id: string; email: string }[]; nextCursor: string | null };
      expect(body.invites.some((i) => i.id === invite.inviteId)).toBe(true);
      expect(body.invites.every((i) => i.email.includes(runId))).toBe(true);
    });
  });

  describe("DELETE /members/invites/:id", () => {
    it("401s with no key", async () => {
      const res = await DELETE(
        apiRequest(`/members/invites/${invite.inviteId}`, { method: "DELETE" }),
        routeCtx({ id: invite.inviteId }),
      );
      expect(res.status).toBe(401);
    });

    it("403s without core.organization.manage_members", async () => {
      const res = await DELETE(
        apiRequest(`/members/invites/${invite.inviteId}`, { method: "DELETE", token: readKey }),
        routeCtx({ id: invite.inviteId }),
      );
      expect(res.status).toBe(403);
    });

    it("404s for an id that doesn't exist", async () => {
      const res = await DELETE(
        apiRequest("/members/invites/not-a-real-id", { method: "DELETE", token: manageKey }),
        routeCtx({ id: "not-a-real-id" }),
      );
      expect(res.status).toBe(404);
    });

    it("404s (not 403) for an invite belonging to another organization", async () => {
      const foreignInvite = await inviteUserToOrganization(
        { organizationId: otherOrg.id, email: `foreign-invite-rest-${runId}@example.com` },
        consoleEmailSender,
      );
      const res = await DELETE(
        apiRequest(`/members/invites/${foreignInvite.inviteId}`, { method: "DELETE", token: manageKey }),
        routeCtx({ id: foreignInvite.inviteId }),
      );
      expect(res.status).toBe(404);
    });

    it("204s and actually removes the invite", async () => {
      const res = await DELETE(
        apiRequest(`/members/invites/${invite.inviteId}`, { method: "DELETE", token: manageKey }),
        routeCtx({ id: invite.inviteId }),
      );
      expect(res.status).toBe(204);
      const row = await prismaWithoutTenantScoping.organizationInvite.findUnique({ where: { id: invite.inviteId } });
      expect(row).toBeNull();
    });
  });
});
