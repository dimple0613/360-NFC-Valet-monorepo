import type { NotificationKindDefinition } from "./notification-kind-registry";

// Core's own notification-kind manifest — mirrors core-permissions.ts and
// billing/core-resource-types.ts (a module's own registrant list, registered
// via prisma/seed.ts). Deliberately small: two kinds, proving the
// kind/template registry works end-to-end, not a speculative full catalog.
// Both are genuinely core-agnostic (org membership + account security are
// platform concerns in every deployment, never a specific business domain).
export const CORE_NOTIFICATION_KINDS: NotificationKindDefinition[] = [
  {
    key: "org.invite_sent",
    module: "core",
    description: "An invite was sent to join an organization (FR-122).",
    subjectTemplate: "You've been invited to join {{organizationName}}",
    bodyTemplate: "You've been invited to join {{organizationName}}. Use the link you were given to accept.",
    category: "member_activity",
  },
  {
    key: "security.password_changed",
    module: "core",
    description: "A user's password was changed via the self-service change-password flow.",
    subjectTemplate: "Your password was changed",
    bodyTemplate: "Your password for {{organizationName}} was just changed. If this wasn't you, contact an administrator immediately.",
    category: "security_alerts",
  },
];
