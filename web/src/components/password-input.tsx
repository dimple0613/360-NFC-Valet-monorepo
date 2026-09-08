"use client";

import { useState } from "react";
import type { InputHTMLAttributes } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";

interface PasswordInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Extra class for the horizontal wrapper (defaults to a full-width flex row so the eye sits inline with the input). */
  containerClassName?: string;
}

/**
 * Single source of truth for the show/hide password eye toggle — same
 * "Toggle password visibility" affordance login exposes, reused across every
 * password input in the app (login, signup, reset-password, invite-accept,
 * change-password, and the console `FormField`). Spreading standard input
 * props means it drops into any form (Formik or server-action) unchanged.
 */
export function PasswordInput({ className, containerClassName, style, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={containerClassName} style={{ width: "100%", display: "flex", alignItems: "center", gap: 6 }}>
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={className}
        style={{ ...style, flex: 1, minWidth: 0 }}
      />
      <button
        type="button"
        aria-label="Toggle password visibility"
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          padding: 4,
          borderRadius: 8,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          color: "#6c7a93",
        }}
      >
        {visible ? <EyeOffIcon size={19} strokeWidth={2} /> : <EyeIcon size={19} strokeWidth={2} />}
      </button>
    </div>
  );
}