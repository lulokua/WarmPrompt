const mysql = require("mysql2/promise");
const { createQqMusicCookie, verifyQqMusicCookie } = require("../qqmusic/qqmusic-auth");

const DB_NAME = process.env.DB_NAME || "warmprompt";
const GIFT_DB_NAME = process.env.GIFT_DB_NAME || DB_NAME;
const LETTER_DB_NAME = process.env.LETTER_DB_NAME || DB_NAME;

const DB_BASE_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  charset: "utf8mb4",
  timezone: "+08:00",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const MAX_RETENTION_DAYS = parseInt(process.env.RETENTION_MAX_DAYS, 10) || 30;
const RETENTION_DEFAULT_DAYS = parseInt(process.env.RETENTION_DEFAULT_DAYS, 10) || 30;
const RETENTION_TRIAL_DAYS = parseInt(process.env.RETENTION_TRIAL_DAYS, 10) || 3;
const RETENTION_AIR_DAYS = parseInt(process.env.RETENTION_AIR_DAYS, 10) || 7;
const RETENTION_STANDARD_DAYS = parseInt(process.env.RETENTION_STANDARD_DAYS, 10) || 14;
const RETENTION_PRO_DAYS = parseInt(process.env.RETENTION_PRO_DAYS, 10) || 30;
const RETENTION_PRO_MAX_DAYS = parseInt(process.env.RETENTION_PRO_MAX_DAYS, 10) || 30;

const ACCESS_MAX_LIMIT = parseInt(process.env.ACCESS_MAX_LIMIT, 10) || 10;
const ACCESS_DEFAULT_LIMIT = parseInt(process.env.ACCESS_DEFAULT_LIMIT, 10) || 1;
const ACCESS_TRIAL_LIMIT = parseInt(process.env.ACCESS_TRIAL_LIMIT, 10) || 2;
const ACCESS_AIR_LIMIT = parseInt(process.env.ACCESS_AIR_LIMIT, 10) || 3;
const ACCESS_STANDARD_LIMIT = parseInt(process.env.ACCESS_STANDARD_LIMIT, 10) || 5;
const ACCESS_PRO_LIMIT = parseInt(process.env.ACCESS_PRO_LIMIT, 10) || 8;
const ACCESS_PRO_MAX_LIMIT = parseInt(process.env.ACCESS_PRO_MAX_LIMIT, 10) || 10;

const ACTIVITY_LIST_LIMIT = parseInt(process.env.ACCOUNT_ACTIVITY_LIMIT, 10) || 50;
const DAY_MS = 24 * 60 * 60 * 1000;

const ACCOUNT_BENEFITS = {
  trial: {
    dailyGenerate: 5,
    neteasePlaylist: 2,
    qqMusic: 2,
    imageUpload: 4,
    videoUpload: 1,
    customDomain: false,
    dedicatedServer: false
  },
  air: {
    dailyGenerate: 15,
    neteasePlaylist: 5,
    qqMusic: 5,
    imageUpload: 10,
    videoUpload: 5,
    customDomain: false,
    dedicatedServer: false
  },
  standard: {
    dailyGenerate: 35,
    neteasePlaylist: 30,
    qqMusic: 30,
    imageUpload: 25,
    videoUpload: 12,
    customDomain: false,
    dedicatedServer: false
  },
  pro: {
    dailyGenerate: 80,
    neteasePlaylist: 200,
    qqMusic: 200,
    imageUpload: 80,
    videoUpload: 40,
    customDomain: false,
    dedicatedServer: false
  }
};

const LEVEL_LABELS = {
  trial: "体验卡",
  air: "VIP Air",
  standard: "标准版",
  pro: "PRO"
};

const SECURITY_CONFIG = {
  BODY_MAX_BYTES: 4 * 1024,
  LOGIN_RATE_WINDOW_MS: 60 * 1000,
  LOGIN_RATE_MAX: 20,
  LOGIN_BAN_MS: 5 * 60 * 1000,
  FAILED_WINDOW_MS: 10 * 60 * 1000,
  MAX_FAILED_ATTEMPTS: 5,
  LOCKOUT_MS: 15 * 60 * 1000,
  CLEANUP_INTERVAL_MS: 60 * 60 * 1000
};

let dbPool = null;
let giftPool = null;
let letterPool = null;

