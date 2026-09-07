"use server";

import { redirect } from "next/navigation";
import QRCode from "qrcode";
import {
  beginMfaEnrollment,
  confirmMfaEnrollment,
  createSession,
  enforceRateLimit,
  getDefaultOrganizationId,
  InvalidMfaCodeError,
  MfaNotPendingError,
  RateLimitExceededError,
} from "@saasclaude/db";
import { clearPendingMfaCookie, getPendingMfaUserId } from "@/lib/auth/pending-mfa";
import { setSessionCookie } from "@/lib/auth/session";
import { setWsTokenCookie } from "@/lib/auth/ws-token";

export interface BeginEnrollResult {
  secret: string;
  qrDataUri: string;
}

export async function beginEnrollAction(): Promise<BeginEnrollResult> {
  const userId = await getPendingMfaUserId();
  if (!userId) throw new Error("Your login attempt expired. Please sign in again.");
  const { secret, provisioningUri } = await beginMfaEnrollment(userId);
  const qrDataUri = await QRCode.toDataURL(provisioningUri);
  return { secret, qrDataUri };
}

export interface ConfirmEnrollState {
  error: string | null;
  recoveryCodes: string[] | null;
}

export async function confirmEnrollAction(
  _prevState: ConfirmEnrollState,
  formData: FormData,
): Promise<ConfirmEnrollState> {
  const userId = await getPendingMfaUserId();
  if (!userId) return { error: "Your login attempt expired. Please sign in again.", recoveryCodes: null };
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "Enter the 6-digit code from your authenticator app.", recoveryCodes: null };

  try {
    // NFR-2: throttle guesses against the pending secret, same reasoning as the
    // login-time challenge and the settings-tab enrollment.
    await enforceRateLimit(`mfa-enroll:${userId}`, { limit: 10, windowSeconds: 15 * 60 });
    const { recoveryCodes } = await confirmMfaEnrollment(userId, code);
    return { error: null, recoveryCodes };
  } catch (error) {
    if (error instanceof InvalidMfaCodeError || error instanceof MfaNotPendingError) {
      return { error: error.message, recoveryCodes: null };
    }
    if (error instanceof RateLimitExceededError) {
      return { error: "Too many attempts. Please wait a few minutes and try again.", recoveryCodes: null };
    }
    console.error(error);
    return { error: "Something went wrong. Please try again.", recoveryCodes: null };
  }
}

export async function finishEnrollmentAction(): Promise<void> {
  const userId = await getPendingMfaUserId();
  if (!userId) redirect("/login");
  await clearPendingMfaCookie();
  const organizationId = await getDefaultOrganizationId(userId);
  const { rawToken, session } = await createSession({ userId, organizationId });
  await setSessionCookie(rawToken);
  await setWsTokenCookie(session.id);
  redirect("/");
}