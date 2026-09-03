import { AuthLeftContent } from "../auth-left";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <>
      <AuthLeftContent
        headline="Every car back at the curb before the guest is."
        sub="Set up your organization in a minute."
        showStats={false}
      />
      <SignupForm />
    </>
  );
}
