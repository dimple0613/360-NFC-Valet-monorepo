"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Currency } from "@saasclaude/db";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime } from "@/lib/format";
import { deleteCurrencyAction } from "./actions";
import { EditCurrencyDialog } from "./edit-currency-dialog";

const CURRENCY_STATUS_STYLES = {
  ACTIVE: { background: "#e7f7ef", color: "#0c9d61" },
  INACTIVE: { background: "#f1f3f6", color: "#6c7a93" },
};

export function CurrencyTableRow({ currency }: { currency: Currency }) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteCurrencyAction(currency.id);
        toast.success("Currency deleted.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      } finally {
        setConfirmOpen(false);
      }
    });
  }

  return (
    <TableRow>
      <TableCell>
        <div className="text-[13px] font-bold text-[#1c2b46]">{currency.name}</div>
        <div className="text-[11px] font-medium text-[#6c7a93]">
          Updated at {formatDateTime(currency.updatedAt)}
        </div>
      </TableCell>

      <TableCell>
        <div className="text-[13px] font-bold text-[#1c2b46]">{currency.code}</div>
      </TableCell>

      <TableCell>
        <div className="text-[13px] font-bold text-[#1c2b46]">{currency.format}</div>
      </TableCell>

      <TableCell>
        <StatusBadge value={currency.isActive ? "ACTIVE" : "INACTIVE"} styles={CURRENCY_STATUS_STYLES} />
      </TableCell>

      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <EditCurrencyDialog currency={currency} />
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={`Delete ${currency.name}`}
                  disabled={pending}
                  onClick={() => setConfirmOpen(true)}
                  style={{
                    cursor: "pointer",
                    border: "none",
                    fontSize: 11,
                    fontWeight: 700,
                    background: "rgb(254, 239, 232)",
                    color: "rgb(214, 67, 15)",
                    padding: "8px 9px",
                    borderRadius: 999,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                />
              }
            >
              <Trash2Icon className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent>Remove</TooltipContent>
          </Tooltip>
        </div>
      </TableCell>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete "${currency.name}"?`}
        message="This will permanently remove this currency. This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        pending={pending}
      />
    </TableRow>
  );
}
