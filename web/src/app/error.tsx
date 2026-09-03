"use client";

import ErrorShell from "@/app/_components/error-shell";

export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ErrorShell
      status="500"
      title="Something went wrong"
      body="An unexpected error occurred while loading this page. Please try again."
      actions={[
        { label: "Try again", variant: "navy", onClick: retry },
        { href: "/console/dashboard", label: "Go to dashboard", variant: "outline" },
      ]}
    />
  );
}
