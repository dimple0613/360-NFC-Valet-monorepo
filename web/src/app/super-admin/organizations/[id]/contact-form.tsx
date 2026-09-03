"use client";

import { Formik, Form } from "formik";
import * as yup from "yup";
import { toast } from "sonner";
import { FormField, FormSelectField } from "@/components/console-form-field";
import { COUNTRIES } from "@/lib/countries";
import { updateOrganizationContactAction } from "./actions";

const optionalEmail = yup
  .string()
  .nullable()
  .test("is-email", "Enter a valid email.", (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)));

const schema = yup.object({
  contactEmail: optionalEmail,
  contactPhone: yup.string().nullable(),
  addressLine1: yup.string().nullable(),
  addressLine2: yup.string().nullable(),
  city: yup.string().nullable(),
  region: yup.string().nullable(),
  postalCode: yup.string().nullable(),
  country: yup.string().nullable(),
});

export interface OrganizationContactDefaults {
  contactEmail: string | null;
  contactPhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
}

export function OrganizationContactForm({
  organizationId,
  defaults,
}: {
  organizationId: string;
  defaults: OrganizationContactDefaults;
}) {
  return (
    <Formik
      initialValues={{
        contactEmail: defaults.contactEmail ?? "",
        contactPhone: defaults.contactPhone ?? "",
        addressLine1: defaults.addressLine1 ?? "",
        addressLine2: defaults.addressLine2 ?? "",
        city: defaults.city ?? "",
        region: defaults.region ?? "",
        postalCode: defaults.postalCode ?? "",
        country: defaults.country ?? "",
      }}
      validationSchema={schema}
      onSubmit={async (values, { setSubmitting }) => {
        try {
          const fd = new FormData();
          fd.append("organizationId", organizationId);
          Object.entries(values).forEach(([k, v]) => fd.append(k, v ?? ""));
          const result = await updateOrganizationContactAction({ error: null, success: false }, fd);
          if (result.error) {
            toast.error(result.error);
          } else {
            toast.success("Contact information updated.");
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
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField name="contactEmail" label="Contact email" type="email" />
            <FormField name="contactPhone" label="Contact phone" type="tel" />
          </div>
          <FormField name="addressLine1" label="Address line 1" />
          <FormField name="addressLine2" label="Address line 2" />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField name="city" label="City" />
            <FormField name="region" label="State / Region" />
            <FormField name="postalCode" label="Postal code" />
            <FormSelectField name="country" label="Country" placeholder="Select a country" options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))} />
          </div>
          <p className="text-xs text-muted-foreground">Country is used to apply the correct tax rate on this org&apos;s invoices.</p>
          <button type="submit" className="btn-primary w-fit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save"}
          </button>
        </Form>
      )}
    </Formik>
  );
}
