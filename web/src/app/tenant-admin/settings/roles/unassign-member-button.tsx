"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { UserXIcon } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { unassignRoleAction } from "./actions";

export function UnassignMemberButton({
  roleId,
  userId,
  email,
}: {
  roleId: string;
  userId: string;
  email: string;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleUnassign() {
    startTransition(async () => {
      try {
        await unassignRoleAction(roleId, userId);
        toast.success("Member unassigned.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      } finally {
        setConfirmOpen(false);
      }
    });
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger render={<button type="button" aria-label={`Unassign ${email}`} disabled={pending} onClick={() => setConfirmOpen(true)} />}>
          <span
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
              opacity: pending ? 0.6 : 1,
            }}
          >
            <UserXIcon className="size-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent>Unassign</TooltipContent>
      </Tooltip>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Unassign "${email}"?`}
        message="They'll lose this role's permissions. You can assign it to them again later."
        confirmLabel="Unassign"
        onConfirm={handleUnassign}
        pending={pending}
      />
    </>
  );
}
