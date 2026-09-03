const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { pool } = require("./db");
const { BACKUP_DIR } = require("./backup-dir");

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("360nfc_valet_") && f.endsWith(".sql.gz"))
    .sort()
    .reverse()
    .map((f) => {
      const stat = fs.statSync(path.join(BACKUP_DIR, f));
      const match = f.match(/360nfc_valet_(\d{8})_(\d{6})\.sql\.gz/);
      let ts = null;
      if (match) {
        const [, date, time] = match;
        ts = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)} ${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}`;
      }
      return {
        filename: f,
        sizeBytes: stat.size,
        sizeMB: (stat.size / 1048576).toFixed(2),
        timestamp: ts,
        modified: stat.mtime,
      };
    });
}

function deleteBackup(filename) {
  const filepath = path.join(BACKUP_DIR, filename);
  if (!filename.startsWith("360nfc_valet_") || !filename.endsWith(".sql.gz")) {
    throw new Error("Invalid backup filename");
  }
  if (!fs.existsSync(filepath)) {
    throw new Error("Backup not found");
  }
  fs.unlinkSync(filepath);
  return true;
}

async function restoreBackup(filename) {
  const filepath = path.join(BACKUP_DIR, filename);
  if (!filename.startsWith("360nfc_valet_") || !filename.endsWith(".sql.gz")) {
    throw new Error("Invalid backup filename");
  }
  if (!fs.existsSync(filepath)) {
    throw new Error("Backup not found");
  }

  const connStr = process.env.DATABASE_URL || "postgresql://postgres@localhost:5432/360nfc_valet";

  console.log(`Restoring from: ${filename}`);
  try {
    execSync(
      `gunzip -c "${filepath}" | psql "${connStr}" --single-transaction --set ON_ERROR_STOP=off`,
      { stdio: "inherit", timeout: 300000 }
    );
    console.log("Restore complete");
    return true;
  } catch (err) {
    console.error("Restore failed:", err.message);
    throw err;
  }
}

async function checkConsistency() {
  const checks = [];

  const { rows: orphanedOrders } = await pool.query(`
    SELECT o.id, o.card_id, o.status
    FROM orders o
    LEFT JOIN nfc_cards c ON c.id = o.card_id
    WHERE c.id IS NULL
    LIMIT 20
  `);
  checks.push({
    name: "Orphaned orders (card deleted)",
    status: orphanedOrders.length === 0 ? "PASS" : "WARN",
    count: orphanedOrders.length,
    details: orphanedOrders.length === 0
      ? "All orders reference valid cards"
      : `${orphanedOrders.length} orders reference deleted cards`,
    rows: orphanedOrders,
  });

  const { rows: cardMismatch } = await pool.query(`
    SELECT c.id, c.uid, c.status, o.status AS order_status, o.id AS order_id
    FROM nfc_cards c
    JOIN orders o ON o.card_id = c.id
    WHERE o.status IN ('active','parked','returning','retrieving')
      AND c.status NOT IN ('with_guest')
    LIMIT 20
  `);
  checks.push({
    name: "Card/order status mismatch",
    status: cardMismatch.length === 0 ? "PASS" : "WARN",
    count: cardMismatch.length,
    details: cardMismatch.length === 0
      ? "Card statuses consistent with order statuses"
      : `${cardMismatch.length} cards have mismatched statuses`,
    rows: cardMismatch,
  });

  const { rows: duplicateActive } = await pool.query(`
    SELECT card_id, COUNT(*) AS cnt
    FROM orders
    WHERE status IN ('active','parked','returning','retrieving')
    GROUP BY card_id
    HAVING COUNT(*) > 1
    LIMIT 20
  `);
  checks.push({
    name: "Multiple active orders per card",
    status: duplicateActive.length === 0 ? "PASS" : "CRITICAL",
    count: duplicateActive.length,
    details: duplicateActive.length === 0
      ? "Each card has at most one active order"
      : `${duplicateActive.length} cards have multiple active orders`,
    rows: duplicateActive,
  });

  const { rows: staleShifts } = await pool.query(`
    SELECT d.id AS driver_id, d.full_name, d.valet_id, s.started_at
    FROM drivers d
    JOIN LATERAL (
      SELECT started_at FROM driver_shifts
      WHERE driver_id = d.id AND ended_at IS NULL
      ORDER BY started_at DESC LIMIT 1
    ) s ON true
    WHERE d.status != 'on_shift'
    LIMIT 20
  `);
  checks.push({
    name: "Driver shift state inconsistency",
    status: staleShifts.length === 0 ? "PASS" : "WARN",
    count: staleShifts.length,
    details: staleShifts.length === 0
      ? "Driver statuses consistent with shift states"
      : `${staleShifts.length} drivers have open shifts but are not on_shift`,
    rows: staleShifts,
  });

  const { rows: staleCards } = await pool.query(`
    SELECT c.id, c.uid, c.status, o.id AS order_id, o.status AS order_status
    FROM nfc_cards c
    LEFT JOIN orders o ON o.card_id = c.id
      AND o.status IN ('active','parked','returning','retrieving')
    WHERE c.status = 'with_guest' AND o.id IS NULL
    LIMIT 20
  `);
  checks.push({
    name: "Cards marked with_guest but no active order",
    status: staleCards.length === 0 ? "PASS" : "WARN",
    count: staleCards.length,
    details: staleCards.length === 0
      ? "No stale card states"
      : `${staleCards.length} cards marked with_guest but have no active order`,
    rows: staleCards,
  });

  const { rows: orphanedDrivers } = await pool.query(`
    SELECT d.id, d.full_name, d.property_id
    FROM drivers d
    LEFT JOIN properties p ON p.id = d.property_id
    WHERE d.property_id IS NOT NULL AND p.id IS NULL
    LIMIT 20
  `);
  checks.push({
    name: "Drivers assigned to deleted properties",
    status: orphanedDrivers.length === 0 ? "PASS" : "CRITICAL",
    count: orphanedDrivers.length,
    details: orphanedDrivers.length === 0
      ? "All driver property assignments valid"
      : `${orphanedDrivers.length} drivers point to deleted properties`,
    rows: orphanedDrivers,
  });

  const allPass = checks.every((c) => c.status === "PASS");
  return {
    status: allPass ? "ALL_PASS" : "ISSUES_FOUND",
    checks,
    timestamp: new Date().toISOString(),
  };
}

module.exports = { listBackups, deleteBackup, restoreBackup, checkConsistency };
