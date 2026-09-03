import Link from "next/link";
import { verifyEmail } from "@saasclaude/db";
import { AuthLeftContent } from "../auth-left";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  let success = false;
  let errorMessage: string | null = null;

  if (!token) {
    errorMessage = "No verification token provided.";
  } else {
    try {
      await verifyEmail(token);
      success = true;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Verification failed.";
    }
  }

  return (
    <>
      <AuthLeftContent
        headline="Every car back at the curb before the guest is."
        sub="Confirm your email address to continue."
        showStats={false}
      />
      <div className="login-form">
        <div className="login-title">Email verification</div>
        <div className="login-desc">
          {success ? "Your email address has been verified." : errorMessage}
        </div>
        <Link
          className="btn-login"
          href="/login"
          style={{ display: "block", marginTop: 26, textDecoration: "none" }}
        >
          Continue to sign in
        </Link>
      </div>
    </>
  );
}
