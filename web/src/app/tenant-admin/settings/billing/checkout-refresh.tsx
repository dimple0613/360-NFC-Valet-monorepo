"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const MAX_ATTEMPTS = 5;
const INTERVAL_MS = 2000;

/**
 * After a successful Stripe Checkout redirect, the subscription this page
 * shows depends on the webhook having landed — which can trail the redirect
 * by a second or two. This re-fetches the (server-rendered) page a few times
 * so the subscription card appears without the user manually reloading,
 * without polling forever if something's actually wrong.
 */
export function CheckoutRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  const attempts = useRef(0);

  useEffect(() => {
    if (!active) return;
    if (attempts.current >= MAX_ATTEMPTS) return;

    const timer = setTimeout(() => {
      attempts.current += 1;
      router.refresh();
    }, INTERVAL_MS);

    return () => clearTimeout(timer);
  }, [active, router]);

  return null;
}
