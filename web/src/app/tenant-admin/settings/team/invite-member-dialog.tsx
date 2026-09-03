"use client";

import { useState } from "react";
import { useActionState } from "react";
import { CopyableSecretDialog } from "@/components/copyable-secret-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PlusIcon, XIcon } from "lucide-react";
import { inviteMemberAction, type InviteMemberFormState } from "./actions";

const initialState: InviteMemberFormState = { error: null, inviteLink: null };

export function InviteMemberDialog({ roles }: { roles: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(inviteMemberAction, initialState);
  const [dismissedLink, setDismissedLink] = useState<string | null>(null);
  const dialogOpen = state.inviteLink !== null && state.inviteLink !== dismissedLink;

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
        Invite member
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="sm:max-w-[460px]"
          showCloseButton={false}
          style={{ borderRadius: 20, padding: 24 }}
        >
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <div className="text-[17px] font-extrabold text-[#1c2b46]">Invite a team member</div>
              <div className="text-[12.5px] font-medium text-[#6c7a93] mt-0.5">
                Send an invite link — they&apos;ll join your organization when they accept.
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
              key={state.inviteLink ?? "form"}
              className="flex flex-col gap-4"
            >
              {state.error ? <div className="field-error">{state.error}</div> : null}
              <div className="field">
                <label className="field-label" htmlFor="invite-email">
                  Email
                </label>
                <input
                  id="invite-email"
                  name="email"
                  className="field-value input"
                  type="email"
                  required
                  placeholder="teammate@example.com"
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="invite-roleId">
                  Role (optional)
                </label>
                <Select name="roleId" items={roles.map((role) => ({ value: role.id, label: role.name }))}>
                  <SelectTrigger id="invite-roleId" className="w-full bg-transparent">
                    <SelectValue placeholder="No role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <button type="submit" className="btn-primary w-fit" disabled={pending}>
                {pending ? "Inviting..." : "Send invite"}
              </button>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {state.inviteLink ? (
        <CopyableSecretDialog
          open={dialogOpen}
          onOpenChange={(next) => {
            if (!next) setDismissedLink(state.inviteLink);
          }}
          title="Invite sent"
          description="No email provider is configured yet, so here's the invite link directly — send it to your teammate yourself."
          value={state.inviteLink}
        />
      ) : null}
    </>
  );
}
