import { AuthLeftContent } from "../../auth-left";
import { AcceptInviteForm } from "./accept-invite-form";

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <>
      <AuthLeftContent
        headline="Every car back at the curb before the guest is."
        sub="You've been invited to join an organization."
        showStats={false}
      />
      <AcceptInviteForm token={token ?? ""} />
    </>
  );
}
