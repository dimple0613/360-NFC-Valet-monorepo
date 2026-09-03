import { prismaWithoutTenantScoping } from "../client";
import {
  clampListPageSize,
  clampPage,
  toCreatedAtDateRangeFilter,
  toListQueryResult,
  toSkipTake,
  type ListQueryParams,
  type ListQueryResult,
} from "../list-query";
import type { Prisma, InvoiceStatus, SubscriptionStatus } from "../../generated/client";

// FR-111's "manages: ...subscriptions, plans, billing, invoices..." — a
// cross-organization, view-only surface for the Super Admin portal. Reads go
// through prismaWithoutTenantScoping deliberately (same escape hatch
// organization-lifecycle.ts's Super Admin reads already use): a platform
// operator legitimately needs to see every org's billing at once, which is
// exactly what the tenant-scoping extension exists to prevent for normal
// tenant-scoped access. Nothing here mutates anything.

const DISPLAYABLE_SUBSCRIPTION_STATUSES = ["ACTIVE", "TRIALING", "PAUSED", "PAST_DUE"] as const;

export async function listOrganizationBillingSummaries() {
  const organizations = await prismaWithoutTenantScoping.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      subscriptions: {
        where: { status: { in: [...DISPLAYABLE_SUBSCRIPTION_STATUSES] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { plan: true },
      },
      invoices: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return organizations.map((org) => {
    const subscription = org.subscriptions[0];
    const latestInvoice = org.invoices[0];
    return {
      organizationId: org.id,
      organizationName: org.name,
      organizationStatus: org.status,
      planName: subscription?.plan.name ?? null,
      subscriptionStatus: subscription?.status ?? null,
      latestInvoiceDate: latestInvoice?.createdAt ?? null,
      latestInvoiceTotalCents: latestInvoice?.totalCents ?? null,
      latestInvoiceCurrency: latestInvoice?.currency ?? null,
    };
  });
}

export interface BillingSummaryRow {
  organizationId: string;
  organizationName: string;
  organizationStatus: string;
  planName: string | null;
  subscriptionStatus: string | null;
  latestInvoiceDate: Date | null;
  latestInvoiceTotalCents: number | null;
  latestInvoiceCurrency: string | null;
}

const BILLING_SORT_FIELDS = ["name", "createdAt"] as const;

/** Offset-paginated, searchable variant of listOrganizationBillingSummaries for the DataTable UI. Sortable only on organization-level fields — plan/subscription status live on a joined, capped (take: 1) relation Prisma can't order the parent query by. */
export async function listOrganizationBillingSummariesSearch(
  params: ListQueryParams = {},
): Promise<ListQueryResult<BillingSummaryRow>> {
  const page = clampPage(params.page);
  const pageSize = clampListPageSize(params.pageSize);
  const sortBy = BILLING_SORT_FIELDS.includes(params.sortBy as (typeof BILLING_SORT_FIELDS)[number])
    ? (params.sortBy as (typeof BILLING_SORT_FIELDS)[number])
    : "createdAt";
  const sortDir = params.sortDir ?? "desc";
  const where = params.q
    ? {
        OR: [
          { name: { contains: params.q, mode: "insensitive" as const } },
          { slug: { contains: params.q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [organizations, totalCount] = await Promise.all([
    prismaWithoutTenantScoping.organization.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      ...toSkipTake(page, pageSize),
      include: {
        subscriptions: {
          where: { status: { in: [...DISPLAYABLE_SUBSCRIPTION_STATUSES] } },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { plan: true },
        },
        invoices: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prismaWithoutTenantScoping.organization.count({ where }),
  ]);

  const items: BillingSummaryRow[] = organizations.map((org) => {
    const subscription = org.subscriptions[0];
    const latestInvoice = org.invoices[0];
    return {
      organizationId: org.id,
      organizationName: org.name,
      organizationStatus: org.status,
      planName: subscription?.plan.name ?? null,
      subscriptionStatus: subscription?.status ?? null,
      latestInvoiceDate: latestInvoice?.createdAt ?? null,
      latestInvoiceTotalCents: latestInvoice?.totalCents ?? null,
      latestInvoiceCurrency: latestInvoice?.currency ?? null,
    };
  });
  return toListQueryResult(items, totalCount, page, pageSize);
}

/** The org's current subscription only — not a list, no pagination needed. The three lists below (invoices, subscription events, webhook events) replaced the old combined getOrganizationBillingDetail's list fields once each grew its own DataTable. */
export interface PlatformInvoiceRow {
  id: string;
  number: string | null;
  organizationId: string;
  organizationName: string;
  status: string;
  totalCents: number;
  currency: string;
  createdAt: Date;
  /** The first line item's description (e.g. "Renew Subscription") — the closest real-data equivalent to a "what is this invoice for" label. Null for an invoice with no line items yet. */
  contentDescription: string | null;
}

const PLATFORM_INVOICE_SORT_FIELDS = ["createdAt", "number", "organization", "status", "totalCents"] as const;

/** Super Admin "Customer > Invoices" list: every invoice across every org, searchable by invoice number or org name. */
export async function listAllInvoicesSearch(params: ListQueryParams = {}): Promise<ListQueryResult<PlatformInvoiceRow>> {
  const page = clampPage(params.page);
  const pageSize = clampListPageSize(params.pageSize);
  const sortBy = PLATFORM_INVOICE_SORT_FIELDS.includes(params.sortBy as (typeof PLATFORM_INVOICE_SORT_FIELDS)[number])
    ? (params.sortBy as (typeof PLATFORM_INVOICE_SORT_FIELDS)[number])
    : "createdAt";
  const sortDir: Prisma.SortOrder = params.sortDir ?? "desc";
  const where: Prisma.InvoiceWhereInput = {};
  if (params.q) {
    where.OR = [
      { number: { contains: params.q, mode: "insensitive" as const } },
      { organization: { name: { contains: params.q, mode: "insensitive" as const } } },
    ];
  }
  const createdRange = toCreatedAtDateRangeFilter(params);
  if (createdRange.gte || createdRange.lt) where.createdAt = createdRange;
  if (params.status) where.status = params.status as Prisma.InvoiceWhereInput["status"];
  const orderBy: Prisma.InvoiceOrderByWithRelationInput[] =
    sortBy === "organization"
      ? [{ organization: { name: sortDir } }, { createdAt: "desc" }]
      : [{ [sortBy]: sortDir }, { createdAt: "desc" }];

  const [rows, totalCount] = await Promise.all([
    prismaWithoutTenantScoping.invoice.findMany({
      where,
      orderBy,
      ...toSkipTake(page, pageSize),
      include: {
        organization: { select: { name: true } },
        lineItems: { take: 1, orderBy: { createdAt: "asc" }, select: { description: true } },
      },
    }),
    prismaWithoutTenantScoping.invoice.count({ where }),
  ]);

  const items: PlatformInvoiceRow[] = rows.map((r) => ({
    id: r.id,
    number: r.number,
    organizationId: r.organizationId,
    organizationName: r.organization.name,
    status: r.status,
    totalCents: r.totalCents,
    currency: r.currency,
    createdAt: r.createdAt,
    contentDescription: r.lineItems[0]?.description ?? null,
  }));
  return toListQueryResult(items, totalCount, page, pageSize);
}

export interface PlatformWebhookEventRow {
  id: string;
  organizationId: string | null;
  organizationName: string | null;
  provider: string;
  eventType: string | null;
  processedAt: Date;
}

const PLATFORM_WEBHOOK_EVENT_SORT_FIELDS = ["processedAt", "eventType"] as const;

/**
 * Super Admin "Invoices > Transactions" list: every raw payment-provider
 * event across every org, one feed. ProcessedWebhookEvent has no `organization`
 * relation (organizationId is a plain optional column, not every event is
 * tied to one org — see the model's own doc comment), so org names are
 * resolved via a page-scoped batch lookup, same pattern as
 * listAllAuditLogsSearch (audit-log.ts) uses for the same reason. (The
 * Organization column is not sortable: org name has no relation to order by,
 * and a correlated-subquery sort isn't worth the raw-SQL cost for a secondary
 * event feed.)
 */
export async function listAllWebhookEventsSearch(
  params: ListQueryParams = {},
): Promise<ListQueryResult<PlatformWebhookEventRow>> {
  const page = clampPage(params.page);
  const pageSize = clampListPageSize(params.pageSize);
  const sortBy = PLATFORM_WEBHOOK_EVENT_SORT_FIELDS.includes(
    params.sortBy as (typeof PLATFORM_WEBHOOK_EVENT_SORT_FIELDS)[number],
  )
    ? (params.sortBy as (typeof PLATFORM_WEBHOOK_EVENT_SORT_FIELDS)[number])
    : "processedAt";
  const sortDir = params.sortDir ?? "desc";
  const where: Prisma.ProcessedWebhookEventWhereInput = {};
  if (params.type) where.eventType = params.type;
  if (params.q) where.eventType = { contains: params.q, mode: "insensitive" as const };
  const processedRange = toCreatedAtDateRangeFilter(params);
  if (processedRange.gte || processedRange.lt) where.processedAt = processedRange;

  const [rows, totalCount] = await Promise.all([
    prismaWithoutTenantScoping.processedWebhookEvent.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      ...toSkipTake(page, pageSize),
    }),
    prismaWithoutTenantScoping.processedWebhookEvent.count({ where }),
  ]);

  const orgIds = [...new Set(rows.map((r) => r.organizationId).filter((id): id is string => id !== null))];
  const organizations = await prismaWithoutTenantScoping.organization.findMany({
    where: { id: { in: orgIds } },
    select: { id: true, name: true },
  });
  const orgNameById = new Map(organizations.map((o) => [o.id, o.name]));

  const items: PlatformWebhookEventRow[] = rows.map((r) => ({
    id: r.id,
    organizationId: r.organizationId,
    organizationName: r.organizationId ? (orgNameById.get(r.organizationId) ?? "(deleted org)") : null,
    provider: r.provider,
    eventType: r.eventType,
    processedAt: r.processedAt,
  }));
  return toListQueryResult(items, totalCount, page, pageSize);
}

export async function getOrganizationSubscriptionOverview(organizationId: string) {
  const [organization, subscription] = await Promise.all([
    prismaWithoutTenantScoping.organization.findUniqueOrThrow({ where: { id: organizationId } }),
    prismaWithoutTenantScoping.subscription.findFirst({
      where: { organizationId, status: { in: [...DISPLAYABLE_SUBSCRIPTION_STATUSES] } },
      orderBy: { createdAt: "desc" },
      include: { plan: true },
    }),
  ]);
  return { organization, subscription };
}

const INVOICE_SORT_FIELDS = ["createdAt", "status", "totalCents"] as const;

/** Offset-paginated, searchable (by invoice number), sortable variant for the org detail page's DataTable. */
export async function listOrganizationInvoicesSearch(
  organizationId: string,
  params: ListQueryParams = {},
) {
  const page = clampPage(params.page);
  const pageSize = clampListPageSize(params.pageSize);
  const sortBy = INVOICE_SORT_FIELDS.includes(params.sortBy as (typeof INVOICE_SORT_FIELDS)[number])
    ? (params.sortBy as (typeof INVOICE_SORT_FIELDS)[number])
    : "createdAt";
  const sortDir = params.sortDir ?? "desc";
  const where = {
    organizationId,
    ...(params.q ? { number: { contains: params.q, mode: "insensitive" as const } } : {}),
  };

  const [items, totalCount] = await Promise.all([
    prismaWithoutTenantScoping.invoice.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      include: { creditNotes: true },
      ...toSkipTake(page, pageSize),
    }),
    prismaWithoutTenantScoping.invoice.count({ where }),
  ]);
  return toListQueryResult(items, totalCount, page, pageSize);
}

const SUBSCRIPTION_EVENT_SORT_FIELDS = ["createdAt", "type"] as const;

/** Offset-paginated, searchable (by event type), sortable variant for the org detail page's DataTable. */
export async function listSubscriptionEventsSearch(organizationId: string, params: ListQueryParams = {}) {
  const page = clampPage(params.page);
  const pageSize = clampListPageSize(params.pageSize);
  const sortBy = SUBSCRIPTION_EVENT_SORT_FIELDS.includes(params.sortBy as (typeof SUBSCRIPTION_EVENT_SORT_FIELDS)[number])
    ? (params.sortBy as (typeof SUBSCRIPTION_EVENT_SORT_FIELDS)[number])
    : "createdAt";
  const sortDir = params.sortDir ?? "desc";
  const where = {
    organizationId,
    ...(params.q ? { type: { contains: params.q, mode: "insensitive" as const } } : {}),
  };

  const [items, totalCount] = await Promise.all([
    prismaWithoutTenantScoping.subscriptionEvent.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      ...toSkipTake(page, pageSize),
    }),
    prismaWithoutTenantScoping.subscriptionEvent.count({ where }),
  ]);
  return toListQueryResult(items, totalCount, page, pageSize);
}

const WEBHOOK_EVENT_SORT_FIELDS = ["processedAt", "eventType"] as const;

/**
 * Offset-paginated, searchable (by event type), sortable variant for the org
 * detail page's DataTable — real gap closed, not just a redesign: the old
 * getOrganizationBillingDetail hard-capped this at `take: 50` with no way to
 * see anything older. This is a genuine cursor into full history now.
 */
export async function listWebhookEventsSearch(organizationId: string, params: ListQueryParams = {}) {
  const page = clampPage(params.page);
  const pageSize = clampListPageSize(params.pageSize);
  const sortBy = WEBHOOK_EVENT_SORT_FIELDS.includes(params.sortBy as (typeof WEBHOOK_EVENT_SORT_FIELDS)[number])
    ? (params.sortBy as (typeof WEBHOOK_EVENT_SORT_FIELDS)[number])
    : "processedAt";
  const sortDir = params.sortDir ?? "desc";
  const where: Prisma.ProcessedWebhookEventWhereInput = {
    organizationId,
    ...(params.type ? { eventType: params.type } : {}),
    ...(params.q ? { eventType: { contains: params.q, mode: "insensitive" as const } } : {}),
  };
  const processedRange = toCreatedAtDateRangeFilter(params);
  if (processedRange.gte || processedRange.lt) where.processedAt = processedRange;

  const [items, totalCount] = await Promise.all([
    prismaWithoutTenantScoping.processedWebhookEvent.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      ...toSkipTake(page, pageSize),
    }),
    prismaWithoutTenantScoping.processedWebhookEvent.count({ where }),
  ]);
  return toListQueryResult(items, totalCount, page, pageSize);
}

