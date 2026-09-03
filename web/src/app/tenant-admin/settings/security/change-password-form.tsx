"use client";

import { useActionState } from "react";
import { changePasswordAction, type ChangePasswordState } from "./actions";

const initialState: ChangePasswordState = { error: null, success: false };

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialState);

  return (
    <form action={formAction} key={state.success ? "reset" : "form"} className="flex flex-col gap-4">
      {state.error ? (
        <div className="field-error">{state.error}</div>
      ) : null}
      {state.success ? (
        <div className="text-sm font-semibold text-[#1c2b46]">
          Password changed. Your other sessions have been signed out.
        </div>
      ) : null}
      <div className="field">
        <label className="field-label" htmlFor="currentPassword">
          Current password
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          className="field-value input"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="newPassword">
          New password
        </label>
        <input
          id="newPassword"
          name="newPassword"
          className="field-value input"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="confirmPassword">
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          className="field-value input"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>
      <button type="submit" className="btn-primary w-fit" disabled={pending}>
        {pending ? "Changing..." : "Change password"}
      </button>
    </form>
  );
}
