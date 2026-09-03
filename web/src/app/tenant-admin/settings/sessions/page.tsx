import { KeyRoundIcon } from "lucide-react";
import { listUserSessionsSearch } from "@saasclaude/db";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { DataTable } from "@/components/data-table";
import { parseListQueryParams } from "@/lib/list-query-params";
import { requireIdentity } from "@/lib/auth/current-user";
import { formatDateTime, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { RevokeSessionButton } from "./revoke-session-button";

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const identity = await requireIdentity();
  const listParams = parseListQueryParams(await searchParams);
  const sessions = await listUserSessionsSearch(identity.user.id, listParams);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<KeyRoundIcon className="size-5" />}
        title="Active sessions"
        description="Devices and browsers currently signed in to your account. Revoke anything you don&apos;t recognize."
      />
      <DataTable
        headers={[
          { key: "userAgent", label: "Device / IP", sortable: true },
          { key: "lastUsedAt", label: "Last used", sortable: true, className: "text-muted-foreground" },
          { key: "expiresAt", label: "Expires", sortable: true, className: "text-muted-foreground" },
          { key: "actions", label: "" },
        ]}
        page={sessions.page}
        totalCount={sessions.totalCount}
        totalPages={sessions.totalPages}
        sortBy={listParams.sortBy ?? "lastUsedAt"}
        sortDir={listParams.sortDir ?? "desc"}
        searchPlaceholder="Search by device or IP..."
      >
        {sessions.items.map((session) => (
          <TableRow key={session.id}>
            <TableCell className="max-w-xs truncate text-muted-foreground">
              {session.userAgent ?? "Unknown device"} {session.ipAddress ? `· ${session.ipAddress}` : ""}
              {session.id === identity.session.sessionId ? <Badge className="ml-2">This session</Badge> : null}
            </TableCell>
            <TableCell className="text-muted-foreground">{formatDateTime(session.lastUsedAt)}</TableCell>
            <TableCell className="text-muted-foreground">{formatDate(session.expiresAt)}</TableCell>
            <TableCell>
              <RevokeSessionButton
                sessionId={session.id}
                deviceLabel={session.userAgent ?? "this device"}
                isCurrent={session.id === identity.session.sessionId}
              />
            </TableCell>
          </TableRow>
        ))}
        {sessions.items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground">
              No active sessions.
            </TableCell>
          </TableRow>
        ) : null}
      </DataTable>
    </div>
  );
}
