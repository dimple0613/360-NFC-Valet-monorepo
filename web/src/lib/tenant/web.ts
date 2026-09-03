import { runWithTenant, type ResolvedSession } from "@saasclaude/db";
import { requireSession } from "../auth/session";

export class NoActiveOrganizationError extends Error {
  constructor() {
    super(
      "The current session has no active organization selected — switch into one " +
        "(switchSessionOrganization) before calling tenant-scoped work.",
    );
    this.name = "NoActiveOrganizationError";
  }
}

/**
 * Wraps web-side work (Server Components, Server Actions, non-API route
 * handlers) so it runs with the session's current organization as the active
 * tenant (FR-103, FR-105). Now backed by a real Session (Phase 1B) rather than
 * a placeholder cookie. `handler` receives the resolved session so callers
 * don't need a second lookup to know which user is acting.
 */
export async function withWebTenantContext<T>(handler: (session: ResolvedSession) => Promise<T>): Promise<T> {
  const session = await requireSession();
  if (!session.organizationId) throw new NoActiveOrganizationError();
  return runWithTenant(session.organizationId, () => handler(session));
}
