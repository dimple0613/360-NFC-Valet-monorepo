"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BanIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { revokeInviteAction } from "./actions";

export function RevokeInviteButton({ inviteId, email }: { inviteId: string; email: string }) {
  const [conf, setConf] = useState(false);
  const [pending, setPending] = useState(false);

  function handleRevoke() {
    setPending(true);
    try {
      revokeInviteAction(inviteId);
      toast.success("Invite revoked.");
    } finally {
      setPending(false);
      setConf(false);
    }
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label={`Revoke invite for ${email}`}
              disabled={pending}
              onClick={() => setConf(true)}
              style={{
                cursor: "pointer",
                border: "none",
                fontSize: 11,
                fontWeight: 700,
                background: "rgb(254, 239, 235)",
                color: "rgb(220, 53, 69)",
                padding: "8px 9px",
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <BanIcon className="size-3.5" />
            </button>
          }
        >
          <TooltipContent>Revoke</TooltipContent>
        </TooltipTrigger>
      </Tooltip>
      <ConfirmDialog
        open={conf}
        onOpenChange={setConf}
        title={`Revoke invite for "${email}"?`}
        message="The invite link will stop working immediately."
        confirmLabel="Revoke"
        onConfirm={handleRevoke}
      />
    </>
  );
}
