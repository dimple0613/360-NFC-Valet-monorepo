"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormik } from "formik";
import * as Yup from "yup";
import { toast } from "sonner";
import { forgotPasswordAction } from "./actions";

export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false);

  const formik = useFormik({
    initialValues: { email: "" },
    validationSchema: Yup.object({
      email: Yup.string().email("Enter a valid email address").required("Email is required"),
    }),
    onSubmit: async (values, { setSubmitting }) => {
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
      </div>
    );
  }

  const showEmailError = formik.touched.email && formik.errors.email;

  return (
    <div>
      <div className="login-title">Reset your password</div>
      <div className="login-desc">We&apos;ll email you a link to reset it</div>
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
