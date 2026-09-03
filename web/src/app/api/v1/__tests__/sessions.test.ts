import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSession, prismaWithoutTenantScoping } from "@saasclaude/db";
import { GET } from "../sessions/route";
import { DELETE } from "../sessions/[id]/route";
import { apiRequest, routeCtx, seedApiKey, seedOrganization, jsonOf } from "./test-helpers";

const runId = Date.now().toString(36);

describe("/api/v1/sessions", () => {
  let org: { id: string };
  let otherOrg: { id: string };
  let readKey: string;
  let manageKey: string;
  let user: { id: string };
  let sessionInOrg: { id: string };

  beforeAll(async () => {
    org = await seedOrganization("REST Sessions Org");
    otherOrg = await seedOrganization("REST Sessions Other Org");
    readKey = (await seedApiKey(org.id, ["core.sessions.read"])).rawKey;
    manageKey = (await seedApiKey(org.id, ["core.sessions.manage"])).rawKey;

    user = await prismaWithoutTenantScoping.user.create({
      data: { email: `sessions-rest-${runId}@example.com` },
    });
    const created = await createSession({ userId: user.id, organizationId: org.id, userAgent: "REST Test Agent" });
    sessionInOrg = created.session;
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.session.deleteMany({ where: { userId: user.id } });
    await prismaWithoutTenantScoping.apiKey.deleteMany({ where: { organizationId: { in: [org.id, otherOrg.id] } } });
    await prismaWithoutTenantScoping.organization.deleteMany({ where: { id: { in: [org.id, otherOrg.id] } } });
    await prismaWithoutTenantScoping.user.deleteMany({ where: { id: user.id } });
  });

  describe("GET", () => {
    it("401s with no key", async () => {
      expect((await GET(apiRequest("/sessions"), {})).status).toBe(401);
    });

    it("403s without core.sessions.read", async () => {
      expect((await GET(apiRequest("/sessions", { token: manageKey }), {})).status).toBe(403);
    });

    it("200s with sessions currently active in this org, never another org's", async () => {
      const res = await GET(apiRequest("/sessions", { token: readKey }), {});
      expect(res.status).toBe(200);
      const body = (await jsonOf(res)) as { sessions: { id: string; userAgent: string | null }[]; nextCursor: string | null };
      expect(body.sessions.some((s) => s.id === sessionInOrg.id)).toBe(true);
      expect(body.sessions.every((s) => s.id !== undefined)).toBe(true);
    });

    it("?userId= narrows to one member", async () => {
      const res = await GET(apiRequest(`/sessions?userId=${user.id}`, { token: readKey }), {});
      const body = (await jsonOf(res)) as { sessions: { id: string }[] };
      expect(body.sessions.map((s) => s.id)).toEqual([sessionInOrg.id]);
    });
  });

  describe("DELETE /sessions/:id", () => {
    it("401s with no key", async () => {
      const res = await DELETE(apiRequest(`/sessions/${sessionInOrg.id}`, { method: "DELETE" }), routeCtx({ id: sessionInOrg.id }));
      expect(res.status).toBe(401);
    });

    it("403s without core.sessions.manage", async () => {
      const res = await DELETE(
        apiRequest(`/sessions/${sessionInOrg.id}`, { method: "DELETE", token: readKey }),
        routeCtx({ id: sessionInOrg.id }),
      );
      expect(res.status).toBe(403);
    });

    it("404s for an id that doesn't exist", async () => {
      const res = await DELETE(
        apiRequest("/sessions/not-a-real-id", { method: "DELETE", token: manageKey }),
        routeCtx({ id: "not-a-real-id" }),
      );
      expect(res.status).toBe(404);
    });

    it("404s (not 403) for a session belonging to another organization", async () => {
      const otherSession = await createSession({ userId: user.id, organizationId: otherOrg.id });
      const otherManageKey = (await seedApiKey(org.id, ["core.sessions.manage"])).rawKey;
      const res = await DELETE(
        apiRequest(`/sessions/${otherSession.session.id}`, { method: "DELETE", token: otherManageKey }),
        routeCtx({ id: otherSession.session.id }),
      );
      expect(res.status).toBe(404);
    });

    it("204s and actually revokes the session", async () => {
      const res = await DELETE(
        apiRequest(`/sessions/${sessionInOrg.id}`, { method: "DELETE", token: manageKey }),
        routeCtx({ id: sessionInOrg.id }),
      );
      expect(res.status).toBe(204);
      const row = await prismaWithoutTenantScoping.session.findUniqueOrThrow({ where: { id: sessionInOrg.id } });
      expect(row.revokedAt).not.toBeNull();
    });
  });
});
