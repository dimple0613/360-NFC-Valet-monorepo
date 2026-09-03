"use client";

import { Formik, Form } from "formik";
import * as yup from "yup";
import { toast } from "sonner";
import { FormField, FormSelectField } from "@/components/console-form-field";

const ADD_SCHEMA = yup.object({
  name: yup.string().required("Full name is required."),
  propertyId: yup.string().required("Select a property."),
  password: yup.string().min(6, "Password must be at least 6 characters.").required("Password is required."),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref("password"), null as any], "Passwords do not match.")
    .required("Confirm password is required."),
  email: yup.string().email("Enter a valid email address."),
  phone: yup.string().matches(/^[0-9+ ]{7,15}$/, "Enter a valid phone number."),
});

const EDIT_SCHEMA = yup.object({
  name: yup.string().required("Full name is required."),
  propertyId: yup.string().required("Select a property."),
  email: yup.string().email("Enter a valid email address."),
  phone: yup.string().matches(/^[0-9+ ]{7,15}$/, "Enter a valid phone number."),
});

export interface DriverFormDefaults {
  name: string;
  propertyId: string;
  email: string;
  phone: string;
  emiratesId: string;
  licenseNumber: string;
  nationality: string;
  emergencyContact: string;
}

/**
 * Create/edit driver form in a currency-style dialog. Create (no driverId)
 * POSTs to the drivers API; update PATCHes. Both close the dialog + toast
 * in place via onSuccess.
 */
export function DriverForm({
  driverId,
  defaults,
  fields,
  onSuccess,
  submitLabel,
}: {
  driverId?: number;
  defaults?: DriverFormDefaults;
  fields: { id: number; name: string }[];
  onSuccess?: () => void;
  submitLabel: string;
}) {
  return (
    <Formik
      initialValues={{
        name: defaults?.name ?? "",
        propertyId: defaults?.propertyId ?? "",
        password: "",
        confirmPassword: "",
        email: defaults?.email ?? "",
        phone: defaults?.phone ?? "",
        emiratesId: defaults?.emiratesId ?? "",
        licenseNumber: defaults?.licenseNumber ?? "",
        nationality: defaults?.nationality ?? "",
        emergencyContact: defaults?.emergencyContact ?? "",
      }}
      validationSchema={driverId ? EDIT_SCHEMA : ADD_SCHEMA}
      onSubmit={async (values, { setSubmitting }) => {
        try {
          const url = "/api/platform/valet/drivers";
          const method = driverId ? "PATCH" : "POST";
          const body = driverId
            ? {
                id: driverId,
                name: values.name,
                propertyId: values.propertyId || null,
                email: values.email || null,
                phone: values.phone || null,
                emiratesId: values.emiratesId || null,
                licenseNumber: values.licenseNumber || null,
                nationality: values.nationality || null,
                emergencyContact: values.emergencyContact || null,
              }
            : {
                name: values.name,
                password: values.password,
                propertyId: values.propertyId,
                email: values.email || undefined,
                phone: values.phone || undefined,
                emiratesId: values.emiratesId || undefined,
                licenseNumber: values.licenseNumber || undefined,
                nationality: values.nationality || undefined,
                emergencyContact: values.emergencyContact || undefined,
              };
          const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || "Failed to save driver");
          toast.success(driverId ? "Driver updated." : "Driver added.");
          if (onSuccess) onSuccess();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Something went wrong.");
        } finally {
          setSubmitting(false);
        }
      }}
    >
      {({ isSubmitting }) => (
        <Form style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <FormField name="name" label="Full name" placeholder="e.g. Ramesh Kumar" />
          <FormSelectField
            name="propertyId"
            label="Property"
            options={[{ value: "", label: "Select…" }, ...fields.map((p) => ({ value: String(p.id), label: p.name }))]}
          />
          {driverId ? null : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField name="password" label="Password" type="password" placeholder="Min 6 characters" />
              <FormField name="confirmPassword" label="Confirm password" type="password" placeholder="Re-enter password" />
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField name="email" label="Email" type="email" placeholder="ramesh@360valet.com" />
            <FormField name="phone" label="Phone" placeholder="+971 5xx xxx xxxx" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField name="emiratesId" label="Emirates ID" placeholder="784-XXXX-XXXXXXX-X" />
            <FormField name="licenseNumber" label="License number" placeholder="DL-XXXXXXX" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField name="nationality" label="Nationality" placeholder="Indian" />
            <FormField name="emergencyContact" label="Emergency contact" placeholder="+971 5xx xxx xxxx" />
          </div>
          <button
            type="submit"
            className="btn-primary"
            style={{ marginTop: 18, padding: 14, width: "100%", fontSize: 14 }}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : submitLabel}
          </button>
        </Form>
      )}
    </Formik>
  );
}
