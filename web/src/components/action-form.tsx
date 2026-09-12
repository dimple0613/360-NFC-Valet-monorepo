"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * Like ActionButton, but for a Server Action that needs the submitting
 * form's FormData (checkboxes, a select value, ...) rather than just a
 * bound id. Intercepts the native submit so the action's result can be
 * toasted instead of the page just silently revalidating either way.
 * Server actions revalidatePath() the route, but the already-mounted list
 * only refetches when the client asks — set refreshOnSuccess so the current
 * route is re-rendered after the action resolves.
 */
export function ActionForm({
  action,
  successMessage,
  refreshOnSuccess = false,
  className,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  successMessage: string;
  refreshOnSuccess?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        await action(formData);
        toast.success(successMessage);
        if (refreshOnSuccess) router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className={className} aria-busy={pending}>
      {children}
    </form>
  );
}
