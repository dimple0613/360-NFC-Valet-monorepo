import ErrorShell from "@/app/_components/error-shell";

export default function Forbidden() {
  return (
    <ErrorShell
      status="403"
      title="Access denied"
      body="Your account doesn't have permission to view this page."
      actions={[
        { href: "/console/dashboard", label: "Go to console", variant: "navy" },
        { href: "/console/login", label: "Back to login", variant: "outline" },
      ]}
    />
  );
}
