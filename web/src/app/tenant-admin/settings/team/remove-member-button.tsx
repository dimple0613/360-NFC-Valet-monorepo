"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BanIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { removeMemberAction } from "./actions";

export function RemoveMemberButton({ membershipId, email, isSelf }: { membershipId: string; email: string; isSelf: boolean }) {
  const [conf, setConf] = useState(false);
  const [pending, setPending] = useState(false);

  if (isSelf) return null;

  function handleRemove() {
    setPending(true);
    try {
      removeMemberAction(membershipId);
      toast.success("Member removed.");
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
              aria-label={`Remove ${email}`}
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
          <TooltipContent>Remove</TooltipContent>
        </TooltipTrigger>
      </Tooltip>
      <ConfirmDialog
        open={conf}
        onOpenChange={setConf}
        title={`Remove "${email}"?`}
        message="They'll lose access to this organization immediately."
        confirmLabel="Remove"
        onConfirm={handleRemove}
      />
    </>
  );
}
