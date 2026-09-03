"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  DatabaseBackupIcon,
  FolderCheckIcon,
  PlayIcon,
  RotateCcwIcon,
  ShieldAlertIcon,
  Trash2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface BackupFile {
  filename: string;
  sizeBytes: number;
  sizeMB: string;
  timestamp: string | null;
  modified: string;
}

export interface BackupCheck {
  name: string;
  status: "PASS" | "WARN" | "CRITICAL";
  count: number;
  details: string;
}

interface CheckResult {
  status: "ALL_PASS" | "ISSUES_FOUND" | "ERROR";
  checks: BackupCheck[];
  timestamp: string;
  error?: string;
}

async function api<T>(init?: RequestInit): Promise<T> {
  const res = await fetch("/api/platform/backup", init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status}).`);
  }
  return res.json() as Promise<T>;
}

const CHECK_STATUS_STYLES: Record<BackupCheck["status"], string> = {
  PASS: "bg-emerald-50 text-emerald-700 border-emerald-200",
  WARN: "bg-amber-50 text-amber-700 border-amber-200",
  CRITICAL: "bg-red-50 text-red-700 border-red-200",
};

function formatBytes(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function BackupsPanel({ initialBackups }: { initialBackups: BackupFile[] }) {
  const [backups, setBackups] = useState<BackupFile[]>(initialBackups);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [pending, startTransition] = useTransition();

  const [restoreTarget, setRestoreTarget] = useState<BackupFile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BackupFile | null>(null);

  const refresh = useCallback(
    () =>
      startTransition(async () => {
        try {
          const data = await api<{ backups: BackupFile[] }>();
          setBackups(data.backups);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Failed to load backups.");
        }
      }),
    []
  );

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCreate() {
    startTransition(async () => {
      try {
        const data = await api<{ backup: BackupFile; backups: BackupFile[] }>({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create" }),
        });
        toast.success(`Backup created: ${data.backup.filename}`);
        setBackups(data.backups);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Backup failed.");
      }
    });
  }

  function handleCheck() {
    startTransition(async () => {
      try {
        const data = await api<{ check: CheckResult }>({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "check" }),
        });
        setCheck(data.check);
        if (data.check.status === "ALL_PASS") {
          toast.success("All consistency checks passed.");
        } else if (data.check.status === "ISSUES_FOUND") {
          toast.success("Consistency check found issues.");
        } else {
          toast.error(data.check.error ?? "Consistency check could not run.");
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Consistency check failed.");
      }
    });
  }

  function handleRestore() {
    if (!restoreTarget) return;
    const target = restoreTarget;
    startTransition(async () => {
      try {
        const data = await api<{ backups: BackupFile[] }>({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "restore", filename: target.filename }),
        });
        toast.success(`Restored from ${target.filename}.`);
        setBackups(data.backups);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Restore failed.");
      } finally {
        setRestoreTarget(null);
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    startTransition(async () => {
      try {
        const data = await api<{ backups: BackupFile[] }>({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", filename: target.filename }),
        });
        toast.success(`Deleted ${target.filename}.`);
        setBackups(data.backups);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Delete failed.");
      } finally {
        setDeleteTarget(null);
      }
    });
  }

  const running = pending;

  const searchParams = useSearchParams();
  const query = (searchParams.get("q") ?? "").toLowerCase();
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Number(searchParams.get("pageSize") ?? "15");

  const filtered = backups.filter((b) => !query || b.filename.toLowerCase().includes(query));
  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<DatabaseBackupIcon className="size-5" />}
        title="Backup & Restore"
        description="Backup, restore, and check the integrity of the 360 Valet product database."
        actions={
          <button
            type="button"
            onClick={handleCreate}
            disabled={running}
            className="inline-flex items-center gap-2"
            style={{
              background: "#f4531f",
              color: "#fff",
              borderRadius: 99,
              padding: "10px 20px",
              fontSize: 12.5,
              fontWeight: 800,
              whiteSpace: "nowrap",
              boxShadow: "0 4px 16px rgba(16,22,35,0.05)",
              transition: "background 0.15s ease",
              border: "none",
              cursor: "pointer",
            }}
          >
            <PlayIcon className="size-4" />
            Create backup
          </button>
        }
      />

      <DataTable
        headers={[
          { key: "file", label: "File" },
          { key: "created", label: "Created at" },
          { key: "size", label: "Size", className: "text-right" },
          { key: "actions", label: "Actions", className: "text-right" },
        ]}
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
        totalPages={totalPages}
        searchPlaceholder="Search backups..."
      >
        {running && backups.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="px-4 py-3">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="mt-2 h-5 w-2/3" />
            </TableCell>
          </TableRow>
        ) : backups.length === 0 ? (
          <TableRow className="border-b transition-colors">
            <TableCell colSpan={4} className="px-4 py-3 text-center text-[13px] text-[#9aa6bc]">
              No backups yet. Create your first backup to get started.
            </TableCell>
          </TableRow>
        ) : (
          visible.map((backup) => (
            <TableRow key={backup.filename}>
              <TableCell>
                <div className="text-[13px] font-bold text-[#1c2b46]">{backup.filename}</div>
                <div className="text-[11px] font-medium text-[#6c7a93]">{formatBytes(backup.sizeBytes)}</div>
              </TableCell>
              <TableCell>
                <div className="text-[13px] font-bold text-[#1c2b46]">{backup.timestamp ?? "—"}</div>
              </TableCell>
              <TableCell className="text-right">
                <div className="text-[13px] font-bold text-[#1c2b46]">{backup.sizeMB} MB</div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={running}
                          onClick={() => setRestoreTarget(backup)}
                        >
                          <RotateCcwIcon className="size-3.5" />
                        </Button>
                      }
                    />
                    <TooltipContent side="top">Restore this backup</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${backup.filename}`}
                          disabled={running}
                          onClick={() => setDeleteTarget(backup)}
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      }
                    />
                    <TooltipContent side="top">Delete this backup</TooltipContent>
                  </Tooltip>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
        {backups.length > 0 ? (
          <TableRow className="border-t-2 border-[#edeff3] bg-[#fafbfc]">
            <TableCell className="px-4 py-3 text-[13px] font-extrabold text-[#1c2b46]">
              Total · {backups.length} {backups.length === 1 ? "backup" : "backups"}
            </TableCell>
            <TableCell />
            <TableCell className="px-4 py-3 text-right text-[13px] font-extrabold text-[#1c2b46]">
              {formatBytes(backups.reduce((s, b) => s + b.sizeBytes, 0))}
            </TableCell>
            <TableCell />
          </TableRow>
        ) : null}
      </DataTable>

      {check ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Consistency check
              <Badge className="ml-2" variant="outline">
                {check.status === "ALL_PASS"
                  ? "All checks passed"
                  : check.status === "ISSUES_FOUND"
                    ? "Issues found"
                    : "Could not run"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {check.status === "ERROR" ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] font-semibold text-amber-800">
                {check.error ?? "The consistency check could not run against the database."}
              </div>
            ) : (
              check.checks.map((c) => (
                <div key={c.name} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-[#1c2b46]">{c.name}</div>
                    <div className="text-[12px] font-medium text-[#6c7a93]">{c.details}</div>
                  </div>
                  <Badge className={CHECK_STATUS_STYLES[c.status]} variant="outline">
                    {c.status}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      <ConfirmDialog
        open={restoreTarget !== null}
        onOpenChange={(open) => !open && setRestoreTarget(null)}
        title={`Restore "${restoreTarget?.filename}"?`}
        message="This will overwrite the 360 Valet database with the contents of this backup. This action cannot be undone."
        confirmLabel="Restore"
        cancelLabel="Cancel"
        onConfirm={handleRestore}
        pending={running}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete "${deleteTarget?.filename}"?`}
        message="This will permanently remove this backup file. This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        pending={running}
      />

      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
        <ShieldAlertIcon className="mt-0.5 size-4 shrink-0" />
        <p className="text-[13px] font-semibold">
          Backup &amp; restore covers the 360 Valet product database only. It backs up the valet schema — not the
          platform (SaaS) accounts, billing, or subscription data.
        </p>
      </div>
    </div>
  );
}