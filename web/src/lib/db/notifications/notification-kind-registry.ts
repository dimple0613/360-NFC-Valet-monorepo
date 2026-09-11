import { prismaWithoutTenantScoping } from "../client";

// REQUIREMENTS.md §2.14 / CLAUDE.md: notification copy is a registry, not
// hardcoded strings inside business logic — same self-registration/
// idempotent-upsert pattern as permission-registry.ts/resource-types.ts.
// NotificationKind is a global catalog (see schema.prisma), so this runs
// outside any tenant context and uses the raw client directly, same as those
// two. Deliberately core-agnostic key names only (e.g. "org.invite_sent",
// "security.password_changed") — no CRM/ERP-specific event names may live in
// core (CLAUDE.md).

export interface NotificationKindDefinition {
  key: string;
  module: string;
  description?: string;
  /** Rendered via renderNotificationTemplate (notify.ts) — {{variable}} placeholders substituted from the caller's `variables` map. */
  subjectTemplate: string;
  bodyTemplate: string;
  /** A settings/notifications preference category key ("security_alerts", "billing", "member_activity") — sendNotification (notify.ts) skips dispatch entirely when the recipient has opted out of it. Omit (defaults to "general") for a kind with no matching preference toggle, which is never gated. */
  category?: string;
}

export class NotificationKindKeyConflictError extends Error {
  constructor(key: string, existingModule: string, incomingModule: string) {
    super(
      `Notification kind "${key}" is already registered by module "${existingModule}" — ` +
        `module "${incomingModule}" cannot claim it. Namespace yours (e.g. "yourModule.thing_happened") ` +
        `to avoid collisions.`,
    );
    this.name = "NotificationKindKeyConflictError";
  }
}

/** Idempotent: safe to call on every boot/deploy, not just once. Re-registering an existing key updates its templates/description in place; claiming a key another module already owns throws NotificationKindKeyConflictError instead of silently reassigning it. */
export async function registerNotificationKinds(definitions: NotificationKindDefinition[]): Promise<void> {
  for (const definition of definitions) {
    const existing = await prismaWithoutTenantScoping.notificationKind.findUnique({
      where: { key: definition.key },
    });
    if (existing && existing.module !== definition.module) {
      throw new NotificationKindKeyConflictError(definition.key, existing.module, definition.module);
    }

    await prismaWithoutTenantScoping.notificationKind.upsert({
      where: { key: definition.key },
      create: { ...definition, category: definition.category ?? "general" },
      update: {
        module: definition.module,
        description: definition.description,
        subjectTemplate: definition.subjectTemplate,
        bodyTemplate: definition.bodyTemplate,
        category: definition.category ?? "general",
      },
    });
  }
}

export async function getNotificationKind(key: string) {
  return prismaWithoutTenantScoping.notificationKind.findUnique({ where: { key } });
}

export async function listNotificationKinds() {
  return prismaWithoutTenantScoping.notificationKind.findMany({ orderBy: { key: "asc" } });
}
