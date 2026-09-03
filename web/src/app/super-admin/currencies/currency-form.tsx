"use client";

import { Formik, Form } from "formik";
import * as yup from "yup";
import { toast } from "sonner";
import { FormField, FormToggleField } from "@/components/console-form-field";
import { createCurrencyDialogAction, updateCurrencyDialogAction } from "./actions";

const schema = yup.object({
  code: yup.string().required("Code is required.").max(8, "Max 8 characters."),
  name: yup.string().required("Name is required."),
  format: yup.string().required("Format is required."),
  isActive: yup.boolean(),
});

export interface CurrencyFormDefaults {
  code: string;
  name: string;
  format: string;
  isActive: boolean;
}

/**
 * Create/edit currency form. Dialog mode (onSuccess set) uses non-redirecting
 * actions so the popup can close + toast in place: create when currencyId is
 * absent, update when it's present.
 */
export function CurrencyForm({
  currencyId,
  defaults,
  onSuccess,
}: {
  currencyId?: string;
  defaults?: CurrencyFormDefaults;
  onSuccess?: () => void;
}) {
  return (
    <Formik
      initialValues={{
        code: defaults?.code ?? "",
        name: defaults?.name ?? "",
        format: defaults?.format ?? "",
        isActive: defaults?.isActive ?? true,
      }}
      validationSchema={schema}
      onSubmit={async (values, { setSubmitting }) => {
        try {
          const fd = new FormData();
          if (currencyId) fd.append("id", currencyId);
          fd.append("code", values.code);
          fd.append("name", values.name);
          fd.append("format", values.format);
          if (values.isActive) fd.append("isActive", "on");

          if (onSuccess) {
            const result = currencyId
              ? await updateCurrencyDialogAction(fd)
              : await createCurrencyDialogAction(fd);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            toast.success(currencyId ? "Currency updated." : "Currency added.");
            onSuccess();
            return;
          }

          if (currencyId) {
            await updateCurrencyDialogAction(fd);
            toast.success("Currency updated.");
          }
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Something went wrong.");
        } finally {
          setSubmitting(false);
        }
      }}
    >
      {({ isSubmitting }) => (
        <Form style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <FormField name="code" label="Code" placeholder="e.g. EUR" />
          <FormField name="name" label="Name" placeholder="e.g. Euro" />
          <FormField name="format" label="Format" placeholder="e.g. €{PRICE}" />
          <p className="text-xs text-muted-foreground">{"{PRICE}"} is replaced with the formatted amount.</p>
          <FormToggleField name="isActive" label="Active" />
          <button
            type="submit"
            className="btn-primary"
            style={{ marginTop: 18, padding: 14, width: "100%", fontSize: 14 }}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Save"}
          </button>
        </Form>
      )}
    </Formik>
  );
}
