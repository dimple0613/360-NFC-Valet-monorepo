"use client";

import { Formik, Form } from "formik";
import * as yup from "yup";
import { toast } from "sonner";
import { FormField, FormCheckboxField } from "@/components/console-form-field";
import { setPlatformSettingAction } from "./actions";

export interface SettingFormDefaults {
  category: string;
  key: string;
  isSensitive: boolean;
}

const schema = yup.object({
  category: yup.string().required("A category is required."),
  key: yup.string().required("A key is required."),
  value: yup.string().required("A value is required."),
  isSensitive: yup.boolean(),
});

export function SettingForm({
  defaults,
  keyLocked = false,
  onSuccess,
}: {
  defaults?: SettingFormDefaults;
  keyLocked?: boolean;
  onSuccess?: () => void;
}) {
  return (
    <Formik
      key={defaults?.key ?? "new"}
      initialValues={{
        category: defaults?.category ?? "",
        key: defaults?.key ?? "",
        value: "",
        isSensitive: defaults?.isSensitive ?? false,
      }}
      validationSchema={schema}
      onSubmit={async (values, { setSubmitting }) => {
        try {
          const fd = new FormData();
          fd.append("category", values.category);
          fd.append("key", values.key);
          fd.append("value", values.value);
          if (values.isSensitive) fd.append("isSensitive", "on");
          const result = await setPlatformSettingAction({ error: null }, fd);
          if (result.error) {
            toast.error(result.error);
          } else {
            toast.success("Setting saved.");
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
          <FormField name="category" label="Category" placeholder="e.g. security" disabled={keyLocked} />
          <FormField name="key" label="Key" placeholder="e.g. security.session_lifetime_days" disabled={keyLocked} />
          <FormField
            name="value"
            label="Value"
            placeholder={
              defaults?.isSensitive
                ? "Enter a new value — required to overwrite a sensitive setting"
                : 'e.g. 30, true, or "some string" — parsed as JSON, falls back to plain text'
            }
          />
          {defaults?.isSensitive ? (
            <p className="text-xs text-muted-foreground">
              This setting is sensitive — its current value is never shown here. Submitting overwrites it.
            </p>
          ) : null}
          <FormCheckboxField name="isSensitive" label="Sensitive (encrypted at rest, redacted in the list below)" />
          <button type="submit" className="btn-primary w-fit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : keyLocked ? "Update setting" : "Set setting"}
          </button>
        </Form>
      )}
    </Formik>
  );
}
