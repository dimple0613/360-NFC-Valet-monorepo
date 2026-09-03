"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { XIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { assignPlanAction } from "./actions";

/**
 * Fully externally-controlled (open/onOpenChange from the caller, no
 * DialogTrigger of its own) — this is opened from a DropdownMenuItem, and a
 * DialogTrigger nested inside one breaks: the menu unmounts on select before
 * the Dialog can claim focus. The row component owns the boolean and flips
 * it from the menu item's onSelect instead.
 */
export function AssignPlanDialog({
  open,
  onOpenChange,
  organizationId,
  organizationName,
  plans,
  currentPlanName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName: string;
  plans: { key: string; name: string }[];
  currentPlanName: string | null;
}) {
  const [planKey, setPlanKey] = useState(plans[0]?.key ?? "");
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    if (!planKey) return;
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("planKey", planKey);
        await assignPlanAction(organizationId, formData);
        toast.success(`Plan assigned to ${organizationName}.`);
        onOpenChange(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[460px]"
        showCloseButton={false}
        style={{ borderRadius: 20, padding: 24 }}
      >
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <div className="text-[17px] font-extrabold text-[#1c2b46]">Assign plan</div>
            <div className="text-[12.5px] font-medium text-[#6c7a93] mt-0.5">
              {organizationName}
              {currentPlanName ? ` is currently on "${currentPlanName}".` : " has no active subscription."}
            </div>
          </div>
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
        </div>
        <div className="super-console flex flex-col gap-4">
          <Select name="planKey" value={planKey} items={plans.map((p) => ({ value: p.key, label: p.name }))} onValueChange={(v) => setPlanKey(String(v))}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a plan" />
            </SelectTrigger>
            <SelectContent>
              {plans.map((p) => (
                <SelectItem key={p.key} value={p.key}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="button"
            disabled={pending || !planKey}
            onClick={handleSubmit}
            className="btn-primary w-fit"
            style={{
              background: "#f4531f",
              color: "#fff",
              borderRadius: 99,
              padding: "10px 24px",
              fontSize: 13,
              fontWeight: 800,
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(244,83,31,0.25)",
            }}
          >
            {pending ? "Assigning..." : "Assign plan"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
