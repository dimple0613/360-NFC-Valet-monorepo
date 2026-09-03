import { NextRequest, NextResponse } from "next/server";
import { executeDueCancellations, executeDueOrganizationDeletions } from "@saasclaude/db";

// FR-132/FR-160-163: two date-driven lifecycle sweeps that TASKS.md flagged as
// "fully implemented and tested but not wired to any scheduler" —
// executeDueOrganizationDeletions (past-grace-period org hard-delete) and
// executeDueCancellations (subscription cancel-at-period-end finalization).
// Bundled into one route since both are the same shape (find rows whose
// scheduled date has passed, transition them) and both are cheap/idempotent —
// a second run before the next schedule just finds nothing due.
//
// Auth follows Vercel's documented cron pattern: Vercel invokes this on
// schedule (vercel.json) with `Authorization: Bearer $CRON_SECRET`; reject
// anything else so the endpoint can't be triggered by an arbitrary request.
export async function GET(req: NextRequest): Promise<Response> {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [deletedOrganizationIds, canceledSubscriptionIds] = await Promise.all([
    executeDueOrganizationDeletions(),
    executeDueCancellations(),
  ]);

  return NextResponse.json({
    deletedOrganizationIds,
    canceledSubscriptionIds,
  });
}
