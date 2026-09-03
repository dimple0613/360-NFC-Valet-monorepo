import type { NextRequest } from "next/server";
import type { PageParams } from "@saasclaude/db";

/** Parses `?limit=&cursor=` off a REST list request. Invalid/absent limit falls back to the service's own default clamp. */
export function parsePageParams(req: NextRequest): PageParams {
  const url = new URL(req.url);
  const limitParam = url.searchParams.get("limit");
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limit = limitParam !== null ? Number(limitParam) : undefined;
  return { limit, cursor };
}
