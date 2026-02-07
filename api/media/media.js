const http = require("http");
const https = require("https");
const mysql = require("mysql2/promise");
const { verifyQqMusicCookie } = require("../for_others/qqmusic/qqmusic-auth");

const MEDIA_SERVER_UPLOAD_URL = String(process.env.MEDIA_SERVER_UPLOAD_URL || "").trim();
const MEDIA_UPLOAD_TOKEN = String(process.env.MEDIA_UPLOAD_TOKEN || "").trim();
const MAX_IMAGE_BYTES = parseInt(process.env.MEDIA_MAX_IMAGE_BYTES, 10) || 500 * 1024 * 1024;
const MAX_VIDEO_BYTES = parseInt(process.env.MEDIA_MAX_VIDEO_BYTES, 10) || 1024 * 1024 * 1024;
const MAX_UPLOAD_BYTES = parseInt(process.env.MEDIA_UPLOAD_MAX_BYTES, 10)
  || Math.max(MAX_IMAGE_BYTES, MAX_VIDEO_BYTES);
const TRUST_PROXY = String(process.env.MEDIA_TRUST_PROXY || "").toLowerCase() === "true";
const UPLOAD_RATE_WINDOW_MS = parseInt(process.env.MEDIA_UPLOAD_RATE_WINDOW_MS) || 10 * 60 * 1000;
const UPLOAD_RATE_MAX = parseInt(process.env.MEDIA_UPLOAD_RATE_MAX) || 30;
const UPLOAD_BAN_MS = parseInt(process.env.MEDIA_UPLOAD_BAN_MS) || 10 * 60 * 1000;
const ALLOW_ORIGIN = String(process.env.MEDIA_UPLOAD_ALLOW_ORIGIN || "").trim();
const FREE_IMAGE_UPLOAD_LIMIT = 2;
const FREE_LIMIT_MESSAGE = "每天两次的免费额度已经用完了。如果需要更多次数，请返回主页升级 VIP Air 版。";
const FREE_VIDEO_MESSAGE = "免费用户不能上传视频，请登录会员后使用。";
const LOGIN_EXPIRED_MESSAGE = "登录已过期，请重新登录。";
const IMAGE_TOO_LARGE_MESSAGE = `你的这个图片已经超过大小 ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB`;
const VIDEO_TOO_LARGE_MESSAGE = `视频已经超过 ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024 / 1024)} GB`;

const DB_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "warmprompt",
  charset: "utf8mb4",
  timezone: "+08:00",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const DAILY_LIMIT_TZ_OFFSET = String(process.env.DAILY_LIMIT_TZ_OFFSET || DB_CONFIG.timezone || "+08:00").trim();

let dbPool = null;
const freeImageDailyMap = new Map();

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

const rateMap = new Map();
const RATE_LIMIT_ENABLED = UPLOAD_RATE_WINDOW_MS > 0 && UPLOAD_RATE_MAX > 0 && UPLOAD_BAN_MS > 0;

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function getClientIp(req) {
  if (TRUST_PROXY) {
    const forwarded = req.headers["x-forwarded-for"];
    const realIp = req.headers["x-real-ip"];
    if (forwarded) {
      return String(forwarded).split(",")[0].trim();
    }
    if (realIp) {
      return String(realIp).trim();
    }
  }
  if (req.socket && req.socket.remoteAddress) {
    return req.socket.remoteAddress.replace(/^::ffff:/, "");
  }
  return "unknown";
}

function checkRateLimit(ip) {
  if (!RATE_LIMIT_ENABLED) {
    return { allowed: true };
  }
  const now = Date.now();
  const record = rateMap.get(ip) || { count: 0, windowStart: now, bannedUntil: 0 };

  if (record.bannedUntil && now < record.bannedUntil) {
    return { allowed: false, retryAfter: Math.ceil((record.bannedUntil - now) / 1000) };
  }

  if (now - record.windowStart > UPLOAD_RATE_WINDOW_MS) {
    record.count = 0;
    record.windowStart = now;
  }

  record.count += 1;
  if (record.count > UPLOAD_RATE_MAX) {
    record.bannedUntil = now + UPLOAD_BAN_MS;
    rateMap.set(ip, record);
    return { allowed: false, retryAfter: Math.ceil(UPLOAD_BAN_MS / 1000) };
  }

  rateMap.set(ip, record);
  return { allowed: true };
}

