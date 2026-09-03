import { getUserSetting } from "../settings";
import { listNotificationChannels } from "./channel-registry";
import { getNotificationKind } from "./notification-kind-registry";

// The dispatcher business logic calls to trigger a notification —
// "call sendNotification(kind, ...)" instead of hand-writing message copy
// inline (REQUIREMENTS.md §2.14, CLAUDE.md's "everything configuration-
// driven, not hardcoded"). Renders the kind's registered subject/body
// templates, then hands the rendered NotificationMessage to every
// registered-and-configured channel (channel-registry.ts) — genuinely
// proving "multiple providers can be active simultaneously" (CLAUDE.md):
// email, webhook, and in-app can all fire for the same event.

export class NotificationKindNotFoundError extends Error {
  constructor(key: string) {
    super(`No notification kind registered for "${key}" — register it first (notification-kind-registry.ts).`);
    this.name = "NotificationKindNotFoundError";
  }
}

/** Simple, dependency-free {{variable}} substitution — deliberately not a full templating engine (mustache/handlebars), since a subject/body line is all a notification-kind template needs. An unresolved placeholder renders as empty string rather than throwing, so a template author's typo degrades gracefully instead of breaking notification delivery entirely. */
export function renderNotificationTemplate(template: string, variables: Record<string, string> = {}): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => variables[key] ?? "");
}

export interface SendNotificationInput {
  kind: string;
  /** FR-102: present whenever the triggering event has an organization context — omit for pre-tenant events (see channel.ts's NotificationMessage doc comment). */
  organizationId?: string;
  userId?: string;
  email?: string;
  variables?: Record<string, string>;
  metadata?: Record<string, unknown>;
  /** Restrict dispatch to specific channel ids — e.g. a call site that already sends its own legacy email can pass `only: ["webhook", "in-app"]` to avoid double-emailing. Omit to dispatch to every registered, configured channel. */
  only?: string[];
}

export interface NotificationDispatchResult {
  channelId: string;
  ok: boolean;
  error?: string;
  skipped?: boolean;
  /** Only set on a skip — distinguishes "channel isn't configured" from "recipient opted out of this kind's preference category" (both leave ok:false/skipped:true). */
  reason?: "unconfigured" | "opted_out";
}

/**
 * Renders the kind's templates and dispatches to every registered channel
 * that reports itself configured (an unconfigured channel is recorded as
 * skipped, not attempted). A channel is contractually never supposed to
 * throw from send() (see channel.ts), but this still wraps each call in a
 * try/catch as defense in depth — one misbehaving channel must never stop
 * the others or bubble an error up to the business-logic call site that
 * triggered the notification.
 *
 * Before any of that: if the kind has a real preference category (not the
 * "general" default) and the recipient user has explicitly opted out of it
 * (settings/notifications, a per-user Setting), every candidate channel is
 * recorded as skipped without even being asked whether it's configured —
 * an opt-out is the recipient's decision not to be notified at all, not a
 * property of any one channel's config state.
 */
export async function sendNotification(input: SendNotificationInput): Promise<NotificationDispatchResult[]> {
  const kind = await getNotificationKind(input.kind);
  if (!kind) throw new NotificationKindNotFoundError(input.kind);

  const subject = renderNotificationTemplate(kind.subjectTemplate, input.variables);
  const body = renderNotificationTemplate(kind.bodyTemplate, input.variables);

  const channels = listNotificationChannels().filter((channel) => !input.only || input.only.includes(channel.id));

  if (input.userId && kind.category !== "general") {
    const preference = await getUserSetting<boolean>(input.userId, `notifications.${kind.category}`);
    if (preference === false) {
      return channels.map((channel) => ({ channelId: channel.id, ok: false, skipped: true, reason: "opted_out" }));
    }
  }

  const results: NotificationDispatchResult[] = [];
  for (const channel of channels) {
    const configured = await channel.isConfigured();
    if (!configured) {
      results.push({ channelId: channel.id, ok: false, skipped: true, reason: "unconfigured" });
      continue;
    }
    try {
      const result = await channel.send({
        kind: input.kind,
        organizationId: input.organizationId,
        userId: input.userId,
        email: input.email,
        subject,
        body,
        metadata: input.metadata,
      });
      results.push({ channelId: channel.id, ...result });
    } catch (error) {
      results.push({ channelId: channel.id, ok: false, error: error instanceof Error ? error.message : "Notification dispatch failed." });
    }
  }
  return results;
}
