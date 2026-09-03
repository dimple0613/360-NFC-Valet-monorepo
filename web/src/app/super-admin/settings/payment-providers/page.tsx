import { listPaymentProviderStatuses } from "@saasclaude/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePlatformAccess } from "@/lib/auth/current-user";
import { ProviderConfigForm } from "./provider-config-form";

/**
 * Renders one card per REGISTERED payment-provider adapter
 * (payment-provider-registry.ts) — no fixed provider list here. Today
 * that's PayPal only (Stripe stays on env-var config, matching Google/Apple's
 * existing OAuth precedent, so it doesn't appear on this Settings-driven
 * page — see TASKS.md for the explicit tradeoff). Registering a second
 * config-driven payment adapter in the future makes it show up here
 * automatically. Structural mirror of super-admin/settings/auth-providers/page.tsx.
 */
export default async function PaymentProvidersPage() {
  await requirePlatformAccess("core.platform.manage_payment_providers");

  const providers = await listPaymentProviderStatuses();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Payment providers</CardTitle>
          <CardDescription>
            Providers the platform can charge subscriptions through. Stripe is configured on the server and
            doesn&apos;t appear here. Razorpay, Paddle, Lemon Squeezy, Braintree, Authorize.Net, Square, bank
            transfer, and crypto aren&apos;t available yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {providers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payment provider adapters are registered.</p>
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
            <CardDescription className="text-xs">Webhook URL: /api/webhooks/{provider.id}</CardDescription>
          </CardHeader>
          <CardContent>
            <ProviderConfigForm adapterId={provider.id} fields={provider.fields} enabled={provider.enabled} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
