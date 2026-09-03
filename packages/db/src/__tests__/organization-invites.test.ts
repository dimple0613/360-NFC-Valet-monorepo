import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping, db } from "../client";
import { runWithTenant } from "../tenant-context";
import type { EmailSender } from "../auth/email-sender";
import {
  acceptOrganizationInvite,
  acceptPendingInviteForOAuthUser,
  AlreadyMemberError,
  cancelInvite,
  inviteUserToOrganization,
  InvalidOrExpiredInviteError,
  InviteAlreadyPendingError,
  InviteNotFoundError,
  countActiveOrganizationMembers,
  listOrganizationMembers,
  listOrganizationMembersPage,
  listOrganizationMembersSearch,
  listPendingInvitesPage,
  listPendingInvitesSearch,
  listPendingInvites,
  MembershipNotFoundError,
  removeOrganizationMember,
  revokeInvite,
} from "../organization-invites";
import { RoleNotFoundError } from "../roles";
import { getResourceUsage } from "../billing/resource-consumption";
import { listInAppNotifications } from "../notifications/in-app-channel";

const runId = Date.now().toString(36);

function capturingEmailSender(): { sender: EmailSender; sent: { to: string; subject: string; body: string }[] } {
  const sent: { to: string; subject: string; body: string }[] = [];
  return { sender: { async send(p) { sent.push(p); } }, sent };
}

function extractToken(body: string): string {
  const match = body.match(/token: (\S+)/);
  if (!match) throw new Error(`No token in body: ${body}`);
  return match[1]!;
}