export interface PlatformSubscriptionRow {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationEmail: string | null;
  organizationPhone: string | null;
  planName: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt: Date | null;
  canceledAt: Date | null;
  terminatedAt: Date | null;
  createdAt: Date;
}

const PLATFORM_SUBSCRIPTION_SORT_FIELDS = ["createdAt", "currentPeriodEnd", "organizationName", "planName"] as const;

/**
 * Every subscription across every org, one row per subscription (not one row
 * per org — an org can have several over its lifetime) — backs the Super
 * Admin sidebar's "Subscriptions" page, the unfiltered/cross-org entry point.
 * The org detail page's own Subscriptions tab uses
 * listSubscriptionsForOrganizationSearch (subscriptions.ts) instead, which is
 * the same shape scoped to one org — that's the "open inside a customer ->
 * customer-specific; open from the menu -> all customers" distinction.
 */
export async function listAllSubscriptionsSearch(
  params: ListQueryParams = {},
): Promise<ListQueryResult<PlatformSubscriptionRow>> {
  const page = clampPage(params.page);
  const pageSize = clampListPageSize(params.pageSize);
  const sortBy = PLATFORM_SUBSCRIPTION_SORT_FIELDS.includes(
    params.sortBy as (typeof PLATFORM_SUBSCRIPTION_SORT_FIELDS)[number],
  )
    ? (params.sortBy as (typeof PLATFORM_SUBSCRIPTION_SORT_FIELDS)[number])
    : "createdAt";
  const sortDir: Prisma.SortOrder = params.sortDir ?? "desc";
  const where: Prisma.SubscriptionWhereInput = {};
  if (params.q) where.organization = { name: { contains: params.q, mode: "insensitive" as const } };
  if (params.status) where.status = params.status as SubscriptionStatus;
  const createdRange = toCreatedAtDateRangeFilter(params);
  if (createdRange.gte || createdRange.lt) where.createdAt = createdRange;
  const orderBy: Prisma.SubscriptionOrderByWithRelationInput[] =
    sortBy === "organizationName"
      ? [{ organization: { name: sortDir } }, { createdAt: "desc" }]
      : sortBy === "planName"
        ? [{ plan: { name: sortDir } }, { createdAt: "desc" }]
        : [{ [sortBy]: sortDir }, { createdAt: "desc" }];

  const [subscriptions, totalCount] = await Promise.all([
    prismaWithoutTenantScoping.subscription.findMany({
      where,
      orderBy,
      ...toSkipTake(page, pageSize),
      include: { plan: true, organization: true },
    }),
    prismaWithoutTenantScoping.subscription.count({ where }),
  ]);

  const items: PlatformSubscriptionRow[] = subscriptions.map((subscription) => ({
    id: subscription.id,
    organizationId: subscription.organizationId,
    organizationName: subscription.organization.name,
    organizationEmail: subscription.organization.contactEmail,
    organizationPhone: subscription.organization.contactPhone,
    planName: subscription.plan.name,
    status: subscription.status,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    trialEndsAt: subscription.trialEndsAt,
    canceledAt: subscription.canceledAt,
    terminatedAt: subscription.terminatedAt,
    createdAt: subscription.createdAt,
  }));
  return toListQueryResult(items, totalCount, page, pageSize);
}

