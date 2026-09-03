export interface BackupFileListEntry {
  filename: string;
  sizeBytes: number;
  sizeMB: string;
  timestamp: string | null;
  modified: Date;
}

export interface ConsistencyCheck {
  name: string;
  status: "PASS" | "WARN" | "CRITICAL";
  count: number;
  details: string;
  rows: unknown[];
}

export function listBackups(): BackupFileListEntry[];
export function deleteBackup(filename: string): boolean;
export function restoreBackup(filename: string): Promise<boolean>;
export function checkConsistency(): Promise<{
  status: "ALL_PASS" | "ISSUES_FOUND";
  checks: ConsistencyCheck[];
  timestamp: string;
}>;
