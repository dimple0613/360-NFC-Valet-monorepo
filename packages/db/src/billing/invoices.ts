import type { CreditNote, Invoice, InvoiceLineItem } from "../../generated/client";
import { db, prismaWithoutTenantScoping } from "../client";
import { runWithTenant } from "../tenant-context";
import { writeAuditLog } from "../audit-log";
import type { LifecycleActionContext } from "./subscriptions";
import { resolveTaxRatePercent } from "./tax";
import { formatInvoiceNumber } from "../platform-config";
import { clampPageLimit, toPageResult, type PageParams, type PageResult } from "../pagination";

// FR-200–201: Invoice is mutable (line items addable/removable) only while
// DRAFT. issueInvoice is the one-way door — from ISSUED onward this module
// refuses further edits, and the only path for a correction is a CreditNote
// (an append-only row referencing the invoice, never an edit to it). See the
// doc comment on the Invoice model (schema.prisma) for why this is enforced
// here rather than via the blanket tenant-scoping immutability mechanism.

export class InvoiceNotFoundError extends Error {
  constructor(invoiceId: string) {
    super(`No invoice with id ${invoiceId}.`);
    this.name = "InvoiceNotFoundError";
  }
}

export class InvoiceNotDraftError extends Error {
  constructor(invoiceId: string, action: string, status: string) {
    super(`Cannot ${action} invoice ${invoiceId}: it is ${status}, not DRAFT.`);
    this.name = "InvoiceNotDraftError";
  }
}

export class InvalidInvoiceTransitionError extends Error {
  constructor(action: string, currentStatus: string, allowedStatuses: readonly string[]) {
    super(`Cannot ${action} an invoice with status ${currentStatus} (requires one of: ${allowedStatuses.join(", ")}).`);
    this.name = "InvalidInvoiceTransitionError";
  }
}

export interface InvoiceLineItemInput {
  description: string;
  quantity?: number;
  unitAmountCents: number;
  resourceTypeKey?: string;
}

export interface CreateDraftInvoiceInput {
  organizationId: string;
  subscriptionId?: string;
  currency?: string;
  periodStart?: Date;
  periodEnd?: Date;
  dueAt?: Date;
  stripeInvoiceId?: string;
  /** PayPal capture id — mirrors stripeInvoiceId's role for the PayPal adapter's equivalent of recordPaidInvoice. */
  paypalCaptureId?: string;
  metadata?: unknown;
  lineItems?: InvoiceLineItemInput[];
}

type InvoiceWithLineItems = Invoice & { lineItems: InvoiceLineItem[] };

function lineItemAmount(item: InvoiceLineItemInput): number {
  return (item.quantity ?? 1) * item.unitAmountCents;
}

function sumLineItems(items: { amountCents: number }[]): number {
  return items.reduce((sum, item) => sum + item.amountCents, 0);
}

async function requireInvoice(organizationId: string, invoiceId: string): Promise<InvoiceWithLineItems> {
  const invoice = await runWithTenant(organizationId, async () =>
    db.invoice.findUnique({ where: { id: invoiceId }, include: { lineItems: true } }),
  );
  if (!invoice) throw new InvoiceNotFoundError(invoiceId);
  return invoice;
}

function requireDraft(invoice: Invoice, action: string): void {
  if (invoice.status !== "DRAFT") throw new InvoiceNotDraftError(invoice.id, action, invoice.status);
}

/** Rounds to the nearest cent — half-up, same convention as every other cents-rounding in this codebase (assignSubscriptionPlan/formatAmount callers all expect integer cents). */
function computeTaxCents(subtotalCents: number, ratePercent: number): number {
  return Math.round((subtotalCents * ratePercent) / 100);
}

export async function createDraftInvoice(input: CreateDraftInvoiceInput): Promise<InvoiceWithLineItems> {
  const lineItems = input.lineItems ?? [];
  const subtotalCents = sumLineItems(lineItems.map((i) => ({ amountCents: lineItemAmount(i) })));

  const organization = await prismaWithoutTenantScoping.organization.findUnique({
    where: { id: input.organizationId },
    select: { country: true },
  });
  const ratePercent = await resolveTaxRatePercent(organization?.country ?? null);
  const taxCents = computeTaxCents(subtotalCents, ratePercent);

  return runWithTenant(input.organizationId, async () =>
    db.invoice.create({
      data: {
        // organizationId required by the column, overwritten by the scoping extension.
        organizationId: input.organizationId,
        subscriptionId: input.subscriptionId,
        currency: input.currency ?? "usd",
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        dueAt: input.dueAt,
        stripeInvoiceId: input.stripeInvoiceId,
        paypalCaptureId: input.paypalCaptureId,
        subtotalCents,
        taxCents,
        totalCents: subtotalCents + taxCents,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: input.metadata as any,
        lineItems: {
          create: lineItems.map((item) => ({
            organizationId: input.organizationId,
            description: item.description,
            quantity: item.quantity ?? 1,
            unitAmountCents: item.unitAmountCents,
            amountCents: lineItemAmount(item),
            resourceTypeKey: item.resourceTypeKey,
          })),
        },
      },
      include: { lineItems: true },
    }),
  );
}

