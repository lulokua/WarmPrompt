const crypto = require("crypto");
const http = require("http");
const https = require("https");
const mysql = require("mysql2/promise");
const { verifyQqMusicCookie } = require("../for_others/qqmusic/qqmusic-auth");

const DB_CONFIG = {
  host: process.env.GIFT_DB_HOST || process.env.MAIN_DB_HOST || process.env.DB_HOST || "localhost",
  port: parseInt(
    process.env.GIFT_DB_PORT || process.env.MAIN_DB_PORT || process.env.DB_PORT,
    10
  ) || 3306,
  user: process.env.GIFT_DB_USER || process.env.MAIN_DB_USER || process.env.DB_USER || "root",
  password: process.env.GIFT_DB_PASSWORD || process.env.MAIN_DB_PASSWORD || process.env.DB_PASSWORD || "",
  database: process.env.GIFT_DB_NAME || process.env.MAIN_DB_NAME || process.env.DB_NAME || "warmprompt",
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

const DAILY_LIMIT_TZ_OFFSET = String(process.env.DAILY_LIMIT_TZ_OFFSET || DB_CONFIG.timezone || "+08:00").trim();

const SHARE_BASE_URL = String(process.env.SHARE_BASE_URL || "").trim();
const BODY_MAX_BYTES = 200 * 1024;
const TOKEN_BYTES = 12;
const TOKEN_RETRY_LIMIT = 5;
const FREE_GIFT_LIMIT = 2;
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
const FREE_LIMIT_MESSAGE = "每天两次的免费额度已经用完了。如果需要更多次数，请返回主页升级 VIP Air 版。";
const LOGIN_EXPIRED_MESSAGE = "登录已过期，请重新登录。";

let dbPool = null;
let accountDbPool = null;
const freeGiftDailyMap = new Map();
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

async function accountDbExecute(sql, params = []) {
  const pool = getAccountDbPool();
  if (!pool) return null;
  const [result] = await pool.execute(sql, params);
  return result;
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

function parseTimezoneOffset(value) {
  if (!value) return null;
  const trimmed = String(value).trim().toUpperCase();
  if (trimmed === "Z" || trimmed === "UTC") {
    return 0;
  }
  const match = trimmed.match(/^([+-])(\d{2}):?(\d{2})$/);
  if (!match) return null;
  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number.parseInt(match[2], 10);
  const minutes = Number.parseInt(match[3], 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours > 23 || minutes > 59) return null;
  return sign * (hours * 60 + minutes);
}

function getDateKey() {
  const now = new Date();
  const offsetMinutes = parseTimezoneOffset(DAILY_LIMIT_TZ_OFFSET);
  if (offsetMinutes !== null) {
    const target = new Date(now.getTime() + offsetMinutes * 60 * 1000);
    const year = target.getUTCFullYear();
    const month = String(target.getUTCMonth() + 1).padStart(2, "0");
    const day = String(target.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDailyRecord(map, ip) {
  const today = getDateKey();
  const record = map.get(ip);
  if (!record || record.date !== today) {
    const next = { date: today, count: 0 };
    map.set(ip, next);
    return next;
  }
  return record;
}

function getDailyCount(map, ip) {
  return getDailyRecord(map, ip).count;
}

function incrementDailyCount(map, ip) {
  const record = getDailyRecord(map, ip);
  record.count += 1;
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
        ["gift_submissions"]
      );
      const columnSet = new Set(columns.map((row) => row.COLUMN_NAME));

    if (!columnSet.has("account_id")) {
      await pool.execute(
        "ALTER TABLE gift_submissions ADD COLUMN account_id VARCHAR(50) DEFAULT NULL AFTER client_ip"
      );
    }
    if (!columnSet.has("retention_days")) {
      await pool.execute(
        `ALTER TABLE gift_submissions ADD COLUMN retention_days INT UNSIGNED NOT NULL DEFAULT ${defaultRetention} AFTER account_id`
      );
    }
    if (!columnSet.has("expires_at")) {
      await pool.execute(
        "ALTER TABLE gift_submissions ADD COLUMN expires_at DATETIME NULL AFTER retention_days"
      );
    }
    if (!columnSet.has("access_limit")) {
      await pool.execute(
        `ALTER TABLE gift_submissions ADD COLUMN access_limit INT UNSIGNED NOT NULL DEFAULT ${getDefaultAccessLimit()} AFTER expires_at`
      );
    }
    if (!columnSet.has("access_used")) {
      await pool.execute(
        "ALTER TABLE gift_submissions ADD COLUMN access_used INT UNSIGNED NOT NULL DEFAULT 0 AFTER access_limit"
      );
    }

    const [indexes] = await pool.execute(
      "SELECT INDEX_NAME FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ?",
      ["gift_submissions"]
    );
    const indexSet = new Set(indexes.map((row) => row.INDEX_NAME));
    if (!indexSet.has("idx_expires_at")) {
      await pool.execute("ALTER TABLE gift_submissions ADD INDEX idx_expires_at (expires_at)");
    }
    if (!indexSet.has("idx_account_id")) {
      await pool.execute("ALTER TABLE gift_submissions ADD INDEX idx_account_id (account_id)");
    }

    await pool.execute(
      "UPDATE gift_submissions SET expires_at = DATE_ADD(created_at, INTERVAL retention_days DAY) WHERE expires_at IS NULL"
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

async function updateRecordExpiry(giftId, expiresAt, retentionDays) {
  if (!giftId || !expiresAt) return;
  await dbExecute(
    "UPDATE gift_submissions SET expires_at = ?, retention_days = ? WHERE gift_id = ?",
    [expiresAt, retentionDays, giftId]
  );
}

async function deleteGiftRecord(record) {
  if (!record) return;
  const mediaPath = extractMediaDeletePath(record.background_media_url || "");
  if (mediaPath) {
    void requestMediaDelete([mediaPath]);
  }
  await dbExecute("DELETE FROM gift_submissions WHERE gift_id = ?", [record.gift_id]);
}

function scheduleGiftDelete(record, delayMs) {
  if (!record) return;
  const delay = Number.isFinite(Number(delayMs)) ? Number(delayMs) : 0;
  if (!delay || delay <= 0) {
    void deleteGiftRecord(record);
    return;
  }
  setTimeout(() => {
    void deleteGiftRecord(record);
  }, delay);
}

async function incrementAccessCount(shareToken) {
  const result = await dbExecute(
    `UPDATE gift_submissions
       SET access_used = access_used + 1
     WHERE share_token = ?
       AND (access_limit IS NULL OR access_used < access_limit)`,
    [shareToken]
  );
  return Boolean(result && result.affectedRows);
}

async function cleanupExpiredGifts() {
  if (retentionCleanupRunning) return;
  retentionCleanupRunning = true;
  try {
    const ready = await ensureRetentionSchema();
    if (!ready) return;
    const pool = getDbPool();
    if (!pool) return;

    const [rows] = await pool.execute(
      "SELECT gift_id, background_media_url FROM gift_submissions WHERE expires_at IS NOT NULL AND expires_at <= NOW() LIMIT ?",
      [RETENTION_CLEANUP_BATCH]
    );
    if (!rows || rows.length === 0) return;

    for (const row of rows) {
      const mediaPath = extractMediaDeletePath(row.background_media_url || "");
      if (mediaPath) {
        await requestMediaDelete([mediaPath]);
      }
      await dbExecute("DELETE FROM gift_submissions WHERE gift_id = ?", [row.gift_id]);
    }
  } catch (error) {
    return;
  } finally {
    retentionCleanupRunning = false;
  }
}

function startRetentionCleanup() {
  if (retentionCleanupTimer || RETENTION_CLEANUP_INTERVAL_MS <= 0) return;
  retentionCleanupTimer = setInterval(cleanupExpiredGifts, RETENTION_CLEANUP_INTERVAL_MS);
  cleanupExpiredGifts();
}

async function decrementDailyGenerateLimit(accountId) {
  if (!accountId) return false;
  const result = await accountDbExecute(
    `UPDATE accounts
     SET daily_generate_limit = CASE
       WHEN daily_generate_limit < 0 THEN daily_generate_limit
       WHEN daily_generate_limit > 0 THEN daily_generate_limit - 1
       ELSE 0
     END
     WHERE account_id = ?`,
    [accountId]
  );
  return Boolean(result);
}

function buildShareUrl(req, token) {
  const safeToken = encodeURIComponent(token);
  if (SHARE_BASE_URL) {
    return `${SHARE_BASE_URL.replace(/\/+$/, "")}/share/index.html?token=${safeToken}`;
  }
  const protoHeader = String(req.headers["x-forwarded-proto"] || "http");
  const proto = protoHeader.split(",")[0].trim() || "http";
  const hostHeader = String(req.headers["x-forwarded-host"] || req.headers.host || "");
  const host = hostHeader.split(",")[0].trim();
  if (!host) {
    return `/share/index.html?token=${safeToken}`;
  }
  return `${proto}://${host}/share/index.html?token=${safeToken}`;
}

async function generateShareToken() {
  for (let i = 0; i < TOKEN_RETRY_LIMIT; i += 1) {
    const token = crypto.randomBytes(TOKEN_BYTES).toString("hex");
    const existing = await dbQueryOne(
      "SELECT gift_id FROM gift_submissions WHERE share_token = ? LIMIT 1",
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
  const match = pathname.match(/^\/api\/gift\/share\/([^/]+)$/);
  if (match) return match[1].trim();
  return "";
}

async function handleGiftSubmit(req, res) {
  try {
    const authState = resolveAuthState(req);
    if (authState.expired) {
      sendJson(res, 403, { success: false, message: LOGIN_EXPIRED_MESSAGE });
      return;
    }

    const schemaReady = await ensureRetentionSchema();
    if (!schemaReady) {
      sendJson(res, 500, { success: false, message: "Database unavailable." });
      return;
    }

    const clientIp = getRequestIp(req);
    if (!authState.loggedIn) {
      const usedCount = getDailyCount(freeGiftDailyMap, clientIp);
      if (usedCount >= FREE_GIFT_LIMIT) {
        sendJson(res, 403, { success: false, message: FREE_LIMIT_MESSAGE });
        return;
      }
    }

    const data = await parseJsonBody(req);

    const recipientName = normalizeString(data.recipientName, 32);
    const senderName = normalizeString(data.senderName, 32);
    const cardContent = normalizeString(data.cardContent, 4000);

    if (!recipientName || !senderName) {
      sendJson(res, 400, { success: false, message: "Missing name fields." });
      return;
    }

    const frameColor = normalizeString(data.frameColor, 16) || "colorful";
    const frameStyleRaw = normalizeString(data.frameStyle, 16);
    const frameStyle = frameStyleRaw === "inside" ? "inside" : "name-top";
    const glassOpacity = normalizeNumber(data.glassOpacity, 50, 0, 100);
    const backgroundType = normalizeString(data.pageBackground, 16) === "custom" ? "custom" : "white";
    const backgroundMediaUrl = backgroundType === "custom"
      ? normalizeString(data.backgroundMediaUrl, 1024)
      : "";
    const backgroundMediaType = backgroundType === "custom"
      ? normalizeString(data.backgroundMediaType, 16)
      : "";

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
      `INSERT INTO gift_submissions
        (share_token, share_url, recipient_name, sender_name, card_content,
         frame_color, frame_style, glass_opacity, background_type, background_media_url, background_media_type,
         music_source, music_url, music_data, playback_mode, snippet_start_time, client_ip, account_id,
         retention_days, expires_at, access_limit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY), ?)`,
      [
        token,
        shareUrl,
        recipientName,
        senderName,
        cardContent,
        frameColor,
        frameStyle,
        glassOpacity,
        backgroundType,
        backgroundMediaUrl || null,
        backgroundMediaType || null,
        musicSource,
        musicUrl || null,
        musicData,
        playbackMode,
        snippetStartTime,
        clientIp,
        accountId,
        retentionDays,
        retentionDays,
        accessLimit
      ]
    );

    if (!result) {
      sendJson(res, 500, { success: false, message: "Database unavailable." });
      return;
    }

    if (authState.loggedIn) {
      void decrementDailyGenerateLimit(authState.accountId);
    } else {
      incrementDailyCount(freeGiftDailyMap, clientIp);
    }

    sendJson(res, 200, {
      success: true,
      data: {
        shareToken: token,
        shareUrl
      }
    });
  } catch (error) {
    if (error && error.code === "BODY_TOO_LARGE") {
      sendJson(res, 413, { success: false, message: "Payload too large." });
      return;
    }
    sendJson(res, 400, { success: false, message: "Invalid request." });
  }
}

async function handleGiftShare(req, res, pathname) {
  try {
    const schemaReady = await ensureRetentionSchema();
    if (!schemaReady) {
      sendJson(res, 500, { success: false, message: "Server error." });
      return;
    }

    const token = parseShareToken(req, pathname);
    if (!token) {
      sendJson(res, 400, { success: false, message: "Missing token." });
      return;
    }

    const accessOk = await incrementAccessCount(token);
    if (!accessOk) {
      const blockedRecord = await dbQueryOne(
        `SELECT gift_id, background_media_url, retention_days, expires_at, created_at,
                access_limit, access_used
           FROM gift_submissions
          WHERE share_token = ?
          LIMIT 1`,
        [token]
      );
      if (blockedRecord) {
        const expiry = resolveExpiryFromRecord(blockedRecord);
        if (expiry.expired || isAccessLimitReached(blockedRecord)) {
          await deleteGiftRecord(blockedRecord);
        }
      }
      sendJson(res, 404, { success: false, message: "Not found." });
      return;
    }

    const record = await dbQueryOne(
      `SELECT gift_id, share_token, recipient_name, sender_name, card_content, frame_color, frame_style, glass_opacity,
              background_type, background_media_url, background_media_type,
              music_source, music_url, music_data, playback_mode, snippet_start_time,
              retention_days, expires_at, created_at, access_limit, access_used
         FROM gift_submissions
        WHERE share_token = ?
        LIMIT 1`,
      [token]
    );

    if (!record) {
      sendJson(res, 404, { success: false, message: "Not found." });
      return;
    }

    const expiry = resolveExpiryFromRecord(record);
    if (expiry.shouldUpdate && expiry.expiresAt) {
      void updateRecordExpiry(record.gift_id, expiry.expiresAt, expiry.retentionDays);
    }
    if (expiry.expired) {
      await deleteGiftRecord(record);
      sendJson(res, 404, { success: false, message: "Not found." });
      return;
    }

    if (isAccessLimitReached(record)) {
      scheduleGiftDelete(record, ACCESS_DELETE_GRACE_MS);
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
        cardContent: record.card_content,
        frameColor: record.frame_color,
        frameStyle: record.frame_style,
        glassOpacity: record.glass_opacity,
        pageBackground: record.background_type,
        backgroundMediaUrl: record.background_media_url,
        backgroundMediaType: record.background_media_type,
        musicSource: record.music_source,
        musicUrl: record.music_url,
        musicData,
        playbackMode: record.playback_mode,
        snippetStartTime: record.snippet_start_time,
        createdAt: record.created_at
      }
    });
  } catch (error) {
    sendJson(res, 500, { success: false, message: "Server error." });
  }
}

function handleGiftRequest(req, res, pathname) {
  if (pathname === "/api/gift/submit" && req.method === "POST") {
    handleGiftSubmit(req, res);
    return true;
  }

  if (pathname.startsWith("/api/gift/share") && req.method === "GET") {
    handleGiftShare(req, res, pathname);
    return true;
  }

  return false;
}

startRetentionCleanup();

module.exports = {
  handleGiftRequest
};
