"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PencilIcon, ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatusBadge, MEMBERSHIP_STATUS_STYLES } from "@/components/status-badge";
import { formatDateTime } from "@/lib/format";
import { impersonateAction, removeOrganizationMemberAction } from "./actions";
import { EditMemberDialog } from "./edit-member-dialog";

export interface MemberRowData {
  membershipId: string;
  userId: string;
  email: string;
  name: string | null;
  status: string;
  roleNames: string[];
  currentRoleId?: string;
  createdAt: Date;
}

export function MemberRow({
  organizationId,
  member,
  roles,
}: {
  organizationId: string;
  member: MemberRowData;
  roles: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

  function handleRemove() {
    startTransition(async () => {
      try {
        await removeOrganizationMemberAction(organizationId, member.membershipId);
        toast.success("Member removed.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      } finally {
        setConfirmRemoveOpen(false);
      }
    });
  }

  return (
    <tr className="border-b border-[#f1f3f6] last:border-b-0 hover:bg-[#fafbfc] transition-colors">
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center" style={{ gap: 11 }}>
          <div
            className="flex items-center justify-center font-extrabold"
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "rgb(237, 240, 254)",
              color: "rgb(74, 95, 201)",
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            {(member.name ?? member.email).slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <span className="text-[13px] font-bold text-[#1c2b46]">{member.name ?? member.email}</span>
            <div className="text-[12px] font-medium text-[#6c7a93]">{member.email}</div>
          </div>
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="text-[13px] font-bold text-[#1c2b46]">{formatDateTime(member.createdAt)}</div>
      </td>

      <td className="px-4 py-3">
        <div className="text-[13px] font-bold text-[#1c2b46]">{member.roleNames.join(", ") || "—"}</div>
      </td>

      <td className="px-4 py-3">
        <StatusBadge value={member.status} styles={MEMBERSHIP_STATUS_STYLES} />
      </td>

      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          {member.status === "ACTIVE" ? (
            <form action={impersonateAction.bind(null, organizationId, member.userId)}>
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
                Impersonate
              </button>
            </form>
          ) : null}
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            aria-label={`Edit ${member.email}`}
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
          >
            <PencilIcon className="size-3.5" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="icon-sm" disabled={pending} />}>
              <ChevronDownIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onClick={() => setConfirmRemoveOpen(true)}>
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>

      <EditMemberDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        organizationId={organizationId}
        userId={member.userId}
        email={member.email}
        name={member.name}
        currentRoleId={member.currentRoleId}
        roles={roles}
      />

      <ConfirmDialog
        open={confirmRemoveOpen}
        onOpenChange={setConfirmRemoveOpen}
        title={`Remove ${member.email}?`}
        message="This member will be removed from this organization. They'll no longer have access to its data."
        confirmLabel="Remove"
        onConfirm={handleRemove}
        pending={pending}
      />
    </tr>
  );
}
