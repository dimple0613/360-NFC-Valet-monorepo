"use client";

import Link from "next/link";
import { ScrollTextIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Console pill-style Logs link used in the subscription rows' actions column,
 * with a hover tooltip. Client component so base-ui's Tooltip (a client hook)
 * can wrap a server-rendered row's action.
 */
export function LogsPill({ href, label }: { href: string; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={href}
            aria-label={`Logs for ${label}`}
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
          />
        }
      >
        <ScrollTextIcon className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent>Logs</TooltipContent>
    </Tooltip>
  );
}