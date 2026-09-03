"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PencilIcon, ChevronDownIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { OrganizationSummaryRow } from "@saasclaude/db";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatusBadge, ORG_STATUS_STYLES } from "@/components/status-badge";
import { AssignPlanDialog } from "./assign-plan-dialog";
import { deleteOrganizationAction, disableOrganizationAction, loginAsOrganizationAction, reactivateOrganizationAction } from "./actions";

export function OrganizationTableRow({
  organization,
  plans,
  canManageBilling,
}: {
  organization: OrganizationSummaryRow;
  plans: { key: string; name: string }[];
  canManageBilling: boolean;
}) {
  const [assignPlanOpen, setAssignPlanOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleToggleStatus() {
    startTransition(async () => {
      try {
        if (organization.status === "ACTIVE") {
          await disableOrganizationAction(organization.id);
          toast.success(`${organization.name} disabled.`);
        } else {
          await reactivateOrganizationAction(organization.id);
          toast.success(`${organization.name} reactivated.`);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteOrganizationAction(organization.id);
        toast.success("Deletion scheduled for 30 days from now.");
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
        <div className="flex flex-wrap items-center avatar-row" style={{ gap: "11px" }}>
          <div
            style={{ width: 36, height: 36, borderRadius: "50%", background: "#edf0fe", color: "#4a5fc9", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >
            {organization.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="table-main" style={{ fontSize: 13.5, fontWeight: 800, color: "#1c2b46" }}>
              <Link
                href={`/super-admin/organizations/${organization.id}`}
                className="text-[13px] font-bold text-[#1c2b46] decoration-transparent hover:text-[#f4531f] hover:underline"
              >
                {organization.name}
              </Link>
            </div>
            <div className="table-sub" style={{ fontSize: 11, color: "#6c7a93", fontWeight: 600, marginTop: 1 }}>
              {organization.activeMemberCount} {organization.activeMemberCount === 1 ? "user" : "users"}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        {organization.planName ? (
          <>
            <div className="font-medium text-[#1c2b46]">{organization.planName}</div>
            <p className="text-[12.5px] text-[#9aa6bc]">Current plan</p>
          </>
        ) : (
          <span className="text-[#9aa6bc]">No active subscription</span>
        )}
      </TableCell>
      <TableCell>
        <StatusBadge value={organization.status} styles={ORG_STATUS_STYLES} />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <form action={loginAsOrganizationAction.bind(null, organization.id)}>
            <button
              type="submit"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                background: "rgb(254, 239, 232)",
                border: "1.5px solid rgb(244, 164, 126)",
                color: "rgb(214, 67, 15)",
                borderRadius: 99,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "background 0.15s ease",
              }}
            >
              Login as
              <ChevronDownIcon className="size-3.5" />
            </button>
          </form>
          <Tooltip>
            <TooltipTrigger
              render={
                <Link
                  href={`/super-admin/organizations/${organization.id}`}
                  aria-label={`Edit ${organization.name}`}
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
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="icon-sm" disabled={pending} />}>
              <ChevronDownIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canManageBilling ? (
                <DropdownMenuItem onClick={() => setAssignPlanOpen(true)}>Assign plan</DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onClick={handleToggleStatus}>
                {organization.status === "ACTIVE" ? "Disable" : "Reactivate"}
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href={`/super-admin/organizations/${organization.id}?tab=subscriptions`} />}>
                Subscriptions
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setConfirmDeleteOpen(true)}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {canManageBilling ? (
          <AssignPlanDialog
            open={assignPlanOpen}
            onOpenChange={setAssignPlanOpen}
            organizationId={organization.id}
            organizationName={organization.name}
            plans={plans}
            currentPlanName={organization.planName}
          />
        ) : null}
      </TableCell>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={`Delete "${organization.name}"?`}
        message="This organization and its data will be permanently deleted in 30 days. This cannot be undone."
        confirmLabel="Schedule deletion"
        onConfirm={handleDelete}
        pending={pending}
      />
    </TableRow>
  );
}
