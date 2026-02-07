const crypto = require("crypto");
const http = require("http");
const https = require("https");
const mysql = require("mysql2/promise");
const { verifyQqMusicCookie } = require("../for_others/qqmusic/qqmusic-auth");

const DB_CONFIG = {
  host: process.env.LETTER_DB_HOST || process.env.MAIN_DB_HOST || process.env.DB_HOST || "localhost",
  port: parseInt(
    process.env.LETTER_DB_PORT || process.env.MAIN_DB_PORT || process.env.DB_PORT,
    10
  ) || 3306,
  user: process.env.LETTER_DB_USER || process.env.MAIN_DB_USER || process.env.DB_USER || "root",
  password: process.env.LETTER_DB_PASSWORD || process.env.MAIN_DB_PASSWORD || process.env.DB_PASSWORD || "",
  database: process.env.LETTER_DB_NAME || process.env.MAIN_DB_NAME || process.env.DB_NAME || "warmprompt",
  charset: "utf8mb4",
  timezone: "+08:00",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const ACCOUNT_DB_CONFIG = {
  host: process.env.DB_HOST || process.env.MAIN_DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || process.env.MAIN_DB_PORT, 10) || 3306,
  user: process.env.DB_USER || process.env.MAIN_DB_USER || "root",
  password: process.env.DB_PASSWORD || process.env.MAIN_DB_PASSWORD || "",
  database: process.env.DB_NAME || process.env.MAIN_DB_NAME || "warmprompt",
  charset: "utf8mb4",
  timezone: "+08:00",
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0
};

const SHARE_BASE_URL = String(process.env.SHARE_BASE_URL || "").trim();
const LETTER_SHARE_PATH = String(process.env.LETTER_SHARE_PATH || "/letter-share/index.html").trim();
const BODY_MAX_BYTES = 300 * 1024;
const TOKEN_BYTES = 12;
const TOKEN_RETRY_LIMIT = 5;
const MAX_CONTENT_CHARS = 20000;
const MAX_IMAGE_BYTES = parseInt(process.env.MEDIA_MAX_IMAGE_BYTES, 10) || 500 * 1024 * 1024;
const MAX_VIDEO_BYTES = parseInt(process.env.MEDIA_MAX_VIDEO_BYTES, 10) || 1024 * 1024 * 1024;
const DEBUG_ERRORS = ["1", "true", "yes"].includes(
  String(process.env.LETTER_DEBUG_ERRORS || "").trim().toLowerCase()
);
const MAX_RETENTION_DAYS = parseInt(process.env.RETENTION_MAX_DAYS, 10) || 30;
const RETENTION_DEFAULT_DAYS = parseInt(process.env.RETENTION_DEFAULT_DAYS, 10) || 30;
const RETENTION_FREE_DAYS = parseInt(process.env.RETENTION_FREE_DAYS, 10) || 1;
const RETENTION_TRIAL_DAYS = parseInt(process.env.RETENTION_TRIAL_DAYS, 10) || 3;
const RETENTION_AIR_DAYS = parseInt(process.env.RETENTION_AIR_DAYS, 10) || 7;
const RETENTION_STANDARD_DAYS = parseInt(process.env.RETENTION_STANDARD_DAYS, 10) || 14;
const RETENTION_PRO_DAYS = parseInt(process.env.RETENTION_PRO_DAYS, 10) || 30;
const RETENTION_PRO_MAX_DAYS = parseInt(process.env.RETENTION_PRO_MAX_DAYS, 10) || 30;
const RETENTION_CLEANUP_INTERVAL_MS = parseInt(process.env.RETENTION_CLEANUP_INTERVAL_MS, 10) || 30 * 60 * 1000;
const RETENTION_CLEANUP_BATCH = parseInt(process.env.RETENTION_CLEANUP_BATCH, 10) || 200;
const ACCESS_MAX_LIMIT = parseInt(process.env.ACCESS_MAX_LIMIT, 10) || 10;
const ACCESS_DEFAULT_LIMIT = parseInt(process.env.ACCESS_DEFAULT_LIMIT, 10) || 1;
const ACCESS_FREE_LIMIT = parseInt(process.env.ACCESS_FREE_LIMIT, 10) || 1;
const ACCESS_TRIAL_LIMIT = parseInt(process.env.ACCESS_TRIAL_LIMIT, 10) || 2;
const ACCESS_AIR_LIMIT = parseInt(process.env.ACCESS_AIR_LIMIT, 10) || 3;
const ACCESS_STANDARD_LIMIT = parseInt(process.env.ACCESS_STANDARD_LIMIT, 10) || 5;
const ACCESS_PRO_LIMIT = parseInt(process.env.ACCESS_PRO_LIMIT, 10) || 8;
const ACCESS_PRO_MAX_LIMIT = parseInt(process.env.ACCESS_PRO_MAX_LIMIT, 10) || 10;
const ACCESS_DELETE_GRACE_MS = parseInt(process.env.ACCESS_DELETE_GRACE_MS, 10) || 30000;
const MEDIA_SERVER_UPLOAD_URL = String(process.env.MEDIA_SERVER_UPLOAD_URL || "").trim();
const MEDIA_SERVER_DELETE_URL = String(process.env.MEDIA_SERVER_DELETE_URL || "").trim();
const MEDIA_UPLOAD_TOKEN = String(process.env.MEDIA_UPLOAD_TOKEN || "").trim();
const MEDIA_DELETE_TIMEOUT_MS = parseInt(process.env.MEDIA_DELETE_TIMEOUT_MS, 10) || 8000;
const DAY_MS = 24 * 60 * 60 * 1000;

