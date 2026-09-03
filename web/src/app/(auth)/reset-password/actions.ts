"use server";

import { redirect } from "next/navigation";
import { InvalidOrExpiredTokenError, resetPassword, WeakPasswordError } from "@saasclaude/db";

export interface ResetPasswordFormState {
  error: string | null;
}

export async function resetPasswordAction(
  _prevState: ResetPasswordFormState,
  formData: FormData,
): Promise<ResetPasswordFormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!token) return { error: "Missing reset token." };
  if (!password) return { error: "Enter a new password." };

  try {
    await resetPassword(token, password);
  } catch (error) {
    if (error instanceof InvalidOrExpiredTokenError || error instanceof WeakPasswordError) {
      return { error: error.message };
    }
    console.error(error);
    return { error: "Something went wrong. Please try again." };
  }

  redirect("/login");
}
