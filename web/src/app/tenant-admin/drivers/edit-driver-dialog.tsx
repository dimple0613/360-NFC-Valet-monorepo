"use client";

import { useState } from "react";
import { PencilIcon, XIcon } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useRouter } from "next/navigation";
import { DriverForm } from "./driver-form";
import type { DriverTableItem } from "../_lib/valet-data";

export function EditDriverDialog({
  driver,
  fields,
}: {
  driver: DriverTableItem;
  fields: { id: number; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label={`Edit ${driver.name}`}
              onClick={() => setOpen(true)}
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
      <DialogContent
        className="sm:max-w-[460px]"
        showCloseButton={false}
        style={{ borderRadius: 20, padding: 24 }}
      >
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <div className="text-[17px] font-extrabold text-[#1c2b46]">Edit driver</div>
            <div className="text-[12.5px] font-medium text-[#6c7a93] mt-0.5">
              Update {driver.name}&apos;s profile and assignment.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
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
        <div className="super-console">
          <DriverForm
            driverId={driver.id}
            fields={fields}
            submitLabel="Save changes"
            defaults={{
              name: driver.name,
              propertyId: driver.propertyId ? String(driver.propertyId) : "",
              email: driver.email ?? "",
              phone: driver.phone ?? "",
              emiratesId: driver.emiratesId ?? "",
              licenseNumber: driver.licenseNumber ?? "",
              nationality: driver.nationality ?? "",
              emergencyContact: driver.emergencyContact ?? "",
            }}
            onSuccess={() => {
              setOpen(false);
              router.refresh();
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
