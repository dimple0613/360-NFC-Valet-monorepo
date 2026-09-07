import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaWithoutTenantScoping } from "../client";
import { resolveOAuthSignIn, RegistrationDisabledError, type OAuthProfile } from "../auth/oauth-provider";
import { inviteUserToOrganization } from "../organization-invites";

// isolate the registration kill-switch behavior in its own file: the switch is
// platform-scoped DB state, so this file mocks isRegistrationEnabled entirely
// (the real one is already covered by platform-config.test.ts) and never
// touches the access.* settings other test files rely on.

const { mockIsRegistrationEnabled } = vi.hoisted(() => ({ mockIsRegistrationEnabled: vi.fn() }));

vi.mock("../platform-config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../platform-config")>();
  return { ...actual, isRegistrationEnabled: mockIsRegistrationEnabled };
});

const runId = Date.now().toString(36);
const createdUserIds: string[] = [];
const createdOrgIds: string[] = [];

function profile(overrides: Partial<OAuthProfile> = {}): OAuthProfile {
  return {
    provider: "google",
    providerUserId: `sub-reg-${runId}-${Math.random().toString(36).slice(2)}`,
    email: `oauth-reg-${runId}-${Math.random().toString(36).slice(2)}@example.com`,
    emailVerified: true,
    ...overrides,
  };
}

beforeEach(() => {
  mockIsRegistrationEnabled.mockReset();
  mockIsRegistrationEnabled.mockResolvedValue(true);
});

afterAll(async () => {
  await prismaWithoutTenantScoping.oAuthAccount.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prismaWithoutTenantScoping.organizationMembership.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prismaWithoutTenantScoping.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prismaWithoutTenantScoping.role.deleteMany({ where: { organizationId: { in: createdOrgIds } } });
  await prismaWithoutTenantScoping.organizationInvite.deleteMany({ where: { organizationId: { in: createdOrgIds } } });
  await prismaWithoutTenantScoping.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
  await prismaWithoutTenantScoping.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

describe("resolveOAuthSignIn x registration kill-switch (#35)", () => {
  it("blocks a brand-new verified profile from self-registering when public sign-up is disabled", async () => {
    mockIsRegistrationEnabled.mockResolvedValue(false);
    const p = profile();

    await expect(resolveOAuthSignIn(p)).rejects.toThrow(RegistrationDisabledError);

    // nothing half-created in the DB
    const email = p.email;
    const createdCount = await prismaWithoutTenantScoping.user.count({ where: { email } });
    expect(createdCount).toBe(0);
    const linkCount = await prismaWithoutTenantScoping.oAuthAccount.count({
      where: { provider: "google", providerUserId: p.providerUserId },
    });
    expect(linkCount).toBe(0);
  });

  it("does not consult the kill-switch for an existing user auto-linking a new OAuth provider", async () => {
    mockIsRegistrationEnabled.mockResolvedValue(false);
    const email = `oauth-reg-link-${runId}@example.com`;
    const existing = await prismaWithoutTenantScoping.user.create({ data: { email, passwordHash: "irrelevant" } });
    createdUserIds.push(existing.id);

    const result = await resolveOAuthSignIn(profile({ email, emailVerified: true }));
    expect(result.userId).toBe(existing.id);
    expect(result.isNewUser).toBe(false);
    expect(mockIsRegistrationEnabled).not.toHaveBeenCalled();
  });

  it("still lets an invited new user join via OAuth while public sign-up is disabled", async () => {
    mockIsRegistrationEnabled.mockResolvedValue(false);
    const org = await prismaWithoutTenantScoping.organization.create({
      data: { name: "OAuth Reg Invite Org", slug: `oauth-reg-invite-org-${runId}` },
    });
    createdOrgIds.push(org.id);
    const email = `oauth-reg-invited-${runId}@example.com`;
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

  it("blocks a brand-new unverified profile too (any new account is self-registration)", async () => {
    mockIsRegistrationEnabled.mockResolvedValue(false);
    const p = profile({ emailVerified: false });

    await expect(resolveOAuthSignIn(p)).rejects.toThrow(RegistrationDisabledError);
    const createdCount = await prismaWithoutTenantScoping.user.count({ where: { email: p.email } });
    expect(createdCount).toBe(0);
  });

  it("creates the new user normally when public sign-up is enabled", async () => {
    const p = profile();
    const result = await resolveOAuthSignIn(p);
    createdUserIds.push(result.userId);
    expect(result.isNewUser).toBe(true);
    expect(mockIsRegistrationEnabled).toHaveBeenCalled();
  });
});