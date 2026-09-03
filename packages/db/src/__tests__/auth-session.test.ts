import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import {
  createSession,
  getDefaultOrganizationId,
  InvalidSessionError,
  listSessionsForOrganizationPage,
  listUserSessions,
  listUserSessionsSearch,
  NotAMemberError,
  resolveSession,
  revokeAllUserSessions,
  revokeSession,
  revokeSessionForOrganization,
  SessionNotFoundError,
  switchSessionOrganization,
} from "../auth/session";

const runId = Date.now().toString(36);

describe("session service", () => {
  let user: { id: string };
  let orgA: { id: string };
  let orgB: { id: string };

  beforeAll(async () => {
    user = await prismaWithoutTenantScoping.user.create({ data: { email: `session-${runId}@example.com` } });
    orgA = await prismaWithoutTenantScoping.organization.create({
      data: { name: "Session Org A", slug: `session-org-a-${runId}` },
    });
    orgB = await prismaWithoutTenantScoping.organization.create({
      data: { name: "Session Org B", slug: `session-org-b-${runId}` },
    });
    await prismaWithoutTenantScoping.organizationMembership.create({
      data: { userId: user.id, organizationId: orgA.id },
    });
  });

  afterEach(async () => {
    await prismaWithoutTenantScoping.session.deleteMany({ where: { userId: user.id } });
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.organizationMembership.deleteMany({ where: { userId: user.id } });
    await prismaWithoutTenantScoping.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
    await prismaWithoutTenantScoping.user.delete({ where: { id: user.id } });
  });

  it("createSession -> resolveSession round-trips and bumps lastUsedAt", async () => {
    const { rawToken, session } = await createSession({ userId: user.id, ipAddress: "127.0.0.1" });
    const resolved = await resolveSession(rawToken);
    expect(resolved.userId).toBe(user.id);
    expect(resolved.sessionId).toBe(session.id);
    expect(resolved.organizationId).toBeNull();
  });

  it("resolveSession rejects a bogus token", async () => {
    await expect(resolveSession("not-a-real-token")).rejects.toThrow(InvalidSessionError);
  });

  it("resolveSession rejects a revoked session", async () => {
    const { rawToken, session } = await createSession({ userId: user.id });
    await revokeSession(session.id);
    await expect(resolveSession(rawToken)).rejects.toThrow(InvalidSessionError);
  });

  it("resolveSession rejects an expired session", async () => {
    const { rawToken, session } = await createSession({ userId: user.id });
    await prismaWithoutTenantScoping.session.update({
      where: { id: session.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(resolveSession(rawToken)).rejects.toThrow(InvalidSessionError);
  });

  it("switchSessionOrganization succeeds for an active member, rejects for a non-member", async () => {
    const { session } = await createSession({ userId: user.id });
    await switchSessionOrganization(session.id, orgA.id);
    const updated = await prismaWithoutTenantScoping.session.findUniqueOrThrow({ where: { id: session.id } });
    expect(updated.organizationId).toBe(orgA.id);

    await expect(switchSessionOrganization(session.id, orgB.id)).rejects.toThrow(NotAMemberError);
  });

  it("listUserSessions returns only active (non-revoked, non-expired) sessions", async () => {
    const s1 = await createSession({ userId: user.id });
    const s2 = await createSession({ userId: user.id });
    await revokeSession(s2.session.id);

    const active = await listUserSessions(user.id);
    expect(active.map((s) => s.id)).toEqual([s1.session.id]);
  });

  it("listUserSessionsSearch filters by user agent, excludes revoked/expired, and paginates with a total count", async () => {
    await createSession({ userId: user.id, userAgent: "Chrome on Mac" });
    const s2 = await createSession({ userId: user.id, userAgent: "Firefox on Linux" });
    await revokeSession(s2.session.id);

    const filtered = await listUserSessionsSearch(user.id, { q: "Chrome" });
    expect(filtered.totalCount).toBe(1);
    expect(filtered.items[0]!.userAgent).toBe("Chrome on Mac");

    const all = await listUserSessionsSearch(user.id);
    expect(all.totalCount).toBe(1); // revoked session excluded
  });

  it("getDefaultOrganizationId returns the earliest ACTIVE membership, null with none", async () => {
    // user is already an ACTIVE member of orgA (from beforeAll).
    await expect(getDefaultOrganizationId(user.id)).resolves.toBe(orgA.id);

    const lonelyUser = await prismaWithoutTenantScoping.user.create({
      data: { email: `session-lonely-${runId}@example.com` },
    });
    await expect(getDefaultOrganizationId(lonelyUser.id)).resolves.toBeNull();
    await prismaWithoutTenantScoping.user.delete({ where: { id: lonelyUser.id } });
  });

  it("revokeAllUserSessions revokes everything except an optional excluded session", async () => {
    const keep = await createSession({ userId: user.id });
    const revoke1 = await createSession({ userId: user.id });
    const revoke2 = await createSession({ userId: user.id });

    await revokeAllUserSessions(user.id, keep.session.id);

    await expect(resolveSession(keep.rawToken)).resolves.toBeDefined();
    await expect(resolveSession(revoke1.rawToken)).rejects.toThrow(InvalidSessionError);
    await expect(resolveSession(revoke2.rawToken)).rejects.toThrow(InvalidSessionError);
  });

  it("listSessionsForOrganizationPage returns only sessions currently active in that org, optionally filtered by userId, paginated", async () => {
    const otherUser = await prismaWithoutTenantScoping.user.create({
      data: { email: `session-other-${runId}@example.com` },
    });
    const inOrgA = await createSession({ userId: user.id, organizationId: orgA.id });
    await createSession({ userId: otherUser.id, organizationId: orgA.id });
    await createSession({ userId: user.id, organizationId: orgB.id }); // different org — must not appear

    const page = await listSessionsForOrganizationPage(orgA.id, { limit: 1 });
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).not.toBeNull();
    expect(page.items.every((s) => s.organizationId === orgA.id)).toBe(true);

    const filtered = await listSessionsForOrganizationPage(orgA.id, { userId: user.id });
    expect(filtered.items.map((s) => s.id)).toEqual([inOrgA.session.id]);

    await prismaWithoutTenantScoping.session.deleteMany({ where: { userId: otherUser.id } });
    await prismaWithoutTenantScoping.user.delete({ where: { id: otherUser.id } });
  });

  it("revokeSessionForOrganization revokes a session belonging to that org, throws SessionNotFoundError for a foreign org or unknown id", async () => {
    const { session } = await createSession({ userId: user.id, organizationId: orgA.id });

    await expect(revokeSessionForOrganization(orgB.id, session.id)).rejects.toThrow(SessionNotFoundError);
    const stillActive = await prismaWithoutTenantScoping.session.findUniqueOrThrow({ where: { id: session.id } });
    expect(stillActive.revokedAt).toBeNull();

    await expect(revokeSessionForOrganization(orgA.id, "not-a-real-id")).rejects.toThrow(SessionNotFoundError);

    await revokeSessionForOrganization(orgA.id, session.id);
    const revoked = await prismaWithoutTenantScoping.session.findUniqueOrThrow({ where: { id: session.id } });
    expect(revoked.revokedAt).not.toBeNull();
  });
});
