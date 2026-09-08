"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon, XIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

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
      <DialogContent
        className="sm:max-w-[460px]"
        showCloseButton={false}
        style={{ borderRadius: 20, padding: 24 }}
      >
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Close"
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "#f6f7f9",
            color: "#6c7a93",
            border: "none",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            position: "absolute",
            right: 10,
            top: 10,
          }}
        >
          <XIcon size={16} />
        </button>
        <div className="mb-3 min-w-0">
          <DialogTitle className="text-[17px] font-extrabold text-[#1c2b46]">{title}</DialogTitle>
          <DialogDescription className="mt-0.5 text-[12.5px] font-medium text-[#6c7a93]">
            {description}
          </DialogDescription>
        </div>
        <code className="mb-3 block break-all rounded-[10px] border border-[#e7eaf0] bg-[#f6f7f9] p-3 text-[12.5px] font-semibold text-[#1c2b46]">
          {value}
        </code>
        <div className="mb-3 rounded-lg border border-[#fbe3d6] bg-[#fff4ec] px-3 py-2 text-[12.5px] font-semibold text-[#c2410c]">
          Copy this now — once you close this dialog, it can&apos;t be shown again.
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleCopy}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "9px 18px",
              borderRadius: 99,
              border: "none",
              background: "#f4531f",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 6px 18px -6px rgba(244, 83, 31, 0.55)",
              fontFamily: "inherit",
            }}
          >
            {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}