const LOGIN_EXPIRED_MESSAGE = "登录已过期，请重新登录。";
const CONTENT_TOO_LONG_MESSAGE = `信件内容不能超过 ${MAX_CONTENT_CHARS} 字。`;
const IMAGE_TOO_LARGE_MESSAGE = `你的这个图片已经超过大小 ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB`;
const VIDEO_TOO_LARGE_MESSAGE = `视频已经超过 ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024 / 1024)} GB`;

let dbPool = null;
let accountDbPool = null;
let retentionSchemaReady = false;
let retentionSchemaPromise = null;
let retentionCleanupTimer = null;
let retentionCleanupRunning = false;

function getDbPool() {
  if (!dbPool) {
    try {
      dbPool = mysql.createPool(DB_CONFIG);
    } catch (error) {
      return null;
    }
  }
  return dbPool;
}

function getAccountDbPool() {
  if (!accountDbPool) {
    try {
      accountDbPool = mysql.createPool(ACCOUNT_DB_CONFIG);
    } catch (error) {
      return null;
    }
  }
  return accountDbPool;
}

async function dbQueryOne(sql, params = []) {
  const pool = getDbPool();
  if (!pool) return null;
  const [rows] = await pool.execute(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

async function dbExecute(sql, params = []) {
  const pool = getDbPool();
  if (!pool) return null;
  const [result] = await pool.execute(sql, params);
  return result;
}

async function accountDbQueryOne(sql, params = []) {
  const pool = getAccountDbPool();
  if (!pool) return null;
  const [rows] = await pool.execute(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function getRequestIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const realIp = req.headers["x-real-ip"];
  let ip = "";
  if (forwarded) {
    ip = forwarded.split(",")[0].trim();
  } else if (realIp) {
    ip = String(realIp).trim();
  } else if (req.socket && req.socket.remoteAddress) {
    ip = req.socket.remoteAddress;
  }
  if (ip.startsWith("::ffff:")) {
    ip = ip.slice(7);
  }
  return ip || "unknown";
}

function parseJsonBody(req, maxBytes = BODY_MAX_BYTES) {
  return new Promise((resolve, reject) => {
    let body = "";
    let finished = false;

    const safeResolve = (value) => {
      if (finished) return;
      finished = true;
      resolve(value);
    };

    const safeReject = (error) => {
      if (finished) return;
      finished = true;
      reject(error);
    };

    req.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > maxBytes) {
        const error = new Error("BODY_TOO_LARGE");
        error.code = "BODY_TOO_LARGE";
        safeReject(error);
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        safeResolve(JSON.parse(body || "{}"));
      } catch (error) {
        safeReject(error);
      }
    });
    req.on("error", safeReject);
  });
}

