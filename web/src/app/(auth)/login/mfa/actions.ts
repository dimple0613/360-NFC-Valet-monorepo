"use server";

import { redirect } from "next/navigation";
import {
  completeMfaLogin,
  createSession,
  enforceRateLimit,
  getDefaultOrganizationId,
  InvalidMfaChallengeError,
  RateLimitExceededError,
} from "@saasclaude/db";
import { setSessionCookie } from "@/lib/auth/session";
import { setWsTokenCookie } from "@/lib/auth/ws-token";
import { clearPendingMfaCookie, getPendingMfaUserId } from "@/lib/auth/pending-mfa";

export interface MfaChallengeFormState {
  error: string | null;
}

export async function mfaChallengeAction(
  _prevState: MfaChallengeFormState,
  formData: FormData,
): Promise<MfaChallengeFormState> {
  const userId = await getPendingMfaUserId();
  if (!userId) return { error: "Your login attempt expired. Please sign in again." };

  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "Enter your 6-digit code or a recovery code." };

  try {
    // NFR-2: a TOTP code is only 6 digits (1M combinations) and time-windowed
    // to 30s, but still worth throttling guesses — keyed by userId since this
    // step already has an authenticated-enough identity (the password step
    // passed) rather than an attacker-supplied email.
    await enforceRateLimit(`mfa:${userId}`, { limit: 10, windowSeconds: 15 * 60 });
    await completeMfaLogin(userId, code);
  } catch (error) {
    if (error instanceof InvalidMfaChallengeError) return { error: error.message };
    if (error instanceof RateLimitExceededError) {
      return { error: "Too many attempts. Please wait a few minutes and try again." };
    }
    console.error(error);
    return { error: "Something went wrong. Please try again." };
  }

  await clearPendingMfaCookie();
  const organizationId = await getDefaultOrganizationId(userId);
  const { rawToken, session } = await createSession({ userId, organizationId });
  await setSessionCookie(rawToken);
  await setWsTokenCookie(session.id);
  redirect("/");
}