/** Invoices scoped to one specific subscription (not the whole org) — the Logs page's "Invoices" sub-tab, opened from a single subscription row. */
export async function listInvoicesForSubscriptionSearch(
  organizationId: string,
  subscriptionId: string,
  params: ListQueryParams = {},
) {
  const page = clampPage(params.page);
  const pageSize = clampListPageSize(params.pageSize);
  const sortBy = INVOICE_SORT_FIELDS.includes(params.sortBy as (typeof INVOICE_SORT_FIELDS)[number])
    ? (params.sortBy as (typeof INVOICE_SORT_FIELDS)[number])
    : "createdAt";
  const sortDir = params.sortDir ?? "desc";
  const where: Prisma.InvoiceWhereInput = {
    organizationId,
    subscriptionId,
    ...(params.status ? { status: params.status as InvoiceStatus } : {}),
  };
  const createdRange = toCreatedAtDateRangeFilter(params);
  if (createdRange.gte || createdRange.lt) where.createdAt = createdRange;

  const [items, totalCount] = await Promise.all([
    prismaWithoutTenantScoping.invoice.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      include: { creditNotes: true },
      ...toSkipTake(page, pageSize),
    }),
    prismaWithoutTenantScoping.invoice.count({ where }),
  ]);
  return toListQueryResult(items, totalCount, page, pageSize);
}

