"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { GlobalRoleRow } from "@saasclaude/db";
import { formatDateTime } from "@/lib/format";
import { StatusBadge, MEMBERSHIP_STATUS_STYLES } from "@/components/status-badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { deleteGlobalRoleAction } from "./actions";

export function RoleTableRow({ role }: { role: GlobalRoleRow }) {
  const [pending, startTransition] = useTransition();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteGlobalRoleAction(role.id);
        toast.success(`${role.name} deleted.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      } finally {
        setConfirmDeleteOpen(false);
      }
    });
  }

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-wrap items-center" style={{ gap: "11px" }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "#edf0fe",
              color: "#4a5fc9",
              fontSize: 12,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {role.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <Link
              href={`/super-admin/roles/${role.id}/edit`}
              className="text-[13px] font-bold text-[#1c2b46] decoration-transparent hover:text-[#f4531f] hover:underline"
            >
              {role.name}
            </Link>
            {role.description ? (
              <div className="text-[11px] font-medium text-[#6c7a93] truncate max-w-[300px]">{role.description}</div>
            ) : null}
          </div>
        </div>
      </TableCell>

      <TableCell>
        <div className="text-[13px] font-bold text-[#1c2b46]">{role.permissionCount}</div>
      </TableCell>

      <TableCell>
        <div className="text-[13px] font-bold text-[#1c2b46]">{role.memberCount}</div>
      </TableCell>

      <TableCell>
        <div className="text-[13px] font-bold text-[#1c2b46]">{formatDateTime(role.updatedAt)}</div>
      </TableCell>

      <TableCell>
        <StatusBadge value="ACTIVE" styles={MEMBERSHIP_STATUS_STYLES} />
      </TableCell>

      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Link
                  href={`/super-admin/roles/${role.id}/edit`}
                  aria-label={`Edit ${role.name}`}
                  style={{
                    cursor: "pointer",
                    border: "none",
                    fontSize: 11,
                    fontWeight: 700,
                    background: "rgb(237, 240, 254)",
                    color: "rgb(74, 95, 201)",
                    padding: "8px 9px",
                    borderRadius: 999,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                />
              }
            >
              <PencilIcon className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent>Edit</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={`Delete ${role.name}`}
                  disabled={pending}
                  onClick={() => setConfirmDeleteOpen(true)}
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
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
        </div>
      </TableCell>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={`Delete "${role.name}"?`}
        message="This role will be permanently deleted. This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        pending={pending}
      />
    </TableRow>
  );
}