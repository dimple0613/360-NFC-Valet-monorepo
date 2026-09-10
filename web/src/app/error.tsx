"use client";

import ErrorShell from "@/app/_components/error-shell";
import { usePublicPlatformContent } from "@/lib/public-content";

// The root error boundary is a client component, so it can't read platform
// settings on the server — it fetches the configurable 500 copy + brand
// identity from the public content endpoint and re-renders once it arrives.
export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const content = usePublicPlatformContent();
  const err = content.error500.title
    ? content.error500
    : { title: "Something went wrong", body: "An unexpected error occurred while loading this page. Please try again." };

  return (
    <ErrorShell
      status="500"
      title={err.title}
      body={err.body}
      brandName={content.brandName}
      copyright={content.copyright}
      logoLightUrl={content.logoLightUrl}
      supportEmail={content.supportEmail}
      actions={[
        { label: "Try again", variant: "navy", onClick: retry },
        { href: "/super-admin", label: "Go to dashboard", variant: "outline" },
      ]}
    />
  );
}