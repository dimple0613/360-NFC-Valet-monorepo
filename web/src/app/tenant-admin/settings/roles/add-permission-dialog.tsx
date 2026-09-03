"use client";

import { useState } from "react";
import { toast } from "sonner";
import { XIcon, PlusIcon } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PermissionPicker } from "@/components/permission-picker";
import { updateRolePermissionsAction } from "./actions";

export function AddPermissionDialog({
  roleId,
  roleName,
  catalog,
  selected,
}: {
  roleId: string;
  roleName: string;
  catalog: { id: string; key: string; description: string | null }[];
  selected: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  function handleSave(formData: FormData) {
    setPending(true);
    try {
      updateRolePermissionsAction(roleId, formData);
      toast.success("Permissions saved.");
    } finally {
      setPending(false);
      setOpen(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="super-console inline-flex items-center gap-2"
        style={{
          background: "#f4531f",
          color: "#fff",
          borderRadius: 99,
          padding: "10px 20px",
          fontSize: 12.5,
          fontWeight: 800,
          letterSpacing: "1.2px",
          whiteSpace: "nowrap",
          boxShadow: "0 4px 16px rgba(16,22,35,0.05)",
          transition: "background 0.15s ease",
          border: "none",
          cursor: "pointer",
        }}
      >
        <PlusIcon className="size-4" />
        Add permission
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="sm:max-w-[560px]"
          showCloseButton={false}
          style={{ borderRadius: 20, padding: 24 }}
        >
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <div className="text-[17px] font-extrabold text-[#1c2b46]">{roleName} · permissions</div>
              <div className="text-[12.5px] font-medium text-[#6c7a93] mt-0.5">
                Tick the permissions this role should grant.
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
              }}
            >
              <XIcon size={16} />
            </button>
          </div>
          <div className="super-console">
            <form action={handleSave} className="flex flex-col gap-4">
              <div className="overflow-y-auto max-h-[50vh] rounded-lg border border-[#e7eaf0] p-3">
                <PermissionPicker
                  catalog={catalog}
                  inputName="permissionIds"
                  valueField="id"
                  defaultSelected={selected}
                />
              </div>
              <button type="submit" className="btn-primary w-fit" disabled={pending}>
                {pending ? "Saving..." : "Save permissions"}
              </button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
