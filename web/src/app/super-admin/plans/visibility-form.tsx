"use client";

import { Formik, Form } from "formik";
import { toast } from "sonner";
import { FormSelectField } from "@/components/console-form-field";
import { setPlanVisibilityAction } from "./actions";

const VISIBILITIES = [
  { value: "PUBLIC", label: "Public" },
  { value: "INVITE_ONLY", label: "Invite only" },
  { value: "HIDDEN", label: "Hidden" },
  { value: "ARCHIVED", label: "Archived" },
];

export function VisibilityForm({ planId, currentVisibility }: { planId: string; currentVisibility: string }) {
  return (
    <Formik
      initialValues={{ visibility: currentVisibility }}
      onSubmit={async (values, { setSubmitting }) => {
        try {
          const fd = new FormData();
          fd.append("visibility", values.visibility);
          await setPlanVisibilityAction(planId, fd);
          toast.success("Visibility updated.");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Something went wrong.");
        } finally {
          setSubmitting(false);
        }
      }}
    >
      {({ isSubmitting }) => (
        <Form className="flex items-center gap-2">
          <FormSelectField name="visibility" options={VISIBILITIES} />
          <button type="submit" className="btn-outline h-8 px-3 text-xs" disabled={isSubmitting}>
            {isSubmitting ? "Updating..." : "Update"}
          </button>
        </Form>
      )}
    </Formik>
  );
}
