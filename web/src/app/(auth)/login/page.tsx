import { getPageContentSettings, getSecurityDefaultSettings, isAppleConfigured, isGoogleConfigured, listOAuthProviderStatuses } from "@saasclaude/db";
import { AuthLeftContent } from "../auth-left";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  // Registry-driven providers (Microsoft/Entra ID today, anything else
  // registered later) only show a button once a Super Admin has actually
  // configured + enabled them — same "hidden until configured" convention
  // Google/Apple already use, just sourced from Settings instead of env vars.
  const statuses = await listOAuthProviderStatuses();
  const adapterProviders = statuses
    .filter((status) => status.configured)
    .map((status) => ({ id: status.id, displayName: status.displayName }));

  // Page copy is configurable via Settings > Pages & content.
  const content = await getPageContentSettings();
  // CAPTCHA config comes from Settings > General > Security defaults — the
  // site key is the only part that makes it to the browser; the secret stays
  // server-side for verifyCaptcha() in the login action.
  const security = await getSecurityDefaultSettings();

  return (
    <>
      <AuthLeftContent
        headline={content.loginHeroHeadline}
        sub={content.loginHeroSub}
        showStats
      />
      <LoginForm
        oauthError={error ?? null}
        showGoogle={isGoogleConfigured()}
        showApple={isAppleConfigured()}
        adapterProviders={adapterProviders}
        title={content.loginTitle}
        subtitle={content.loginSubtitle}
        captcha={{ provider: security.captchaProvider, siteKey: security.captchaSiteKey }}
      />
    </>
  );
}
