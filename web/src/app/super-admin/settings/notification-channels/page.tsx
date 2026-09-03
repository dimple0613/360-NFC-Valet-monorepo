import { listNotificationChannelStatuses } from "@saasclaude/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePlatformAccess } from "@/lib/auth/current-user";
import { ChannelConfigForm } from "./channel-config-form";

/**
 * Renders one card per REGISTERED channel (channel-registry.ts) — no fixed
 * channel list here, direct structural mirror of the Auth Providers /
 * Payment Providers pages (same adapter-framework shape, third instance).
 * Today that's Email (SMTP) and Webhook — the in-app channel has no config
 * fields at all (it only ever writes to this platform's own database) so it
 * never appears here, same reasoning Google/Apple/Stripe stay off their
 * respective config pages.
 */
export default async function NotificationChannelsPage() {
  await requirePlatformAccess("core.platform.manage_notification_channels");

  const channels = await listNotificationChannelStatuses();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Notification channels</CardTitle>
          <CardDescription>
            Channels the platform can deliver notifications through. The in-app channel needs no setup. SMS, push,
            WhatsApp, Slack, Teams, Discord, and Telegram aren&apos;t available yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {channels.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notification channels are registered.</p>
          ) : null}
        </CardContent>
      </Card>

      {channels.map((channel) => (
        <Card key={channel.id}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>{channel.displayName}</CardTitle>
              {channel.configured ? (
                <Badge variant="default">Active</Badge>
              ) : channel.enabled ? (
                <Badge variant="secondary">Enabled — missing required fields</Badge>
              ) : (
                <Badge variant="outline">Disabled</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ChannelConfigForm channelId={channel.id} fields={channel.fields} enabled={channel.enabled} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
