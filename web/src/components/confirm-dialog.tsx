"use client";

import { AlertTriangleIcon, XIcon } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  pending = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  pending?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[460px]"
        showCloseButton={false}
        style={{ borderRadius: 20, padding: 24 }}
      >
        <div className="flex items-start justify-between gap-4 mb-0">
          <div className="flex items-center gap-2 flex-wrap min-w-0" style={{ width: "100%" }}>
            <div
              style={{
                flexShrink: 0,
                width: 80,
                height: 80,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgb(253, 232, 232)",
                color: "rgb(214, 67, 15)",
                margin: "0 auto",
              }}
            >
              <AlertTriangleIcon size={50} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={pending}
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
              position: "absolute",
              right: 10,
              top: 10,
            }}
          >
            <XIcon size={16} />
          </button>
        </div>
        <div className="min-w-0 text-center" style={{ width: "100%" }}>
          <div className="text-[17px] font-extrabold text-[#1c2b46] leading-snug">{title}</div>
          <div className="text-[12.5px] font-medium text-[#6c7a93] mt-0.5 leading-relaxed">
            {message}
          </div>
        </div>
        <div className="flex justify-center gap-2 mt-0">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "9px 18px",
              borderRadius: 99,
              border: "1.5px solid #E7EAF0",
              background: "#fff",
              color: "#1c2b46",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "9px 18px",
              borderRadius: 99,
              border: "none",
              background: "#f4531f",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 6px 18px -6px rgba(244, 83, 31, 0.55)",
              fontFamily: "inherit",
              opacity: pending ? 0.6 : 1,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}