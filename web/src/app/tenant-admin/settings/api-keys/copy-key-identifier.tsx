"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function CopyKeyIdentifier({ name, prefix }: { name: string; prefix: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(prefix).then(() => {
      setCopied(true);
      toast.success("Identifier copied.");
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <code className="rounded-md bg-[#f1f3f6] px-2 py-1 text-[12px] font-semibold text-[#16213a]">
        {prefix}...
      </code>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              onClick={copy}
              aria-label={`Copy identifier for ${name}`}
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
              {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
            </button>
          }
        >
          <TooltipContent>{copied ? "Copied" : "Copy identifier"}</TooltipContent>
        </TooltipTrigger>
      </Tooltip>
    </div>
  );
}
