"use server";

import { redirect } from "next/navigation";
import { revokeSession } from "@saasclaude/db";
import { clearSessionCookie, getCurrentSession } from "./session";
import { clearWsTokenCookie } from "./ws-token";

export async function logoutAction(): Promise<void> {
  const session = await getCurrentSession();
  if (session) {
    await revokeSession(session.sessionId);
  }
  await clearSessionCookie();
  await clearWsTokenCookie();
  redirect("/login");
}
