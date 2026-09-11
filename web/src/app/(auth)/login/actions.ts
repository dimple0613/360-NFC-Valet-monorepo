"use server";

import { redirect } from "next/navigation";
import {
  AccountNotActiveError,
  createSession,
  enforceRateLimit,
  getDefaultOrganizationId,
  InvalidCredentialsError,
  login,
  RateLimitExceededError,
  verifyCaptcha,
} from "../../../lib/db";
import { setSessionCookie } from "@/lib/auth/session";
import { setWsTokenCookie } from "@/lib/auth/ws-token";
import { setPendingMfaCookie } from "@/lib/auth/pending-mfa";

export interface LoginFormState {
  error: string | null;
}

export async function loginAction(_prevState: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Email and password are required." };

  // Verify the form's CAPTCHA token before touching credentials. verifyCaptcha
  // is a no-op (returns true) when no provider/keys are configured.
  if (!(await verifyCaptcha(String(formData.get("captchaToken") ?? "")))) {
    return { error: "CAPTCHA verification failed. Please try again." };
  }

  let result;
  try {
    // NFR-2: throttle brute-force/credential-stuffing per email, not per IP —
    // see rate-limit.ts's doc comment for why IP-based limiting is deferred.
    await enforceRateLimit(`login:${email.toLowerCase()}`, { limit: 10, windowSeconds: 15 * 60 });
    result = await login({ email, password });
  } catch (error) {
    if (error instanceof InvalidCredentialsError || error instanceof AccountNotActiveError) {
      return { error: error.message };
    }
    if (error instanceof RateLimitExceededError) {
      return { error: "Too many attempts. Please wait a few minutes and try again." };
    }
    console.error(error);
    return { error: "Something went wrong. Please try again." };
  }

  if (result.status === "mfa_required") {
    await setPendingMfaCookie(result.userId);
    redirect("/login/mfa");
  }

  if (result.status === "mfa_enrollment_required") {
    await setPendingMfaCookie(result.userId);
    redirect("/login/mfa/enroll");
  }

  const organizationId = await getDefaultOrganizationId(result.userId);
  const { rawToken, session } = await createSession({ userId: result.userId, organizationId });
  await setSessionCookie(rawToken);
  // The browser's live surfaces (queue/offers) open a WebSocket and need a
  // readable credential the HttpOnly session cookie can't provide — issue the
  // short-lived non-HttpOnly WS token alongside the session.
  await setWsTokenCookie(session.id);
  redirect("/");
}
