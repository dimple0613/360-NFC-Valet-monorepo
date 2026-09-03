"use client";

import { Formik, Form } from "formik";
import * as yup from "yup";
import { toast } from "sonner";
import { FormField, FormSelectField } from "@/components/console-form-field";
import { assignPlatformAdminAction } from "./actions";

const schema = yup.object({
  email: yup.string().email("Enter a valid email.").required("Email is required."),
  platformRoleId: yup.string().required("Select a role."),
});

export function AssignAdminForm({
  roles,
  onSuccess,
}: {
  roles: { id: string; name: string }[];
  onSuccess?: () => void;
}) {
  return (
    <Formik
      initialValues={{ email: "", platformRoleId: "" }}
      validationSchema={schema}
      onSubmit={async (values, { setSubmitting, resetForm }) => {
        try {
          const fd = new FormData();
          fd.append("email", values.email);
          fd.append("platformRoleId", values.platformRoleId);
          const result = await assignPlatformAdminAction({ error: null }, fd);
          if (result.error) {
            toast.error(result.error);
          } else {
            toast.success("Admin assigned.");
            resetForm();
            onSuccess?.();
          }
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Something went wrong.");
        } finally {
          setSubmitting(false);
        }
      }}
    >
      {({ isSubmitting }) => (
        <Form className="flex flex-col gap-4">
          <FormField name="email" label="User email" type="email" placeholder="person@example.com" />
          <FormSelectField name="platformRoleId" label="Platform role" placeholder="Select a role" options={roles.map((r) => ({ value: r.id, label: r.name }))} />
          <button type="submit" className="btn-primary w-fit" disabled={isSubmitting}>
            {isSubmitting ? "Assigning..." : "Assign"}
          </button>
        </Form>
      )}
    </Formik>
  );
}
