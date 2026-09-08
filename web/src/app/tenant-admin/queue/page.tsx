import { requireValetPage } from "../_lib/valet-permissions";
import { getQueueOrders } from "../_lib/valet-data";
import QueuePageClient from "./queue-page-client";

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const identity = await requireValetPage("valet.queue.read");
  const raw = await searchParams;
  const status = typeof raw.status === "string" ? raw.status : null;
  const property = typeof raw.property === "string" ? raw.property : "all";
  const driver = typeof raw.driver === "string" ? raw.driver : "all";
  const q = typeof raw.q === "string" ? raw.q : "";
  const days = Number(raw.days) || 30;
  const page = Number(raw.page) || 1;
  const pageSize = Math.min(100, Math.max(5, Number(raw.pageSize) || 20));
  const sortBy = typeof raw.sortBy === "string" ? raw.sortBy : "createdAt";
  const sortDir = raw.sortDir === "asc" ? "asc" : "desc";

  const data = await getQueueOrders({ days, property, driver, status, q, sort: sortBy, dir: sortDir, page, pageSize, organizationId: identity.session.organizationId ?? null });

  return (
    <QueuePageClient
      initialData={data}
      days={days}
      property={property}
      driver={driver}
      status={status}
      canManageQueue={identity.permissions.includes("valet.queue.manage")}
    />
  );
}
