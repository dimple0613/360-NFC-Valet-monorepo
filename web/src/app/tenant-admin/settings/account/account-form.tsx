"use client";

import { useActionState } from "react";
import { updateAccountAction, type UpdateAccountFormState } from "./actions";

const initialState: UpdateAccountFormState = { error: null, success: false };

export function AccountForm({ currentName, email }: { currentName: string | null; email: string }) {
  const [state, formAction, pending] = useActionState(updateAccountAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? (
        <div className="field-error">{state.error}</div>
      ) : null}
      {state.success ? (
        <div className="text-sm font-semibold text-[#1c2b46]">Saved.</div>
      ) : null}
      <div className="field">
        <label className="field-label" htmlFor="name">
          Name
        </label>
        <input id="name" name="name" className="field-value input" defaultValue={currentName ?? ""} required />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="email">
          Email
        </label>
        <input id="email" name="email" className="field-value input" value={email} disabled readOnly />
      </div>
      <button type="submit" className="btn-primary w-fit" disabled={pending}>
        {pending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