function cleanupRateMap() {
  if (!RATE_LIMIT_ENABLED) {
    return;
  }
  const now = Date.now();
  for (const [ip, record] of rateMap.entries()) {
    if (record.bannedUntil && now > record.bannedUntil) {
      rateMap.delete(ip);
      continue;
    }
    if (!record.bannedUntil && now - record.windowStart > UPLOAD_RATE_WINDOW_MS * 2) {
      rateMap.delete(ip);
    }
  }
}

if (RATE_LIMIT_ENABLED) {
  setInterval(cleanupRateMap, 60 * 1000);
}

function originAllowed(req) {
  if (!ALLOW_ORIGIN) return true;
  const origin = req.headers.origin || "";
  const referer = req.headers.referer || "";
  return origin.includes(ALLOW_ORIGIN) || referer.includes(ALLOW_ORIGIN);
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
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
    const target = new Date(utcMs + offsetMinutes * 60 * 1000);
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
    return { loggedIn: false, expired: true };
  }
  if (authResult && authResult.error && authResult.error !== "missing") {
    return { loggedIn: false, expired: true };
  }
  return { loggedIn: false, accountId: "" };
}

function getMediaTypeHint(req) {
  const hint = String(req.headers["x-media-type"] || "").toLowerCase();
  if (hint === "image" || hint === "video") {
    return hint;
  }
  return "";
}

function getFileTooLargeMessage(mediaType) {
  if (mediaType === "video") return VIDEO_TOO_LARGE_MESSAGE;
  if (mediaType === "image") return IMAGE_TOO_LARGE_MESSAGE;
  return "文件过大。";
}

function parseUploadMediaType(body) {
  if (!body) return "";
  try {
    const parsed = JSON.parse(body);
    if (!parsed || !parsed.success || !parsed.data) {
      return "";
    }
    const mediaType = String(parsed.data.mediaType || "").toLowerCase();
    if (mediaType === "image" || mediaType === "video") {
      return mediaType;
    }
    return "";
  } catch (error) {
    return "";
  }
}

async function decrementUploadLimit(accountId, mediaType) {
  if (!accountId) return false;
  if (mediaType !== "image" && mediaType !== "video") return false;
  const pool = getDbPool();
  if (!pool) return false;

  const column = mediaType === "video" ? "video_upload_limit" : "image_upload_limit";
  try {
    await pool.execute(
      `UPDATE accounts
       SET ${column} = CASE
         WHEN ${column} < 0 THEN ${column}
         WHEN ${column} > 0 THEN ${column} - 1
         ELSE 0
       END
       WHERE account_id = ?`,
      [accountId]
    );
    return true;
  } catch (error) {
    return false;
  }
}