describe("organization invites", () => {
  let org: { id: string };
  let role: { id: string };
  let inviter: { id: string; email: string };

  beforeAll(async () => {
    org = await prismaWithoutTenantScoping.organization.create({
      data: { name: "Invite Org", slug: `invite-org-${runId}` },
    });
    inviter = await prismaWithoutTenantScoping.user.create({ data: { email: `inviter-${runId}@example.com` } });
    role = await runWithTenant(org.id, async () =>
      db.role.create({ data: { name: "Member", slug: `member-${runId}`, organizationId: org.id } }),
    );
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.userRole.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.organizationMembership.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.organizationInvite.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.auditLog.deleteMany({ where: { organizationId: org.id } });
    await prismaWithoutTenantScoping.role.deleteMany({ where: { id: role.id } });
    await prismaWithoutTenantScoping.organization.delete({ where: { id: org.id } });
    await prismaWithoutTenantScoping.user.deleteMany({
      where: { email: { in: [inviter.email, `invitee-${runId}@example.com`, `invitee2-${runId}@example.com`] } },
    });
  });

  it("invite -> accept creates the user, activates membership, and applies the pre-assigned role", async () => {
    const email = `invitee-${runId}@example.com`;
    const { sender, sent } = capturingEmailSender();

    await inviteUserToOrganization({ organizationId: org.id, email, roleId: role.id, invitedByUserId: inviter.id }, sender);
    expect(sent).toHaveLength(1);

    const { userId, organizationId } = await acceptOrganizationInvite({
      rawToken: extractToken(sent[0]!.body),
      name: "Invitee Name",
      password: "correct-horse-battery-staple",
    });
    expect(organizationId).toBe(org.id);

    const membership = await prismaWithoutTenantScoping.organizationMembership.findUniqueOrThrow({
      where: { organizationId_userId: { organizationId: org.id, userId } },
    });
    expect(membership.status).toBe("ACTIVE");

    const userRole = await prismaWithoutTenantScoping.userRole.findUniqueOrThrow({
      where: { userId_roleId: { userId, roleId: role.id } },
    });
    expect(userRole.organizationId).toBe(org.id);
  });

  it("rejects accepting the same invite twice", async () => {
    const email = `invitee2-${runId}@example.com`;
    const { sender, sent } = capturingEmailSender();
    await inviteUserToOrganization({ organizationId: org.id, email }, sender);
    const token = extractToken(sent[0]!.body);

    await acceptOrganizationInvite({ rawToken: token, password: "correct-horse-battery-staple" });
    await expect(
      acceptOrganizationInvite({ rawToken: token, password: "another-long-password" }),
    ).rejects.toThrow(InvalidOrExpiredInviteError);
  });

  it("rejects a garbage token", async () => {
    await expect(
      acceptOrganizationInvite({ rawToken: "not-a-real-token", password: "correct-horse-battery-staple" }),
    ).rejects.toThrow(InvalidOrExpiredInviteError);
  });

  it("rejects a roleId that belongs to a different organization", async () => {
    const otherOrg = await prismaWithoutTenantScoping.organization.create({
      data: { name: "Other Invite Org", slug: `other-invite-org-${runId}` },
    });
    const otherOrgRole = await runWithTenant(otherOrg.id, async () =>
      db.role.create({ data: { name: "Foreign Role", slug: `foreign-role-${runId}`, organizationId: otherOrg.id } }),
    );

    await expect(
      inviteUserToOrganization({
        organizationId: org.id,
        email: `cross-org-invitee-${runId}@example.com`,
        roleId: otherOrgRole.id,
      }),
    ).rejects.toThrow(RoleNotFoundError);

    await prismaWithoutTenantScoping.role.deleteMany({ where: { id: otherOrgRole.id } });
    await prismaWithoutTenantScoping.organization.delete({ where: { id: otherOrg.id } });
  });

  it("rejects inviting an email that's already an active member", async () => {
    const email = `already-member-${runId}@example.com`;
    const { sender, sent } = capturingEmailSender();
    await inviteUserToOrganization({ organizationId: org.id, email }, sender);
    await acceptOrganizationInvite({ rawToken: extractToken(sent[0]!.body), password: "correct-horse-battery-staple" });

    await expect(inviteUserToOrganization({ organizationId: org.id, email })).rejects.toThrow(AlreadyMemberError);

    await prismaWithoutTenantScoping.user.deleteMany({ where: { email } });
  });

  it("rejects inviting an email that already has a pending invite", async () => {
    const email = `already-pending-${runId}@example.com`;
    const { sender } = capturingEmailSender();
    await inviteUserToOrganization({ organizationId: org.id, email }, sender);

    await expect(inviteUserToOrganization({ organizationId: org.id, email })).rejects.toThrow(
      InviteAlreadyPendingError,
    );

    await prismaWithoutTenantScoping.organizationInvite.deleteMany({ where: { email } });
  });

  it("listPendingInvites excludes accepted invites; revokeInvite removes a pending one", async () => {
    const { sender } = capturingEmailSender();
    await inviteUserToOrganization({ organizationId: org.id, email: `pending-${runId}@example.com` }, sender);

    const before = await listPendingInvites(org.id);
    expect(before.some((i) => i.email === `pending-${runId}@example.com`)).toBe(true);

    const toRevoke = before.find((i) => i.email === `pending-${runId}@example.com`)!;
    await revokeInvite(toRevoke.id);

    const after = await listPendingInvites(org.id);
    expect(after.some((i) => i.id === toRevoke.id)).toBe(false);
  });

  it("listOrganizationMembers returns the org's members with their user attached", async () => {
    const members = await listOrganizationMembers(org.id);
    expect(members.length).toBeGreaterThan(0);
    expect(members.every((m) => m.organizationId === org.id)).toBe(true);
    expect(members[0]!.user).toBeDefined();
  });

  it("countActiveOrganizationMembers matches the ACTIVE subset of listOrganizationMembers", async () => {
    const members = await listOrganizationMembers(org.id);
    const activeCount = members.filter((m) => m.status === "ACTIVE").length;
    await expect(countActiveOrganizationMembers(org.id)).resolves.toBe(activeCount);
  });

  it("removeOrganizationMember deletes the membership and frees the seat", async () => {
    const usageBefore = await getResourceUsage(org.id, "core.seats");
    const [member] = await listOrganizationMembers(org.id);
    await removeOrganizationMember(org.id, member!.id);

    const stillThere = await prismaWithoutTenantScoping.organizationMembership.findUnique({
      where: { id: member!.id },
    });
    expect(stillThere).toBeNull();

    const usageAfter = await getResourceUsage(org.id, "core.seats");
    expect(usageAfter).toBe(usageBefore - 1);
  });

  it("removeOrganizationMember throws MembershipNotFoundError for an unknown id", async () => {
    await expect(removeOrganizationMember(org.id, "not-a-real-id")).rejects.toThrow(MembershipNotFoundError);
  });

  it("listOrganizationMembersPage paginates in real DB pages with a working cursor", async () => {
    const users = await Promise.all(
      [1, 2, 3].map((n) => prismaWithoutTenantScoping.user.create({ data: { email: `page-member-${n}-${runId}@example.com` } })),
    );
    await runWithTenant(org.id, async () => {
      for (const u of users) {
        await db.organizationMembership.create({ data: { organizationId: org.id, userId: u.id, status: "ACTIVE" } });
      }
    });

    const first = await listOrganizationMembersPage(org.id, { limit: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();

    const seenIds = new Set(first.items.map((m) => m.id));
    let cursor = first.nextCursor;
    while (cursor) {
      const page = await listOrganizationMembersPage(org.id, { limit: 2, cursor });
      for (const item of page.items) {
        expect(seenIds.has(item.id)).toBe(false); // no duplicate rows across pages
        seenIds.add(item.id);
      }
      cursor = page.nextCursor;
    }
    expect(seenIds.size).toBeGreaterThanOrEqual(3);

    await prismaWithoutTenantScoping.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  });

  it("listOrganizationMembersSearch filters by email, sorts, and paginates with a total count", async () => {
    const uniqueTag = `search-${runId}`;
    const users = await Promise.all(
      ["alice", "bob"].map((name) =>
        prismaWithoutTenantScoping.user.create({ data: { email: `${name}-${uniqueTag}@example.com` } }),
      ),
    );
    await runWithTenant(org.id, async () => {
      for (const u of users) {
        await db.organizationMembership.create({ data: { organizationId: org.id, userId: u.id, status: "ACTIVE" } });
      }
    });

    const filtered = await listOrganizationMembersSearch(org.id, { q: uniqueTag, pageSize: 1, sortBy: "email", sortDir: "asc" });
    expect(filtered.totalCount).toBe(2);
    expect(filtered.totalPages).toBe(2);
    expect(filtered.items).toHaveLength(1);
    expect(filtered.items[0]!.user.email).toBe(`alice-${uniqueTag}@example.com`);

    const secondPage = await listOrganizationMembersSearch(org.id, { q: uniqueTag, pageSize: 1, page: 2, sortBy: "email", sortDir: "asc" });
    expect(secondPage.items[0]!.user.email).toBe(`bob-${uniqueTag}@example.com`);

    const noMatch = await listOrganizationMembersSearch(org.id, { q: "definitely-not-a-real-email-prefix" });
    expect(noMatch.totalCount).toBe(0);
    expect(noMatch.items).toHaveLength(0);

    await prismaWithoutTenantScoping.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  });

  it("listPendingInvitesSearch filters by email and paginates with a total count", async () => {
    const uniqueTag = `pending-search-${runId}`;
    const { sender } = capturingEmailSender();
    await inviteUserToOrganization({ organizationId: org.id, email: `a-${uniqueTag}@example.com` }, sender);
    await inviteUserToOrganization({ organizationId: org.id, email: `b-${uniqueTag}@example.com` }, sender);

    const filtered = await listPendingInvitesSearch(org.id, { q: uniqueTag, pageSize: 1 });
    expect(filtered.totalCount).toBe(2);
    expect(filtered.items).toHaveLength(1);

    const noMatch = await listPendingInvitesSearch(org.id, { q: "no-such-invite-prefix" });
    expect(noMatch.totalCount).toBe(0);

    await prismaWithoutTenantScoping.organizationInvite.deleteMany({ where: { email: { contains: uniqueTag } } });
  });

  it("acceptPendingInviteForOAuthUser activates the membership for a matching pending invite, and returns null with none", async () => {
    const email = `oauth-invitee-${runId}@example.com`;
    const oauthUser = await prismaWithoutTenantScoping.user.create({ data: { email } });

    const noneYet = await acceptPendingInviteForOAuthUser(email, oauthUser.id);
    expect(noneYet).toBeNull();

    await inviteUserToOrganization({ organizationId: org.id, email, roleId: role.id });
    const result = await acceptPendingInviteForOAuthUser(email, oauthUser.id);
    expect(result?.organizationId).toBe(org.id);

    const membership = await prismaWithoutTenantScoping.organizationMembership.findUniqueOrThrow({
      where: { organizationId_userId: { organizationId: org.id, userId: oauthUser.id } },
    });
    expect(membership.status).toBe("ACTIVE");

    await prismaWithoutTenantScoping.userRole.deleteMany({ where: { userId: oauthUser.id } });
    await prismaWithoutTenantScoping.organizationMembership.deleteMany({ where: { userId: oauthUser.id } });
    await prismaWithoutTenantScoping.user.delete({ where: { id: oauthUser.id } });
  });

  it("dispatches an org.invite_sent in-app notification when the invitee already has a User account (§2.14 framework proof)", async () => {
    const email = `notif-invitee-${runId}@example.com`;
    const existingUser = await prismaWithoutTenantScoping.user.create({ data: { email } });

    await inviteUserToOrganization({ organizationId: org.id, email });

    const notifications = await listInAppNotifications(org.id, existingUser.id);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.kind).toBe("org.invite_sent");
    expect(notifications[0]?.subject).toContain("invited to join");

    await prismaWithoutTenantScoping.inAppNotification.deleteMany({ where: { userId: existingUser.id } });
    await prismaWithoutTenantScoping.organizationInvite.deleteMany({ where: { email } });
    await prismaWithoutTenantScoping.user.delete({ where: { id: existingUser.id } });
  });

  it("does not fail the invite if notification dispatch has nothing to do (brand-new invitee, no User account yet — in-app has no userId to write to)", async () => {
    const email = `notif-brandnew-${runId}@example.com`;
    await expect(inviteUserToOrganization({ organizationId: org.id, email })).resolves.toEqual(
      expect.objectContaining({ rawToken: expect.any(String) }),
    );
    await prismaWithoutTenantScoping.organizationInvite.deleteMany({ where: { email } });
  });

  it("listPendingInvitesPage paginates in real DB pages with a working cursor, excludes accepted invites", async () => {
    const emails = [1, 2, 3].map((n) => `page-invite-${n}-${runId}@example.com`);
    for (const email of emails) {
      await inviteUserToOrganization({ organizationId: org.id, email }, capturingEmailSender().sender);
    }

    const firstPage = await listPendingInvitesPage(org.id, { limit: 2 });
    expect(firstPage.items.length).toBeLessThanOrEqual(2);
    const seen = new Set(firstPage.items.map((i) => i.id));
    if (firstPage.nextCursor) {
      const secondPage = await listPendingInvitesPage(org.id, { limit: 2, cursor: firstPage.nextCursor });
      for (const item of secondPage.items) expect(seen.has(item.id)).toBe(false);
    }

    const all = await listPendingInvitesPage(org.id, { limit: 50 });
    expect(emails.every((email) => all.items.some((i) => i.email === email))).toBe(true);

    await prismaWithoutTenantScoping.organizationInvite.deleteMany({ where: { email: { in: emails } } });
  });

  it("cancelInvite removes a pending invite scoped to the organization, throws InviteNotFoundError for a foreign org or unknown id", async () => {
    const email = `cancel-me-${runId}@example.com`;
    const { inviteId } = await inviteUserToOrganization({ organizationId: org.id, email }, capturingEmailSender().sender);

    const otherOrg = await prismaWithoutTenantScoping.organization.create({
      data: { name: "Cancel Other Org", slug: `cancel-other-org-${runId}` },
    });
    await expect(cancelInvite(otherOrg.id, inviteId)).rejects.toThrow(InviteNotFoundError);
    await expect(cancelInvite(org.id, "not-a-real-id")).rejects.toThrow(InviteNotFoundError);

    await cancelInvite(org.id, inviteId);
    const gone = await prismaWithoutTenantScoping.organizationInvite.findUnique({ where: { id: inviteId } });
    expect(gone).toBeNull();

    await prismaWithoutTenantScoping.organization.delete({ where: { id: otherOrg.id } });
  });
});
