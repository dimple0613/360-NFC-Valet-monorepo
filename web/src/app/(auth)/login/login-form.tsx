"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormik } from "formik";
import * as Yup from "yup";
import { toast } from "sonner";
import { CheckIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { loginAction } from "./actions";

export interface AdapterLoginOption {
  id: string;
  displayName: string;
}

const SCHEMA = Yup.object({
  email: Yup.string().email("Enter a valid email address.").required("Work email is required."),
  password: Yup.string().required("Password is required."),
});

export function LoginForm({
  oauthError,
  showGoogle,
  showApple,
  adapterProviders = [],
}: {
  oauthError: string | null;
  showGoogle: boolean;
  showApple: boolean;
  /** Registry-driven providers (oauth-registry.ts) that report as configured+enabled right now — e.g. Microsoft/Entra ID once a Super Admin sets it up. Unlike showGoogle/showApple, this list isn't hardcoded here: a brand-new adapter shows up with zero changes to this component. */
  adapterProviders?: AdapterLoginOption[];
}) {
  const [showPw, setShowPw] = useState(false);
  const [keep, setKeep] = useState(true);

  const hasOAuthOptions = showGoogle || showApple || adapterProviders.length > 0;

  const formik = useFormik({
    initialValues: { email: "", password: "" },
    validationSchema: SCHEMA,
    onSubmit: async (values, { setSubmitting }) => {
      const formData = new FormData();
      formData.set("email", values.email);
      formData.set("password", values.password);
      let state;
      try {
        state = await loginAction({ error: null }, formData);
      } catch {
        // loginAction redirect()s on success — Next handles the navigation and
        // the awaited call throws NEXT_REDIRECT, which we treat as success.
        state = null;
      }
      if (state?.error) toast.error(state.error);
      setSubmitting(false);
    },
  });

  const showEmailError = !!(formik.touched.email && formik.errors.email);
  const showPasswordError = !!(formik.touched.password && formik.errors.password);

  return (
    <div>
      {oauthError ? (
        <div className="login-error">{oauthError}</div>
      ) : null}
      <div className="login-title">Welcome back</div>
      <div className="login-desc">Sign in to your saasclaude account</div>
      <form className="login-form" onSubmit={formik.handleSubmit} noValidate>
        {hasOAuthOptions ? (
          <>
            {/* Real <a> tags, not next/link, are deliberate here: these hit
                GET Route Handlers (login/google, login/apple,
                login/[provider]) that 307-redirect to the provider's own
                authorize endpoint — a genuine full navigation, not an
                internal page transition. next/link's client-side router
                expects an RSC payload back and isn't the right tool for
                triggering a plain HTTP redirect. */}
            {showGoogle ? (
              // eslint-disable-next-line @next/next/no-html-link-for-pages
              <a href="/login/google" className="btn-sso" style={{ display: "block" }}>
                Continue with Google
              </a>
            ) : null}
            {showApple ? (
              // eslint-disable-next-line @next/next/no-html-link-for-pages
              <a href="/login/apple" className="btn-sso" style={{ display: "block" }}>
                Continue with Apple
              </a>
            ) : null}
            {adapterProviders.map((provider) => (
              <a key={provider.id} href={`/login/${provider.id}`} className="btn-sso" style={{ display: "block" }}>
                Continue with {provider.displayName}
              </a>
            ))}
            <div className="login-divider">
              <span>or</span>
            </div>
          </>
        ) : null}

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
          <div>
            <div className={`login-field${showPasswordError ? " login-field-error" : ""}`}>
              <div style={{ flex: 1 }}>
                <label className="login-field-label" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type={showPw ? "text" : "password"}
                  className="login-field-input dots"
                  placeholder="••••••••••"
                  value={formik.values.password}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  autoComplete="current-password"
                  aria-invalid={showPasswordError ? "true" : undefined}
                />
              </div>
              <button
                type="button"
                className="icon-btn"
                aria-label="Toggle password visibility"
                onClick={() => setShowPw((v) => !v)}
              >
                {showPw ? <EyeOffIcon size={19} strokeWidth={2} /> : <EyeIcon size={19} strokeWidth={2} />}
              </button>
            </div>
            {showPasswordError ? <div className="field-error">{formik.errors.password}</div> : null}
          </div>
        </div>

        <div className="login-row">
          <button
            type="button"
            className="checkbox"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
            onClick={() => setKeep((v) => !v)}
          >
            <div className={`checkbox-box${keep ? " checked" : ""}`}>
              <CheckIcon size={11} strokeWidth={4} />
            </div>
            <span className="checkbox-label">Keep me signed in</span>
          </button>
          <Link className="forgot" href="/forgot-password">
            Forgot your password?
          </Link>
        </div>

        <button className="btn-login" type="submit" disabled={formik.isSubmitting}>
          {formik.isSubmitting ? "Signing in…" : "Sign in"}
        </button>

        <div className="login-create">
          Don&apos;t have an organization yet?{" "}
          <Link className="forgot" href="/signup">
            Create one
          </Link>
        </div>
      </form>
    </div>
  );
}
