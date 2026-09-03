"use client";

import { Formik, Form } from "formik";
import * as yup from "yup";
import { toast } from "sonner";
import { FormField, FormSelectField } from "@/components/console-form-field";
import { updateMemberAction } from "./actions";

const schema = yup.object({
  name: yup.string().required("Name is required."),
  roleId: yup.string().required("Select a role."),
});

export function EditMemberForm({
  organizationId,
  userId,
  currentName,
  currentRoleId,
  roles,
  onSuccess,
}: {
  organizationId: string;
  userId: string;
  currentName: string;
  currentRoleId?: string;
  roles: { id: string; name: string }[];
  onSuccess?: () => void;
}) {
  return (
    <Formik
      initialValues={{ name: currentName, roleId: currentRoleId ?? "" }}
      validationSchema={schema}
      onSubmit={async (values, { setSubmitting }) => {
        try {
          const fd = new FormData();
          fd.append("organizationId", organizationId);
          fd.append("userId", userId);
          fd.append("name", values.name);
          fd.append("roleId", values.roleId);
          await updateMemberAction({ error: null }, fd);
          toast.success("Member updated.");
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
          <FormField name="name" label="Name" />
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
