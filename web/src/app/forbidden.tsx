import ErrorShell from "@/app/_components/error-shell";
import { getPlatformPageIdentity } from "@/lib/platform-page-identity";

export default async function Forbidden() {
  const identity = await getPlatformPageIdentity();
  const err = identity.errors["403"];
  return (
    <ErrorShell
      status="403"
      title={err.title}
      body={err.body}
      brandName={identity.brandName}
      copyright={identity.copyright}
      logoLightUrl={identity.logoLightUrl}
      supportEmail={identity.supportEmail}
      actions={[
        { href: "/super-admin", label: "Go to Super Admin", variant: "navy" },
        { href: "/login", label: "Back to login", variant: "outline" },
      ]}
    />
  );
}