async function recomputeTotals(organizationId: string, invoiceId: string): Promise<InvoiceWithLineItems> {
  const [organization, subtotalCents] = await Promise.all([
    prismaWithoutTenantScoping.organization.findUnique({ where: { id: organizationId }, select: { country: true } }),
    runWithTenant(organizationId, async () => {
      const items = await db.invoiceLineItem.findMany({ where: { invoiceId } });
      return sumLineItems(items);
    }),
  ]);
  const ratePercent = await resolveTaxRatePercent(organization?.country ?? null);
  const taxCents = computeTaxCents(subtotalCents, ratePercent);

  return runWithTenant(organizationId, async () =>
    db.invoice.update({
      where: { id: invoiceId },
      data: { subtotalCents, taxCents, totalCents: subtotalCents + taxCents },
      include: { lineItems: true },
    }),
  );
}

export async function addInvoiceLineItem(
  organizationId: string,
  invoiceId: string,
  item: InvoiceLineItemInput,
): Promise<InvoiceWithLineItems> {
  const invoice = await requireInvoice(organizationId, invoiceId);
  requireDraft(invoice, "add a line item to");

  await runWithTenant(organizationId, async () =>
    db.invoiceLineItem.create({
      data: {
        organizationId,
        invoiceId,
        description: item.description,
        quantity: item.quantity ?? 1,
        unitAmountCents: item.unitAmountCents,
        amountCents: lineItemAmount(item),
        resourceTypeKey: item.resourceTypeKey,
      },
    }),
  );

  return recomputeTotals(organizationId, invoiceId);
}

export async function removeInvoiceLineItem(
  organizationId: string,
  invoiceId: string,
  lineItemId: string,
): Promise<InvoiceWithLineItems> {
  const invoice = await requireInvoice(organizationId, invoiceId);
  requireDraft(invoice, "remove a line item from");

  await runWithTenant(organizationId, async () => db.invoiceLineItem.delete({ where: { id: lineItemId } }));

  return recomputeTotals(organizationId, invoiceId);
}

/**
 * DRAFT -> ISSUED. Assigns the invoice number and freezes it — no further
 * line-item or amount changes are possible after this returns (FR-201).
 * Number assignment is a simple per-organization sequence computed inside
 * the same tenant-scoped call, rendered through the platform-configured
 * format (Settings > General, default "INV-{NUMBER}"); Phase 1 accepts the
 * narrow race between two concurrent issues for the same org (documented,
 * not fixed — same tradeoff organization-lifecycle.ts makes elsewhere for
 * Phase 1).
 */
export async function issueInvoice(
  organizationId: string,
  invoiceId: string,
  context?: LifecycleActionContext,
): Promise<Invoice> {
  const invoice = await requireInvoice(organizationId, invoiceId);
  requireDraft(invoice, "issue");

  return runWithTenant(organizationId, async () => {
    const issuedCount = await db.invoice.count({ where: { status: { not: "DRAFT" } } });
    const number = await formatInvoiceNumber(issuedCount + 1);
    const issued = await db.invoice.update({
      where: { id: invoiceId },
      data: { status: "ISSUED", number, issuedAt: new Date() },
    });

    await writeAuditLog({
      module: "core",
      action: "invoice.issued",
      actorUserId: context?.actorUserId,
      resourceType: "Invoice",
      resourceId: invoiceId,
      metadata: { number: issued.number, totalCents: issued.totalCents },
    });

    return issued;
  });
}

export async function markInvoicePaid(
  organizationId: string,
  invoiceId: string,
  context?: LifecycleActionContext,
): Promise<Invoice> {
  return runWithTenant(organizationId, async () => {
    const { count } = await db.invoice.updateMany({
      where: { id: invoiceId, status: "ISSUED" },
      data: { status: "PAID", paidAt: new Date() },
    });
    if (count === 0) {
      const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
      if (!invoice) throw new InvoiceNotFoundError(invoiceId);
      throw new InvalidInvoiceTransitionError("mark paid", invoice.status, ["ISSUED"]);
    }
    const invoice = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    await writeAuditLog({
      module: "core",
      action: "invoice.paid",
      actorUserId: context?.actorUserId,
      resourceType: "Invoice",
      resourceId: invoiceId,
    });
    return invoice;
  });
}

