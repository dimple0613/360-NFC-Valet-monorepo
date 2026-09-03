import { redirect } from "next/navigation";
import { getUserPlatformPermissions } from "@saasclaude/db";
import { getCurrentSession } from "@/lib/auth/session";

export default async function Home() {
  const session = await getCurrentSession();

  if (session?.organizationId) {
    redirect("/tenant-admin");
  }
  if (session) {
    const platformPermissions = await getUserPlatformPermissions(session.userId);
    if (platformPermissions.length > 0) redirect("/super-admin");
  }
  redirect("/login");
}
