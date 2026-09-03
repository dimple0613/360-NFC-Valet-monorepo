"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { BanIcon } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { revokeApiKeyAction } from "./api-keys-actions";

export function RevokeApiKeyButton({ apiKeyId, name }: { apiKeyId: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleRevoke() {
    startTransition(async () => {
      try {
        await revokeApiKeyAction(apiKeyId);
        toast.success("Key revoked.");
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
        <TooltipTrigger
          render={
            <button type="button" aria-label={`Revoke ${name}`} disabled={pending} onClick={() => setConfirmOpen(true)} />
          }
        >
          <span
            style={{
              cursor: pending ? "not-allowed" : "pointer",
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
            <BanIcon className="size-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent>Revoke</TooltipContent>
      </Tooltip>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Revoke "${name}"?`}
        message="Anything using this key will stop working immediately. This key cannot be restored."
        confirmLabel="Revoke"
        onConfirm={handleRevoke}
        pending={pending}
      />
    </>
  );
}
