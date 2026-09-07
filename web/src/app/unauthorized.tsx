import ErrorShell from "@/app/_components/error-shell";
import { getPlatformPageIdentity } from "@/lib/platform-page-identity";

export default async function Unauthorized() {
  const identity = await getPlatformPageIdentity();
  const err = identity.errors["401"];
  return (
    <ErrorShell
      status="401"
      title={err.title}
      body={err.body}
      brandName={identity.brandName}
      copyright={identity.copyright}
      logoLightUrl={identity.logoLightUrl}
      actions={[
        { href: "/login", label: "Sign in", variant: "navy" },
        { href: "/super-admin", label: "Back to platform", variant: "outline" },
      ]}
    />
  );
}