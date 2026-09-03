import { NextResponse } from "next/server";
import { getUserPlatformPermissions } from "@saasclaude/db";
import { getCurrentSession } from "@/lib/auth/session";
import { runBackup } from "@/lib/backup/backup";
import {
  listBackups,
  deleteBackup,
  restoreBackup,
  checkConsistency,
} from "@/lib/backup/restore";

// Platform-gated delegate for the 360 Valet console's backup/restore tooling
// (src/lib/backup/backup.js + restore.js operate on the 360nfc_valet DB). The
// Super Admin portal owns the platform session, NOT the valet `session` cookie
// the /console/backup page relies on, so this route re-authenticates against
// the platform session and calls the same underlying functions. Restore is
// destructive (overwrites the valet DB), which is why it sits behind a
// platform-manage_settings-level gate rather than a plain read permission.
//
// On Laragon (Windows dev) the PostgreSQL/GNU tools are not on the system
// PATH by default, so we prepend them here before calling the scripts — they
// use execSync('pg_dump ...') which inherits process.env.PATH.

const BACKUP_PERMISSION = "core.platform.manage_settings";

function ensureToolPaths() {
  if (process.env.PATH) {
    const postgresBin = "D:\\laragon\\bin\\postgresql\\postgresql\\bin";
    const gitBin = "D:\\laragon\\bin\\git\\usr\\bin";
    const entries = process.env.PATH.split(";");
    if (!entries.includes(postgresBin)) entries.unshift(postgresBin);
    if (!entries.includes(gitBin)) entries.unshift(gitBin);
    process.env.PATH = entries.join(";");
  }
}

async function authorize() {
  const session = await getCurrentSession();
  if (!session) return null;
  const permissions = await getUserPlatformPermissions(session.userId);
  if (!permissions.includes(BACKUP_PERMISSION)) return false;
  return true;
}

export async function GET() {
  const ok = await authorize();
  if (ok === null) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (ok === false) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    return NextResponse.json({ backups: listBackups() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list backups." },
      { status: 500 }
    );
  }
}

interface BackupActionBody {
  action: "create" | "check" | "restore" | "delete";
  filename?: string;
}

export async function POST(req: Request) {
  const ok = await authorize();
  if (ok === null) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (ok === false) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  ensureToolPaths();

  let body: BackupActionBody;
  try {
    body = (await req.json()) as BackupActionBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    switch (body.action) {
      case "create": {
        const created = runBackup();
        return NextResponse.json({ backup: created, backups: listBackups() });
      }
      case "check": {
        try {
          const result = await checkConsistency();
          return NextResponse.json({ check: result });
        } catch (checkErr) {
          return NextResponse.json({
            check: {
              status: "ERROR",
              error: checkErr instanceof Error ? checkErr.message : "Check failed.",
              checks: [],
              timestamp: new Date().toISOString(),
            },
          });
        }
      }
      case "restore": {
        if (!body.filename) {
          return NextResponse.json({ error: "Missing filename." }, { status: 400 });
        }
        await restoreBackup(body.filename);
        return NextResponse.json({ ok: true, backups: listBackups() });
      }
      case "delete": {
        if (!body.filename) {
          return NextResponse.json({ error: "Missing filename." }, { status: 400 });
        }
        deleteBackup(body.filename);
        return NextResponse.json({ ok: true, backups: listBackups() });
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${String(body?.action)}` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Backup operation failed." },
      { status: 500 }
    );
  }
}