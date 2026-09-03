import ErrorShell from "@/app/_components/error-shell";

export default function Unauthorized() {
  return (
    <ErrorShell
      status="401"
      title="Sign in required"
      body="You need to sign in to view this page."
      actions={[
        { href: "/login", label: "Sign in", variant: "navy" },
        { href: "/console/dashboard", label: "Back to console", variant: "outline" },
      ]}
    />
  );
}
