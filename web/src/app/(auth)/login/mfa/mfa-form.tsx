"use client";

import { useFormik } from "formik";
import * as Yup from "yup";
import { toast } from "sonner";
import { mfaChallengeAction, type MfaChallengeFormState } from "./actions";

export function MfaForm() {
  const formik = useFormik({
    initialValues: { code: "" },
    validationSchema: Yup.object({
      code: Yup.string().required("Enter the verification code."),
    }),
    onSubmit: async (values, { setSubmitting }) => {
      const formData = new FormData();
      formData.set("code", values.code);
      let state: MfaChallengeFormState | null = null;
      try {
        state = await mfaChallengeAction({ error: null }, formData);
      } catch {
        // mfaChallengeAction redirect()s on success — Next handles the navigation
        // and the awaited call throws NEXT_REDIRECT, which we treat as success.
        state = null;
      }
      if (state?.error) toast.error(state.error);
      setSubmitting(false);
    },
  });

  const showCodeError = !!(formik.touched.code && formik.errors.code);

  return (
    <div>
      <div className="login-title">Two-factor verification</div>
      <div className="login-desc">
        Enter the 6-digit code from your authenticator app, or a recovery code.
      </div>
      <form className="login-form" onSubmit={formik.handleSubmit} noValidate>
        <div className="login-fields">
          <div>
            <div className={`login-field${showCodeError ? " login-field-error" : ""}`}>
              <div style={{ flex: 1 }}>
                <label className="login-field-label" htmlFor="code">
                  Code
                </label>
                <input
                  id="code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  className="login-field-input dots"
                  placeholder="••••••"
                  value={formik.values.code}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                />
              </div>
            </div>
            {showCodeError ? <div className="field-error">{formik.errors.code}</div> : null}
          </div>
        </div>
        <button className="btn-login" type="submit" disabled={formik.isSubmitting}>
          {formik.isSubmitting ? "Verifying..." : "Verify"}
        </button>
      </form>
    </div>
  );
}
