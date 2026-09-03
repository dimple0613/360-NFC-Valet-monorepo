"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * A one-time secret reveal: the value is never retrievable again once this
 * dialog closes (the caller only ever has the raw value for this one render —
 * it's hashed/discarded server-side). Used for anything with that shape:
 * an invite link, a raw API key, etc.
 */
export function CopyableSecretDialog({
  open,
  onOpenChange,
  title,
  description,
  value,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <code className="block rounded-md border bg-muted/50 p-2 text-sm break-all">{value}</code>

        <Alert variant="destructive">
          <AlertDescription>
            Copy this now — once you close this dialog, it can&apos;t be shown again.
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button type="button" onClick={handleCopy} className="gap-1.5">
            {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
