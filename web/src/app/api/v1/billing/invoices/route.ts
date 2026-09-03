import { NextResponse } from "next/server";
import { listInvoicesPage } from "@saasclaude/db";
import { requireApiScope, withApiTenantContext } from "@/lib/tenant/api";
import { parsePageParams } from "@/lib/tenant/pagination";

export const GET = withApiTenantContext(async (req, _ctx, apiKey) => {
  const denied = requireApiScope(apiKey, "core.billing.read");
  if (denied) return denied;

  const { items, nextCursor } = await listInvoicesPage(apiKey.organizationId, parsePageParams(req));
  return NextResponse.json({
    invoices: items.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      currency: invoice.currency,
      totalCents: invoice.totalCents,
      issuedAt: invoice.issuedAt,
      paidAt: invoice.paidAt,
      dueAt: invoice.dueAt,
    })),
    nextCursor,
  });
});