function normalizeString(value, maxLength = 255) {
  if (value === null || value === undefined) return "";
  return String(value).trim().slice(0, maxLength);
}

function normalizeNumber(value, fallback, minValue, maxValue) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  if (minValue !== undefined && num < minValue) return minValue;
  if (maxValue !== undefined && num > maxValue) return maxValue;
  return num;
}

function normalizeContentType(value) {
  const type = String(value || "").toLowerCase();
  if (type === "official" || type === "custom") return type;
  return "custom";
}

function normalizeFontType(value) {
  const type = String(value || "").toLowerCase();
  if (type === "hand" || type === "mi") return type;
  return "mi";
}

function normalizeTypingSpeed(value) {
  const speed = String(value || "").toLowerCase();
  if (speed === "slow" || speed === "fast" || speed === "normal") return speed;
  return "normal";
}

function normalizeMediaType(value) {
  const type = String(value || "").toLowerCase();
  if (type === "image" || type === "video") return type;
  return "none";
}

function resolveAuthState(req) {
  const authResult = verifyQqMusicCookie(req);
  if (authResult && authResult.valid && authResult.accountId) {
    return { loggedIn: true, accountId: String(authResult.accountId).trim() };
  }
  if (authResult && authResult.valid && !authResult.accountId) {
    return { expired: true };
  }
  if (authResult && authResult.error && authResult.error !== "missing") {
    return { expired: true };
  }
  return { loggedIn: false, accountId: "" };
}

function clampRetentionDays(value, fallback) {
  const num = parseInt(value, 10);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.min(num, MAX_RETENTION_DAYS);
}

function clampAccessLimit(value, fallback) {
  const num = parseInt(value, 10);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.min(num, ACCESS_MAX_LIMIT);
}

function getDefaultRetentionDays() {
  return clampRetentionDays(RETENTION_DEFAULT_DAYS, MAX_RETENTION_DAYS);
}

function getDefaultAccessLimit() {
  return clampAccessLimit(ACCESS_DEFAULT_LIMIT, 1);
}

function getRetentionDaysByType(type) {
  const normalized = String(type || "").toLowerCase();
  if (normalized === "trial") return clampRetentionDays(RETENTION_TRIAL_DAYS, 3);
  if (normalized === "air") return clampRetentionDays(RETENTION_AIR_DAYS, 7);
  if (normalized === "standard") return clampRetentionDays(RETENTION_STANDARD_DAYS, 14);
  if (normalized === "pro") return clampRetentionDays(RETENTION_PRO_DAYS, 30);
  if (normalized === "pro_max" || normalized === "promax" || normalized === "max") {
    return clampRetentionDays(RETENTION_PRO_MAX_DAYS, 30);
  }
  return getDefaultRetentionDays();
}

function getAccessLimitByType(type) {
  const normalized = String(type || "").toLowerCase();
  if (normalized === "trial") return clampAccessLimit(ACCESS_TRIAL_LIMIT, 2);
  if (normalized === "air") return clampAccessLimit(ACCESS_AIR_LIMIT, 3);
  if (normalized === "standard") return clampAccessLimit(ACCESS_STANDARD_LIMIT, 5);
  if (normalized === "pro") return clampAccessLimit(ACCESS_PRO_LIMIT, 8);
  if (normalized === "pro_max" || normalized === "promax" || normalized === "max") {
    return clampAccessLimit(ACCESS_PRO_MAX_LIMIT, 10);
  }
  return getDefaultAccessLimit();
}

async function getAccountType(accountId) {
  if (!accountId) return "";
  try {
    const row = await accountDbQueryOne(
      "SELECT type FROM accounts WHERE account_id = ? LIMIT 1",
      [accountId]
    );
    return row && row.type ? String(row.type).trim() : "";
  } catch (error) {
    return "";
  }
}

