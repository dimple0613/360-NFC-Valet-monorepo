import type { ListQueryParams } from "@saasclaude/db";

type RawSearchParams = Record<string, string | string[] | undefined>;

/**
 * Parses a Server Component page's `searchParams` into ListQueryParams.
 * `prefix` namespaces the keys (`${prefix}page`, `${prefix}q`, ...) so more
 * than one DataTable can live on the same page (e.g. one per role card on
 * the Roles page) without their URL state colliding.
 */
export function parseListQueryParams(searchParams: RawSearchParams, prefix = ""): ListQueryParams {
  const get = (key: string): string | undefined => {
    const value = searchParams[`${prefix}${key}`];
    return Array.isArray(value) ? value[0] : value;
  };

  const page = get("page");
  const pageSize = get("pageSize");
  const sortDir = get("sortDir");

  return {
    page: page !== undefined ? Number(page) : undefined,
    pageSize: pageSize !== undefined ? Number(pageSize) : undefined,
    sortBy: get("sortBy"),
    sortDir: sortDir === "asc" || sortDir === "desc" ? sortDir : undefined,
    q: get("q"),
    status: get("status"),
    roleId: get("roleId"),
    type: get("type"),
    plan: get("plan"),
    module: get("module"),
    action: get("action"),
    visibility: get("visibility"),
    hasMembers: get("hasMembers") === "true" ? true : get("hasMembers") === "false" ? false : undefined,
    dateFrom: get("dateFrom"),
    dateTo: get("dateTo"),
  };
}
