import { getPageContentSettings, getSecurityDefaultSettings } from "../../../lib/db";
import { AuthLeftContent } from "../auth-left";
import { SignupForm } from "./signup-form";

export default async function SignupPage() {
  const content = await getPageContentSettings();
  const security = await getSecurityDefaultSettings();
  return (
    <>
      <AuthLeftContent
        headline={content.signupHeroHeadline}
        sub={content.signupHeroSub}
        showStats={false}
      />
      <SignupForm
        title={content.signupTitle}
        subtitle={content.signupSubtitle}
        captcha={{ provider: security.captchaProvider, siteKey: security.captchaSiteKey }}
      />
    </>
  );
}