async function resolveRetentionDays(authState) {
  if (!authState || !authState.loggedIn) {
    return clampRetentionDays(RETENTION_FREE_DAYS, 1);
  }
  const accountType = await getAccountType(authState.accountId);
  if (!accountType) {
    return clampRetentionDays(RETENTION_FREE_DAYS, 1);
  }
  return getRetentionDaysByType(accountType);
}

async function resolveAccessLimit(authState) {
  if (!authState || !authState.loggedIn) {
    return clampAccessLimit(ACCESS_FREE_LIMIT, 1);
  }
  const accountType = await getAccountType(authState.accountId);
  if (!accountType) {
    return clampAccessLimit(ACCESS_FREE_LIMIT, 1);
  }
  return getAccessLimitByType(accountType);
}

function resolveMediaDeleteUrl() {
  if (MEDIA_SERVER_DELETE_URL) return MEDIA_SERVER_DELETE_URL;
  if (!MEDIA_SERVER_UPLOAD_URL) return "";
  try {
    const url = new URL(MEDIA_SERVER_UPLOAD_URL);
    url.pathname = "/api/delete";
    url.search = "";
    return url.toString();
  } catch (error) {
    return "";
  }
}

function extractMediaDeletePath(mediaUrl) {
  if (!mediaUrl) return "";
  try {
    const base = mediaUrl.startsWith("http") ? undefined : "http://localhost";
    const url = new URL(mediaUrl, base);
    const match = url.pathname.match(/\/media\/(images|videos)\/([^/]+)$/);
    if (!match) return "";
    const folder = match[1];
    const filename = decodeURIComponent(match[2]);
    if (!filename) return "";
    return `${folder}/${filename}`;
  } catch (error) {
    return "";
  }
}

function requestMediaDelete(paths) {
  const deleteUrl = resolveMediaDeleteUrl();
  if (!deleteUrl || !MEDIA_UPLOAD_TOKEN) return Promise.resolve(false);
  const list = Array.isArray(paths) ? paths.filter(Boolean) : [];
  if (list.length === 0) return Promise.resolve(false);

  return new Promise((resolve) => {
    let url;
    try {
      url = new URL(deleteUrl);
    } catch (error) {
      resolve(false);
      return;
    }

    const payload = JSON.stringify({ paths: list });
    const isHttps = url.protocol === "https:";
    const client = isHttps ? https : http;
    const req = client.request(
      {
        method: "POST",
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: `${url.pathname}${url.search || ""}`,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          "x-upload-token": MEDIA_UPLOAD_TOKEN
        },
        timeout: MEDIA_DELETE_TIMEOUT_MS
      },
      (res) => {
        res.on("data", () => {});
        res.on("end", () => resolve(res.statusCode >= 200 && res.statusCode < 300));
      }
    );

    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.on("error", () => resolve(false));
    req.write(payload);
    req.end();
  });
}

