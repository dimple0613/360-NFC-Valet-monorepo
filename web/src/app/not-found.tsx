import ErrorShell from "@/app/_components/error-shell";
import { getPlatformPageIdentity } from "@/lib/platform-page-identity";

export default async function NotFound() {
  const identity = await getPlatformPageIdentity();
  const err = identity.errors["404"];
  return (
    <ErrorShell
      status="404"
      title={err.title}
      body={err.body}
      brandName={identity.brandName}
      copyright={identity.copyright}
      logoLightUrl={identity.logoLightUrl}
      actions={[
        { href: "/super-admin", label: "Go to dashboard", variant: "navy" },
        { href: "/login", label: "Back to login", variant: "outline" },
      ]}
    />
  );
}