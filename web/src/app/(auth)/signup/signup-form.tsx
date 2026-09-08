"use client";

import { useRef } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { toast } from "sonner";
import Link from "next/link";
import { signupAction, type SignupFormState } from "./actions";
import { CaptchaWidget, type CaptchaWidgetHandle } from "@/components/captcha-widget";
import { PasswordInput } from "@/components/password-input";
import type { AuthCaptchaConfig } from "../login/login-form";

const SCHEMA = Yup.object({
  organizationName: Yup.string().required("Organization name is required."),
  name: Yup.string().required("Your name is required."),
  email: Yup.string().email("Enter a valid email address.").required("Email is required."),
  password: Yup.string().min(12, "Password must be at least 12 characters.").required("Password is required."),
});

export function SignupForm({
  title = "Create your organization",
  subtitle = "Set up your organization in a minute",
  captcha,
}: {
  /** Configurable via Settings > Pages & content — defaults keep the historical copy. */
  title?: string;
  subtitle?: string;
  /** CAPTCHA config from Settings > General > Security defaults; renders the widget and verifies the token when a provider is configured. */
  captcha?: AuthCaptchaConfig;
}) {
  const captchaRef = useRef<CaptchaWidgetHandle>(null);
  const captchaEnabled = !!captcha && captcha.provider !== "none" && !!captcha.siteKey;

  const formik = useFormik({
    initialValues: { organizationName: "", name: "", email: "", password: "" },
    validationSchema: SCHEMA,
    onSubmit: async (values, { setSubmitting }) => {
      if (captchaEnabled) {
        const token = (await captchaRef.current?.getToken()) ?? null;
        if (!token) {
          toast.error("Please complete the security check before creating your account.");
          setSubmitting(false);
          return;
        }
        const formData = new FormData();
        formData.set("organizationName", values.organizationName);
        formData.set("name", values.name);
        formData.set("email", values.email);
        formData.set("password", values.password);
        formData.set("captchaToken", token);
        let state: SignupFormState | null = null;
        try {
          state = await signupAction({ error: null }, formData);
        } catch {
          state = null;
        }
        if (state?.error) toast.error(state.error);
        captchaRef.current?.reset();
        setSubmitting(false);
        return;
      }
      const formData = new FormData();
      formData.set("organizationName", values.organizationName);
      formData.set("name", values.name);
      formData.set("email", values.email);
      formData.set("password", values.password);
      let state: SignupFormState | null = null;
      try {
        // signupAction redirect()s on success — Next handles the navigation and
        // the awaited call throws NEXT_REDIRECT, which we treat as success.
        state = await signupAction({ error: null }, formData);
      } catch {
        state = null;
      }
      if (state?.error) toast.error(state.error);
      setSubmitting(false);
    },
  });

  const showOrgError = !!(formik.touched.organizationName && formik.errors.organizationName);
  const showNameError = !!(formik.touched.name && formik.errors.name);
  const showEmailError = !!(formik.touched.email && formik.errors.email);
  const showPasswordError = !!(formik.touched.password && formik.errors.password);

  return (
    <div>
      <div className="login-title">{title}</div>
      <div className="login-desc">{subtitle}</div>
      <form className="login-form" onSubmit={formik.handleSubmit} noValidate>
        <div className="login-fields">
          <div>
            <div className="login-field">
              <div style={{ flex: 1 }}>
                <label className="login-field-label" htmlFor="organizationName">
                  Organization name
                </label>
                <input
                  id="organizationName"
                  name="organizationName"
                  type="text"
                  className="login-field-input"
                  value={formik.values.organizationName}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  autoComplete="organization"
                />
              </div>
            </div>
            {showOrgError ? <div className="field-error">{formik.errors.organizationName}</div> : null}
          </div>
          <div>
            <div className="login-field">
              <div style={{ flex: 1 }}>
                <label className="login-field-label" htmlFor="name">
                  Your name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  className="login-field-input"
                  value={formik.values.name}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  autoComplete="name"
                />
              </div>
            </div>
            {showNameError ? <div className="field-error">{formik.errors.name}</div> : null}
          </div>
          <div>
            <div className="login-field">
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
                />
              </div>
            </div>
            {showEmailError ? <div className="field-error">{formik.errors.email}</div> : null}
          </div>
          <div>
            <div className="login-field">
              <div style={{ flex: 1 }}>
                <label className="login-field-label" htmlFor="password">
                  Password
                </label>
                <PasswordInput
                  id="password"
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
            {showPasswordError ? <div className="field-error">{formik.errors.password}</div> : null}
          </div>
        </div>
        <CaptchaWidget ref={captchaRef} provider={captcha?.provider ?? "none"} siteKey={captcha?.siteKey ?? null} action="signup" />

        <button className="btn-login" type="submit" disabled={formik.isSubmitting}>
          {formik.isSubmitting ? "Creating account..." : "Create account"}
        </button>
        <div className="login-create">
          Already have an account?{" "}
          <Link className="forgot" href="/login">
            Sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
