"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { AddMemberDialog } from "./add-member-dialog";

export function AddMemberButton({
  organizationId,
  organizationName,
  roles,
}: {
  organizationId: string;
  organizationName: string;
  roles: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2"
        style={{
          background: "#f4531f",
          color: "#fff",
          borderRadius: 99,
          padding: "10px 20px",
          fontSize: 12.5,
          fontWeight: 800,
          whiteSpace: "nowrap",
          boxShadow: "0 4px 16px rgba(16,22,35,0.05)",
          transition: "background 0.15s ease",
          border: "none",
          cursor: "pointer",
        }}
      >
        <PlusIcon className="size-4" />
        Add user
      </button>
      <AddMemberDialog
        open={open}
        onOpenChange={setOpen}
        organizationId={organizationId}
        organizationName={organizationName}
        roles={roles}
      />
    </>
  );
}
