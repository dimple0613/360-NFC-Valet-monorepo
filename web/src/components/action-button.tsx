"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, type buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { VariantProps } from "class-variance-authority";

/**
 * A fire-and-forget mutation (Remove, Revoke, Suspend, ...) that previously
 * gave zero feedback either way — the page just revalidated silently, even
 * on failure. This wraps it in a toast: success message on resolve, the
 * thrown error's message on reject. Not for actions that call redirect()
 * internally (impersonation, org switching) — Next's redirect throws a
 * special error that a generic catch here would wrongly swallow as a
 * failure; those stay plain <form action> submissions.
 */
export function ActionButton({
  action,
  successMessage,
  confirmMessage,
  confirmLabel,
  variant,
  size,
  className,
  children,
}: {
  action: () => Promise<void>;
  successMessage: string;
  /** If set, a styled in-app confirm dialog must be accepted before the action runs — for destructive actions with no other undo path. */
  confirmMessage?: string;
  confirmLabel?: string;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  className?: string;
  children: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleConfirm() {
    startTransition(async () => {
      try {
        await action();
        toast.success(successMessage);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      } finally {
        setConfirmOpen(false);
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={pending}
        onClick={() => {
          if (confirmMessage) {
            setConfirmOpen(true);
          } else {
            handleConfirm();
          }
        }}
      >
        {children}
      </Button>
      {confirmMessage ? (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={confirmMessage}
          message="This action cannot be undone."
          confirmLabel={confirmLabel}
          onConfirm={handleConfirm}
          pending={pending}
        />
      ) : null}
    </>
  );
}
