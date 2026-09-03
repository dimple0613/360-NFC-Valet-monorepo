const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { BACKUP_DIR } = require("./backup-dir");

const MAX_BACKUPS = 30;

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function resolveConnString(databaseUrl) {
  const connStr = databaseUrl || process.env.DATABASE_URL;
  if (!connStr) throw new Error("DATABASE_URL is not set");
  return connStr;
}

function dbPrefix(connStr) {
  const m = /:\d+\/([^?&#]+)/.exec(String(connStr));
  return (m ? m[1] : "backup").toLowerCase();
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function cleanupOld(dir, max) {
  const files = fs.readdirSync(dir)
    .filter((f) => /\.sql\.gz$/.test(f))
    .sort()
    .reverse();
  if (files.length > max) {
    files.slice(max).forEach((f) => {
      fs.unlinkSync(path.join(dir, f));
      console.log(`  Removed old backup: ${f}`);
    });
  }
}

function runBackup(databaseUrl) {
  ensureDir(BACKUP_DIR);
  const connStr = resolveConnString(databaseUrl);
  const ts = timestamp();
  const filename = `${dbPrefix(connStr)}_${ts}.sql.gz`;
  const filepath = path.join(BACKUP_DIR, filename);

  console.log(`Starting backup: ${filename}`);
  try {
    execSync(
      `pg_dump "${connStr}" | gzip > "${filepath}"`,
      { stdio: "inherit", timeout: 120000 }
    );
    const stat = fs.statSync(filepath);
    const sizeMB = (stat.size / 1048576).toFixed(2);
    console.log(`Backup complete: ${filepath} (${sizeMB} MB)`);

    cleanupOld(BACKUP_DIR, MAX_BACKUPS);

    return { filename, filepath, sizeBytes: stat.size, timestamp: ts };
  } catch (err) {
    console.error("Backup failed:", err.message);
    throw err;
  }
}

if (require.main === module) {
  runBackup();
}

module.exports = { runBackup, BACKUP_DIR };
