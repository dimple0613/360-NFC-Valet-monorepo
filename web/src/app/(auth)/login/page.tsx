import { isAppleConfigured, isGoogleConfigured, listOAuthProviderStatuses } from "@saasclaude/db";
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

  return (
    <>
      <AuthLeftContent
        headline="Every car back at the curb before the guest is."
        sub="Run every property, driver and NFC card from one console — and see the day's numbers as they happen."
        showStats
      />
      <LoginForm
        oauthError={error ?? null}
        showGoogle={isGoogleConfigured()}
        showApple={isAppleConfigured()}
        adapterProviders={adapterProviders}
      />
    </>
  );
}
