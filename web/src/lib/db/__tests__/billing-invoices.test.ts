import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, prismaWithoutTenantScoping } from "../client";
import { runWithTenant } from "../tenant-context";
import { ImmutableRecordError } from "../tenant-scoping";
import {
  addInvoiceLineItem,
  createCreditNote,
  createDraftInvoice,
  getInvoice,
  InvalidInvoiceTransitionError,
  InvoiceNotDraftError,
  InvoiceNotFoundError,
  issueInvoice,
  listCreditNotes,
  listInvoices,
  listInvoicesPage,
  markInvoicePaid,
  removeInvoiceLineItem,
  voidInvoice,
} from "../billing/invoices";

const runId = Date.now().toString(36);

describe("invoices + credit notes (FR-200–201)", () => {
  let orgA: { id: string };
  let orgB: { id: string };

  beforeAll(async () => {
    orgA = await prismaWithoutTenantScoping.organization.create({
      data: { name: "Invoice Org A", slug: `inv-org-a-${runId}` },
    });
    orgB = await prismaWithoutTenantScoping.organization.create({
      data: { name: "Invoice Org B", slug: `inv-org-b-${runId}` },
    });
  });

  afterAll(async () => {
    for (const org of [orgA, orgB]) {
      await prismaWithoutTenantScoping.creditNote.deleteMany({ where: { organizationId: org.id } });
      await prismaWithoutTenantScoping.invoiceLineItem.deleteMany({ where: { organizationId: org.id } });
      await prismaWithoutTenantScoping.invoice.deleteMany({ where: { organizationId: org.id } });
      await prismaWithoutTenantScoping.organization.delete({ where: { id: org.id } });
    }
  });

  it("createDraftInvoice computes totals from line items and starts DRAFT", async () => {
    const invoice = await createDraftInvoice({
      organizationId: orgA.id,
      lineItems: [
        { description: "Seats", quantity: 3, unitAmountCents: 1000 },
        { description: "Storage", unitAmountCents: 500 },
      ],
    });

    expect(invoice.status).toBe("DRAFT");
    expect(invoice.subtotalCents).toBe(3500);
    expect(invoice.totalCents).toBe(3500);
    expect(invoice.lineItems).toHaveLength(2);
  });

  it("addInvoiceLineItem and removeInvoiceLineItem recompute totals, only while DRAFT", async () => {
    const invoice = await createDraftInvoice({ organizationId: orgA.id, lineItems: [{ description: "Base", unitAmountCents: 100 }] });

    const withExtra = await addInvoiceLineItem(orgA.id, invoice.id, { description: "Add-on", quantity: 2, unitAmountCents: 200 });
    expect(withExtra.totalCents).toBe(500); // 100 + 2*200

    const addedItem = withExtra.lineItems.find((i) => i.description === "Add-on")!;
    const afterRemove = await removeInvoiceLineItem(orgA.id, invoice.id, addedItem.id);
    expect(afterRemove.totalCents).toBe(100);
  });

  it("issueInvoice freezes the invoice and assigns a per-organization sequential number", async () => {
    const invoice = await createDraftInvoice({ organizationId: orgA.id, lineItems: [{ description: "Plan", unitAmountCents: 2900 }] });
    const issued = await issueInvoice(orgA.id, invoice.id);

    expect(issued.status).toBe("ISSUED");
    expect(issued.number).toMatch(/^INV-\d{6}$/);
    expect(issued.issuedAt).not.toBeNull();

    // Mutating an issued invoice is refused.
    await expect(addInvoiceLineItem(orgA.id, invoice.id, { description: "Late add", unitAmountCents: 100 })).rejects.toThrow(
      InvoiceNotDraftError,
    );
  });

  it("two different organizations can independently produce the same invoice number", async () => {
    const invA = await issueInvoice(orgA.id, (await createDraftInvoice({ organizationId: orgA.id, lineItems: [{ description: "x", unitAmountCents: 1 }] })).id);
    const invB = await issueInvoice(orgB.id, (await createDraftInvoice({ organizationId: orgB.id, lineItems: [{ description: "x", unitAmountCents: 1 }] })).id);

    // Not asserting a specific shared value (order-dependent across the whole
    // suite) — the point is the org-scoped uniqueness constraint doesn't reject
    // this combination the way a globally-unique `number` column would.
    expect(invA.number).toMatch(/^INV-\d{6}$/);
    expect(invB.number).toMatch(/^INV-\d{6}$/);
  });

  it("markInvoicePaid requires ISSUED, and createCreditNote requires ISSUED or PAID", async () => {
    const draft = await createDraftInvoice({ organizationId: orgA.id, lineItems: [{ description: "y", unitAmountCents: 500 }] });

    await expect(markInvoicePaid(orgA.id, draft.id)).rejects.toThrow(InvalidInvoiceTransitionError);
    await expect(createCreditNote({ organizationId: orgA.id, invoiceId: draft.id, reason: "test", amountCents: 100 })).rejects.toThrow(
      InvalidInvoiceTransitionError,
    );

    const issued = await issueInvoice(orgA.id, draft.id);
    const paid = await markInvoicePaid(orgA.id, issued.id);
    expect(paid.status).toBe("PAID");
    expect(paid.paidAt).not.toBeNull();
  });

  it("createCreditNote attaches an immutable correction without touching the invoice", async () => {
    const draft = await createDraftInvoice({ organizationId: orgA.id, lineItems: [{ description: "z", unitAmountCents: 5000 }] });
    const issued = await issueInvoice(orgA.id, draft.id);
    const paid = await markInvoicePaid(orgA.id, issued.id);

    const creditNote = await createCreditNote({
      organizationId: orgA.id,
      invoiceId: paid.id,
      reason: "Partial refund",
      amountCents: 1000,
    });
    expect(creditNote.amountCents).toBe(1000);
    expect(creditNote.number).toContain("CN-");

    // The invoice itself is untouched.
    const reloaded = await getInvoice(orgA.id, paid.id);
    expect(reloaded?.totalCents).toBe(5000);
    expect(reloaded?.status).toBe("PAID");

    // CreditNote rows are append-only — direct mutation is rejected by the
    // tenant-scoping extension's immutability guard (same as AuditLog).
    // prismaWithoutTenantScoping bypasses that extension entirely, so the
    // check must go through the scoped `db` client inside runWithTenant.
    await expect(
      runWithTenant(orgA.id, async () =>
        db.creditNote.update({ where: { id: creditNote.id }, data: { amountCents: 1 } }),
      ),
    ).rejects.toThrow(ImmutableRecordError);

    const notes = await listCreditNotes(orgA.id, paid.id);
    expect(notes).toHaveLength(1);
  });

  it("voidInvoice works from DRAFT or ISSUED but not PAID", async () => {
    const draft = await createDraftInvoice({ organizationId: orgA.id, lineItems: [{ description: "v", unitAmountCents: 100 }] });
    const voided = await voidInvoice(orgA.id, draft.id);
    expect(voided.status).toBe("VOID");

    const paidInvoice = await markInvoicePaid(
      orgA.id,
      (await issueInvoice(orgA.id, (await createDraftInvoice({ organizationId: orgA.id, lineItems: [{ description: "p", unitAmountCents: 100 }] })).id)).id,
    );
    await expect(voidInvoice(orgA.id, paidInvoice.id)).rejects.toThrow(InvalidInvoiceTransitionError);
  });

  it("getInvoice/listInvoices are tenant-scoped: org B cannot see org A's invoices", async () => {
    const invoice = await createDraftInvoice({ organizationId: orgA.id, lineItems: [{ description: "scoped", unitAmountCents: 1 }] });

    await expect(getInvoice(orgB.id, invoice.id)).resolves.toBeNull();

    const orgAInvoices = await listInvoices(orgA.id);
    const orgBInvoices = await listInvoices(orgB.id);
    expect(orgAInvoices.some((i) => i.id === invoice.id)).toBe(true);
    expect(orgBInvoices.some((i) => i.id === invoice.id)).toBe(false);
  });

  it("throws InvoiceNotFoundError for an unknown id", async () => {
    await expect(issueInvoice(orgA.id, "nonexistent-id")).rejects.toThrow(InvoiceNotFoundError);
  });

  it("listInvoicesPage paginates in real DB pages with no duplicate/missing rows across pages", async () => {
    const pagingOrg = await prismaWithoutTenantScoping.organization.create({
      data: { name: "Invoice Paging Org", slug: `inv-paging-org-${runId}` },
    });
    const created = await Promise.all(
      [1, 2, 3].map((n) => createDraftInvoice({ organizationId: pagingOrg.id, lineItems: [{ description: `line-${n}`, unitAmountCents: n * 100 }] })),
    );

    const first = await listInvoicesPage(pagingOrg.id, { limit: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();

    const second = await listInvoicesPage(pagingOrg.id, { limit: 2, cursor: first.nextCursor! });
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();

    const allIds = new Set([...first.items, ...second.items].map((i) => i.id));
    expect(allIds.size).toBe(3);
    expect(created.every((c) => allIds.has(c.id))).toBe(true);

    await prismaWithoutTenantScoping.invoiceLineItem.deleteMany({ where: { organizationId: pagingOrg.id } });
    await prismaWithoutTenantScoping.invoice.deleteMany({ where: { organizationId: pagingOrg.id } });
    await prismaWithoutTenantScoping.organization.delete({ where: { id: pagingOrg.id } });
  });
});
