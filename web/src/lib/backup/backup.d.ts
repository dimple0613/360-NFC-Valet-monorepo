export interface BackupResult {
  filename: string;
  filepath: string;
  sizeBytes: number;
  timestamp: string;
}

export const BACKUP_DIR: string;

export function runBackup(): BackupResult;
