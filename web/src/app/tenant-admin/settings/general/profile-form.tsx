"use client";

import { useActionState } from "react";
import { updateProfileAction, type UpdateProfileFormState } from "./actions";

const initialState: UpdateProfileFormState = { error: null, success: false };

export function ProfileForm({ currentName }: { currentName: string }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialState);

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
          Organization name
        </label>
        <input id="name" name="name" className="field-value input" defaultValue={currentName} required />
      </div>
      <button type="submit" className="btn-primary w-fit" disabled={pending}>
        {pending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
