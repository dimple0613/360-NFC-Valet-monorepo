import { afterAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import { listLinkedOAuthAccounts, resolveOAuthSignIn, UnverifiedEmailConflictError, type OAuthProfile } from "../auth/oauth-provider";
import { inviteUserToOrganization } from "../organization-invites";

const runId = Date.now().toString(36);
const createdUserIds: string[] = [];
const createdOrgIds: string[] = [];

function profile(overrides: Partial<OAuthProfile> = {}): OAuthProfile {
  return {
    provider: "google",
    providerUserId: `sub-${runId}-${Math.random().toString(36).slice(2)}`,
    email: `oauth-${runId}-${Math.random().toString(36).slice(2)}@example.com`,
    emailVerified: true,
    ...overrides,
  };
}

describe("resolveOAuthSignIn", () => {
  afterAll(async () => {
    await prismaWithoutTenantScoping.oAuthAccount.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prismaWithoutTenantScoping.organizationMembership.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prismaWithoutTenantScoping.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prismaWithoutTenantScoping.role.deleteMany({ where: { organizationId: { in: createdOrgIds } } });
    await prismaWithoutTenantScoping.organizationInvite.deleteMany({ where: { organizationId: { in: createdOrgIds } } });
    await prismaWithoutTenantScoping.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
    await prismaWithoutTenantScoping.user.deleteMany({ where: { id: { in: createdUserIds } } });
  });

  it("creates a brand-new user + OAuthAccount for a verified email with no existing account", async () => {
    const p = profile();
    const result = await resolveOAuthSignIn(p);
    createdUserIds.push(result.userId);

    expect(result.isNewUser).toBe(true);
    expect(result.mfaRequired).toBe(false);
    expect(result.joinedOrganizationId).toBeNull();

    const user = await prismaWithoutTenantScoping.user.findUniqueOrThrow({ where: { id: result.userId } });
    expect(user.email).toBe(p.email);
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(user.passwordHash).toBeNull();

    const link = await prismaWithoutTenantScoping.oAuthAccount.findUniqueOrThrow({
      where: { provider_providerUserId: { provider: "google", providerUserId: p.providerUserId } },
    });
    expect(link.userId).toBe(result.userId);
  });

  it("resolves to the same user on a second sign-in via the existing OAuthAccount link", async () => {
    const p = profile();
    const first = await resolveOAuthSignIn(p);
    createdUserIds.push(first.userId);

    const second = await resolveOAuthSignIn(p);
    expect(second.userId).toBe(first.userId);
    expect(second.isNewUser).toBe(false);

    const accountCount = await prismaWithoutTenantScoping.oAuthAccount.count({
      where: { provider: "google", providerUserId: p.providerUserId },
    });
    expect(accountCount).toBe(1); // no duplicate link created
  });

  it("auto-links to an existing user by verified email when there's no OAuthAccount yet", async () => {
    const email = `oauth-link-${runId}@example.com`;
    const existing = await prismaWithoutTenantScoping.user.create({ data: { email, passwordHash: "irrelevant" } });
    createdUserIds.push(existing.id);

    const result = await resolveOAuthSignIn(profile({ email, emailVerified: true }));
    expect(result.userId).toBe(existing.id);
    expect(result.isNewUser).toBe(false);
  });

  it("rejects (not a raw DB error) when an unverified email collides with an existing account", async () => {
    const email = `oauth-unverified-${runId}@example.com`;
    const existing = await prismaWithoutTenantScoping.user.create({ data: { email, passwordHash: "irrelevant" } });
    createdUserIds.push(existing.id);

    await expect(resolveOAuthSignIn(profile({ email, emailVerified: false }))).rejects.toThrow(
      UnverifiedEmailConflictError,
    );
  });

  it("creates a new user for an unverified email with no existing account at all", async () => {
    const result = await resolveOAuthSignIn(profile({ emailVerified: false }));
    createdUserIds.push(result.userId);
    expect(result.isNewUser).toBe(true);

    const user = await prismaWithoutTenantScoping.user.findUniqueOrThrow({ where: { id: result.userId } });
    expect(user.emailVerifiedAt).toBeNull();
  });

  it("reflects mfaEnabled on the resolved account", async () => {
    const p = profile();
    const first = await resolveOAuthSignIn(p);
    createdUserIds.push(first.userId);
    await prismaWithoutTenantScoping.user.update({ where: { id: first.userId }, data: { mfaEnabled: true } });

    const second = await resolveOAuthSignIn(p);
    expect(second.mfaRequired).toBe(true);
  });

  it("auto-accepts a pending invite for a brand-new user's email", async () => {
    const org = await prismaWithoutTenantScoping.organization.create({
      data: { name: "OAuth Invite Org", slug: `oauth-invite-org-${runId}` },
    });
    createdOrgIds.push(org.id);
    const email = `oauth-invited-${runId}@example.com`;
    await inviteUserToOrganization({ organizationId: org.id, email });

    const result = await resolveOAuthSignIn(profile({ email, emailVerified: true }));
    createdUserIds.push(result.userId);

    expect(result.isNewUser).toBe(true);
    expect(result.joinedOrganizationId).toBe(org.id);

    const membership = await prismaWithoutTenantScoping.organizationMembership.findUniqueOrThrow({
      where: { organizationId_userId: { organizationId: org.id, userId: result.userId } },
    });
    expect(membership.status).toBe("ACTIVE");
  });

  it("resolves a non-google/apple provider string identically — resolveOAuthSignIn never special-cases which adapter ran (proves the shared contract is genuinely provider-agnostic)", async () => {
    const p = profile({ provider: "microsoft-entra-id", providerUserId: `entra-sub-${runId}` });
    const result = await resolveOAuthSignIn(p);
    createdUserIds.push(result.userId);

    expect(result.isNewUser).toBe(true);
    const link = await prismaWithoutTenantScoping.oAuthAccount.findUniqueOrThrow({
      where: { provider_providerUserId: { provider: "microsoft-entra-id", providerUserId: p.providerUserId } },
    });
    expect(link.userId).toBe(result.userId);
  });

  it("listLinkedOAuthAccounts returns only this user's linked providers", async () => {
    const p = profile();
    const result = await resolveOAuthSignIn(p);
    createdUserIds.push(result.userId);

    const linked = await listLinkedOAuthAccounts(result.userId);
    expect(linked).toEqual([{ provider: "google", createdAt: expect.any(Date) }]);

    const otherUserLinked = await listLinkedOAuthAccounts("not-a-real-user-id");
    expect(otherUserLinked).toEqual([]);
  });
});
