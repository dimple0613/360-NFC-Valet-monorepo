"use client";

import { useState } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { DriverForm } from "./driver-form";

export function CreateDriverDialog({ fields }: { fields: { id: number; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2"
        style={{
          background: "#f4531f",
          color: "#fff",
          borderRadius: 99,
          padding: "10px 20px",
          fontSize: 12.5,
          fontWeight: 800,
          whiteSpace: "nowrap",
          boxShadow: "0 4px 16px rgba(16,22,35,0.05)",
          transition: "background 0.15s ease",
          border: "none",
          cursor: "pointer",
        }}
      >
        <PlusIcon className="size-4" />
        Add driver
      </button>
      <DialogContent
        className="sm:max-w-[460px]"
        showCloseButton={false}
        style={{ borderRadius: 20, padding: 24 }}
      >
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <div className="text-[17px] font-extrabold text-[#1c2b46]">Add driver</div>
            <div className="text-[12.5px] font-medium text-[#6c7a93] mt-0.5">
              Creates a driver account with auto-generated VD-ID.
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
            fields={fields}
            submitLabel="Add driver"
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
