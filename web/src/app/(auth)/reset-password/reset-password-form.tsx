"use client";

import { useRef } from "react";
import Link from "next/link";
import { useFormik } from "formik";
import * as Yup from "yup";
import { toast } from "sonner";
import { resetPasswordAction, type ResetPasswordFormState } from "./actions";
import { CaptchaWidget, type CaptchaWidgetHandle } from "@/components/captcha-widget";
import { PasswordInput } from "@/components/password-input";
import type { AuthCaptchaConfig } from "../login/login-form";

export function ResetPasswordForm({
  token,
  captcha,
}: {
  token: string;
  captcha?: AuthCaptchaConfig;
}) {
  const captchaRef = useRef<CaptchaWidgetHandle>(null);
  const captchaEnabled = !!captcha && captcha.provider !== "none" && !!captcha.siteKey;

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
      if (captchaEnabled) {
        const captchaToken = (await captchaRef.current?.getToken()) ?? null;
        if (!captchaToken) {
          toast.error("Please complete the security check before resetting your password.");
          setSubmitting(false);
          return;
        }
        const formData = new FormData();
        formData.set("token", token);
        formData.set("password", values.password);
        formData.set("captchaToken", captchaToken);
        let state: ResetPasswordFormState | null = null;
        try {
          state = await resetPasswordAction({ error: null }, formData);
        } catch {
          state = null;
        }
        if (state?.error) toast.error(state.error);
        captchaRef.current?.reset();
        setSubmitting(false);
        return;
      }
      const formData = new FormData();
      formData.set("token", token);
      formData.set("password", values.password);
      let state: ResetPasswordFormState | null = null;
      try {
        // resetPasswordAction() redirects on success; the awaited call throws
        // NEXT_REDIRECT, which we treat as success.
        state = await resetPasswordAction({ error: null }, formData);
      } catch {
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
              <PasswordInput
                id="rp-pw"
                name="password"
                className="login-field-input dots"
                placeholder="••••••••••"
                value={formik.values.password}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                autoComplete="new-password"
              />
            </div>
          </div>
          {showPwError ? <div className="field-error">{formik.errors.password}</div> : null}
        </div>
        <div>
          <div className={`login-field${showCpError ? " login-field-error" : ""}`}>
            <div style={{ flex: 1 }}>
              <label className="login-field-label" htmlFor="rp-cpw">
                Confirm password
              </label>
              <PasswordInput
                id="rp-cpw"
                name="confirmPassword"
                className="login-field-input dots"
                placeholder="••••••••••"
                value={formik.values.confirmPassword}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                autoComplete="new-password"
              />
            </div>
          </div>
          {showCpError ? <div className="field-error">{formik.errors.confirmPassword}</div> : null}
        </div>
      </div>
      <CaptchaWidget ref={captchaRef} provider={captcha?.provider ?? "none"} siteKey={captcha?.siteKey ?? null} action="reset-password" />

      <button className="btn-login" type="submit" disabled={formik.isSubmitting}>
        {formik.isSubmitting ? "Updating…" : "Update password"}
      </button>
      <Link className="btn-sso back-link" href="/login" style={{ display: "block", textDecoration: "none" }}>
        ← Back to sign in
      </Link>
    </form>
  );
}
