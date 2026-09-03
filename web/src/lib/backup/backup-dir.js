const fs = require("fs");
const path = require("path");

// web/src/lib/backup/backup-dir.js → web/backups/
const WEB_ROOT = path.resolve(__dirname, "../../../..");
const BACKUP_DIR = path.join(WEB_ROOT, "backups");

module.exports = { BACKUP_DIR, WEB_ROOT };
