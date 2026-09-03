"use server";

import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import {
  beginMfaEnrollment,
  changePassword,
  confirmMfaEnrollment,
  disableMfa,
  enforceRateLimit,
  InvalidCredentialsError,
  InvalidMfaCodeError,
  prismaWithoutTenantScoping,
  RateLimitExceededError,
  sendNotification,
  WeakPasswordError,
  verifyMfaCode,
} from "@saasclaude/db";
import { requireIdentity } from "@/lib/auth/current-user";

export interface BeginEnrollmentResult {
  secret: string;
  qrDataUri: string;
}

export async function beginMfaEnrollmentAction(): Promise<BeginEnrollmentResult> {
  const identity = await requireIdentity();
  const { secret, provisioningUri } = await beginMfaEnrollment(identity.user.id);
  const qrDataUri = await QRCode.toDataURL(provisioningUri);
  return { secret, qrDataUri };
}

export interface ConfirmEnrollmentState {
  error: string | null;
  recoveryCodes: string[] | null;
}

export async function confirmMfaEnrollmentAction(
  _prevState: ConfirmEnrollmentState,
  formData: FormData,
): Promise<ConfirmEnrollmentState> {
  const identity = await requireIdentity();
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "Enter the 6-digit code from your authenticator app.", recoveryCodes: null };

  try {
    // NFR-2: throttle guesses against the pending secret, same reasoning as
    // the login-time MFA challenge (login/mfa/actions.ts).
    await enforceRateLimit(`mfa-enroll:${identity.user.id}`, { limit: 10, windowSeconds: 15 * 60 });
    const { recoveryCodes } = await confirmMfaEnrollment(identity.user.id, code);
    revalidatePath("/tenant-admin/settings/security");
    return { error: null, recoveryCodes };
  } catch (error) {
    if (error instanceof InvalidMfaCodeError) return { error: error.message, recoveryCodes: null };
    if (error instanceof RateLimitExceededError) {
      return { error: "Too many attempts. Please wait a few minutes and try again.", recoveryCodes: null };
    }
    console.error(error);
    return { error: "Something went wrong. Please try again.", recoveryCodes: null };
  }
}

export interface DisableMfaState {
  error: string | null;
}

export async function disableMfaAction(_prevState: DisableMfaState, formData: FormData): Promise<DisableMfaState> {
  const identity = await requireIdentity();
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "Enter your current 6-digit code to confirm." };

  try {
    // Re-proving possession of the second factor before removing it — the
    // service layer's disableMfa() itself does no such check (a low-level
    // primitive, same pattern as revokeSession's ownership check living in
    // its caller, not the primitive itself).
    await enforceRateLimit(`mfa-disable:${identity.user.id}`, { limit: 10, windowSeconds: 15 * 60 });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return { error: "Too many attempts. Please wait a few minutes and try again." };
    }
    throw error;
  }

  const valid = await verifyMfaCode(identity.user.id, code);
  if (!valid) return { error: "Invalid code." };

  await disableMfa(identity.user.id);
  revalidatePath("/tenant-admin/settings/security");
  return { error: null };
}

export interface ChangePasswordState {
  error: string | null;
  success: boolean;
}

export async function changePasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const identity = await requireIdentity();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword) return { error: "Fill in both password fields.", success: false };
  if (newPassword !== confirmPassword) return { error: "New passwords don't match.", success: false };

  try {
    // NFR-2: throttle guesses against the current password, same reasoning
    // as the neighboring MFA actions.
    await enforceRateLimit(`password-change:${identity.user.id}`, { limit: 10, windowSeconds: 15 * 60 });
    await changePassword(
      { userId: identity.user.id, currentPassword, newPassword },
      identity.session.sessionId,
    );
  } catch (error) {
    if (error instanceof InvalidCredentialsError) return { error: "Current password is incorrect.", success: false };
    if (error instanceof WeakPasswordError) return { error: error.message, success: false };
    if (error instanceof RateLimitExceededError) {
      return { error: "Too many attempts. Please wait a few minutes and try again.", success: false };
    }
    throw error;
  }

  // §2.14 framework proof: a genuinely new notification (no pre-existing
  // ad-hoc email for this event, unlike invites), dispatched through every
  // registered/configured channel (email/webhook/in-app all fire, unlike
  // org.invite_sent's `only` filter — see organization-invites.ts). Wired
  // here in the web layer rather than local-provider.ts's pure
  // changePassword() itself, since organizationId is only known once a user
  // is inside an active Tenant Admin session, not at the service layer
  // (changePassword has no org concept — a User isn't tenant-scoped). Best
  // effort: never fails the password change itself.
  try {
    const organizationId = identity.session.organizationId;
    if (organizationId) {
      const org = await prismaWithoutTenantScoping.organization.findUnique({ where: { id: organizationId } });
      await sendNotification({
        kind: "security.password_changed",
        organizationId,
        userId: identity.user.id,
        email: identity.user.email,
        variables: { organizationName: org?.name ?? "your organization" },
      });
    }
  } catch {
    // Non-fatal — see comment above.
  }

  revalidatePath("/tenant-admin/settings/security");
  return { error: null, success: true };
}
