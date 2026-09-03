"use client";

import { Formik, Form } from "formik";
import * as yup from "yup";
import { toast } from "sonner";
import { FormField, FormSelectField } from "@/components/console-form-field";
import { createMemberAction } from "./actions";

const schema = yup.object({
  firstName: yup.string().required("First name is required."),
  lastName: yup.string().required("Last name is required."),
  email: yup.string().email("Enter a valid email.").required("Email is required."),
  password: yup.string().min(12, "Password must be at least 12 characters.").required("Password is required."),
  confirmPassword: yup.string().oneOf([yup.ref("password")], "Passwords must match.").required("Confirm password is required."),
  roleId: yup.string().required("Select a role."),
});

export function NewMemberForm({
  organizationId,
  roles,
  onSuccess,
}: {
  organizationId: string;
  roles: { id: string; name: string }[];
  onSuccess?: () => void;
}) {
  return (
    <Formik
      initialValues={{ firstName: "", lastName: "", email: "", password: "", confirmPassword: "", roleId: "" }}
      validationSchema={schema}
      onSubmit={async (values, { setSubmitting, resetForm }) => {
        try {
          const fd = new FormData();
          fd.append("organizationId", organizationId);
          fd.append("firstName", values.firstName);
          fd.append("lastName", values.lastName);
          fd.append("email", values.email);
          fd.append("password", values.password);
          fd.append("confirmPassword", values.confirmPassword);
          fd.append("roleId", values.roleId);
          const res = await createMemberAction({ error: null }, fd);
          if (res?.error) {
            toast.error(res.error);
            return;
          }
          toast.success("Member added.");
          resetForm();
          onSuccess?.();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Something went wrong.");
        } finally {
          setSubmitting(false);
        }
      }}
    >
      {({ isSubmitting }) => (
        <Form className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField name="firstName" label="First name" />
            <FormField name="lastName" label="Last name" />
          </div>
          <FormField name="email" label="Email" type="email" />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField name="password" label="New password" type="password" />
            <FormField name="confirmPassword" label="Confirm new password" type="password" />
          </div>
          <FormSelectField name="roleId" label="Role" options={roles.map((r) => ({ value: r.id, label: r.name }))} />
          <button
            type="submit"
            className="btn-primary w-fit"
            disabled={isSubmitting}
            style={{
              background: "#f4531f",
              color: "#fff",
              borderRadius: 99,
              padding: "10px 24px",
              fontSize: 13,
              fontWeight: 800,
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(244,83,31,0.25)",
            }}
          >
            {isSubmitting ? "Saving..." : "Save"}
          </button>
        </Form>
      )}
    </Formik>
  );
}
