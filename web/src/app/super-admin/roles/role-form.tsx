"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Formik, Form } from "formik";
import * as yup from "yup";
import { toast } from "sonner";
import { FormField, FormTextareaField } from "@/components/console-form-field";
import { PermissionPicker } from "@/components/permission-picker";
import { createGlobalRoleAction, updateGlobalRoleAction } from "./actions";

const schema = yup.object({
  name: yup.string().required("Role name is required."),
  description: yup.string().required("Description is required."),
});

export interface RoleFormDefaults {
  name: string;
  description: string;
  grantedPermissionIds: Set<string>;
}

export function RoleForm({
  roleId,
  defaults,
  permissionCatalog,
}: {
  roleId?: string;
  defaults?: RoleFormDefaults;
  permissionCatalog: { id: string; key: string; description: string | null }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const action = roleId ? updateGlobalRoleAction : createGlobalRoleAction;

  return (
    <Formik
      initialValues={{
        name: defaults?.name ?? "",
        description: defaults?.description ?? "",
      }}
      validationSchema={schema}
      onSubmit={async (values, { setSubmitting }) => {
        try {
          const fd = new FormData(formRef.current!);
          const result = await action({ error: null, success: false }, fd);
          if (result.error) {
            toast.error(result.error);
          } else {
            toast.success(roleId ? "Role updated." : "Role created.");
            router.push("/super-admin/roles");
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
          {roleId ? <input type="hidden" name="roleId" value={roleId} /> : null}
          <FormField name="name" label="Role name" />
          <FormTextareaField name="description" label="Description" rows={2} />
          <div className="flex flex-col gap-2">
            <div className="text-section">Permissions</div>
            <PermissionPicker
              catalog={permissionCatalog}
              inputName="permissionIds"
              valueField="id"
              defaultSelected={defaults?.grantedPermissionIds}
            />
          </div>
          <button type="submit" className="btn-primary w-fit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save"}
          </button>
        </Form>
      )}
    </Formik>
  );
}
