"use server";

import { redirect } from "next/navigation";
import { EmailAlreadyRegisteredError, enforceRateLimit, RateLimitExceededError, WeakPasswordError } from "@saasclaude/db";
import { signUpNewOrganization } from "@/lib/auth/signup-flow";
import { setSessionCookie } from "@/lib/auth/session";

export interface SignupFormState {
  error: string | null;
}

export async function signupAction(_prevState: SignupFormState, formData: FormData): Promise<SignupFormState> {
  const organizationName = String(formData.get("organizationName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim() || undefined;

  if (!organizationName || !email || !password) {
    return { error: "Organization name, email, and password are required." };
  }

  let sessionToken: string;
  try {
    // NFR-2: throttle signup spam / enumeration probing per email.
    await enforceRateLimit(`signup:${email.toLowerCase()}`, { limit: 5, windowSeconds: 60 * 60 });
    const result = await signUpNewOrganization({ organizationName, email, password, name });
    sessionToken = result.sessionToken;
  } catch (error) {
    if (error instanceof EmailAlreadyRegisteredError || error instanceof WeakPasswordError) {
      return { error: error.message };
    }
    if (error instanceof RateLimitExceededError) {
      return { error: "Too many attempts. Please wait a while and try again." };
    }
    console.error(error);
    return { error: "Something went wrong. Please try again." };
  }

  await setSessionCookie(sessionToken);
  redirect("/");
}
