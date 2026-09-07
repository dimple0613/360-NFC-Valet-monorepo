import { getPageContentSettings } from "@saasclaude/db";
import { AuthLeftContent } from "../auth-left";
import { ForgotPasswordForm } from "./forgot-password-form";

export default async function ForgotPasswordPage() {
  const content = await getPageContentSettings();
  return (
    <>
      <AuthLeftContent
        headline={content.forgotHeroHeadline}
        sub={content.forgotHeroSub}
        showStats={false}
      />
      <ForgotPasswordForm title={content.forgotTitle} subtitle={content.forgotSubtitle} />
    </>
  );
}
