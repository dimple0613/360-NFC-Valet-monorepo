import Link from "next/link";
import { ShieldIcon } from "lucide-react";
import { isAppleConfigured, isGoogleConfigured, listLinkedOAuthAccounts, prismaWithoutTenantScoping } from "@saasclaude/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireIdentity } from "@/lib/auth/current-user";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { MfaSection } from "./mfa-section";
import { ChangePasswordForm } from "./change-password-form";

const PROVIDER_LABELS: Record<string, string> = { google: "Google", apple: "Apple" };

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const identity = await requireIdentity();
  const rawParams = await searchParams;
  const tab = rawParams.tab === "mfa" ? "mfa" : "password";

  const tabHref = (target: string) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(rawParams)) {
      if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
      else if (value !== undefined) params.append(key, value);
    }
    if (target === "password") params.delete("tab");
    else params.set("tab", target);
    const qs = params.toString();
    return `/tenant-admin/settings/security${qs ? `?${qs}` : ""}`;
  };

  const tabs = [
    { value: "password", label: "Change password" },
    { value: "mfa", label: "Two-factor authentication" },
  ];

  const [user, linkedAccounts] = await Promise.all([
    prismaWithoutTenantScoping.user.findUniqueOrThrow({ where: { id: identity.user.id } }),
    listLinkedOAuthAccounts(identity.user.id),
  ]);
  const linkedProviders = new Set(linkedAccounts.map((a) => a.provider));
  const availableProviders = [
    ...(isGoogleConfigured() ? ["google"] : []),
    ...(isAppleConfigured() ? ["apple"] : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<ShieldIcon className="size-5" />}
        title="Security"
        description="Manage your password and two-factor authentication."
      />
      <nav className="-mb-px flex gap-4 overflow-x-auto border-b">
        {tabs.map(({ value, label }) => {
          const active = tab === value;
          return (
            <Link
              key={value}
              href={tabHref(value)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "whitespace-nowrap border-b-2 px-1 pb-2.5 text-sm font-bold transition-colors",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {tab === "password" ? (
        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      ) : null}

      {tab === "mfa" ? (
        <Card>
          <CardHeader>
            <CardTitle>Two-factor authentication</CardTitle>
          </CardHeader>
          <CardContent>
            <MfaSection mfaEnabled={user.mfaEnabled} />
          </CardContent>
        </Card>
      ) : null}

      {availableProviders.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Linked accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {availableProviders.map((provider) => (
                <div key={provider} className="flex items-center justify-between text-sm">
                  <span>{PROVIDER_LABELS[provider] ?? provider}</span>
                  {linkedProviders.has(provider) ? (
                    <Badge variant="secondary">Linked</Badge>
                  ) : (
                    <span className="text-muted-foreground">Not linked</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
