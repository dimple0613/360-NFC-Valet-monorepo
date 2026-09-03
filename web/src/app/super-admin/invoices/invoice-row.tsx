import Link from "next/link";
import { TableCell, TableRow } from "@/components/ui/table";
import type { PlatformInvoiceRow } from "@saasclaude/db";
import { formatPrice, formatDateTime } from "@/lib/format";
import { StatusBadge, INVOICE_STATUS_STYLES } from "@/components/status-badge";

export function InvoiceTableRow({ invoice }: { invoice: PlatformInvoiceRow }) {
  return (
    <TableRow>
      <TableCell>
        <div className="text-[13px] font-bold text-[#1c2b46]">{invoice.number ?? `#${invoice.id}`}</div>
        {invoice.contentDescription ? (
          <div className="text-[11px] font-medium text-[#6c7a93] truncate max-w-[260px]">{invoice.contentDescription}</div>
        ) : null}
      </TableCell>

      <TableCell>
        <Link
          href={`/super-admin/organizations/${invoice.organizationId}`}
          className="text-[13px] font-bold text-[#1c2b46] decoration-transparent hover:text-[#f4531f] hover:underline"
        >
          {invoice.organizationName}
        </Link>
      </TableCell>

      <TableCell>
        <div className="text-[13px] font-bold text-[#1c2b46]">{formatDateTime(invoice.createdAt)}</div>
      </TableCell>

      <TableCell>
        <div className="text-[13px] font-bold text-[#1c2b46]">{formatPrice(invoice.totalCents, invoice.currency)}</div>
      </TableCell>

      <TableCell>
        <StatusBadge value={invoice.status} styles={INVOICE_STATUS_STYLES} />
      </TableCell>
    </TableRow>
  );
}
