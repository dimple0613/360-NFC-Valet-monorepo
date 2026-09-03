"use client";

import { useRouter } from "next/navigation";
import { Formik, Form } from "formik";
import * as yup from "yup";
import { toast } from "sonner";
import { FormField, FormSelectField } from "@/components/console-form-field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createCustomerAction } from "./actions";

const FOUNDER_ROLES = [
  { value: "Owner", label: "Owner" },
  { value: "Admin", label: "Admin" },
  { value: "Member", label: "Member" },
  { value: "Viewer", label: "Viewer" },
];

const schema = yup.object({
  organizationName: yup.string().required("Customer name is required."),
  firstName: yup.string().required("First name is required."),
  lastName: yup.string().required("Last name is required."),
  email: yup.string().email("Enter a valid email.").required("Email is required."),
  password: yup.string().min(12, "Password must be at least 12 characters.").required("Password is required."),
  confirmPassword: yup.string().oneOf([yup.ref("password")], "Passwords must match.").required("Confirm password is required."),
  founderRoleName: yup.string().required(),
});

export function NewCustomerForm() {
  const router = useRouter();
  return (
    <Formik
      initialValues={{ organizationName: "", firstName: "", lastName: "", email: "", password: "", confirmPassword: "", founderRoleName: "Owner" }}
      validationSchema={schema}
      onSubmit={async (values, { setSubmitting }) => {
        try {
          const fd = new FormData();
          fd.append("organizationName", values.organizationName);
          fd.append("firstName", values.firstName);
          fd.append("lastName", values.lastName);
          fd.append("email", values.email);
          fd.append("password", values.password);
          fd.append("confirmPassword", values.confirmPassword);
          fd.append("founderRoleName", values.founderRoleName);
          const result = await createCustomerAction({ error: null, success: false }, fd);
          if (result.error) {
            toast.error(result.error);
          } else {
            toast.success("Customer created.");
            if (result.organizationId) {
              router.push(`/super-admin/organizations/${result.organizationId}`);
            } else {
              router.push("/super-admin/organizations");
            }
          }
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Something went wrong.");
        } finally {
          setSubmitting(false);
        }
      }}
    >
      {({ isSubmitting }) => (
        <Form className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Information</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField name="organizationName" label="Customer name" placeholder="Acme Inc." />
            </CardContent>
            <CardHeader>
              <CardTitle>First user</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField name="firstName" label="First name" />
                <FormField name="lastName" label="Last name" />
              </div>
              <FormField name="email" label="Email" type="email" />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField name="password" label="New password" type="password" />
                <FormField name="confirmPassword" label="Confirm new password" type="password" />
              </div>
              <FormSelectField name="founderRoleName" label="Role" options={FOUNDER_ROLES} />
            </CardContent>
            <div className="px-6 py-4">
              <button type="submit" className="btn-primary" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save"}
              </button>
            </div>
          </Card>
        </Form>
      )}
    </Formik>
  );
}
