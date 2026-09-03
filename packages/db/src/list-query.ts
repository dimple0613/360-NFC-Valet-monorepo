// Shared offset-pagination + search/sort shape for UI list screens (the
// DataTable rollout). Deliberately separate from pagination.ts's cursor-based
// PageParams/PageResult, which serves REST API consumers doing incremental
// fetches — an admin table wants page numbers and a total count, which cursor
// pagination can't give cheaply. Different consumer, different shape, no
// reason to unify them.

export interface ListQueryParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  q?: string;
  // Optional member-list filters (org detail Users tab). `status` is a
  // MembershipStatus literal; `roleId` matches a member's assigned role.
  status?: string;
  roleId?: string;
  // Optional event-type filter (subscription Logs / Transactions tabs): matches a
  // SubscriptionEvent.type or a ProcessedWebhookEvent.eventType value.
  type?: string;
  // Optional plan-key filter (organizations list): matches an org whose active
  // subscription is on the given plan key.
  plan?: string;
  // Optional plan-visibility filter (plans list): matches a Plan.visibility value.
  visibility?: string;
  // Optional global-role membership filter (roles list): `true` matches roles
  // that have at least one assigned member, `false` matches unassigned roles.
  hasMembers?: boolean;
  // Optional module-key filter (Super Admin audit log): matches log entries
  // written by the given module (e.g. "core", "billing").
  module?: string;
  // Optional action filter (Super Admin audit log): matches a log entry's
  // action value (e.g. "subscription.renewed", "invoice.issued").
  action?: string;
  // Optional inclusive date-range filter (YYYY-MM-DD) applied to a list's
  // primary timestamp column (createdAt for audit/log/invoice/subscription
  // lists, processedAt for webhook-event feeds). `dateFrom` includes the whole
  // day; `dateTo` is also inclusive.
  dateFrom?: string;
  dateTo?: string;
}

export interface ListQueryResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export const DEFAULT_LIST_PAGE_SIZE = 20;
export const MAX_LIST_PAGE_SIZE = 100;

export function clampListPageSize(pageSize?: number): number {
  if (pageSize === undefined || Number.isNaN(pageSize)) return DEFAULT_LIST_PAGE_SIZE;
  return Math.min(Math.max(Math.trunc(pageSize), 1), MAX_LIST_PAGE_SIZE);
}

export function clampPage(page?: number): number {
  if (page === undefined || Number.isNaN(page)) return 1;
  return Math.max(Math.trunc(page), 1);
}

/** `skip`/`take` for the Prisma query the caller issues, from already-clamped page/pageSize. */
export function toSkipTake(page: number, pageSize: number): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function toListQueryResult<T>(items: T[], totalCount: number, page: number, pageSize: number): ListQueryResult<T> {
  return { items, page, pageSize, totalCount, totalPages: Math.max(Math.ceil(totalCount / pageSize), 1) };
}

/** Date-only UTC arithmetic (`YYYY-MM-DD` → next UTC midnight, handles month/year rollover). */
function nextUtcMidnight(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + 1));
}

/**
 * Turns the shared `dateFrom`/`dateTo` list params (YYYY-MM-DD strings, both
 * inclusive) into a Prisma `DateTimeFilter`-shaped `{ gte?, lt? }` for a list's
 * primary timestamp column. `dateTo` uses an exclusive next-midnight `<` so the
 * whole `dateTo` day is included with no fractional-millisecond edge cases.
 * Callers assign the result to whichever timestamp column keeps that list
 * natural (`createdAt`, `processedAt`, ...).
 */
export function toCreatedAtDateRangeFilter(
  params: Pick<ListQueryParams, "dateFrom" | "dateTo">,
): { gte?: Date; lt?: Date } {
  const gte = params.dateFrom ? new Date(`${params.dateFrom}T00:00:00.000Z`) : undefined;
  const lt = params.dateTo ? nextUtcMidnight(params.dateTo) : undefined;
  return {
    ...(gte ? { gte } : {}),
    ...(lt ? { lt } : {}),
  };
}
