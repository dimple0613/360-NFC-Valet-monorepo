"use client";

import { Formik, Form } from "formik";
import * as yup from "yup";
import { toast } from "sonner";
import { FormField } from "@/components/console-form-field";
import { updateOrganizationProfileAction } from "./actions";

const schema = yup.object({
  name: yup.string().required("Customer name is required."),
});

export function OrganizationProfileForm({ organizationId, currentName }: { organizationId: string; currentName: string }) {
  return (
    <Formik
      initialValues={{ name: currentName }}
      validationSchema={schema}
      onSubmit={async (values, { setSubmitting }) => {
        try {
          const fd = new FormData();
          fd.append("organizationId", organizationId);
          fd.append("name", values.name);
          const result = await updateOrganizationProfileAction({ error: null, success: false }, fd);
          if (result.error) {
            toast.error(result.error);
          } else {
            toast.success("Customer name updated.");
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
          <FormField name="name" label="Customer name" />
          <button type="submit" className="btn-primary w-fit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save"}
          </button>
        </Form>
      )}
    </Formik>
  );
}
