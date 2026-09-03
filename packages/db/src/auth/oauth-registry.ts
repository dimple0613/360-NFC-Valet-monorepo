import type { OAuthAdapter } from "./oauth-adapter";

// The actual "provider adapter pattern" registry (CLAUDE.md's load-bearing
// rule for anything pluggable): a plain in-process Map keyed by adapter id.
// Deliberately not itself DB-backed — which adapters *exist* is a code-level
// concern (a module ships its adapter and registers it, same as
// registerPermissions()/registerResourceTypes() elsewhere in this package);
// which of those registered adapters is actually *enabled/configured* is the
// data-level concern, handled by oauth-provider-config.ts against the
// platform Settings service. Re-registering the same id (e.g. a hot-reloaded
// dev server re-evaluating the adapter module) is a harmless overwrite, not
// an error — no de-dup bookkeeping needed.

const registry = new Map<string, OAuthAdapter>();

export function registerOAuthAdapter(adapter: OAuthAdapter): void {
  registry.set(adapter.id, adapter);
}

export function getOAuthAdapter(id: string): OAuthAdapter | undefined {
  return registry.get(id);
}

export function listOAuthAdapters(): OAuthAdapter[] {
  return Array.from(registry.values());
}

/** Test/maintenance-only escape hatch — mirrors no equivalent elsewhere in this codebase but is needed so adapter registry tests don't leak dummy adapters into other test files sharing this module (vitest doesn't isolate module state within a single file's own imports). Not exported from index.ts — internal to this package. */
export function unregisterOAuthAdapter(id: string): void {
  registry.delete(id);
}
