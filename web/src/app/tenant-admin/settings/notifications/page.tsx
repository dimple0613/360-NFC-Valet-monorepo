import { BellIcon } from "lucide-react";
import { listUserSettings } from "@saasclaude/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireIdentity } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/page-header";
import { NotificationForm } from "./notification-form";
import { NOTIFICATION_CATEGORIES } from "./categories";

export default async function NotificationsPage() {
  const identity = await requireIdentity();
  const settings = await listUserSettings(identity.user.id);

  const enabled: Record<string, boolean> = {};
  for (const category of NOTIFICATION_CATEGORIES) {
    const row = settings.find((s) => s.key === `notifications.${category.key}`);
    enabled[category.key] = row ? Boolean(row.value) : true;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<BellIcon className="size-5" />}
        title="Notifications"
        description="Choose what you want to hear about. Turning a category off skips every channel — email, webhook, and in-app — for that category."
      />
      <Card>
        <CardHeader>
          <CardTitle>Notification preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <NotificationForm enabled={enabled} />
        </CardContent>
      </Card>
    </div>
  );
}