export async function voidInvoice(
  organizationId: string,
  invoiceId: string,
  context?: LifecycleActionContext,
): Promise<Invoice> {
  return runWithTenant(organizationId, async () => {
    const { count } = await db.invoice.updateMany({
      where: { id: invoiceId, status: { in: ["DRAFT", "ISSUED"] } },
      data: { status: "VOID", voidedAt: new Date() },
    });
    if (count === 0) {
      const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
      if (!invoice) throw new InvoiceNotFoundError(invoiceId);
      throw new InvalidInvoiceTransitionError("void", invoice.status, ["DRAFT", "ISSUED"]);
    }
    const invoice = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    await writeAuditLog({
      module: "core",
      action: "invoice.voided",
      actorUserId: context?.actorUserId,
      resourceType: "Invoice",
      resourceId: invoiceId,
      metadata: context?.reason ? { reason: context.reason } : undefined,
    });
    return invoice;
  });
}

export interface CreateCreditNoteInput {
  organizationId: string;
  invoiceId: string;
  reason: string;
  amountCents: number;
  currency?: string;
  metadata?: unknown;
}

/**
 * FR-201's correction path: attaches an immutable CreditNote to an
 * ISSUED/PAID invoice without touching the invoice itself. Only permitted
 * against an already-issued invoice — a DRAFT mistake should just be edited
 * directly (still mutable) or voided, not credit-noted.
 */
export async function createCreditNote(input: CreateCreditNoteInput, context?: LifecycleActionContext): Promise<CreditNote> {
  const invoice = await requireInvoice(input.organizationId, input.invoiceId);
  if (invoice.status !== "ISSUED" && invoice.status !== "PAID") {
    throw new InvalidInvoiceTransitionError("credit-note", invoice.status, ["ISSUED", "PAID"]);
  }

  return runWithTenant(input.organizationId, async () => {
    const count = await db.creditNote.count({ where: { invoiceId: input.invoiceId } });
    const creditNote = await db.creditNote.create({
      data: {
        organizationId: input.organizationId,
        invoiceId: input.invoiceId,
        number: `CN-${invoice.number ?? invoice.id.slice(0, 8)}-${count + 1}`,
        reason: input.reason,
        amountCents: input.amountCents,
        currency: input.currency ?? invoice.currency,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: input.metadata as any,
      },
    });

    await writeAuditLog({
      module: "core",
      action: "invoice.credit_note_issued",
      actorUserId: context?.actorUserId,
      resourceType: "Invoice",
      resourceId: input.invoiceId,
      metadata: { creditNoteId: creditNote.id, amountCents: input.amountCents, reason: input.reason },
    });

    return creditNote;
  });
}

export async function getInvoice(organizationId: string, invoiceId: string): Promise<InvoiceWithLineItems | null> {
  return runWithTenant(organizationId, async () =>
    db.invoice.findUnique({ where: { id: invoiceId }, include: { lineItems: true } }),
  );
}

export interface ListInvoicesOptions {
  status?: Invoice["status"][];
}

export async function listInvoices(organizationId: string, options: ListInvoicesOptions = {}) {
  return runWithTenant(organizationId, async () =>
    db.invoice.findMany({
      where: options.status ? { status: { in: options.status } } : undefined,
      include: { lineItems: true },
      orderBy: { createdAt: "desc" },
    }),
  );
}

/** Cursor-paginated variant for REST — the UI's listInvoices stays as-is (unpaginated, fine at UI scale). */
export async function listInvoicesPage(
  organizationId: string,
  options: ListInvoicesOptions & PageParams = {},
): Promise<PageResult<InvoiceWithLineItems>> {
  const limit = clampPageLimit(options.limit);
  return runWithTenant(organizationId, async () => {
    const rows = await db.invoice.findMany({
      where: options.status ? { status: { in: options.status } } : undefined,
      include: { lineItems: true },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    });
    return toPageResult(rows, limit);
  });
}

export async function listCreditNotes(organizationId: string, invoiceId: string): Promise<CreditNote[]> {
  return runWithTenant(organizationId, async () => db.creditNote.findMany({ where: { invoiceId }, orderBy: { createdAt: "asc" } }));
}
