import { getUserOrganizationPermissions, listApiKeysSearch, prismaWithoutTenantScoping } from "@saasclaude/db";
import { KeyRoundIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { DataTable } from "@/components/data-table";
import { parseListQueryParams } from "@/lib/list-query-params";
import { requireIdentity } from "@/lib/auth/current-user";
import { formatDateTime, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { AddApiKeyDialog } from "./add-api-key-dialog";
import { CopyKeyIdentifier } from "./copy-key-identifier";
import { RevokeApiKeyButton } from "./revoke-api-key-button";

const MANAGE_API_KEYS_PERMISSION = "core.api_keys.manage";

export default async function ApiKeysPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const identity = await requireIdentity();
  const organizationId = identity.session.organizationId!;
  const listParams = parseListQueryParams(await searchParams);

  const [apiKeys, scopeCatalog, permissions] = await Promise.all([
    listApiKeysSearch(organizationId, listParams),
    prismaWithoutTenantScoping.permission.findMany({ where: { scope: "TENANT" }, orderBy: { key: "asc" } }),
    getUserOrganizationPermissions(identity.user.id, organizationId),
  ]);
  const canManageApiKeys = permissions.includes(MANAGE_API_KEYS_PERMISSION);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<KeyRoundIcon className="size-5" />}
        title="API keys"
        description="Credentials for the versioned REST API (/api/v1) — each key acts only within the scopes granted to it."
        actions={<AddApiKeyDialog scopeCatalog={scopeCatalog} canManage={canManageApiKeys} />}
      />
      <DataTable
        headers={[
          { key: "name", label: "Name", sortable: true },
          { key: "keyPrefix", label: "Key", sortable: true },
          { key: "scopes", label: "Scopes" },
          { key: "lastUsedAt", label: "Last used", sortable: true, className: "text-muted-foreground" },
          { key: "expiresAt", label: "Expires", sortable: true, className: "text-muted-foreground" },
          ...(canManageApiKeys ? [{ key: "actions", label: "" }] : []),
        ]}
        page={apiKeys.page}
        totalCount={apiKeys.totalCount}
        totalPages={apiKeys.totalPages}
        sortBy={listParams.sortBy ?? "createdAt"}
        sortDir={listParams.sortDir ?? "desc"}
        searchPlaceholder="Search by name..."
      >
        {apiKeys.items.map((key) => (
          <TableRow key={key.id}>
            <TableCell>{key.name}</TableCell>
            <TableCell>
              <CopyKeyIdentifier name={key.name} prefix={key.keyPrefix} />
            </TableCell>
            <TableCell className="max-w-xs">
              <div className="flex flex-wrap gap-1">
                {key.scopes.map((scope) => (
                  <Badge key={scope} variant="secondary" className="text-xs">
                    {scope}
                  </Badge>
                ))}
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {key.lastUsedAt ? formatDateTime(key.lastUsedAt) : "Never"}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {key.expiresAt ? formatDate(key.expiresAt) : "Never"}
            </TableCell>
            {canManageApiKeys ? (
              <TableCell>
                <RevokeApiKeyButton apiKeyId={key.id} name={key.name} />
              </TableCell>
            ) : null}
          </TableRow>
        ))}
        {apiKeys.items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={canManageApiKeys ? 6 : 5} className="text-center text-muted-foreground">
              No active API keys.
            </TableCell>
          </TableRow>
        ) : null}
      </DataTable>
    </div>
  );
}