function handleMediaUpload(req, res) {
  if (!MEDIA_SERVER_UPLOAD_URL || !MEDIA_UPLOAD_TOKEN) {
    sendJson(res, 500, { success: false, message: "Upload service not configured." });
    return;
  }

  const authState = resolveAuthState(req);
  if (authState.expired) {
    sendJson(res, 403, { success: false, message: LOGIN_EXPIRED_MESSAGE });
    return;
  }

  const mediaTypeHint = getMediaTypeHint(req);
  if (!originAllowed(req)) {
    sendJson(res, 403, { success: false, message: "Forbidden." });
    return;
  }

  const clientIp = getClientIp(req);
  if (!authState.loggedIn) {
    if (mediaTypeHint === "video") {
      sendJson(res, 403, { success: false, message: FREE_VIDEO_MESSAGE });
      return;
    }
    if (mediaTypeHint !== "image") {
      sendJson(res, 400, { success: false, message: "无法识别上传类型，请重新选择图片。" });
      return;
    }
    const usedCount = getDailyCount(freeImageDailyMap, clientIp);
    if (usedCount >= FREE_IMAGE_UPLOAD_LIMIT) {
      sendJson(res, 403, { success: false, message: FREE_LIMIT_MESSAGE });
      return;
    }
  }

  const rateCheck = checkRateLimit(clientIp);
  if (!rateCheck.allowed) {
    res.writeHead(429, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Retry-After": String(rateCheck.retryAfter || 60)
    });
    res.end(JSON.stringify({ success: false, message: "Too many uploads." }));
    return;
  }

  const contentLength = parseInt(req.headers["content-length"] || "0", 10);
  if (contentLength) {
    if (mediaTypeHint === "image" && contentLength > MAX_IMAGE_BYTES) {
      sendJson(res, 413, { success: false, message: IMAGE_TOO_LARGE_MESSAGE });
      return;
    }
    if (mediaTypeHint === "video" && contentLength > MAX_VIDEO_BYTES) {
      sendJson(res, 413, { success: false, message: VIDEO_TOO_LARGE_MESSAGE });
      return;
    }
    if (contentLength > MAX_UPLOAD_BYTES) {
      sendJson(res, 413, { success: false, message: getFileTooLargeMessage(mediaTypeHint) });
      return;
    }
  }

  const accountId = authState.loggedIn ? authState.accountId : "";
  let responded = false;

  const targetUrl = new URL(MEDIA_SERVER_UPLOAD_URL);
  const protocol = targetUrl.protocol === "https:" ? https : http;
  const headers = { ...req.headers };
  headers.host = targetUrl.host;
  headers["x-upload-token"] = MEDIA_UPLOAD_TOKEN;
  delete headers.cookie;

  const upstreamReq = protocol.request(
    {
      method: "POST",
      hostname: targetUrl.hostname,
      port: targetUrl.port || (targetUrl.protocol === "https:" ? 443 : 80),
      path: `${targetUrl.pathname}${targetUrl.search || ""}`,
      headers
    },
    (upstreamRes) => {
      if (responded) {
        upstreamRes.resume();
        return;
      }
      const chunks = [];
      upstreamRes.on("data", (chunk) => {
        chunks.push(chunk);
      });
      upstreamRes.on("end", () => {
        if (responded) {
          return;
        }
        responded = true;
        const bodyBuffer = Buffer.concat(chunks);
        const bodyText = bodyBuffer.toString("utf8");
        const mediaType = parseUploadMediaType(bodyText);

        if (!authState.loggedIn && mediaType === "video") {
          res.writeHead(403, {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store"
          });
          res.end(JSON.stringify({ success: false, message: FREE_VIDEO_MESSAGE }));
          return;
        }

        res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
        res.end(bodyBuffer);

        if (accountId && mediaType) {
          void decrementUploadLimit(accountId, mediaType);
        }

        if (!authState.loggedIn && mediaType === "image") {
          incrementDailyCount(freeImageDailyMap, clientIp);
        }
      });
      upstreamRes.on("error", () => {
        if (responded) return;
        responded = true;
        sendJson(res, 502, { success: false, message: "Upload failed." });
      });
    }
  );

  upstreamReq.on("error", () => {
    if (responded) return;
    responded = true;
    sendJson(res, 502, { success: false, message: "Upload failed." });
  });

  req.on("error", () => {
    upstreamReq.destroy();
  });

  req.pipe(upstreamReq);
}

function handleMediaRequest(req, res, pathname) {
  if (pathname === "/api/media/upload" && req.method === "POST") {
    handleMediaUpload(req, res);
    return true;
  }

  if (pathname === "/api/media/upload" && req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }

  return false;
}

module.exports = {
  handleMediaRequest
};
