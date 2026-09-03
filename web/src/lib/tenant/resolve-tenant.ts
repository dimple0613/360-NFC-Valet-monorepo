// FR-103: tenant context is resolved differently per surface — a bearer API
// key for API requests, a session for web requests. Web resolution goes
// through a real session (web/src/lib/auth/session.ts). This file is the API
// side: a pure function (Headers in, token or null out) so it's testable
// without spinning up a Next.js server — the actual key verification (which
// organization the key belongs to, is it revoked/expired) lives in
// @saasclaude/db's api-keys.ts, called from web/src/lib/tenant/api.ts.

/** Extracts the raw token from `Authorization: Bearer <token>`, or null if the header is missing/malformed. */
export function extractBearerToken(headers: Headers): string | null {
  const value = headers.get("authorization");
  if (!value) return null;
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match ? match[1].trim() : null;
}