function createPool(database) {
  return mysql.createPool({
    ...DB_BASE_CONFIG,
    database
  });
}
const loginRateMap = new Map();
const failedByIp = new Map();
const failedByAccount = new Map();

function getDbPool() {
  if (!dbPool) {
    try {
      dbPool = createPool(DB_NAME);
    } catch (error) {
      return null;
    }
  }
  return dbPool;
}

function getGiftPool() {
  if (!giftPool) {
    try {
      giftPool = createPool(GIFT_DB_NAME);
    } catch (error) {
      return null;
    }
  }
  return giftPool;
}

function getLetterPool() {
  if (!letterPool) {
    try {
      letterPool = createPool(LETTER_DB_NAME);
    } catch (error) {
      return null;
    }
  }
  return letterPool;
}

async function dbQueryOne(sql, params = []) {
  const pool = getDbPool();
  if (!pool) return null;
  const [rows] = await pool.execute(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

async function dbQueryAll(sql, params = []) {
  const pool = getDbPool();
  if (!pool) return [];
  const [rows] = await pool.execute(sql, params);
  return rows || [];
}

async function dbQueryOneWithPool(poolGetter, sql, params = []) {
  const pool = poolGetter();
  if (!pool) return null;
  const [rows] = await pool.execute(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

async function dbQueryAllWithPool(poolGetter, sql, params = []) {
  const pool = poolGetter();
  if (!pool) return [];
  const [rows] = await pool.execute(sql, params);
  return rows || [];
}

function sendJson(res, status, payload, extraHeaders = null) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };
  if (extraHeaders) {
    Object.assign(headers, extraHeaders);
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(payload));
}

function handleQqMusicVerify(req, res) {
  const result = verifyQqMusicCookie(req);
  sendJson(res, 200, {
    success: true,
    valid: result.valid,
    remainingSeconds: result.remainingSeconds || 0
  });
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

function checkRateLimit(ip) {
  const now = Date.now();
  const record = loginRateMap.get(ip) || { count: 0, windowStart: now, bannedUntil: 0 };

  if (record.bannedUntil && now < record.bannedUntil) {
    return { allowed: false, retryAfter: Math.ceil((record.bannedUntil - now) / 1000) };
  }

  if (now - record.windowStart > SECURITY_CONFIG.LOGIN_RATE_WINDOW_MS) {
    record.count = 0;
    record.windowStart = now;
  }

  record.count += 1;

  if (record.count > SECURITY_CONFIG.LOGIN_RATE_MAX) {
    record.bannedUntil = now + SECURITY_CONFIG.LOGIN_BAN_MS;
    loginRateMap.set(ip, record);
    return { allowed: false, retryAfter: Math.ceil(SECURITY_CONFIG.LOGIN_BAN_MS / 1000) };
  }

  loginRateMap.set(ip, record);
  return { allowed: true };
}

function getLockStatus(map, key) {
  if (!key) return { locked: false };
  const record = map.get(key);
  if (!record) return { locked: false };
  const now = Date.now();

  if (record.lockedUntil && now < record.lockedUntil) {
    return { locked: true, remaining: Math.ceil((record.lockedUntil - now) / 1000) };
  }

  if (record.lockedUntil && now >= record.lockedUntil) {
    map.delete(key);
    return { locked: false };
  }

  if (now - record.lastAttempt > SECURITY_CONFIG.FAILED_WINDOW_MS) {
    map.delete(key);
    return { locked: false };
  }

  return { locked: false };
}

function registerFailure(map, key) {
  if (!key) return;
  const now = Date.now();
  let record = map.get(key);

  if (!record || now - record.firstAttempt > SECURITY_CONFIG.FAILED_WINDOW_MS) {
    record = { count: 0, firstAttempt: now, lastAttempt: now, lockedUntil: 0 };
  }

  record.count += 1;
  record.lastAttempt = now;

  if (record.count >= SECURITY_CONFIG.MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + SECURITY_CONFIG.LOCKOUT_MS;
    record.count = 0;
    record.firstAttempt = now;
  }

  map.set(key, record);
}

function clearFailures(map, key) {
  if (!key) return;
  map.delete(key);
}

function normalizeBenefitNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
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
  if (type === "trial") return clampRetentionDays(RETENTION_TRIAL_DAYS, 3);
  if (type === "air") return clampRetentionDays(RETENTION_AIR_DAYS, 7);
  if (type === "standard") return clampRetentionDays(RETENTION_STANDARD_DAYS, 14);
  if (type === "pro") return clampRetentionDays(RETENTION_PRO_DAYS, 30);
  if (type === "pro_max" || type === "promax" || type === "max") {
    return clampRetentionDays(RETENTION_PRO_MAX_DAYS, 30);
  }
  return getDefaultRetentionDays();
}

function getAccessLimitByType(type) {
  if (type === "trial") return clampAccessLimit(ACCESS_TRIAL_LIMIT, 2);
  if (type === "air") return clampAccessLimit(ACCESS_AIR_LIMIT, 3);
  if (type === "standard") return clampAccessLimit(ACCESS_STANDARD_LIMIT, 5);
  if (type === "pro") return clampAccessLimit(ACCESS_PRO_LIMIT, 8);
  if (type === "pro_max" || type === "promax" || type === "max") {
    return clampAccessLimit(ACCESS_PRO_MAX_LIMIT, 10);
  }
  return getDefaultAccessLimit();
}

function mapAccountBenefits(account) {
  const preset = ACCOUNT_BENEFITS[account.type] || {};
  return {
    dailyGenerate: normalizeBenefitNumber(account.daily_generate_limit, preset.dailyGenerate || 0),
    neteasePlaylist: normalizeBenefitNumber(account.netease_playlist_limit, preset.neteasePlaylist || 0),
    qqMusic: normalizeBenefitNumber(account.qq_music_limit, preset.qqMusic || 0),
    imageUpload: normalizeBenefitNumber(account.image_upload_limit, preset.imageUpload || 0),
    videoUpload: normalizeBenefitNumber(account.video_upload_limit, preset.videoUpload || 0),
    customDomain: account.custom_domain === null || account.custom_domain === undefined
      ? Boolean(preset.customDomain)
      : Boolean(account.custom_domain),
    dedicatedServer: account.dedicated_server === null || account.dedicated_server === undefined
      ? Boolean(preset.dedicatedServer)
      : Boolean(account.dedicated_server),
    retentionDays: getRetentionDaysByType(account.type),
    accessLimit: getAccessLimitByType(account.type)
  };
}

function getExpireAt(account) {
  if (account.expire_at) {
    return new Date(account.expire_at);
  }
  if (account.expire_date) {
    const date = new Date(account.expire_date);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
  }
  return null;
}

function isExpired(account) {
  const expireAt = getExpireAt(account);
  if (!expireAt) return false;
  return expireAt.getTime() <= Date.now();
}

function buildAccountPayload(account) {
  const expireAt = getExpireAt(account);
  const expireDate = account.expire_date
    ? new Date(account.expire_date).toLocaleDateString("zh-CN")
    : "";
  return {
    accountId: account.account_id,
    type: account.type,
    levelLabel: LEVEL_LABELS[account.type] || account.type,
    expireDate,
    expireAt: expireAt ? expireAt.toISOString() : null,
    benefits: mapAccountBenefits(account)
  };
}

function parseBody(req) {
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
      if (body.length > SECURITY_CONFIG.BODY_MAX_BYTES) {
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
    req.on("error", (error) => {
      safeReject(error);
    });
  });
}

async function handleAccountLogin(req, res) {
  try {
    const ip = getRequestIp(req);
    const rateLimit = checkRateLimit(ip);
    if (!rateLimit.allowed) {
      sendJson(res, 429, {
        success: false,
        message: "请求过于频繁，请稍后再试",
        data: { retryAfter: rateLimit.retryAfter }
      });
      return;
    }

    const data = await parseBody(req);
    const accountId = String(data.accountId || "").trim();
    const accountKey = accountId ? accountId.toUpperCase() : "";
    const password = String(data.password || "");

    if (!accountId || !password) {
      sendJson(res, 400, { success: false, message: "请输入账号与密码" });
      return;
    }

    const ipLock = getLockStatus(failedByIp, ip);
    if (ipLock.locked) {
      sendJson(res, 429, {
        success: false,
        message: `尝试次数过多，请 ${Math.ceil(ipLock.remaining / 60)} 分钟后再试`,
        data: { retryAfter: ipLock.remaining }
      });
      return;
    }

    const accountLock = getLockStatus(failedByAccount, accountKey);
    if (accountLock.locked) {
      sendJson(res, 429, {
        success: false,
        message: `账号已被临时锁定，请 ${Math.ceil(accountLock.remaining / 60)} 分钟后再试`,
        data: { retryAfter: accountLock.remaining }
      });
      return;
    }

    const account = await dbQueryOne("SELECT * FROM accounts WHERE account_id = ?", [accountId]);
    if (!account) {
      registerFailure(failedByIp, ip);
      sendJson(res, 404, { success: false, message: "账号不存在" });
      return;
    }

    if (account.password !== password) {
      registerFailure(failedByIp, ip);
      registerFailure(failedByAccount, accountKey);
      sendJson(res, 401, { success: false, message: "账号或密码错误" });
      return;
    }

    if (account.status && account.status !== "active") {
      sendJson(res, 403, { success: false, message: "账号状态异常" });
      return;
    }

    if (isExpired(account)) {
      sendJson(res, 403, { success: false, message: "账号已到期" });
      return;
    }

    clearFailures(failedByIp, ip);
    clearFailures(failedByAccount, accountKey);

    const qqMusicCookie = createQqMusicCookie(req, account.account_id);
    sendJson(res, 200, {
      success: true,
      data: buildAccountPayload(account)
    }, { "Set-Cookie": qqMusicCookie });
  } catch (error) {
    if (error && error.code === "BODY_TOO_LARGE") {
      sendJson(res, 413, { success: false, message: "请求体过大" });
      return;
    }
    sendJson(res, 400, { success: false, message: "请求格式错误" });
  }
}

async function handleAccountBenefits(req, res) {
  const auth = verifyQqMusicCookie(req);
  if (!auth.valid || !auth.accountId) {
    sendJson(res, 403, { success: false, message: "请先登录" });
    return;
  }

  try {
    const account = await dbQueryOne("SELECT * FROM accounts WHERE account_id = ?", [auth.accountId]);
    if (!account) {
      sendJson(res, 404, { success: false, message: "账号不存在" });
      return;
    }

    if (account.status && account.status !== "active") {
      sendJson(res, 403, { success: false, message: "账号状态异常" });
      return;
    }

    if (isExpired(account)) {
      sendJson(res, 403, { success: false, message: "账号已到期" });
      return;
    }

    sendJson(res, 200, { success: true, data: buildAccountPayload(account) });
  } catch (error) {
    sendJson(res, 500, { success: false, message: "服务器内部错误" });
  }
}

function computeRemainingDays(expiresAt, retentionDays, createdAt) {
  const now = Date.now();
  if (expiresAt) {
    const exp = new Date(expiresAt).getTime();
    if (!Number.isFinite(exp)) return 0;
    return Math.max(0, Math.ceil((exp - now) / DAY_MS));
  }
  if (createdAt && retentionDays) {
    const created = new Date(createdAt).getTime();
    if (!Number.isFinite(created)) return 0;
    const exp = created + Number(retentionDays) * DAY_MS;
    return Math.max(0, Math.ceil((exp - now) / DAY_MS));
  }
  return 0;
}

async function handleAccountActivity(req, res) {
  const auth = verifyQqMusicCookie(req);
  if (!auth.valid || !auth.accountId) {
    sendJson(res, 403, { success: false, message: "请先登录" });
    return;
  }

  try {
    const account = await dbQueryOne("SELECT * FROM accounts WHERE account_id = ?", [auth.accountId]);
    if (!account) {
      sendJson(res, 404, { success: false, message: "账号不存在" });
      return;
    }

    if (account.status && account.status !== "active") {
      sendJson(res, 403, { success: false, message: "账号状态异常" });
      return;
    }

    if (isExpired(account)) {
      sendJson(res, 403, { success: false, message: "账号已到期" });
      return;
    }

    const giftCountRow = await dbQueryOneWithPool(
      getGiftPool,
      "SELECT COUNT(*) AS total FROM gift_submissions WHERE account_id = ? AND DATE(created_at) = CURDATE()",
      [account.account_id]
    );
    const letterCountRow = await dbQueryOneWithPool(
      getLetterPool,
      "SELECT COUNT(*) AS total FROM letter_submissions WHERE account_id = ? AND DATE(created_at) = CURDATE()",
      [account.account_id]
    );

    const giftRows = await dbQueryAllWithPool(
      getGiftPool,
      `SELECT share_url, share_token, recipient_name, sender_name, created_at, expires_at,
              retention_days, access_limit, access_used
         FROM gift_submissions
        WHERE account_id = ?
          AND DATE(created_at) = CURDATE()
          AND (expires_at IS NULL OR expires_at > NOW())
          AND (access_limit IS NULL OR access_used < access_limit)
        ORDER BY created_at DESC
        LIMIT ?`,
      [account.account_id, ACTIVITY_LIST_LIMIT]
    );

    const letterRows = await dbQueryAllWithPool(
      getLetterPool,
      `SELECT share_url, share_token, recipient_name, sender_name, created_at, expires_at,
              retention_days, access_limit, access_used
         FROM letter_submissions
        WHERE account_id = ?
          AND DATE(created_at) = CURDATE()
          AND (expires_at IS NULL OR expires_at > NOW())
          AND (access_limit IS NULL OR access_used < access_limit)
        ORDER BY created_at DESC
        LIMIT ?`,
      [account.account_id, ACTIVITY_LIST_LIMIT]
    );

    const items = []
      .concat(giftRows.map((row) => ({
        type: "gift",
        shareUrl: row.share_url,
        shareToken: row.share_token,
        recipientName: row.recipient_name,
        senderName: row.sender_name,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        retentionDays: row.retention_days,
        accessLimit: row.access_limit,
        accessUsed: row.access_used
      })))
      .concat(letterRows.map((row) => ({
        type: "letter",
        shareUrl: row.share_url,
        shareToken: row.share_token,
        recipientName: row.recipient_name,
        senderName: row.sender_name,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        retentionDays: row.retention_days,
        accessLimit: row.access_limit,
        accessUsed: row.access_used
      })))
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, ACTIVITY_LIST_LIMIT)
      .map((item) => {
        const accessLimit = Number.isFinite(Number(item.accessLimit)) ? Number(item.accessLimit) : 0;
        const accessUsed = Number.isFinite(Number(item.accessUsed)) ? Number(item.accessUsed) : 0;
        const remainingAccess = accessLimit < 0 ? -1 : Math.max(0, accessLimit - accessUsed);
        const remainingDays = computeRemainingDays(item.expiresAt, item.retentionDays, item.createdAt);
        return {
          ...item,
          remainingAccess,
          remainingDays
        };
      });

    const giftCount = giftCountRow && giftCountRow.total ? Number(giftCountRow.total) : 0;
    const letterCount = letterCountRow && letterCountRow.total ? Number(letterCountRow.total) : 0;

    sendJson(res, 200, {
      success: true,
      data: {
        today: {
          gift: giftCount,
          letter: letterCount,
          total: giftCount + letterCount
        },
        plan: {
          retentionDays: getRetentionDaysByType(account.type),
          accessLimit: getAccessLimitByType(account.type)
        },
        items
      }
    });
  } catch (error) {
    sendJson(res, 500, { success: false, message: "服务器内部错误" });
  }
}

