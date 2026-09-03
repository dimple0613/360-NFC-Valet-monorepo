import { cookies } from "next/headers";

// Short-lived, httpOnly cookie carrying which user is mid-MFA-challenge
// between login() returning mfa_required and completeMfaLogin() finishing it.
// A cookie rather than a URL query param so the user id doesn't end up in
// browser history or server access logs — though the actual security boundary
// is still the TOTP/recovery code check itself, not secrecy of this id.

const PENDING_MFA_COOKIE = "pending_mfa_user_id";
const PENDING_MFA_MAX_AGE_SECONDS = 5 * 60;

export async function setPendingMfaCookie(userId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(PENDING_MFA_COOKIE, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PENDING_MFA_MAX_AGE_SECONDS,
  });
}

export async function getPendingMfaUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(PENDING_MFA_COOKIE)?.value ?? null;
}

export async function clearPendingMfaCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(PENDING_MFA_COOKIE);
}
