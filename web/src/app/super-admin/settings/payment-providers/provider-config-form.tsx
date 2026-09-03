"use client";

import { useRef } from "react";
import { Formik, Form } from "formik";
import { toast } from "sonner";
import { FormField, FormCheckboxField } from "@/components/console-form-field";
import { savePaymentProviderConfigAction } from "./actions";
import type { PaymentProviderFieldStatus } from "@saasclaude/db";

export function ProviderConfigForm({
  adapterId,
  fields,
  enabled,
}: {
  adapterId: string;
  fields: PaymentProviderFieldStatus[];
  enabled: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Formik
      initialValues={{
        enabled,
        ...Object.fromEntries(fields.map((f) => [`field_${f.key}`, f.sensitive ? "" : (f.value ?? "")])),
      }}
      onSubmit={async (values, { setSubmitting }) => {
        try {
          const fd = new FormData(formRef.current!);
          fd.append("adapterId", adapterId);
          if (values.enabled) fd.append("enabled", "on");
          const result = await savePaymentProviderConfigAction({ error: null }, fd);
          if (result.error) {
            toast.error(result.error);
          } else {
            toast.success("Provider config saved.");
          }
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Something went wrong.");
        } finally {
          setSubmitting(false);
        }
      }}
    >
      {({ isSubmitting }) => (
        <Form ref={formRef} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <FormField
                key={field.key}
                name={`field_${field.key}`}
                label={field.label + (field.required ? " *" : "")}
                type={field.sensitive ? "password" : "text"}
                placeholder={field.sensitive && field.hasValue ? "Set — leave blank to keep the current value" : undefined}
              />
            ))}
          </div>
          <FormCheckboxField name="enabled" label="Enabled — allow checkout/subscription requests through this provider once required fields are set" />
          <button type="submit" className="btn-primary w-fit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save"}
          </button>
        </Form>
      )}
    </Formik>
  );
}
