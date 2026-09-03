"use server";

import { redirect } from "next/navigation";
import { switchSessionOrganization } from "@saasclaude/db";
import { requireIdentity } from "@/lib/auth/current-user";

// FR-105: switching the session's active organization. Nothing previously
// called switchSessionOrganization (packages/db) from the web layer — this
// closes that gap, surfaced through the sidebar's org switcher.
export async function switchOrganizationAction(organizationId: string): Promise<void> {
  const identity = await requireIdentity();
  await switchSessionOrganization(identity.session.sessionId, organizationId);
  redirect("/tenant-admin");
}
