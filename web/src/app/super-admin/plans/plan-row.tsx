"use client";

import Link from "next/link";
import { CopyIcon, PencilIcon } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusBadge, PLAN_VISIBILITY_STYLES } from "@/components/status-badge";
import { formatPrice } from "@/lib/format";

function VisibilityBadge({ visibility }: { visibility: string }) {
  return <StatusBadge value={visibility} styles={PLAN_VISIBILITY_STYLES} />;
}

function formatPriceWithCycle(priceCents: number | null, currency: string, billingCycle: string | null): string {
  if (priceCents === null || priceCents === 0) return "Free";
  const amount = formatPrice(priceCents, currency);
  return billingCycle === "YEARLY" ? `${amount} / year` : billingCycle === "MONTHLY" ? `${amount} / month` : amount;
}

export interface PlanRowData {
  id: string;
  key: string;
  name: string;
  description: string | null;
  visibility: string;
  priceCents: number | null;
  currency: string;
  billingCycle: string | null;
  subscriberCount: number;
}

export function PlanTableRow({ plan }: { plan: PlanRowData }) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-wrap items-center" style={{ gap: "11px" }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "#edf0fe",
              color: "#4a5fc9",
              fontSize: 12,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {plan.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <Link
              href={`/super-admin/plans/${plan.key}/edit`}
              className="text-[13px] font-bold text-[#1c2b46] decoration-transparent hover:text-[#f4531f] hover:underline"
            >
              {plan.name}
            </Link>
            {plan.description ? (
              <div className="text-[11px] font-medium text-[#6c7a93] truncate max-w-[300px]">{plan.description}</div>
            ) : null}
          </div>
        </div>
      </TableCell>

      <TableCell>
        <div className="text-[13px] font-bold text-[#1c2b46]">{formatPriceWithCycle(plan.priceCents, plan.currency, plan.billingCycle)}</div>
      </TableCell>

      <TableCell>
        <div className="text-[13px] font-bold text-[#1c2b46]">{plan.subscriberCount}</div>
      </TableCell>

      <TableCell>
        <VisibilityBadge visibility={plan.visibility} />
      </TableCell>

      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Link
                  href={`/super-admin/plans/${plan.key}/edit`}
                  aria-label={`Edit ${plan.name}`}
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
              <PencilIcon className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent>Edit</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Link
                  href={`/super-admin/plans/new?copyFrom=${plan.key}`}
                  aria-label={`Copy ${plan.name}`}
                  style={{
                    cursor: "pointer",
                    border: "none",
                    fontSize: 11,
                    fontWeight: 700,
                    background: "rgb(231, 247, 239)",
                    color: "rgb(12, 157, 97)",
                    padding: "8px 9px",
                    borderRadius: 999,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                />
              }
            >
              <CopyIcon className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent>Clone</TooltipContent>
          </Tooltip>
        </div>
      </TableCell>
    </TableRow>
  );
}
