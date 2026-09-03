"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDownIcon, EyeIcon, KeyRoundIcon, PencilIcon, PowerIcon, Trash2Icon } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DriverForm } from "./driver-form";
import type { DriverTableItem } from "../_lib/valet-data";

export function DriverManageMenu({
  driver,
  fields,
}: {
  driver: DriverTableItem;
  fields: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const onShift = driver.status === "on_shift" || driver.status === "on_break";

  function toggleShift() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/platform/valet/drivers", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: driver.id, shift: !onShift }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to update shift");
        toast.success(onShift ? `${driver.name} is now off shift.` : `${driver.name} is now on shift.`);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Something went wrong.");
      }
    });
  }

  function handleRemove() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/platform/valet/drivers", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: driver.id, remove: true }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to remove driver");
        toast.success("Driver removed.");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      } finally {
        setConfirmOpen(false);
      }
    });
  }

  function submitReset() {
    if (!newPassword.trim()) return;
    if (newPassword.trim().length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setResetting(true);
    startTransition(async () => {
      try {
        const res = await fetch("/api/platform/valet/drivers", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: driver.id, newPassword: newPassword.trim() }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to reset password");
        toast.success("Password updated.");
        setResetOpen(false);
        setNewPassword("");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Something went wrong.");
      } finally {
        setResetting(false);
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={`Manage ${driver.name}`}
              disabled={pending}
              style={{
                cursor: "pointer",
                border: "1px solid #e7eaf0",
                background: "#fff",
                color: "#1c2b46",
                fontSize: 11,
                fontWeight: 800,
                padding: "7px 11px",
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                whiteSpace: "nowrap",
              }}
            >
              Manage
              <ChevronDownIcon className="size-3.5" />
            </button>
          }
        />
      <DropdownMenuContent align="end" style={{ minWidth: 210, borderRadius: 14, padding: 6 }}>
        <DropdownMenuGroup>
            <DropdownMenuLabel className="text-[11px] font-bold uppercase tracking-wide text-[#9aa6bc]">
              {driver.name}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
            <DropdownMenuItem onClick={() => router.push(`/tenant-admin/drivers/${driver.id}`)}>
              <EyeIcon className="size-4" /> View details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleShift} disabled={pending}>
              <PowerIcon className="size-4" /> {onShift ? "End shift" : "Start shift"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setResetOpen(true)}>
              <KeyRoundIcon className="size-4" /> Reset password
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <PencilIcon className="size-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setConfirmOpen(true)} className="text-[#e23d3d] focus:text-[#e23d3d]">
              <Trash2Icon className="size-4" /> Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent
          className="sm:max-w-[460px]"
          showCloseButton={false}
          style={{ borderRadius: 20, padding: 24 }}
        >
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <div className="text-[17px] font-extrabold text-[#1c2b46]">Edit driver</div>
              <div className="text-[12.5px] font-medium text-[#6c7a93] mt-0.5">
                Update {driver.name}&apos;s profile and assignment.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              aria-label="Close"
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "#f6f7f9",
                color: "#6c7a93",
                border: "none",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>
          <DriverForm
            driverId={driver.id}
            fields={fields}
            submitLabel="Save changes"
            defaults={{
              name: driver.name,
              propertyId: driver.propertyId ? String(driver.propertyId) : "",
              email: driver.email ?? "",
              phone: driver.phone ?? "",
              emiratesId: driver.emiratesId ?? "",
              licenseNumber: driver.licenseNumber ?? "",
              nationality: driver.nationality ?? "",
              emergencyContact: driver.emergencyContact ?? "",
            }}
            onSuccess={() => {
              setEditOpen(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent
          className="sm:max-w-[420px]"
          showCloseButton={false}
          style={{ borderRadius: 20, padding: 24 }}
        >
          <div className="text-[17px] font-extrabold text-[#1c2b46]">Reset password</div>
          <div className="mt-1 text-[12.5px] font-medium text-[#6c7a93]">Enter a new password for {driver.name}.</div>
          <input
            type="password"
            placeholder="New password (min 6 chars)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-4 w-full rounded-xl border-[1.5px] border-[#e7eaf0] bg-white px-4 py-3 text-[13px] font-semibold text-[#1c2b46] outline-none focus:border-[#f4531f]"
          />
          <button
            type="button"
            onClick={submitReset}
            disabled={resetting || !newPassword.trim()}
            className="mt-4 w-full rounded-full bg-[#f4531f] py-3 text-[13px] font-extrabold text-white disabled:opacity-50"
          >
            {resetting ? "Updating…" : "Update password"}
          </button>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Remove "${driver.name}"?`}
        message="This will remove the driver from the valet team. This action can be undone later."
        confirmLabel="Remove"
        onConfirm={handleRemove}
        pending={pending}
      />
    </>
  );
}
