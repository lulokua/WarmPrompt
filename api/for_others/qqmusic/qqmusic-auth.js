const crypto = require("crypto");

const COOKIE_NAME = "wp_qqmusic";
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const COOKIE_MAX_AGE_SECONDS = Math.floor(COOKIE_MAX_AGE_MS / 1000);
const TIMESTAMP_TOLERANCE_MS = 2 * 60 * 1000;
const COOKIE_SEPARATOR = ".";
const ACCOUNT_VALUE_SEPARATOR = "|";
const SESSION_PREFIX = "v2:";
const SESSION_ID_BYTES = 24;
const SESSION_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const COOKIE_SECRET =
  process.env.QQ_COOKIE_SECRET ||
  process.env.COOKIE_SECRET ||
  process.env.ADMIN_SECRET_KEY ||
  crypto.randomBytes(32).toString("hex");
const sessionStore = new Map();

function parseCookies(cookieHeader = "") {
  const cookies = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(";").forEach((cookie) => {
    const [name, ...rest] = cookie.trim().split("=");
    if (!name) return;
    cookies[name.trim()] = rest.join("=").trim();
  });

  return cookies;
}

function getClientIp(req) {
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
  if (ip === "::1") {
    ip = "127.0.0.1";
  }

  return ip || "unknown";
}

function isHttps(req) {
  if (req.socket && req.socket.encrypted) {
    return true;
  }
  return req.headers["x-forwarded-proto"] === "https";
}

