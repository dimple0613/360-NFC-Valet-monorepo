"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useFormik } from "formik";
import * as Yup from "yup";
import { toast } from "sonner";
import { forgotPasswordAction, type ForgotPasswordFormState } from "./actions";
import { CaptchaWidget, type CaptchaWidgetHandle } from "@/components/captcha-widget";
import type { AuthCaptchaConfig } from "../login/login-form";

export function ForgotPasswordForm({
  title = "Reset your password",
  subtitle = "We'll email you a link to reset it",
  captcha,
}: {
  /** Configurable via Settings > Pages & content — defaults keep the historical copy. */
  title?: string;
  subtitle?: string;
  /** CAPTCHA config from Settings > General > Security defaults; renders the widget and verifies the token when a provider is configured. */
  captcha?: AuthCaptchaConfig;
}) {
  const [submitted, setSubmitted] = useState(false);
  const captchaRef = useRef<CaptchaWidgetHandle>(null);
  const captchaEnabled = !!captcha && captcha.provider !== "none" && !!captcha.siteKey;

  const formik = useFormik({
    initialValues: { email: "" },
    validationSchema: Yup.object({
      email: Yup.string().email("Enter a valid email address").required("Email is required"),
    }),
    onSubmit: async (values, { setSubmitting }) => {
      if (captchaEnabled) {
        const token = (await captchaRef.current?.getToken()) ?? null;
        if (!token) {
          toast.error("Please complete the security check before requesting a reset.");
          setSubmitting(false);
          return;
        }
        const formData = new FormData();
        formData.set("email", values.email);
        formData.set("captchaToken", token);
        let state: ForgotPasswordFormState | null = null;
        try {
          state = await forgotPasswordAction({ submitted: false }, formData);
        } catch {
          state = { submitted: false, error: "Something went wrong" };
        }
        if (state?.error) {
          toast.error(state.error);
          captchaRef.current?.reset();
          setSubmitting(false);
          return;
        }
        setSubmitted(true);
        toast.success("Reset link sent");
        setSubmitting(false);
        return;
      }
      try {
        const formData = new FormData();
        formData.set("email", values.email);
        await forgotPasswordAction({ submitted: false }, formData);
        setSubmitted(true);
        toast.success("Reset link sent");
      } catch {
        toast.error("Something went wrong");
      } finally {
        setSubmitting(false);
      }
    },
  });

  if (submitted) {
    return (
      <div className="login-form">
        <div className="login-title">Check your email</div>
        <div className="login-desc">
          If an account exists for that email, we&apos;ve sent a password reset link.
        </div>
        <Link
          className="btn-sso back-link"
          href="/login"
          style={{ display: "block", marginTop: 26, textDecoration: "none" }}
        >
          ← Back to sign in
        </Link>
      </div>
    );
  }

  const showEmailError = formik.touched.email && formik.errors.email;

  return (
    <div>
      <div className="login-title">{title}</div>
      <div className="login-desc">{subtitle}</div>
      <form className="login-form" onSubmit={formik.handleSubmit} noValidate>
        <div className="login-fields">
          <div>
            <div className={`login-field${showEmailError ? " login-field-error" : ""}`}>
              <div style={{ flex: 1 }}>
                <label className="login-field-label" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className="login-field-input"
                  placeholder="you@example.com"
                  value={formik.values.email}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  autoComplete="username"
                  aria-invalid={showEmailError ? "true" : undefined}
                />
              </div>
            </div>
            {showEmailError ? <div className="field-error">{formik.errors.email}</div> : null}
          </div>
        </div>
        <CaptchaWidget ref={captchaRef} provider={captcha?.provider ?? "none"} siteKey={captcha?.siteKey ?? null} action="forgot-password" />

        <button className="btn-login" type="submit" disabled={formik.isSubmitting}>
          {formik.isSubmitting ? "Sending..." : "Send reset link"}
        </button>
        <Link className="btn-sso back-link" href="/login" style={{ display: "block", textDecoration: "none" }}>
          ← Back to sign in
        </Link>
      </form>
    </div>
  );
}
