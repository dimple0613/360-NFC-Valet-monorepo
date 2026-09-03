"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormik } from "formik";
import * as Yup from "yup";
import { toast } from "sonner";
import { resetPasswordAction, type ResetPasswordFormState } from "./actions";

function EyeIcon({ size = 19, color = "#6C7A93" }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [showPw, setShowPw] = useState(false);

  const formik = useFormik({
    initialValues: { password: "", confirmPassword: "" },
    validationSchema: Yup.object({
      password: Yup.string()
        .min(12, "Password must be at least 12 characters.")
        .required("New password is required."),
      confirmPassword: Yup.string()
        .oneOf([Yup.ref("password")], "Passwords do not match.")
        .required("Please confirm your password."),
    }),
    onSubmit: async (values, { setSubmitting }) => {
      const formData = new FormData();
      formData.set("token", token);
      formData.set("password", values.password);
      let state: ResetPasswordFormState | null = null;
      try {
        state = await resetPasswordAction({ error: null }, formData);
      } catch {
        // resetPasswordAction() redirects on success; the awaited call throws
        // NEXT_REDIRECT, which we treat as success.
        state = null;
      }
      if (state?.error) toast.error(state.error);
      setSubmitting(false);
    },
  });

  if (!token) {
    return (
      <div className="login-form">
        <div className="login-title">Invalid reset link</div>
        <div className="login-desc">
          Please request a new password reset from the login page.
        </div>
        <Link
          className="btn-login"
          href="/forgot-password"
          style={{ display: "block", marginTop: 26, textDecoration: "none" }}
        >
          Request new reset link
        </Link>
        <Link
          className="btn-sso back-link"
          href="/login"
          style={{ display: "block", marginTop: 16, textDecoration: "none" }}
        >
          ← Back to sign in
        </Link>
      </div>
    );
  }

  const showPwError = !!(formik.touched.password && formik.errors.password);
  const showCpError = !!(formik.touched.confirmPassword && formik.errors.confirmPassword);

  return (
    <form className="login-form" onSubmit={formik.handleSubmit} noValidate>
      <input type="hidden" name="token" value={token} />
      <div className="login-title">Set a new password</div>
      <div className="login-desc">It must be at least 12 characters.</div>
      <div className="login-fields">
        <div>
          <div className={`login-field${showPwError ? " login-field-error" : ""}`}>
            <div style={{ flex: 1 }}>
              <label className="login-field-label" htmlFor="rp-pw">
                New password
              </label>
              <input
                id="rp-pw"
                name="password"
                type={showPw ? "text" : "password"}
                className="login-field-input dots"
                placeholder="••••••••••"
                value={formik.values.password}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                autoComplete="new-password"
              />
            </div>
            <button
              type="button"
              className="icon-btn"
              aria-label="Toggle password visibility"
              onClick={() => setShowPw((v) => !v)}
            >
              <EyeIcon />
            </button>
          </div>
          {showPwError ? <div className="field-error">{formik.errors.password}</div> : null}
        </div>
        <div>
          <div className={`login-field${showCpError ? " login-field-error" : ""}`}>
            <div style={{ flex: 1 }}>
              <label className="login-field-label" htmlFor="rp-cpw">
                Confirm password
              </label>
              <input
                id="rp-cpw"
                name="confirmPassword"
                type={showPw ? "text" : "password"}
                className="login-field-input dots"
                placeholder="••••••••••"
                value={formik.values.confirmPassword}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                autoComplete="new-password"
              />
            </div>
            <button
              type="button"
              className="icon-btn"
              aria-label="Toggle password visibility"
              onClick={() => setShowPw((v) => !v)}
            >
              <EyeIcon />
            </button>
          </div>
          {showCpError ? <div className="field-error">{formik.errors.confirmPassword}</div> : null}
        </div>
      </div>
      <button className="btn-login" type="submit" disabled={formik.isSubmitting}>
        {formik.isSubmitting ? "Updating…" : "Update password"}
      </button>
      <Link className="btn-sso back-link" href="/login" style={{ display: "block", textDecoration: "none" }}>
        ← Back to sign in
      </Link>
    </form>
  );
}
