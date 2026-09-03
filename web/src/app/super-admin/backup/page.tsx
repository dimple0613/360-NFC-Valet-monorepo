import { requirePlatformAccess } from "@/lib/auth/current-user";
import { listBackups, type BackupFileListEntry } from "@/lib/backup/restore";
import { BackupsPanel, type BackupFile } from "./backups-panel";

/**
 * Super Admin view over the 360 Valet console's backup/restore tooling. Backs
 * up the 360 Valet product DB via the same scripts /console/backup uses,
 * but surfaced here under the platform session instead of the valet `session`
 * cookie. Gated on core.platform.manage_settings (platform operational data).
 */
export default async function SuperAdminBackupPage() {
  await requirePlatformAccess("core.platform.manage_settings");

  let initialBackups: BackupFile[] = [];
  try {
    initialBackups = listBackups().map((b: BackupFileListEntry) => ({
      filename: b.filename,
      sizeBytes: b.sizeBytes,
      sizeMB: b.sizeMB,
      timestamp: b.timestamp,
      modified: typeof b.modified === "string" ? b.modified : b.modified.toISOString(),
    }));
  } catch {
    initialBackups = [];
  }

  return <BackupsPanel initialBackups={initialBackups} />;
}