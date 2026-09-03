import { AuthLeftContent } from "../auth-left";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthLeftContent
        headline="Every car back at the curb before the guest is."
        sub="Reset your password to get back into the operations console."
        showStats={false}
      />
      <ForgotPasswordForm />
    </>
  );
}
