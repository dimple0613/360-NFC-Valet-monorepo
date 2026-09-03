"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { LogOutIcon } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { revokeSessionAction } from "./actions";

export function RevokeSessionButton({
  sessionId,
  deviceLabel,
  isCurrent,
}: {
  sessionId: string;
  deviceLabel: string;
  isCurrent: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleRevoke() {
    startTransition(async () => {
      try {
        await revokeSessionAction(sessionId);
        toast.success("Session revoked.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      } finally {
        setConfirmOpen(false);
      }
    });
  }

  const trigger = (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={`Revoke session ${deviceLabel}`}
            disabled={pending || isCurrent}
            onClick={() => setConfirmOpen(true)}
          />
        }
      >
        <span
          style={{
            cursor: pending || isCurrent ? "not-allowed" : "pointer",
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
          <LogOutIcon className="size-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent>{isCurrent ? "This session" : "Revoke"}</TooltipContent>
    </Tooltip>
  );

  return (
    <>
      {trigger}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={isCurrent ? "Sign out this session?" : `Revoke ${deviceLabel}?`}
        message={
          isCurrent
            ? "This is your current session. Revoking it will sign you out immediately."
            : `This session will be signed out and will need to sign in again on the device.`
        }
        confirmLabel="Revoke"
        onConfirm={handleRevoke}
        pending={pending}
      />
    </>
  );
}
