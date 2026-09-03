import { listOAuthProviderStatuses } from "@saasclaude/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePlatformAccess } from "@/lib/auth/current-user";
import { ProviderConfigForm } from "./provider-config-form";

/**
 * Renders one card per REGISTERED adapter (oauth-registry.ts) — no fixed
 * provider list here. Today that's Microsoft/Entra ID only (Google/Apple
 * stay on env-var config, matching Stripe's existing pattern, so they don't
 * appear on this Settings-driven page — see TASKS.md for the explicit
 * tradeoff). Registering a second config-driven adapter in the future makes
 * it show up here automatically.
 */
export default async function AuthProvidersPage() {
  await requirePlatformAccess("core.platform.manage_auth_providers");

  const providers = await listOAuthProviderStatuses();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Authentication providers</CardTitle>
          <CardDescription>
            Single sign-on providers your customers can use to log in and register. Google and Apple sign-in are
            configured on the server and don&apos;t appear here. SAML, LDAP / Active Directory, passkeys, and magic
            links aren&apos;t available yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {providers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No OAuth2/OIDC adapters are registered.</p>
          ) : null}
        </CardContent>
      </Card>

      {providers.map((provider) => (
        <Card key={provider.id}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>{provider.displayName}</CardTitle>
              {provider.configured ? (
                <Badge variant="default">Active</Badge>
              ) : provider.enabled ? (
                <Badge variant="secondary">Enabled — missing required fields</Badge>
              ) : (
                <Badge variant="outline">Disabled</Badge>
              )}
            </div>
            <CardDescription className="text-xs">
              Sign-in URL: /login/{provider.id}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProviderConfigForm adapterId={provider.id} fields={provider.fields} enabled={provider.enabled} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
