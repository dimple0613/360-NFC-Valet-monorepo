"use server";

import { checkRateLimit, requestPasswordReset, resolveEmailSender } from "@saasclaude/db";

export interface ForgotPasswordFormState {
  submitted: boolean;
}

export async function forgotPasswordAction(
  _prevState: ForgotPasswordFormState,
  formData: FormData,
): Promise<ForgotPasswordFormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (email) {
    // NFR-2: throttle repeated reset requests per email (mitigates
    // inbox-bombing a target). Uses the non-throwing check, not
    // enforceRateLimit — the response below must stay "submitted: true"
    // either way, same enumeration-safety reasoning as the no-op-on-unknown-
    // email behavior right below it: only skip sending, never say why.
    const { allowed } = await checkRateLimit(`password-reset:${email.toLowerCase()}`, { limit: 5, windowSeconds: 60 * 60 });
    // No branching on whether the email exists — requestPasswordReset already
    // no-ops silently for an unregistered one (see local-provider.ts).
    // §2.14: resolveEmailSender() sends for real once the email channel is
    // configured, falls back to the console placeholder otherwise (same
    // absorb-the-ad-hoc-mailer wiring as signup-flow.ts).
    if (allowed) await requestPasswordReset(email, await resolveEmailSender());
  }
  return { submitted: true };
}
