import ErrorShell from "@/app/_components/error-shell";

export default function NotFound() {
  return (
    <ErrorShell
      status="404"
      title="Page not found"
      body="The page you're looking for doesn't exist or has been moved."
      actions={[
        { href: "/console/dashboard", label: "Go to dashboard", variant: "navy" },
        { href: "/console/login", label: "Back to login", variant: "outline" },
      ]}
    />
  );
}
