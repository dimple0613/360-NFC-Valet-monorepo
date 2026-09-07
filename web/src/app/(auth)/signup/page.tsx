import { getPageContentSettings } from "@saasclaude/db";
import { AuthLeftContent } from "../auth-left";
import { SignupForm } from "./signup-form";

export default async function SignupPage() {
  const content = await getPageContentSettings();
  return (
    <>
      <AuthLeftContent
        headline={content.signupHeroHeadline}
        sub={content.signupHeroSub}
        showStats={false}
      />
      <SignupForm title={content.signupTitle} subtitle={content.signupSubtitle} />
    </>
  );
}
