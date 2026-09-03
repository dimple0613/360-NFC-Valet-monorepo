"use client";

import { useFormik } from "formik";
import * as Yup from "yup";
import { toast } from "sonner";
import { nameOrganizationAction, type OrganizationNameFormState } from "./actions";

export function OrganizationNameForm() {
  const formik = useFormik({
    initialValues: { organizationName: "" },
    validationSchema: Yup.object({
      organizationName: Yup.string().required("Organization name is required."),
    }),
    onSubmit: async (values, { setSubmitting }) => {
      const formData = new FormData();
      formData.set("organizationName", values.organizationName);
      let state: OrganizationNameFormState | null = null;
      try {
        state = await nameOrganizationAction({ error: null }, formData);
      } catch {
        // nameOrganizationAction redirect()s on success — Next handles the
        // navigation and the awaited call throws NEXT_REDIRECT, which we treat
        // as success.
        state = null;
      }
      if (state?.error) toast.error(state.error);
      setSubmitting(false);
    },
  });

  const showOrgError = !!(formik.touched.organizationName && formik.errors.organizationName);

  return (
    <div>
      <div className="login-title">Name your organization</div>
      <div className="login-desc">One last step before your workspace is ready.</div>
      <form className="login-form" onSubmit={formik.handleSubmit} noValidate>
        <div className="login-fields">
          <div>
            <div className={`login-field${showOrgError ? " login-field-error" : ""}`}>
              <div style={{ flex: 1 }}>
                <label className="login-field-label" htmlFor="organizationName">
                  Organization name
                </label>
                <input
                  id="organizationName"
                  name="organizationName"
                  type="text"
                  autoFocus
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
        </div>
        <button className="btn-login" type="submit" disabled={formik.isSubmitting}>
          {formik.isSubmitting ? "Creating..." : "Continue"}
        </button>
      </form>
    </div>
  );
}
