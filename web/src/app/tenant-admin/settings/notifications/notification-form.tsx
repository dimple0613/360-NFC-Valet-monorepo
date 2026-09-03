"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { updateNotificationPreferencesAction, type UpdateNotificationPreferencesState } from "./actions";
import { NOTIFICATION_CATEGORIES } from "./categories";

const initialState: UpdateNotificationPreferencesState = { error: null, success: false };

export function NotificationForm({ enabled }: { enabled: Record<string, boolean> }) {
  const [state, formAction, pending] = useActionState(updateNotificationPreferencesAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.success ? (
        <div className="text-sm font-semibold text-[#1c2b46]">Saved.</div>
      ) : null}
      {state.error ? <div className="field-error">{state.error}</div> : null}
      <div className="flex flex-col gap-4">
        {NOTIFICATION_CATEGORIES.map((category) => (
          <label key={category.key} className="checkbox" htmlFor={category.key}>
            <input
              id={category.key}
              name={category.key}
              type="checkbox"
              defaultChecked={enabled[category.key] ?? true}
              className="hidden"
            />
            <span className="checkbox-box">
              <Check size={12} strokeWidth={3.5} color="#ffffff" />
            </span>
            <span className="checkbox-label grid gap-1">
              {category.label}
              <span className="block font-normal text-[12px] font-medium text-[#6c7a93]">
                {category.description}
              </span>
            </span>
          </label>
        ))}
      </div>
      <button type="submit" className="btn-primary w-fit" disabled={pending}>
        {pending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
