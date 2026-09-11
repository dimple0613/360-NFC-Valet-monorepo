import { NextResponse } from "next/server";
import { createSession, getDefaultOrganizationId, resolveOAuthSignIn, type OAuthProfile } from "../db";
import { setSessionCookie } from "./session";
import { setWsTokenCookie } from "./ws-token";
import { setPendingMfaCookie } from "./pending-mfa";
import { setPendingOrgNameCookie } from "./pending-org-name";

/**
 * Shared post-authentication branching for both Google and Apple callbacks —
 * same resolution outcome, same destinations, regardless of which provider ran:
 *  - MFA is a property of the account, not the login method, so it's still
 *    enforced here exactly like local login (same pending-mfa cookie).
 *    Challenge first (/login/mfa); when the platform-wide "Require 2FA"
 *    toggle is on and the user has no factor, force enrollment first
 *    (/login/mfa/enroll) before any session is created.
 *  - A brand-new user with no matching pending invite names their own org
 *    next (Google/Apple don't hand us an organization name).
 *  - Everyone else (existing account, or a new user who auto-joined a
 *    pending invite's org) gets a real session immediately.
 */
export async function finishOAuthSignIn(profile: OAuthProfile, baseUrl: string): Promise<NextResponse> {
  const result = await resolveOAuthSignIn(profile);

  if (result.mfaEnrollmentRequired) {
    await setPendingMfaCookie(result.userId);
    return NextResponse.redirect(`${baseUrl}/login/mfa/enroll`);
  }

  if (result.mfaRequired) {
    await setPendingMfaCookie(result.userId);
    return NextResponse.redirect(`${baseUrl}/login/mfa`);
  }

  if (result.isNewUser && !result.joinedOrganizationId) {
    await setPendingOrgNameCookie(result.userId);
    return NextResponse.redirect(`${baseUrl}/signup/organization-name`);
  }

  const organizationId = result.joinedOrganizationId ?? (await getDefaultOrganizationId(result.userId));
  const { rawToken, session } = await createSession({ userId: result.userId, organizationId });
  await setSessionCookie(rawToken);
  await setWsTokenCookie(session.id);
  // New users who just created their org go to onboarding to pick a plan;
  // existing users or those who joined via invite go straight to the dashboard.
  const destination = result.isNewUser && !result.joinedOrganizationId ? "/select-plan" : "/";
  return NextResponse.redirect(`${baseUrl}${destination}`);
}
