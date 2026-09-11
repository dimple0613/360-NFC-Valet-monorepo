import { AsyncLocalStorage } from "node:async_hooks";

// FR-103: tenant context is resolved per request (web session / API header
// or token) and per queued job (serialized with the payload), then must be
// reachable by every DB call made while handling that request/job — without
// callers threading an organizationId parameter through every function.
// AsyncLocalStorage gives us that: whoever resolves the tenant (web request
// middleware, API route wrapper, job processor) wraps the rest of the work in
// `runWithTenant`, and the Prisma extension in `tenant-scoping.ts` reads the
// current value back out to scope every query.

type TenantContext =
  | { organizationId: string; bypass: false }
  | { organizationId: null; bypass: true };

const storage = new AsyncLocalStorage<TenantContext>();

export class MissingTenantContextError extends Error {
  constructor(operation: string, model: string) {
    super(
      `No tenant context set for ${model}.${operation}. Every call touching a tenant-scoped ` +
        `model must run inside runWithTenant(organizationId, fn) — this is a bug, not something ` +
        `to relax, per the "multi-tenancy is automatic" rule. If this is genuinely a deliberate ` +
        `cross-tenant operation (Super Admin portal, a maintenance script), use ` +
        `unsafeRunWithoutTenantScoping instead.`,
    );
    this.name = "MissingTenantContextError";
  }
}

/**
 * Runs `fn` with `organizationId` as the active tenant for every DB call made inside it.
 *
 * Important: because Prisma queries are lazy thenables that only dispatch on `.then()`/
 * `await`, `fn` must actually `await` its Prisma calls itself rather than just returning
 * the unawaited promise — otherwise the `.then()` (and the tenant-scoping check it
 * triggers) runs after this function has already returned and the context is gone.
 * In practice any real handler naturally awaits its own work, so this only bites
 * one-liners like `() => db.team.findMany()` — write those as
 * `async () => await db.team.findMany()` instead.
 */
export function runWithTenant<T>(organizationId: string, fn: () => T): T {
  return storage.run({ organizationId, bypass: false }, fn);
}

/**
 * Deliberately runs `fn` with tenant scoping switched off — every query behaves as it
 * would on the raw, unextended client. Reserved for the Super Admin portal and
 * background maintenance jobs that must legitimately operate across organizations.
 * Never call this while handling a tenant-facing request.
 */
export function unsafeRunWithoutTenantScoping<T>(fn: () => T): T {
  return storage.run({ organizationId: null, bypass: true }, fn);
}

/** Returns the active tenant context, or `undefined` if none has been established. */
export function getTenantContext(): TenantContext | undefined {
  return storage.getStore();
}

/** Returns the active organizationId, throwing `MissingTenantContextError` if none is set. */
export function requireTenantOrganizationId(operation: string, model: string): string {
  const ctx = storage.getStore();
  if (!ctx || ctx.bypass) {
    throw new MissingTenantContextError(operation, model);
  }
  return ctx.organizationId;
}

/** True when the current context explicitly opted out of tenant scoping. */
export function isBypassingTenantScoping(): boolean {
  return storage.getStore()?.bypass === true;
}
