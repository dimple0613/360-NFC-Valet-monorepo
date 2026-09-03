"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { UserXIcon } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { revokePlatformAdminAction } from "./actions";

export function RevokeAdminButton({
  platformUserRoleId,
  userEmail,
}: {
  platformUserRoleId: string;
  userEmail: string;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleRevoke() {
    startTransition(async () => {
      try {
        await revokePlatformAdminAction(platformUserRoleId);
        toast.success("Platform admin access revoked.");
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
        <TooltipTrigger render={<button type="button" aria-label={`Revoke ${userEmail}`} disabled={pending} onClick={() => setConfirmOpen(true)} />}>
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
        <TooltipContent>Revoke</TooltipContent>
      </Tooltip>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Revoke ${userEmail}?`}
        message={`Revoke platform admin access for ${userEmail}? This can be granted again later.`}
        confirmLabel="Revoke"
        onConfirm={handleRevoke}
        pending={pending}
      />
    </>
  );
}