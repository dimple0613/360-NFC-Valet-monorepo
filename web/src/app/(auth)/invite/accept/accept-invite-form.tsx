"use client";

import { useFormik } from "formik";
import * as Yup from "yup";
import { toast } from "sonner";
import { acceptInviteAction, type AcceptInviteFormState } from "./actions";

export function AcceptInviteForm({ token }: { token: string }) {
  const formik = useFormik({
    initialValues: { name: "", password: "" },
    validationSchema: Yup.object({
      name: Yup.string().required("Your name is required."),
      password: Yup.string().min(12, "Password must be at least 12 characters.").required("Password is required."),
    }),
    onSubmit: async (values, { setSubmitting }) => {
      const formData = new FormData();
      formData.set("token", token);
      formData.set("name", values.name);
      formData.set("password", values.password);
      let state: AcceptInviteFormState | null = null;
      try {
        state = await acceptInviteAction({ error: null }, formData);
      } catch {
        // acceptInviteAction redirect()s on success — Next handles the navigation
        // and the awaited call throws NEXT_REDIRECT, which we treat as success.
        state = null;
      }
      if (state?.error) toast.error(state.error);
      setSubmitting(false);
    },
  });

  const showNameError = !!(formik.touched.name && formik.errors.name);
  const showPasswordError = !!(formik.touched.password && formik.errors.password);

  return (
    <div>
      <div className="login-title">Join the organization</div>
      <div className="login-desc">Set up your account to accept this invite</div>
      <form className="login-form" onSubmit={formik.handleSubmit} noValidate>
        <input type="hidden" name="token" value={token} />
        <div className="login-fields">
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
                <label className="login-field-label" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
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
        <button className="btn-login" type="submit" disabled={formik.isSubmitting}>
          {formik.isSubmitting ? "Joining..." : "Join organization"}
        </button>
      </form>
    </div>
  );
}
