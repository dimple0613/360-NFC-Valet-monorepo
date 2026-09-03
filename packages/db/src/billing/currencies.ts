import type { Currency } from "../../generated/client";
import { prismaWithoutTenantScoping } from "../client";
import { clampListPageSize, clampPage, toListQueryResult, toSkipTake, type ListQueryParams, type ListQueryResult } from "../list-query";

// A basic multi-currency registry (ROADMAP.md: "single currency acceptable
// for Phase 1, multi-currency plumbing left ready" — this is that plumbing).
// Global/platform-wide, managed by Super Admin, not tenant-scoped.

export class CurrencyNotFoundError extends Error {
  constructor(id: string) {
    super(`No currency with id ${id}.`);
    this.name = "CurrencyNotFoundError";
  }
}

export class DuplicateCurrencyCodeError extends Error {
  constructor(code: string) {
    super(`A currency with code "${code}" already exists.`);
    this.name = "DuplicateCurrencyCodeError";
  }
}

/** Two sensible defaults so a fresh install isn't an empty picker — re-seeded idempotently (upsert on code), same convention as CORE_PERMISSIONS/CORE_RESOURCE_TYPES. */
export const CORE_CURRENCIES: { code: string; name: string; format: string }[] = [
  { code: "USD", name: "US Dollar", format: "${PRICE}" },
  { code: "INR", name: "Indian rupee", format: "₹{PRICE}" },
];

export async function seedCoreCurrencies(): Promise<void> {
  for (const currency of CORE_CURRENCIES) {
    await prismaWithoutTenantScoping.currency.upsert({
      where: { code: currency.code },
      create: currency,
      update: {},
    });
  }
}

export async function listActiveCurrencies(): Promise<Currency[]> {
  return prismaWithoutTenantScoping.currency.findMany({ where: { isActive: true }, orderBy: { code: "asc" } });
}

const CURRENCY_SORT_FIELDS = ["code", "name", "format", "status", "createdAt", "updatedAt"] as const;

export async function listCurrenciesSearch(params: ListQueryParams = {}): Promise<ListQueryResult<Currency>> {
  const page = clampPage(params.page);
  const pageSize = clampListPageSize(params.pageSize);
  const sortKey = CURRENCY_SORT_FIELDS.includes(params.sortBy as (typeof CURRENCY_SORT_FIELDS)[number])
    ? (params.sortBy as (typeof CURRENCY_SORT_FIELDS)[number])
    : "createdAt";
  const sortBy = sortKey === "status" ? "isActive" : sortKey;
  const sortDir = params.sortDir ?? "desc";
  const where = {
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q, mode: "insensitive" as const } },
            { code: { contains: params.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(params.status === "ACTIVE"
      ? { isActive: true }
      : params.status === "INACTIVE"
        ? { isActive: false }
        : {}),
  };

  const [items, totalCount] = await Promise.all([
    prismaWithoutTenantScoping.currency.findMany({ where, orderBy: { [sortBy]: sortDir }, ...toSkipTake(page, pageSize) }),
    prismaWithoutTenantScoping.currency.count({ where }),
  ]);
  return toListQueryResult(items, totalCount, page, pageSize);
}

export async function getCurrency(id: string): Promise<Currency> {
  const currency = await prismaWithoutTenantScoping.currency.findUnique({ where: { id } });
  if (!currency) throw new CurrencyNotFoundError(id);
  return currency;
}

export interface CurrencyInput {
  code: string;
  name: string;
  format: string;
  isActive?: boolean;
}

export async function createCurrency(input: CurrencyInput): Promise<Currency> {
  const existing = await prismaWithoutTenantScoping.currency.findUnique({ where: { code: input.code } });
  if (existing) throw new DuplicateCurrencyCodeError(input.code);
  return prismaWithoutTenantScoping.currency.create({
    data: { code: input.code, name: input.name, format: input.format, isActive: input.isActive ?? true },
  });
}

export async function updateCurrency(id: string, input: CurrencyInput): Promise<Currency> {
  await getCurrency(id);
  return prismaWithoutTenantScoping.currency.update({
    where: { id },
    data: { code: input.code, name: input.name, format: input.format, isActive: input.isActive ?? true },
  });
}

export async function deleteCurrency(id: string): Promise<void> {
  const { count } = await prismaWithoutTenantScoping.currency.deleteMany({ where: { id } });
  if (count === 0) throw new CurrencyNotFoundError(id);
}
