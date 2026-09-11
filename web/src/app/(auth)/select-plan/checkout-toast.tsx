"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export type CheckoutMessage = { variant: "default" | "destructive"; text: string } | null;

// Checkout results (cancelled / Stripe not configured / plan errors) surface
// as a sonner toast — the same notification pattern every other auth flow uses
// (login, signup, forgot-password...), not a bespoke inline Alert box.
export function CheckoutToast({ message }: { message: CheckoutMessage }) {
  useEffect(() => {
    if (!message) return;
    if (message.variant === "destructive") {
      toast.error(message.text);
    } else {
      toast.info(message.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message?.variant, message?.text]);

  return null;
}