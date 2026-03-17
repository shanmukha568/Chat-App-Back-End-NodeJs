import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

function parseBoolean(value) {
  if (value == null) return null;
  const s = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(s)) return true;
  if (["0", "false", "no", "n", "off"].includes(s)) return false;
  return null;
}

function buildSslOptions({ dbUrl, host } = {}) {
  const enabledFromEnv = parseBoolean(process.env.DB_SSL);
  const enabledFromUrl =
    dbUrl?.searchParams?.get("ssl") ??
    dbUrl?.searchParams?.get("sslmode") ??
    dbUrl?.searchParams?.get("ssl-mode");

  const defaultEnabled =
    process.env.NODE_ENV === "production" &&
    host != null &&
    !["localhost", "127.0.0.1"].includes(String(host).toLowerCase());

  const enabled =
    enabledFromEnv ??
    (enabledFromUrl
      ? ["1", "true", "required", "require"].includes(String(enabledFromUrl).toLowerCase())
      : null) ??
    defaultEnabled;

  if (!enabled) return undefined;

  const rejectUnauthorized =
    parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED) ??
    (process.env.NODE_ENV === "production" ? true : false);

  return { rejectUnauthorized };
}

function parseMySqlUrl(raw) {
  const url = new URL(raw);
  if (!["mysql:", "mysql2:"].includes(url.protocol)) {
    throw new Error(`Unsupported DB URL protocol: ${url.protocol}`);
  }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username || ""),
    password: decodeURIComponent(url.password || ""),
    database: decodeURIComponent((url.pathname || "").replace(/^\//, "")),
    ssl: buildSslOptions({ dbUrl: url, host: url.hostname }),
  };
}

function buildDbConfig() {
  const rawUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;
  if (rawUrl) return parseMySqlUrl(rawUrl);

  // Back-compat / convenience:
  // If someone puts a full mysql://... URL into DB_HOST, treat it as a URL.
  // (Useful for Railway where you may copy a single connection string.)
  const dbHostRaw = process.env.DB_HOST;
  if (dbHostRaw && /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(dbHostRaw)) {
    return parseMySqlUrl(dbHostRaw);
  }

  const host =
    dbHostRaw ||
    process.env.MYSQLHOST ||
    process.env.MYSQL_HOST ||
    "localhost";

  const port = Number(process.env.DB_PORT || process.env.MYSQLPORT || process.env.MYSQL_PORT || 3306);
  const database = process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || "whatsapp_lite";
  const user = process.env.DB_USER || process.env.MYSQLUSER || process.env.MYSQL_USER || "root";
  const password = process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || "root";

  return { host, port, database, user, password, ssl: buildSslOptions({ host }) };
}

const dbConfig = buildDbConfig();

const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  timezone: "Z", // store/retrieve all DATETIMEs as UTC
  charset: "utf8mb4",
  supportBigNumbers: true,
  bigNumberStrings: false,
});

export async function testConnection() {
  const conn = await pool.getConnection();
  console.log("✅  MySQL connected — pool ready");
  conn.release();
}

export default pool;