async function ensureRetentionSchema() {
  if (retentionSchemaReady) return true;
  if (retentionSchemaPromise) return retentionSchemaPromise;

  retentionSchemaPromise = (async () => {
    try {
      const pool = getDbPool();
      if (!pool) return false;
      const defaultRetention = getDefaultRetentionDays();

      const [columns] = await pool.execute(
        "SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?",
        ["letter_submissions"]
      );
      const columnSet = new Set(columns.map((row) => row.COLUMN_NAME));

    if (!columnSet.has("account_id")) {
      await pool.execute(
        "ALTER TABLE letter_submissions ADD COLUMN account_id VARCHAR(50) DEFAULT NULL AFTER client_ip"
      );
    }
    if (!columnSet.has("retention_days")) {
      await pool.execute(
        `ALTER TABLE letter_submissions ADD COLUMN retention_days INT UNSIGNED NOT NULL DEFAULT ${defaultRetention} AFTER account_id`
      );
    }
    if (!columnSet.has("expires_at")) {
      await pool.execute(
        "ALTER TABLE letter_submissions ADD COLUMN expires_at DATETIME NULL AFTER retention_days"
      );
    }
    if (!columnSet.has("access_limit")) {
      await pool.execute(
        `ALTER TABLE letter_submissions ADD COLUMN access_limit INT UNSIGNED NOT NULL DEFAULT ${getDefaultAccessLimit()} AFTER expires_at`
      );
    }
    if (!columnSet.has("access_used")) {
      await pool.execute(
        "ALTER TABLE letter_submissions ADD COLUMN access_used INT UNSIGNED NOT NULL DEFAULT 0 AFTER access_limit"
      );
    }

    const [indexes] = await pool.execute(
      "SELECT INDEX_NAME FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ?",
      ["letter_submissions"]
    );
    const indexSet = new Set(indexes.map((row) => row.INDEX_NAME));
    if (!indexSet.has("idx_expires_at")) {
      await pool.execute("ALTER TABLE letter_submissions ADD INDEX idx_expires_at (expires_at)");
    }
    if (!indexSet.has("idx_account_id")) {
      await pool.execute("ALTER TABLE letter_submissions ADD INDEX idx_account_id (account_id)");
    }

    await pool.execute(
      "UPDATE letter_submissions SET expires_at = DATE_ADD(created_at, INTERVAL retention_days DAY) WHERE expires_at IS NULL"
    );

      retentionSchemaReady = true;
      return true;
    } catch (error) {
      retentionSchemaPromise = null;
      retentionSchemaReady = false;
      return false;
    }
  })();

  return retentionSchemaPromise;
}

function resolveExpiryFromRecord(record) {
  const retentionDays = clampRetentionDays(record.retention_days, getDefaultRetentionDays());
  if (record.expires_at) {
    const expiresAt = new Date(record.expires_at);
    return {
      expired: Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() <= Date.now(),
      expiresAt,
      retentionDays,
      shouldUpdate: false
    };
  }

  if (record.created_at) {
    const createdAt = new Date(record.created_at).getTime();
    if (Number.isFinite(createdAt)) {
      const expiresAt = new Date(createdAt + retentionDays * DAY_MS);
      return {
        expired: expiresAt.getTime() <= Date.now(),
        expiresAt,
        retentionDays,
        shouldUpdate: true
      };
    }
  }

  return {
    expired: false,
    expiresAt: null,
    retentionDays,
    shouldUpdate: false
  };
}

function isAccessLimitReached(record) {
  const limit = clampAccessLimit(record.access_limit, getDefaultAccessLimit());
  const used = Number.isFinite(Number(record.access_used)) ? Number(record.access_used) : 0;
  return used >= limit;
}

async function updateRecordExpiry(letterId, expiresAt, retentionDays) {
  if (!letterId || !expiresAt) return;
  await dbExecute(
    "UPDATE letter_submissions SET expires_at = ?, retention_days = ? WHERE letter_id = ?",
    [expiresAt, retentionDays, letterId]
  );
}

async function deleteLetterRecord(record) {
  if (!record) return;
  const mediaPath = extractMediaDeletePath(record.media_url || "");
  if (mediaPath) {
    void requestMediaDelete([mediaPath]);
  }
  await dbExecute("DELETE FROM letter_submissions WHERE letter_id = ?", [record.letter_id]);
}

function scheduleLetterDelete(record, delayMs) {
  if (!record) return;
  const delay = Number.isFinite(Number(delayMs)) ? Number(delayMs) : 0;
  if (!delay || delay <= 0) {
    void deleteLetterRecord(record);
    return;
  }
  setTimeout(() => {
    void deleteLetterRecord(record);
  }, delay);
}

async function incrementAccessCount(shareToken) {
  const result = await dbExecute(
    `UPDATE letter_submissions
       SET access_used = access_used + 1
     WHERE share_token = ?
       AND (access_limit IS NULL OR access_used < access_limit)`,
    [shareToken]
  );
  return Boolean(result && result.affectedRows);
}

