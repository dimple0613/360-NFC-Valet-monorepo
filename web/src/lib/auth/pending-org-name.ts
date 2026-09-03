import { cookies } from "next/headers";

// Short-lived, httpOnly cookie carrying which brand-new OAuth user is
// mid-"name your organization" step — same pattern as pending-mfa.ts. A
// cookie, not a URL param, so the user id doesn't end up in browser
// history/server logs; the actual security boundary is still the real
// session issued once the org is created, not secrecy of this id.

const PENDING_ORG_NAME_COOKIE = "pending_org_name_user_id";
const PENDING_ORG_NAME_MAX_AGE_SECONDS = 10 * 60;

export async function setPendingOrgNameCookie(userId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(PENDING_ORG_NAME_COOKIE, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PENDING_ORG_NAME_MAX_AGE_SECONDS,
  });
}

export async function getPendingOrgNameUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(PENDING_ORG_NAME_COOKIE)?.value ?? null;
}

export async function clearPendingOrgNameCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(PENDING_ORG_NAME_COOKIE);
}
