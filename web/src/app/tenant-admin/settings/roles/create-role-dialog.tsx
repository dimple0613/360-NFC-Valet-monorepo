"use client";

import { useState } from "react";
import { useActionState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PlusIcon, XIcon } from "lucide-react";
import { createRoleAction, type CreateRoleFormState } from "./actions";

const initialState: CreateRoleFormState = { error: null };

export function CreateRoleDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createRoleAction, initialState);

  return (
    <>
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
        Create role
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="sm:max-w-[460px]"
          showCloseButton={false}
          style={{ borderRadius: 20, padding: 24 }}
        >
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <div className="text-[17px] font-extrabold text-[#1c2b46]">Create a custom role</div>
              <div className="text-[12.5px] font-medium text-[#6c7a93] mt-0.5">
                Add a role name — you&apos;ll set its permissions and members here.
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
            <form action={formAction} className="flex flex-col gap-4">
              {state.error ? <div className="field-error">{state.error}</div> : null}
              <div className="field">
                <label className="field-label" htmlFor="role-name">
                  New role name
                </label>
                <input id="role-name" name="name" className="field-value input" required placeholder="e.g. Billing Manager" />
              </div>
              <button type="submit" className="btn-primary w-fit" disabled={pending}>
                {pending ? "Creating..." : "Create role"}
              </button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
