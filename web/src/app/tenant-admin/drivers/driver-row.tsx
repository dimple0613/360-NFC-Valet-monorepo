"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2Icon } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatusBadge } from "@/components/status-badge";
import { useRouter } from "next/navigation";
import { fmtDuration } from "../_lib/valet-ui";
import { EditDriverDialog } from "./edit-driver-dialog";
import { DriverManageMenu } from "./driver-manage-menu";
import type { DriverTableItem } from "../_lib/valet-data";

const DRIVER_STATUS_STYLES: Record<string, { background: string; color: string }> = {
  on_shift: { background: "#e7f7ef", color: "#0c9d61" },
  on_break: { background: "#fdf3e3", color: "#b97b17" },
  off_duty: { background: "#f1f3f6", color: "#6c7a93" },
};

export function DriverTableRow({
  driver,
  fields,
}: {
  driver: DriverTableItem;
  fields: { id: number; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const router = useRouter();

  function handleDelete() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/platform/valet/drivers", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: driver.id, remove: true }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to remove driver");
        toast.success("Driver removed.");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      } finally {
        setConfirmOpen(false);
      }
    });
  }

  const avgColor = driver.avgMin > 8 ? "#E9A23B" : driver.status === "off_duty" ? "#6C7A93" : "#0C9D61";

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              color: "#fff",
              fontSize: 11,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "none",
              background: driver.color || "#1C2B46",
            }}
          >
            {driver.initials}
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-extrabold text-[#1c2b46] truncate">{driver.name}</div>
            <div className="text-[11px] font-medium text-[#6c7a93]">{driver.valetId}</div>
          </div>
        </div>
      </TableCell>

      <TableCell>
        <div className="text-[12.5px] font-semibold text-[#6c7a93]">{driver.email || "—"}</div>
      </TableCell>

      <TableCell>
        <div className="text-[12.5px] font-semibold text-[#6c7a93]">{driver.property || "—"}</div>
      </TableCell>

      <TableCell>
        <div className="text-[12.5px] font-extrabold text-[#1c2b46]">
          {driver.status === "off_duty" ? "—" : driver.today}
        </div>
      </TableCell>

      <TableCell>
        <div className="text-[12.5px] font-extrabold" style={{ color: avgColor }}>
          {driver.status === "off_duty" ? "—" : fmtDuration(driver.avgMin)}
        </div>
      </TableCell>

      <TableCell>
        <StatusBadge
          value={driver.status}
          styles={DRIVER_STATUS_STYLES}
          label={driver.statusLabel}
        />
      </TableCell>

      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1.5">
          <DriverManageMenu driver={driver} fields={fields} />
          <EditDriverDialog driver={driver} fields={fields} />
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={`Delete ${driver.name}`}
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
        title={`Remove "${driver.name}"?`}
        message="This will remove the driver from the valet team. This action can be undone later."
        confirmLabel="Remove"
        onConfirm={handleDelete}
        pending={pending}
      />
    </TableRow>
  );
}
