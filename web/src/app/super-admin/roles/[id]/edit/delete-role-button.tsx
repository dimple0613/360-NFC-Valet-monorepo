"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { deleteGlobalRoleAction } from "../../actions";

export function DeleteRoleButton({ roleId, roleName }: { roleId: string; roleName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteGlobalRoleAction(roleId);
        toast.success("Role deleted.");
        router.push("/super-admin/roles");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      } finally {
        setConfirmOpen(false);
      }
    });
  }

  return (
    <>
      <Button type="button" variant="destructive" size="sm" disabled={pending} onClick={() => setConfirmOpen(true)}>
        Delete role
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete "${roleName}"?`}
        message="This role will be permanently deleted. This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        pending={pending}
      />
    </>
  );
}
