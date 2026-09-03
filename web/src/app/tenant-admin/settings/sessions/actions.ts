"use server";

import { revalidatePath } from "next/cache";
import { prismaWithoutTenantScoping, revokeSession } from "@saasclaude/db";
import { requireIdentity } from "@/lib/auth/current-user";

export async function revokeSessionAction(sessionId: string): Promise<void> {
  const identity = await requireIdentity();

  // revokeSession itself doesn't check ownership — it's a low-level primitive.
  // The caller (here) is responsible for confirming this session actually
  // belongs to the requesting user before revoking it.
  const session = await prismaWithoutTenantScoping.session.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== identity.user.id) throw new Error("Session not found.");

  await revokeSession(sessionId);
  revalidatePath("/tenant-admin/settings/sessions");
}
