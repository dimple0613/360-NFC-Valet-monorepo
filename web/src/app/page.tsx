import { redirect } from "next/navigation";
import { getUserPlatformPermissions } from "../lib/db";
import { getCurrentSession } from "@/lib/auth/session";

export default async function Home() {
  const session = await getCurrentSession();

  if (session) {
    const platformPermissions = await getUserPlatformPermissions(session.userId);
    if (platformPermissions.length > 0) redirect("/super-admin");
  }
  if (session?.organizationId) {
    redirect("/tenant-admin");
  }
  redirect("/login");
}
