"use client";

import { useActionState, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CopyableSecretDialog } from "@/components/copyable-secret-dialog";
import { inviteMemberAction, type InviteMemberFormState } from "./actions";

const initialState: InviteMemberFormState = { error: null, inviteLink: null };

export function InviteForm({ roles }: { roles: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(inviteMemberAction, initialState);
  // Dialog auto-opens whenever a fresh inviteLink lands in state; tracking
  // which link was already dismissed (rather than a separate open flag set
  // from an effect) keeps this a pure render-time derivation.
  const [dismissedLink, setDismissedLink] = useState<string | null>(null);
  const dialogOpen = state.inviteLink !== null && state.inviteLink !== dismissedLink;

  return (
    <>
      <form action={formAction} className="flex flex-wrap items-end gap-4">
        {state.error ? <div className="field-error w-full">{state.error}</div> : null}
        <div className="field">
          <label className="field-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            className="field-value input"
            type="email"
            required
            placeholder="teammate@example.com"
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="roleId">
            Role (optional)
          </label>
          <div>
            <Select name="roleId" items={roles.map((role) => ({ value: role.id, label: role.name }))}>
              <SelectTrigger id="roleId" className="w-full bg-transparent">
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
        </div>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Inviting..." : "Send invite"}
        </button>
      </form>

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
