/**
 * Safely extracts a message from an unknown thrown value. The valet route
 * handlers surface error.message from the data layer (which throws plain
 * `Error`s like "Offer not found"), so narrowing `unknown` to Error keeps
 * that behavior without resorting to `any`.
 */
export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/**
 * Extracts the PostgreSQL error code (e.g. "23505" unique violation) from an
 * unknown thrown value, or null when the value isn't a PG error carrying one.
 */
export function errorCode(err: unknown): string | null {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code?: unknown }).code;
    return typeof code === "string" ? code : null;
  }
  return null;
}