function toBase64Url(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value) {
  if (!value) return "";
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  try {
    return Buffer.from(padded, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function createSessionId() {
  return toBase64Url(crypto.randomBytes(SESSION_ID_BYTES));
}

function storeSession(sessionId, accountId, ipHash) {
  const expiresAt = Date.now() + COOKIE_MAX_AGE_MS;
  sessionStore.set(sessionId, {
    accountId: accountId || "",
    ipHash: ipHash || "",
    expiresAt
  });
  return expiresAt;
}

function getSession(sessionId) {
  return sessionStore.get(sessionId) || null;
}

function cleanupSessions() {
  const now = Date.now();
  for (const [sessionId, session] of sessionStore.entries()) {
    if (!session || session.expiresAt <= now) {
      sessionStore.delete(sessionId);
    }
  }
}

setInterval(cleanupSessions, SESSION_CLEANUP_INTERVAL_MS);

function encodeAccountId(accountId) {
  if (!accountId) return "";
  return toBase64Url(Buffer.from(String(accountId), "utf8"));
}

function decodeAccountId(value) {
  return fromBase64Url(value);
}

function hashIp(ip) {
  return toBase64Url(crypto.createHash("sha256").update(ip).digest());
}

function sign(value, timestamp) {
  const hmac = crypto.createHmac("sha256", COOKIE_SECRET);
  hmac.update(`${value}${COOKIE_SEPARATOR}${timestamp}`);
  return toBase64Url(hmac.digest());
}

function buildSignedValue(value) {
  const timestamp = Date.now().toString(36);
  const signature = sign(value, timestamp);
  return `${value}${COOKIE_SEPARATOR}${timestamp}${COOKIE_SEPARATOR}${signature}`;
}

function buildLegacyValue(accountId, ipHash) {
  const accountPart = encodeAccountId(accountId);
  return accountPart
    ? `${accountPart}${ACCOUNT_VALUE_SEPARATOR}${ipHash}`
    : ipHash;
}

function buildSessionValue(sessionId, accountId, ipHash) {
  const accountPart = encodeAccountId(accountId);
  const parts = [`${SESSION_PREFIX}${sessionId}`];
  if (accountPart) {
    parts.push(accountPart);
  }
  parts.push(ipHash);
  return parts.join(ACCOUNT_VALUE_SEPARATOR);
}

function parseValue(value) {
  if (!value) {
    return { valid: false, error: "format" };
  }
  if (value.startsWith(SESSION_PREFIX)) {
    const raw = value.slice(SESSION_PREFIX.length);
    const parts = raw.split(ACCOUNT_VALUE_SEPARATOR);
    if (parts.length < 2 || parts.length > 3) {
      return { valid: false, error: "format" };
    }
    const sessionId = parts[0];
    const ipHash = parts.length === 2 ? parts[1] : parts[2];
    const accountPart = parts.length === 3 ? parts[1] : "";
    if (!sessionId || !ipHash) {
      return { valid: false, error: "format" };
    }
    return {
      valid: true,
      version: "v2",
      sessionId,
      ipHash,
      accountId: accountPart ? decodeAccountId(accountPart) : ""
    };
  }
  const separatorIndex = value.indexOf(ACCOUNT_VALUE_SEPARATOR);
  if (separatorIndex === -1) {
    return { valid: true, version: "v1", accountId: "", ipHash: value };
  }
  const accountPart = value.slice(0, separatorIndex);
  const ipHash = value.slice(separatorIndex + 1);
  if (!ipHash) {
    return { valid: false, error: "format" };
  }
  return {
    valid: true,
    version: "v1",
    ipHash,
    accountId: decodeAccountId(accountPart)
  };
}

function parseSignedValue(signedValue) {
  if (!signedValue || typeof signedValue !== "string") {
    return { valid: false, error: "missing" };
  }

  const parts = signedValue.split(COOKIE_SEPARATOR);
  if (parts.length !== 3) {
    return { valid: false, error: "format" };
  }

  const [value, timestamp, signature] = parts;
  const parsedValue = parseValue(value);
  if (!parsedValue.valid) {
    return { valid: false, error: parsedValue.error || "format" };
  }
  const issuedAt = Number.parseInt(timestamp, 36);
  if (!Number.isFinite(issuedAt)) {
    return { valid: false, error: "timestamp" };
  }

  const now = Date.now();
  if (issuedAt - now > TIMESTAMP_TOLERANCE_MS) {
    return { valid: false, error: "future" };
  }
  if (now - issuedAt > COOKIE_MAX_AGE_MS) {
    return { valid: false, error: "expired" };
  }

  const expectedSignature = sign(value, timestamp);
  if (signature.length !== expectedSignature.length) {
    return { valid: false, error: "signature" };
  }

  try {
    if (!crypto.timingSafeEqual(
      Buffer.from(signature, "utf8"),
      Buffer.from(expectedSignature, "utf8")
    )) {
      return { valid: false, error: "signature" };
    }
  } catch {
    return { valid: false, error: "signature" };
  }

  const remainingSeconds = Math.max(
    0,
    Math.floor((issuedAt + COOKIE_MAX_AGE_MS - now) / 1000)
  );

  return {
    valid: true,
    ipHash: parsedValue.ipHash,
    accountId: parsedValue.accountId || "",
    sessionId: parsedValue.sessionId || "",
    issuedAt,
    remainingSeconds
  };
}

function getCookieValue(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const raw = cookies[COOKIE_NAME];
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function createQqMusicCookie(req, accountId) {
  const ip = getClientIp(req);
  const ipHash = hashIp(ip);
  cleanupSessions();
  const sessionId = createSessionId();
  storeSession(sessionId, accountId, ipHash);
  const value = buildSessionValue(sessionId, accountId, ipHash);
  const signedValue = buildSignedValue(value);
  const parts = [
    `${encodeURIComponent(COOKIE_NAME)}=${encodeURIComponent(signedValue)}`,
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax"
  ];

  if (isHttps(req)) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function verifyQqMusicCookie(req) {
  const signedValue = getCookieValue(req);
  if (!signedValue) {
    return { valid: false, error: "missing" };
  }

  const parsed = parseSignedValue(signedValue);
  if (!parsed.valid) {
    return parsed;
  }

  const ip = getClientIp(req);
  const ipHash = hashIp(ip);
  if (parsed.ipHash !== ipHash) {
    return { valid: false, error: "ip_mismatch" };
  }

  if (parsed.sessionId) {
    const session = getSession(parsed.sessionId);
    const fallbackAccountId = parsed.accountId || "";
    if (!session) {
      if (fallbackAccountId) {
        return {
          valid: true,
          remainingSeconds: parsed.remainingSeconds,
          accountId: fallbackAccountId
        };
      }
      return { valid: false, error: "session_missing" };
    }
    if (session.expiresAt <= Date.now()) {
      sessionStore.delete(parsed.sessionId);
      return { valid: false, error: "expired" };
    }
    if (session.ipHash && session.ipHash !== ipHash) {
      return { valid: false, error: "ip_mismatch" };
    }
    return {
      valid: true,
      remainingSeconds: Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000)),
      accountId: session.accountId || fallbackAccountId
    };
  }

  return {
    valid: true,
    remainingSeconds: parsed.remainingSeconds,
    accountId: parsed.accountId || ""
  };
}

module.exports = {
  COOKIE_NAME,
  COOKIE_MAX_AGE_MS,
  createQqMusicCookie,
  verifyQqMusicCookie,
  getClientIp
};