/** Subscription lifecycle events scoped to one specific subscription — the Logs page's "Logs" sub-tab. */
export async function listSubscriptionEventsForSubscriptionSearch(
  organizationId: string,
  subscriptionId: string,
  params: ListQueryParams = {},
) {
  const page = clampPage(params.page);
  const pageSize = clampListPageSize(params.pageSize);
  const sortBy = SUBSCRIPTION_EVENT_SORT_FIELDS.includes(params.sortBy as (typeof SUBSCRIPTION_EVENT_SORT_FIELDS)[number])
    ? (params.sortBy as (typeof SUBSCRIPTION_EVENT_SORT_FIELDS)[number])
    : "createdAt";
  const sortDir = params.sortDir ?? "desc";
  const where: Prisma.SubscriptionEventWhereInput = {
    organizationId,
    subscriptionId,
    ...(params.type ? { type: params.type } : {}),
  };
  const createdRange = toCreatedAtDateRangeFilter(params);
  if (createdRange.gte || createdRange.lt) where.createdAt = createdRange;

  const [items, totalCount] = await Promise.all([
    prismaWithoutTenantScoping.subscriptionEvent.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      ...toSkipTake(page, pageSize),
    }),
    prismaWithoutTenantScoping.subscriptionEvent.count({ where }),
  ]);
  return toListQueryResult(items, totalCount, page, pageSize);
}
