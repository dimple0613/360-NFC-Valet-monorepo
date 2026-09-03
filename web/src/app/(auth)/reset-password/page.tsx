import { AuthLeftContent } from "../auth-left";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const hasToken = !!token;
  return (
    <>
      <AuthLeftContent
        headline="Every car back at the curb before the guest is."
        sub={
          hasToken
            ? "Choose a new password, then sign back in."
            : "This reset link is invalid or has expired."
        }
        showStats={false}
      />
      <ResetPasswordForm token={token ?? ""} />
    </>
  );
}
