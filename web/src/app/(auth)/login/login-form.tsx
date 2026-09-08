"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useFormik } from "formik";
import * as Yup from "yup";
import { toast } from "sonner";
import { CheckIcon } from "lucide-react";
import type { CaptchaProvider } from "@saasclaude/db";
import { loginAction } from "./actions";
import { CaptchaWidget, type CaptchaWidgetHandle } from "@/components/captcha-widget";
import { PasswordInput } from "@/components/password-input";

export interface AdapterLoginOption {
  id: string;
  displayName: string;
}

export interface AuthCaptchaConfig {
  provider: CaptchaProvider;
  siteKey: string | null;
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
  title = "Welcome back",
  subtitle = "Sign in to your saasclaude account",
  captcha,
}: {
  oauthError: string | null;
  showGoogle: boolean;
  showApple: boolean;
  /** Registry-driven providers (oauth-registry.ts) that report as configured+enabled right now — e.g. Microsoft/Entra ID once a Super Admin sets it up. Unlike showGoogle/showApple, this list isn't hardcoded here: a brand-new adapter shows up with zero changes to this component. */
  adapterProviders?: AdapterLoginOption[];
  /** Configurable via Settings > Pages & content — defaults keep the historical copy. */
  title?: string;
  subtitle?: string;
  /** CAPTCHA config from Settings > General > Security defaults; renders the widget and verifies the token when a provider is configured. */
  captcha?: AuthCaptchaConfig;
}) {
const [keep, setKeep] = useState(true);
  const captchaRef = useRef<CaptchaWidgetHandle>(null);

  const captchaEnabled = !!captcha && captcha.provider !== "none" && !!captcha.siteKey;

  const hasOAuthOptions = showGoogle || showApple || adapterProviders.length > 0;

  const formik = useFormik({
    initialValues: { email: "", password: "" },
    validationSchema: SCHEMA,
    onSubmit: async (values, { setSubmitting }) => {
      if (captchaEnabled) {
        const token = (await captchaRef.current?.getToken()) ?? null;
        if (!token) {
          toast.error("Please complete the security check before signing in.");
          setSubmitting(false);
          return;
        }
        const formData = new FormData();
        formData.set("email", values.email);
        formData.set("password", values.password);
        formData.set("captchaToken", token);
        let state;
        try {
          state = await loginAction({ error: null }, formData);
        } catch {
          state = null;
        }
        if (state?.error) toast.error(state.error);
        captchaRef.current?.reset();
        setSubmitting(false);
        return;
      }
      const formData = new FormData();
      formData.set("email", values.email);
      formData.set("password", values.password);
      let state;
      try {
        // loginAction redirect()s on success — Next handles the navigation and
        // the awaited call throws NEXT_REDIRECT, which we treat as success.
        state = await loginAction({ error: null }, formData);
      } catch {
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
      <div className="login-title">{title}</div>
      <div className="login-desc">{subtitle}</div>
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
                <PasswordInput
                  id="password"
                  name="password"
                  className="login-field-input dots"
                  placeholder="••••••••••"
                  value={formik.values.password}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  autoComplete="current-password"
                  aria-invalid={showPasswordError ? "true" : undefined}
                />
              </div>
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

        <CaptchaWidget ref={captchaRef} provider={captcha?.provider ?? "none"} siteKey={captcha?.siteKey ?? null} action="login" />

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
