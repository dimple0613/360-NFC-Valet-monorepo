import type { PermissionDefinition } from "./permission-registry";

// FR-152: core's own permission manifest — the one Phase 1 registrant. Deliberately
// small: it covers the resources Phase 1A actually models (orgs/roles/members),
// not a speculative full catalog. Grows as the authorization policy layer
// (FR-153) and each portal's real endpoints are built.
export const CORE_PERMISSIONS: PermissionDefinition[] = [
  {
    key: "core.platform.manage_organizations",
    module: "core",
    scope: "PLATFORM",
    description: "Create, suspend, reactivate, archive, or delete any organization.",
  },
  {
    key: "core.platform.manage_platform_admins",
    module: "core",
    scope: "PLATFORM",
    description: "Assign or revoke platform roles for other platform administrators.",
  },
  {
    key: "core.platform.manage_global_roles",
    module: "core",
    scope: "PLATFORM",
    description: "Create, edit, or delete global tenant roles — role templates usable by every organization.",
  },
  {
    key: "core.platform.impersonate_organization_admin",
    module: "core",
    scope: "PLATFORM",
    description: "Start a time-boxed, audited impersonation session as an organization admin.",
  },
  {
    key: "core.platform.view_billing",
    module: "core",
    scope: "PLATFORM",
    description: "View any organization's plan, subscription, invoices, and billing event history (read-only).",
  },
  {
    key: "core.platform.manage_plans",
    module: "core",
    scope: "PLATFORM",
    description: "Create new plan versions and change a plan's visibility (FR-180-183).",
  },
  {
    key: "core.platform.manage_billing",
    module: "core",
    scope: "PLATFORM",
    description: "Assign or change any organization's subscription plan — write counterpart to view_billing.",
  },
  {
    key: "core.platform.manage_settings",
    module: "core",
    scope: "PLATFORM",
    description: "View and set platform-wide settings (FR-270/271).",
  },
  {
    key: "core.platform.manage_auth_providers",
    module: "core",
    scope: "PLATFORM",
    description: "Enable, configure, or disable authentication providers (OAuth2/OIDC/SSO) for the platform (FR-220/221).",
  },
  {
    key: "core.platform.manage_payment_providers",
    module: "core",
    scope: "PLATFORM",
    description: "Enable, configure, or disable payment providers for the platform (FR-211).",
  },
  {
    key: "core.platform.view_audit_log",
    module: "core",
    scope: "PLATFORM",
    description: "View the audit trail across every organization (FR-280/282, read-only).",
  },
  {
    key: "core.platform.manage_notification_channels",
    module: "core",
    scope: "PLATFORM",
    description: "Enable, configure, or disable notification channels (email/webhook) for the platform (§2.14).",
  },
  {
    key: "core.organization.manage_profile",
    module: "core",
    scope: "TENANT",
    description: "Edit the organization's own profile, branding, and contact information.",
  },
  {
    key: "core.organization.read",
    module: "core",
    scope: "TENANT",
    description: "Read the organization's own profile — read-only counterpart to manage_profile, for API keys/integrations that only need visibility.",
  },
  {
    key: "core.organization.manage_members",
    module: "core",
    scope: "TENANT",
    description: "Invite, remove, or change the status of members within the organization.",
  },
  {
    key: "core.organization.read_members",
    module: "core",
    scope: "TENANT",
    description: "Read the organization's member list — read-only counterpart to manage_members, for API keys/integrations that only need visibility.",
  },
  {
    key: "core.roles.manage",
    module: "core",
    scope: "TENANT",
    description: "Create custom roles and assign permissions to them (FR-122).",
  },
  {
    key: "core.api_keys.manage",
    module: "core",
    scope: "TENANT",
    description: "Create and revoke the organization's API keys (FR-322).",
  },
  {
    key: "core.billing.manage",
    module: "core",
    scope: "TENANT",
    description: "Subscribe to a plan, upgrade/downgrade, or cancel the organization's subscription (FR-160-163).",
  },
  {
    key: "core.billing.read",
    module: "core",
    scope: "TENANT",
    description: "Read the organization's plan, subscription, and invoices — read-only counterpart to billing.manage, for API keys/integrations that only need visibility.",
  },
  {
    key: "core.settings.manage",
    module: "core",
    scope: "TENANT",
    description: "Create or update the organization's own settings (FR-270/271).",
  },
  {
    key: "core.settings.read",
    module: "core",
    scope: "TENANT",
    description: "Read the organization's own settings — read-only counterpart to settings.manage, for API keys/integrations that only need visibility.",
  },
  {
    key: "core.sessions.read",
    module: "core",
    scope: "TENANT",
    description: "Read which sessions are currently active within the organization (no per-user 'self' concept applies to an API key — see session.ts).",
  },
  {
    key: "core.sessions.manage",
    module: "core",
    scope: "TENANT",
    description: "Revoke a session currently active within the organization.",
  },
  {
    key: "core.notifications.read",
    module: "core",
    scope: "TENANT",
    description: "Read the organization's in-app notification feed (§2.14).",
  },
  {
    key: "core.organization.export_data",
    module: "core",
    scope: "TENANT",
    description: "Export a portability snapshot of the organization's own data (FR-132, GDPR data portability) — a more sensitive read than organization.read, kept as its own permission.",
  },
  {
    key: "core.features.read",
    module: "core",
    scope: "TENANT",
    description: "Read which feature flags are currently enabled for the organization (FR-190-192).",
  },
  {
    key: "core.audit_log.read",
    module: "core",
    scope: "TENANT",
    description: "Read the organization's own audit trail (FR-280/282) — a real access grant, so kept separate from the broader admin permissions rather than folded into an existing one.",
  },
];