async function cleanupExpiredLetters() {
  if (retentionCleanupRunning) return;
  retentionCleanupRunning = true;
  try {
    const ready = await ensureRetentionSchema();
    if (!ready) return;
    const pool = getDbPool();
    if (!pool) return;

    const [rows] = await pool.execute(
      "SELECT letter_id, media_url FROM letter_submissions WHERE expires_at IS NOT NULL AND expires_at <= NOW() LIMIT ?",
      [RETENTION_CLEANUP_BATCH]
    );
    if (!rows || rows.length === 0) return;

    for (const row of rows) {
      const mediaPath = extractMediaDeletePath(row.media_url || "");
      if (mediaPath) {
        await requestMediaDelete([mediaPath]);
      }
      await dbExecute("DELETE FROM letter_submissions WHERE letter_id = ?", [row.letter_id]);
    }
  } catch (error) {
    return;
  } finally {
    retentionCleanupRunning = false;
  }
}

function startRetentionCleanup() {
  if (retentionCleanupTimer || RETENTION_CLEANUP_INTERVAL_MS <= 0) return;
  retentionCleanupTimer = setInterval(cleanupExpiredLetters, RETENTION_CLEANUP_INTERVAL_MS);
  cleanupExpiredLetters();
}

function normalizeSharePath(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "/letter-share/index.html";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function buildShareUrl(req, token) {
  const safeToken = encodeURIComponent(token);
  const sharePath = normalizeSharePath(LETTER_SHARE_PATH);
  if (SHARE_BASE_URL) {
    return `${SHARE_BASE_URL.replace(/\/+$/, "")}${sharePath}?token=${safeToken}`;
  }
  const protoHeader = String(req.headers["x-forwarded-proto"] || "http");
  const proto = protoHeader.split(",")[0].trim() || "http";
  const hostHeader = String(req.headers["x-forwarded-host"] || req.headers.host || "");
  const host = hostHeader.split(",")[0].trim();
  if (!host) {
    return `${sharePath}?token=${safeToken}`;
  }
  return `${proto}://${host}${sharePath}?token=${safeToken}`;
}

async function generateShareToken() {
  for (let i = 0; i < TOKEN_RETRY_LIMIT; i += 1) {
    const token = crypto.randomBytes(TOKEN_BYTES).toString("hex");
    const existing = await dbQueryOne(
      "SELECT letter_id FROM letter_submissions WHERE share_token = ? LIMIT 1",
      [token]
    );
    if (!existing) {
      return token;
    }
  }
  throw new Error("TOKEN_GENERATION_FAILED");
}

function parseShareToken(req, pathname) {
  const host = req.headers.host || "localhost";
  const url = new URL(req.url, `http://${host}`);
  const queryToken = url.searchParams.get("token");
  if (queryToken) return queryToken.trim();
  const match = pathname.match(/^\/api\/letter\/share\/([^/]+)$/);
  if (match) return match[1].trim();
  return "";
}

function validateMediaBytes(mediaType, mediaBytes) {
  if (mediaType !== "image" && mediaType !== "video") return { ok: true };
  if (!mediaBytes || !Number.isFinite(mediaBytes) || mediaBytes <= 0) {
    return { ok: false, message: "缺少媒体大小信息。" };
  }
  const limit = mediaType === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (mediaBytes > limit) {
    return {
      ok: false,
      message: mediaType === "video" ? VIDEO_TOO_LARGE_MESSAGE : IMAGE_TOO_LARGE_MESSAGE
    };
  }
  return { ok: true };
}

function isDbError(error) {
  if (!error) return false;
  const code = String(error.code || "");
  return code.startsWith("ER_") || Boolean(error.sqlState);
}

function buildDebugInfo(error) {
  if (!DEBUG_ERRORS || !error) return null;
  return {
    code: error.code || "",
    errno: error.errno || "",
    sqlState: error.sqlState || "",
    message: error.sqlMessage || error.message || ""
  };
}

function buildErrorPayload(message, error) {
  const debugInfo = buildDebugInfo(error);
  const debugHint = debugInfo
    ? debugInfo.code || debugInfo.sqlState || debugInfo.errno || debugInfo.message
    : "";
  return {
    success: false,
    message: debugHint ? `${message} (${debugHint})` : message,
    error: debugInfo || undefined
  };
}

async function handleLetterSubmit(req, res) {
  try {
    const authState = resolveAuthState(req);
    if (authState.expired) {
      sendJson(res, 403, { success: false, message: LOGIN_EXPIRED_MESSAGE });
      return;
    }

    const schemaReady = await ensureRetentionSchema();
    if (!schemaReady) {
      sendJson(res, 500, { success: false, message: "数据库不可用。" });
      return;
    }

    const data = await parseJsonBody(req);

    const recipientName = normalizeString(data.recipientName, 32);
    const senderName = normalizeString(data.senderName, 32);
    const cardContent = data.cardContent === null || data.cardContent === undefined
      ? ""
      : String(data.cardContent).trim();

    if (!recipientName || !senderName) {
      sendJson(res, 400, { success: false, message: "缺少收信人或署名。" });
      return;
    }

    if (!cardContent) {
      sendJson(res, 400, { success: false, message: "请输入信件内容。" });
      return;
    }

    if (cardContent.length > MAX_CONTENT_CHARS) {
      sendJson(res, 413, { success: false, message: CONTENT_TOO_LONG_MESSAGE });
      return;
    }

    const contentType = normalizeContentType(data.contentType);
    const fontType = normalizeFontType(data.fontType);
    const typingSpeed = normalizeTypingSpeed(data.typingSpeed);

    const mediaType = normalizeMediaType(data.mediaType);
    const mediaUrl = mediaType === "none" ? "" : normalizeString(data.mediaUrl, 1024);
    const mediaName = mediaType === "none" ? "" : normalizeString(data.mediaName, 255);
    const mediaBytes = mediaType === "none"
      ? 0
      : Math.floor(normalizeNumber(data.mediaBytes, 0, 0));

    if (mediaType !== "none" && !mediaUrl) {
      sendJson(res, 400, { success: false, message: "媒体链接缺失。" });
      return;
    }

    const mediaCheck = validateMediaBytes(mediaType, mediaBytes);
    if (!mediaCheck.ok) {
      sendJson(res, 413, { success: false, message: mediaCheck.message || "媒体过大。" });
      return;
    }

    const musicSource = normalizeString(data.musicSource, 16) || "none";
    const musicUrl = normalizeString(data.musicUrl, 1024);
    let musicData = null;
    if (data.musicData && typeof data.musicData === "object") {
      try {
        musicData = JSON.stringify(data.musicData);
      } catch (error) {
        musicData = null;
      }
    } else if (typeof data.musicData === "string") {
      musicData = normalizeString(data.musicData, 8000);
    }

    const playbackMode = normalizeString(data.playbackMode, 16) || "full";
    const snippetStartTime = normalizeNumber(data.snippetStartTime, 0, 0, 36000);

    const token = await generateShareToken();
    const shareUrl = buildShareUrl(req, token);
    const retentionDays = await resolveRetentionDays(authState);
    const accessLimit = await resolveAccessLimit(authState);

    const accountId = authState.loggedIn ? authState.accountId : null;

    const result = await dbExecute(
      `INSERT INTO letter_submissions
        (share_token, share_url, recipient_name, sender_name, letter_content, content_type,
         font_type, typing_speed, media_type, media_url, media_name, media_bytes,
         music_source, music_url, music_data, playback_mode, snippet_start_time, client_ip, account_id,
         retention_days, expires_at, access_limit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY), ?)`,
      [
        token,
        shareUrl,
        recipientName,
        senderName,
        cardContent,
        contentType,
        fontType,
        typingSpeed,
        mediaType === "none" ? "none" : mediaType,
        mediaUrl || null,
        mediaName || null,
        mediaBytes || 0,
        musicSource,
        musicUrl || null,
        musicData,
        playbackMode,
        snippetStartTime,
        getRequestIp(req),
        accountId,
        retentionDays,
        retentionDays,
        accessLimit
      ]
    );

    if (!result) {
      sendJson(res, 500, { success: false, message: "数据库不可用。" });
      return;
    }

    sendJson(res, 200, {
      success: true,
      data: {
        shareToken: token,
        shareUrl
      }
    });
  } catch (error) {
    if (isDbError(error)) {
      console.error("Letter submit database error:", error);
      sendJson(res, 500, buildErrorPayload("数据库错误，请检查信件库配置或表结构。", error));
      return;
    }
    if (error && error.code === "BODY_TOO_LARGE") {
      sendJson(res, 413, buildErrorPayload("请求体过大。", error));
      return;
    }
    console.error("Letter submit request error:", error);
    sendJson(res, 400, buildErrorPayload("请求无效。", error));
  }
}

async function handleLetterShare(req, res, pathname) {
  try {
    const schemaReady = await ensureRetentionSchema();
    if (!schemaReady) {
      sendJson(res, 500, { success: false, message: "服务器错误。" });
      return;
    }

    const token = parseShareToken(req, pathname);
    if (!token) {
      sendJson(res, 400, { success: false, message: "缺少 token。" });
      return;
    }

    const accessOk = await incrementAccessCount(token);
    if (!accessOk) {
      const blockedRecord = await dbQueryOne(
        `SELECT letter_id, media_url, retention_days, expires_at, created_at,
                access_limit, access_used
           FROM letter_submissions
          WHERE share_token = ?
          LIMIT 1`,
        [token]
      );
      if (blockedRecord) {
        const expiry = resolveExpiryFromRecord(blockedRecord);
        if (expiry.expired || isAccessLimitReached(blockedRecord)) {
          await deleteLetterRecord(blockedRecord);
        }
      }
      sendJson(res, 404, { success: false, message: "未找到分享内容。" });
      return;
    }

    const record = await dbQueryOne(
      `SELECT letter_id, share_token, recipient_name, sender_name, letter_content, content_type,
              font_type, typing_speed, media_type, media_url, media_name, media_bytes,
              music_source, music_url, music_data, playback_mode, snippet_start_time,
              retention_days, expires_at, created_at, access_limit, access_used
         FROM letter_submissions
        WHERE share_token = ?
        LIMIT 1`,
      [token]
    );

    if (!record) {
      sendJson(res, 404, { success: false, message: "未找到分享内容。" });
      return;
    }

    const expiry = resolveExpiryFromRecord(record);
    if (expiry.shouldUpdate && expiry.expiresAt) {
      void updateRecordExpiry(record.letter_id, expiry.expiresAt, expiry.retentionDays);
    }
    if (expiry.expired) {
      await deleteLetterRecord(record);
      sendJson(res, 404, { success: false, message: "未找到分享内容。" });
      return;
    }

    if (isAccessLimitReached(record)) {
      scheduleLetterDelete(record, ACCESS_DELETE_GRACE_MS);
    }

    let musicData = null;
    if (record.music_data) {
      try {
        musicData = JSON.parse(record.music_data);
      } catch (error) {
        musicData = record.music_data;
      }
    }

    sendJson(res, 200, {
      success: true,
      data: {
        shareToken: record.share_token,
        recipientName: record.recipient_name,
        senderName: record.sender_name,
        cardContent: record.letter_content,
        contentType: record.content_type,
        fontType: record.font_type,
        typingSpeed: record.typing_speed,
        mediaType: record.media_type,
        mediaUrl: record.media_url,
        mediaName: record.media_name,
        mediaBytes: record.media_bytes,
        musicSource: record.music_source,
        musicUrl: record.music_url,
        musicData,
        playbackMode: record.playback_mode,
        snippetStartTime: record.snippet_start_time,
        createdAt: record.created_at
      }
    });
  } catch (error) {
    sendJson(res, 500, { success: false, message: "服务器错误。" });
  }
}

function handleLetterRequest(req, res, pathname) {
  if (pathname === "/api/letter/submit" && req.method === "POST") {
    handleLetterSubmit(req, res);
    return true;
  }

  if (pathname.startsWith("/api/letter/share") && req.method === "GET") {
    handleLetterShare(req, res, pathname);
    return true;
  }

  return false;
}

startRetentionCleanup();

module.exports = {
  handleLetterRequest
};
