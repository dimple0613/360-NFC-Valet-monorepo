import {
  createOrganization,
  createSession,
  db,
  isRegistrationEnabled,
  listRoles,
  prismaWithoutTenantScoping,
  recordResourceUsage,
  resolveEmailSender,
  runWithTenant,
  seedDefaultRoles,
  signUp,
} from "@saasclaude/db";

// Composes signUp (auth-only, packages/db) with createOrganization
// (packages/db) and the default role set (packages/db's seedDefaultRoles) —
// this composition is deliberately NOT part of any lower-level service (see
// the doc comments on signUp/createOrganization/seedDefaultRoles); it belongs
// here, at the one place that actually needs "a new organization signs up" as
// a single action (FR-130: customers are organizations, not individual users).

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * The org-creation half, factored out so the OAuth "name your organization"
 * flow (a user who already exists — created by Google/Apple sign-in, no
 * password to set) can reuse it without going through signUp() again.
 * signUpNewOrganization below is now a thin wrapper: signUp, then this.
 */
export async function createOrganizationForExistingUser(
  userId: string,
  organizationName: string,
  /** Super Admin's "New customer" form lets the default user start as any default role, not just Owner (the self-serve signup path's only caller never passes this, so it keeps its Owner behavior). */
  founderRoleName: "Owner" | "Admin" | "Member" | "Viewer" = "Owner",
): Promise<{ organizationId: string }> {
  const baseSlug = slugify(organizationName) || "org";
  let slug = baseSlug;
  let attempt = 0;
  // Unlikely to collide in practice, but slugs are unique — retry with a
  // numeric suffix rather than surfacing a raw constraint violation.
  while (await prismaWithoutTenantScoping.organization.findUnique({ where: { slug } })) {
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }

  const organization = await createOrganization({ name: organizationName, slug });

  await runWithTenant(organization.id, async () => {
    await db.organizationMembership.create({
      data: { organizationId: organization.id, userId, status: "ACTIVE" },
    });
  });

  // Owner + Admin/Member/Viewer (FR-122's default role set) — the founding
  // member gets Owner by default here; the other three exist so new invites
  // have somewhere to land besides "everything" or "nothing" (or, for the
  // Super Admin "New customer" form, so the founding member can start as one
  // of them instead).
  const { ownerRoleId } = await seedDefaultRoles(organization.id);
  let founderRoleId = ownerRoleId;
  if (founderRoleName !== "Owner") {
    const roles = await listRoles(organization.id);
    const role = roles.find((r) => r.name === founderRoleName);
    if (!role) throw new Error(`seedDefaultRoles did not create a "${founderRoleName}" role.`);
    founderRoleId = role.id;
  }
  await runWithTenant(organization.id, async () => {
    await db.userRole.create({
      data: { userId, roleId: founderRoleId, organizationId: organization.id },
    });
  });

  // FR-173/DoD: the founding member occupies a seat too — a brand-new org has
  // no subscription yet (recordResourceUsage, not the *Enforced variant: no
  // quota exists to check against), but the usage must still be on the books
  // so quota enforcement is accurate once they later subscribe (see the
  // matching call in organization-invites.ts's acceptOrganizationInvite).
  // No `userId` here: core.seats is an org-wide gauge, and getResourceUsage
  // treats a passed userId as a *scope* on future quota reads, not
  // attribution — tagging events with it would make later checks undercount.
  await recordResourceUsage({ organizationId: organization.id, resourceTypeKey: "core.seats", amount: 1 });

  return { organizationId: organization.id };
}

export interface SignUpNewOrganizationInput {
  organizationName: string;
  email: string;
  password: string;
  name?: string;
}

export interface SignUpNewOrganizationResult {
  userId: string;
  organizationId: string;
  sessionToken: string;
}

export class RegistrationDisabledError extends Error {
  constructor() {
    super("New account registration is currently disabled.");
    this.name = "RegistrationDisabledError";
  }
}

export async function signUpNewOrganization(
  input: SignUpNewOrganizationInput,
): Promise<SignUpNewOrganizationResult> {
  // Platform-level kill switch for self-serve signup (Settings > General).
  // The Super Admin "New customer" flow goes through
  // createOrganizationForExistingUser directly and is deliberately NOT gated
  // by this — an operator can always onboard a customer.
  if (!(await isRegistrationEnabled())) {
    throw new RegistrationDisabledError();
  }

  // Absorbs the ad-hoc mailer into the notification-channel framework (§2.14):
  // signUp's verification email now goes out for real once the email channel
  // is configured (Super Admin > Settings > Notification Channels), falling
  // back to the pre-existing console placeholder otherwise — no behavior
  // change in this dev environment (nothing configured), see TASKS.md.
  const { userId } = await signUp(
    { email: input.email, password: input.password, name: input.name },
    await resolveEmailSender(),
  );
  const { organizationId } = await createOrganizationForExistingUser(userId, input.organizationName);
  const { rawToken } = await createSession({ userId, organizationId });
  return { userId, organizationId, sessionToken: rawToken };
}
