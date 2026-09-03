// Shared cursor-pagination shape for list endpoints (round 2 of the REST
// surface). Real DB-level pagination (take/cursor), not in-memory slicing —
// each list*Page function still issues its own Prisma query (per-model
// typing, same reasoning tenant-scoping.ts documents for not generalizing
// across models), this just factors out the take-one-extra/slice/nextCursor
// arithmetic they'd otherwise all repeat.

export interface PageParams {
  cursor?: string;
  limit?: number;
}

export interface PageResult<T> {
  items: T[];
  nextCursor: string | null;
}

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

export function clampPageLimit(limit?: number): number {
  if (limit === undefined || Number.isNaN(limit)) return DEFAULT_PAGE_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_PAGE_LIMIT);
}

/** Takes `limit + 1` rows fetched by the caller and turns them into a page: trims the lookahead row, uses it to signal there's more. */
export function toPageResult<T extends { id: string }>(rows: T[], limit: number): PageResult<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1]!.id : null };
}
