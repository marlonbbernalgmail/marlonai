import mysql from "mysql2/promise";
import type { Pool, RowDataPacket } from "mysql2/promise";

let pool: Pool | null = null;
let warnedLoggingDisabled = false;

const REQUIRED_DB_ENV = [
  "MYSQL_HOST",
  "MYSQL_USER",
  "MYSQL_PASSWORD",
  "MYSQL_DATABASE",
] as const;

export interface DatabaseConfigStatus {
  configured: boolean;
  missing: string[];
  host?: string;
  port: string;
  database?: string;
}

export function getDatabaseConfigStatus(): DatabaseConfigStatus {
  const missing = REQUIRED_DB_ENV.filter((name) => !process.env[name]);

  return {
    configured: missing.length === 0,
    missing,
    host: process.env.MYSQL_HOST,
    port: process.env.MYSQL_PORT ?? "3306",
    database: process.env.MYSQL_DATABASE,
  };
}

export function isDatabaseConfigured(): boolean {
  return getDatabaseConfigStatus().configured;
}

export function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST ?? "localhost",
      port: parseInt(process.env.MYSQL_PORT ?? "3306", 10),
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 10,
      charset: "utf8mb4",
    });
  }
  return pool;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
  warnedLoggingDisabled = false;
}

export async function initDb(): Promise<void> {
  const status = getDatabaseConfigStatus();
  if (!status.configured) {
    console.warn(
      `[db] MySQL not configured — interaction logging disabled. Missing: ${status.missing.join(", ")}`
    );
    return;
  }

  const db = getPool();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS interactions (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      question      TEXT         NOT NULL,
      answer        TEXT         NOT NULL,
      ip_address    VARCHAR(45)  NOT NULL,
      forwarded_ips VARCHAR(500) NULL,
      user_agent    TEXT         NULL,
      referer       VARCHAR(500) NULL,
      response_ms   INT          NULL,
      model         VARCHAR(100) NULL,
      status        ENUM('success','error') DEFAULT 'success',
      accuracy      ENUM('unreviewed','accurate','inaccurate') DEFAULT 'unreviewed',
      notes         TEXT         NULL,
      created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ip   (ip_address),
      INDEX idx_ts   (created_at),
      INDEX idx_flag (accuracy)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS ip_blocklist (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      ip_address VARCHAR(45)  NOT NULL UNIQUE,
      reason     VARCHAR(500) NULL,
      blocked_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ip (ip_address)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  console.log("[db] Tables ready");
}

// ── Write ────────────────────────────────────────────────────────────────────

export interface InteractionRecord {
  question: string;
  answer: string;
  ip_address: string;
  forwarded_ips?: string;
  user_agent?: string;
  referer?: string;
  response_ms?: number;
  model?: string;
  status?: "success" | "error";
}

export async function logInteraction(r: InteractionRecord): Promise<void> {
  if (!isDatabaseConfigured()) {
    if (!warnedLoggingDisabled) {
      warnedLoggingDisabled = true;
      console.warn("[db] Interaction logging skipped because MySQL is not configured");
    }
    return;
  }
  try {
    console.log("[db] Executing INSERT for interaction...");
    await getPool().execute(
      `INSERT INTO interactions
         (question, answer, ip_address, forwarded_ips, user_agent, referer, response_ms, model, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.question,
        r.answer,
        r.ip_address,
        r.forwarded_ips ?? null,
        r.user_agent ?? null,
        r.referer ?? null,
        r.response_ms ?? null,
        r.model ?? process.env.OLLAMA_MODEL ?? null,
        r.status ?? "success",
      ]
    );
    console.log("[db] INSERT successful");
  } catch (err) {
    console.error("[db] logInteraction failed:", err);
  }
}

export async function isIpBlocked(ip: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  try {
    const [rows] = await getPool().execute<RowDataPacket[]>(
      "SELECT 1 FROM ip_blocklist WHERE ip_address = ? LIMIT 1",
      [ip]
    );
    return rows.length > 0;
  } catch (err) {
    console.error("[db] isIpBlocked failed:", err);
    return false; // fail open — never block due to DB error
  }
}

// ── Admin reads ──────────────────────────────────────────────────────────────

export interface InteractionRow extends RowDataPacket {
  id: number;
  question: string;
  answer: string;
  ip_address: string;
  forwarded_ips: string | null;
  user_agent: string | null;
  referer: string | null;
  response_ms: number | null;
  model: string | null;
  status: "success" | "error";
  accuracy: "unreviewed" | "accurate" | "inaccurate";
  notes: string | null;
  created_at: Date;
}

export interface BlocklistRow extends RowDataPacket {
  id: number;
  ip_address: string;
  reason: string | null;
  blocked_at: Date;
}

export interface StatsRow extends RowDataPacket {
  total: number;
  today: number;
  unique_ips: number;
  blocked_ips: number;
  unreviewed: number;
}

export interface IpStatsRow extends RowDataPacket {
  ip_address: string;
  request_count: number;
  last_seen: Date;
  is_blocked: number;
}

export async function getStats(): Promise<StatsRow> {
  const [rows] = await getPool().execute<StatsRow[]>(`
    SELECT
      (SELECT COUNT(*)                    FROM interactions)                           AS total,
      (SELECT COUNT(*)                    FROM interactions WHERE DATE(created_at) = CURDATE()) AS today,
      (SELECT COUNT(DISTINCT ip_address)  FROM interactions)                           AS unique_ips,
      (SELECT COUNT(*)                    FROM ip_blocklist)                           AS blocked_ips,
      (SELECT COUNT(*)                    FROM interactions WHERE accuracy = 'unreviewed') AS unreviewed
  `);
  return rows[0];
}

export async function getInteractions(
  page: number,
  perPage: number,
  filterIp?: string,
  filterAccuracy?: string
): Promise<{ rows: InteractionRow[]; total: number }> {
  const db = getPool();
  const conds: string[] = [];
  const args: (string | number)[] = [];

  if (filterIp) {
    conds.push("ip_address = ?");
    args.push(filterIp);
  }
  if (filterAccuracy && ["unreviewed", "accurate", "inaccurate"].includes(filterAccuracy)) {
    conds.push("accuracy = ?");
    args.push(filterAccuracy);
  }

  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const [[{ total }]] = await db.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM interactions ${where}`,
    args
  );
  const offset = (page - 1) * perPage;
  const [rows] = await db.execute<InteractionRow[]>(
    `SELECT * FROM interactions ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...args, perPage, offset]
  );
  return { rows, total: total as number };
}

export async function getBlocklist(): Promise<BlocklistRow[]> {
  const [rows] = await getPool().execute<BlocklistRow[]>(
    "SELECT * FROM ip_blocklist ORDER BY blocked_at DESC"
  );
  return rows;
}

export async function getIpStats(): Promise<IpStatsRow[]> {
  const [rows] = await getPool().execute<IpStatsRow[]>(`
    SELECT
      i.ip_address,
      COUNT(*)         AS request_count,
      MAX(i.created_at) AS last_seen,
      IF(b.ip_address IS NOT NULL, 1, 0) AS is_blocked
    FROM interactions i
    LEFT JOIN ip_blocklist b ON i.ip_address = b.ip_address
    GROUP BY i.ip_address
    ORDER BY request_count DESC
    LIMIT 100
  `);
  return rows;
}

// ── Admin writes ─────────────────────────────────────────────────────────────

export async function blockIp(ip: string, reason?: string): Promise<void> {
  await getPool().execute(
    "INSERT IGNORE INTO ip_blocklist (ip_address, reason) VALUES (?, ?)",
    [ip, reason ?? null]
  );
}

export async function unblockIp(ip: string): Promise<void> {
  await getPool().execute("DELETE FROM ip_blocklist WHERE ip_address = ?", [ip]);
}

export async function updateAccuracy(
  id: number,
  accuracy: "unreviewed" | "accurate" | "inaccurate",
  notes?: string
): Promise<void> {
  if (notes !== undefined) {
    await getPool().execute(
      "UPDATE interactions SET accuracy = ?, notes = ? WHERE id = ?",
      [accuracy, notes, id]
    );
  } else {
    await getPool().execute(
      "UPDATE interactions SET accuracy = ? WHERE id = ?",
      [accuracy, id]
    );
  }
}