function handleAccountRequest(req, res, pathname) {
  if (pathname === "/api/account/qqmusic/verify" && req.method === "GET") {
    handleQqMusicVerify(req, res);
    return true;
  }

  if (pathname === "/api/account/benefits" && req.method === "GET") {
    handleAccountBenefits(req, res);
    return true;
  }

  if (pathname === "/api/account/activity" && req.method === "GET") {
    handleAccountActivity(req, res);
    return true;
  }

  if (pathname === "/api/account/login" && req.method === "POST") {
    handleAccountLogin(req, res);
    return true;
  }

  return false;
}

module.exports = {
  handleAccountRequest
};

setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of loginRateMap.entries()) {
    if (record.bannedUntil && now > record.bannedUntil) {
      loginRateMap.delete(ip);
    } else if (now - record.windowStart > SECURITY_CONFIG.LOGIN_RATE_WINDOW_MS * 2) {
      loginRateMap.delete(ip);
    }
  }

  for (const [key, record] of failedByIp.entries()) {
    if (record.lockedUntil && now > record.lockedUntil) {
      failedByIp.delete(key);
    } else if (now - record.lastAttempt > SECURITY_CONFIG.FAILED_WINDOW_MS * 2) {
      failedByIp.delete(key);
    }
  }

  for (const [key, record] of failedByAccount.entries()) {
    if (record.lockedUntil && now > record.lockedUntil) {
      failedByAccount.delete(key);
    } else if (now - record.lastAttempt > SECURITY_CONFIG.FAILED_WINDOW_MS * 2) {
      failedByAccount.delete(key);
    }
  }
}, SECURITY_CONFIG.CLEANUP_INTERVAL_MS);
