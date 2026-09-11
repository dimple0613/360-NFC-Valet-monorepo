import { getPageContentSettings, getSecurityDefaultSettings } from "../../../lib/db";
import { AuthLeftContent } from "../auth-left";
import { ForgotPasswordForm } from "./forgot-password-form";

export default async function ForgotPasswordPage() {
  const content = await getPageContentSettings();
  const security = await getSecurityDefaultSettings();
  return (
    <>
      <AuthLeftContent
        headline={content.forgotHeroHeadline}
        sub={content.forgotHeroSub}
        showStats={false}
      />
      <ForgotPasswordForm
        title={content.forgotTitle}
        subtitle={content.forgotSubtitle}
        captcha={{ provider: security.captchaProvider, siteKey: security.captchaSiteKey }}
      />
    </>
  );
}
