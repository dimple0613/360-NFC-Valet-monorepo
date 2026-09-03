import { NextResponse } from "next/server";
import { getInvoice } from "@saasclaude/db";
import { requireApiScope, withApiTenantContext } from "@/lib/tenant/api";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withApiTenantContext<RouteContext>(async (_req, ctx, apiKey) => {
  const denied = requireApiScope(apiKey, "core.billing.read");
  if (denied) return denied;

  const { id } = await ctx.params;
  const invoice = await getInvoice(apiKey.organizationId, id);
  if (!invoice) return NextResponse.json({ error: "No invoice with that id." }, { status: 404 });

  return NextResponse.json({
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    currency: invoice.currency,
    subtotalCents: invoice.subtotalCents,
    taxCents: invoice.taxCents,
    totalCents: invoice.totalCents,
    issuedAt: invoice.issuedAt,
    paidAt: invoice.paidAt,
    dueAt: invoice.dueAt,
    lineItems: invoice.lineItems.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitAmountCents: item.unitAmountCents,
      amountCents: item.amountCents,
    })),
  });
});
