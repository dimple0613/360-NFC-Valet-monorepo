"use client";

import { useState } from "react";
import { useActionState } from "react";
import { CopyableSecretDialog } from "@/components/copyable-secret-dialog";
import { PermissionPicker } from "@/components/permission-picker";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PlusIcon, XIcon } from "lucide-react";
import { createApiKeyAction, type CreateApiKeyState } from "./api-keys-actions";

const initialState: CreateApiKeyState = { error: null, createdKey: null };

interface ScopeDef {
  id: string;
  key: string;
  description: string | null;
}

export function AddApiKeyDialog({
  scopeCatalog,
  canManage,
}: {
  scopeCatalog: ScopeDef[];
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createApiKeyAction, initialState);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const dialogOpen = state.createdKey !== null && state.createdKey.rawKey !== dismissedKey;

  if (!canManage) return null;

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
        Add key
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="sm:max-w-[460px]"
          showCloseButton={false}
          style={{ borderRadius: 20, padding: 24 }}
        >
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <div className="text-[17px] font-extrabold text-[#1c2b46]">Create an API key</div>
              <div className="text-[12.5px] font-medium text-[#6c7a93] mt-0.5">
                A credential for the versioned REST API (/api/v1), scoped to what it&apos;s allowed to do.
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
            <form
              action={formAction}
              key={state.createdKey ? state.createdKey.rawKey : "form"}
              className="flex flex-col gap-4"
            >
              {state.error ? <div className="field-error">{state.error}</div> : null}
              <div className="field">
                <label className="field-label" htmlFor="api-key-name">
                  New key name
                </label>
                <input id="api-key-name" name="name" className="field-value input" placeholder="e.g. CI integration" required />
              </div>
              <div className="field">
                <div className="field-label">Scopes</div>
                <p className="mb-2 text-[12px] font-medium text-[#6c7a93]">
                  What this key is allowed to do — grant only what&apos;s needed.
                </p>
                <PermissionPicker catalog={scopeCatalog} inputName="scopes" valueField="key" />
              </div>
              <button type="submit" className="btn-primary w-fit" disabled={pending}>
                {pending ? "Creating..." : "Create API key"}
              </button>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {state.createdKey ? (
        <CopyableSecretDialog
          open={dialogOpen}
          onOpenChange={(next) => {
            if (!next) setDismissedKey(state.createdKey!.rawKey);
          }}
          title={`"${state.createdKey.name}" created`}
          description="This is the only time the full key is shown."
          value={state.createdKey.rawKey}
        />
      ) : null}
    </>
  );
}
