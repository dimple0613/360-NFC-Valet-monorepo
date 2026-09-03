"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PencilIcon, PowerIcon, KeyRoundIcon, XIcon } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DriverForm } from "../driver-form";
import type { DriverTableItem } from "../../_lib/valet-data";

export function DriverDetailActions({
  driverId,
  name,
  status,
  propertyId,
  fields,
}: {
  driverId: number;
  name: string;
  status: string;
  propertyId: number | null;
  fields: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const onShift = status === "on_shift";
  const defaults: DriverTableItem = {
    id: driverId,
    valetId: "",
    name,
    initials: "",
    color: "",
    email: null,
    phone: null,
    status,
    statusLabel: "",
    property: null,
    propertyId,
    today: 0,
    avgMin: 0,
    createdAt: new Date(),
    emiratesId: null,
    licenseNumber: null,
    nationality: null,
    emergencyContact: null,
  };

  function toggleShift() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/platform/valet/drivers", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: driverId, shift: !onShift }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to update shift");
        toast.success(onShift ? `${name} is now off shift.` : `${name} is now on shift.`);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Something went wrong.");
      }
    });
  }

  function submitReset() {
    if (!newPassword.trim()) return;
    if (newPassword.trim().length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setResetting(true);
    startTransition(async () => {
      try {
        const res = await fetch("/api/platform/valet/drivers", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: driverId, newPassword: newPassword.trim() }),
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
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setEditOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-[#e7eaf0] bg-white px-4 py-2 text-[12.5px] font-extrabold text-[#1c2b46] hover:border-[#f4531f] hover:text-[#f4531f]"
      >
        <PencilIcon className="size-3.5" />
        Edit
      </button>
      <button
        type="button"
        onClick={toggleShift}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-full border border-[#e7eaf0] bg-white px-4 py-2 text-[12.5px] font-extrabold text-[#1c2b46] hover:border-[#f4531f] hover:text-[#f4531f] disabled:opacity-50"
      >
        <PowerIcon className="size-3.5" />
        {onShift ? "End shift" : "Start shift"}
      </button>
      <button
        type="button"
        onClick={() => setResetOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-[#e7eaf0] bg-white px-4 py-2 text-[12.5px] font-extrabold text-[#1c2b46] hover:border-[#f4531f] hover:text-[#f4531f]"
      >
        <KeyRoundIcon className="size-3.5" />
        Reset password
      </button>

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
                Update {name}&apos;s profile and assignment.
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
            driverId={driverId}
            fields={fields}
            submitLabel="Save changes"
            defaults={{
              name: defaults.name,
              propertyId: defaults.propertyId ? String(defaults.propertyId) : "",
              email: defaults.email ?? "",
              phone: defaults.phone ?? "",
              emiratesId: defaults.emiratesId ?? "",
              licenseNumber: defaults.licenseNumber ?? "",
              nationality: defaults.nationality ?? "",
              emergencyContact: defaults.emergencyContact ?? "",
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
          <div className="mt-1 text-[12.5px] font-medium text-[#6c7a93]">
            Enter a new password for {name}.
          </div>
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
    </div>
  );
}
