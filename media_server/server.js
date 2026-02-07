const http = require("http");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const Busboy = require("busboy");

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }
  const contents = fs.readFileSync(envPath, "utf8");
  contents.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }
    const index = trimmed.indexOf("=");
    if (index === -1) {
      return;
    }
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

loadEnvFile();

const PORT = parseInt(process.env.MEDIA_PORT) || 4001;
const UPLOAD_DIR = process.env.MEDIA_UPLOAD_DIR || path.join(__dirname, "uploads");
const IMAGE_DIR = path.join(UPLOAD_DIR, "images");
const VIDEO_DIR = path.join(UPLOAD_DIR, "videos");
const MAX_IMAGE_BYTES = parseInt(process.env.MEDIA_MAX_IMAGE_BYTES, 10) || 500 * 1024 * 1024;
const MAX_VIDEO_BYTES = parseInt(process.env.MEDIA_MAX_VIDEO_BYTES, 10) || 1024 * 1024 * 1024;
const MAX_FILE_BYTES = Math.max(MAX_IMAGE_BYTES, MAX_VIDEO_BYTES);
const IMAGE_TOO_LARGE_MESSAGE = `你的这个图片已经超过大小 ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB`;
const VIDEO_TOO_LARGE_MESSAGE = `视频已经超过 ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024 / 1024)} GB`;
const MEDIA_BASE_URL = String(process.env.MEDIA_BASE_URL || "").trim();
const UPLOAD_TOKEN = String(process.env.MEDIA_UPLOAD_TOKEN || "").trim();
const TRUST_PROXY = String(process.env.MEDIA_TRUST_PROXY || "").toLowerCase() === "true";
const UPLOAD_ALLOWED_IPS = String(process.env.MEDIA_UPLOAD_IP_ALLOWLIST || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const UPLOAD_RATE_WINDOW_MS = parseInt(process.env.MEDIA_UPLOAD_RATE_WINDOW_MS) || 10 * 60 * 1000;
const UPLOAD_RATE_MAX = parseInt(process.env.MEDIA_UPLOAD_RATE_MAX) || 20;
const UPLOAD_BAN_MS = parseInt(process.env.MEDIA_UPLOAD_BAN_MS) || 10 * 60 * 1000;
const DOWNLOAD_RATE_WINDOW_MS = parseInt(process.env.MEDIA_DOWNLOAD_RATE_WINDOW_MS) || 60 * 1000;
const DOWNLOAD_RATE_MAX = parseInt(process.env.MEDIA_DOWNLOAD_RATE_MAX) || 300;
const DOWNLOAD_BAN_MS = parseInt(process.env.MEDIA_DOWNLOAD_BAN_MS) || 10 * 60 * 1000;
const DELETE_MAX_BYTES = parseInt(process.env.MEDIA_DELETE_MAX_BYTES, 10) || 64 * 1024;

const MIME_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime"
};

const MIME_EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov"
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function ensureUploadDir() {
  try {
    fs.mkdirSync(IMAGE_DIR, { recursive: true });
    fs.mkdirSync(VIDEO_DIR, { recursive: true });
  } catch (error) {
    return;
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...CORS_HEADERS
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, message) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    ...CORS_HEADERS
  });
  res.end(message);
}

function parseJsonBody(req, maxBytes = DELETE_MAX_BYTES) {
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

function getExtension(filename, mimeType) {
  const ext = path.extname(filename || "").toLowerCase();
  if (ext && /^[.\w]+$/.test(ext)) {
    return ext;
  }
  return MIME_EXTENSIONS[mimeType] || "";
}

function buildBaseUrl(req) {
  if (MEDIA_BASE_URL) {
    return MEDIA_BASE_URL.replace(/\/+$/, "");
  }
  const protoHeader = String(req.headers["x-forwarded-proto"] || "http");
  const proto = protoHeader.split(",")[0].trim() || "http";
  const hostHeader = String(req.headers["x-forwarded-host"] || req.headers.host || "");
  const host = hostHeader.split(",")[0].trim();
  if (!host) return "";
  return `${proto}://${host}`;
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

function isIpAllowed(ip) {
  if (!UPLOAD_ALLOWED_IPS.length) return true;
  return UPLOAD_ALLOWED_IPS.includes(ip);
}

function getUploadToken(req) {
  const headerToken = req.headers["x-upload-token"];
  if (headerToken) return String(headerToken).trim();
  const url = new URL(req.url, "http://" + (req.headers.host || "localhost"));
  const queryToken = url.searchParams.get("token");
  return queryToken ? queryToken.trim() : "";
}

function createRateLimiter(windowMs, maxCount, banMs) {
  if (windowMs <= 0 || maxCount <= 0 || banMs <= 0) {
    return null;
  }
  const map = new Map();
  return {
    check(ip) {
      const now = Date.now();
      const record = map.get(ip) || { count: 0, windowStart: now, bannedUntil: 0 };

      if (record.bannedUntil && now < record.bannedUntil) {
        return { allowed: false, retryAfter: Math.ceil((record.bannedUntil - now) / 1000) };
      }

      if (now - record.windowStart > windowMs) {
        record.count = 0;
        record.windowStart = now;
      }

      record.count += 1;
      if (record.count > maxCount) {
        record.bannedUntil = now + banMs;
        map.set(ip, record);
        return { allowed: false, retryAfter: Math.ceil(banMs / 1000) };
      }

      map.set(ip, record);
      return { allowed: true };
    },
    cleanup() {
      const now = Date.now();
      for (const [ip, record] of map.entries()) {
        if (record.bannedUntil && now > record.bannedUntil) {
          map.delete(ip);
          continue;
        }
        if (!record.bannedUntil && now - record.windowStart > windowMs * 2) {
          map.delete(ip);
        }
      }
    }
  };
}

const uploadLimiter = createRateLimiter(UPLOAD_RATE_WINDOW_MS, UPLOAD_RATE_MAX, UPLOAD_BAN_MS);
const downloadLimiter = createRateLimiter(DOWNLOAD_RATE_WINDOW_MS, DOWNLOAD_RATE_MAX, DOWNLOAD_BAN_MS);

if (uploadLimiter || downloadLimiter) {
  setInterval(() => {
    if (uploadLimiter) {
      uploadLimiter.cleanup();
    }
    if (downloadLimiter) {
      downloadLimiter.cleanup();
    }
  }, 60 * 1000);
}

function handleUpload(req, res) {
  ensureUploadDir();

  const clientIp = getClientIp(req);
  if (!UPLOAD_TOKEN) {
    sendJson(res, 500, { success: false, message: "Upload token not configured." });
    return;
  }
  const token = getUploadToken(req);
  if (!token || token !== UPLOAD_TOKEN) {
    sendJson(res, 403, { success: false, message: "Forbidden." });
    return;
  }
  if (!isIpAllowed(clientIp)) {
    sendJson(res, 403, { success: false, message: "IP not allowed." });
    return;
  }

  if (uploadLimiter) {
    const rateCheck = uploadLimiter.check(clientIp);
    if (!rateCheck.allowed) {
      res.writeHead(429, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Retry-After": String(rateCheck.retryAfter || 60),
        ...CORS_HEADERS
      });
      res.end(JSON.stringify({ success: false, message: "Too many uploads." }));
      return;
    }
  }

  let uploadInfo = null;
  let uploadError = null;
  let responded = false;
  let fileSeen = false;
  let uploadEnded = false;
  let outputFinished = false;

  const respondOnce = (status, payload) => {
    if (responded) return;
    responded = true;
    sendJson(res, status, payload);
  };

  const maybeRespond = () => {
    if (responded) return;
    if (uploadError) {
      const message = uploadError === "IMAGE_TOO_LARGE"
        ? IMAGE_TOO_LARGE_MESSAGE
        : uploadError === "VIDEO_TOO_LARGE"
          ? VIDEO_TOO_LARGE_MESSAGE
          : uploadError === "FILE_TOO_LARGE"
            ? "File too large."
            : uploadError === "UNSUPPORTED_TYPE"
              ? "Unsupported file type."
              : "Upload failed.";
      respondOnce(400, { success: false, message });
      return;
    }
    if (!fileSeen && uploadEnded) {
      respondOnce(400, { success: false, message: "No file received." });
      return;
    }
    if (fileSeen && uploadEnded && outputFinished && uploadInfo) {
      const baseUrl = buildBaseUrl(req);
      const encodedName = encodeURIComponent(uploadInfo.filename);
      const folder = uploadInfo.isVideo ? "videos" : "images";
      const url = baseUrl ? `${baseUrl}/media/${folder}/${encodedName}` : `/media/${folder}/${encodedName}`;
      const mediaType = uploadInfo.mimeType.startsWith("video/") ? "video" : "image";

      respondOnce(200, {
        success: true,
        data: {
          url,
          mediaType
        }
      });
    }
  };

  const busboy = Busboy({
    headers: req.headers,
    limits: { files: 1, fileSize: MAX_FILE_BYTES }
  });

  busboy.on("file", (fieldname, file, info) => {
    fileSeen = true;
    if (uploadInfo) {
      file.resume();
      return;
    }

    const mimeType = info && info.mimeType ? info.mimeType : "";
    if (!mimeType.startsWith("image/") && !mimeType.startsWith("video/")) {
      uploadError = "UNSUPPORTED_TYPE";
      file.resume();
      maybeRespond();
      return;
    }

    const isVideo = mimeType.startsWith("video/");
    const sizeLimit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    const ext = getExtension(info.filename, mimeType);
    const safeName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    const targetDir = isVideo ? VIDEO_DIR : IMAGE_DIR;
    const targetPath = path.join(targetDir, safeName);
    const output = fs.createWriteStream(targetPath);
    let fileBytes = 0;

    file.on("limit", () => {
      uploadError = isVideo ? "VIDEO_TOO_LARGE" : "IMAGE_TOO_LARGE";
      output.destroy();
      fs.unlink(targetPath, () => {});
      maybeRespond();
    });

    file.on("data", (chunk) => {
      fileBytes += chunk.length;
      if (fileBytes > sizeLimit) {
        uploadError = isVideo ? "VIDEO_TOO_LARGE" : "IMAGE_TOO_LARGE";
        file.unpipe(output);
        output.destroy();
        fs.unlink(targetPath, () => {});
        file.resume();
        maybeRespond();
      }
    });

    output.on("error", () => {
      uploadError = "WRITE_FAILED";
      file.unpipe(output);
      output.destroy();
      fs.unlink(targetPath, () => {});
      maybeRespond();
    });

    output.on("finish", () => {
      uploadInfo = { filename: safeName, mimeType, isVideo };
      outputFinished = true;
      maybeRespond();
    });

    file.pipe(output);
  });

  busboy.on("error", () => {
    uploadError = "UPLOAD_FAILED";
    maybeRespond();
  });

  busboy.on("finish", () => {
    uploadEnded = true;
    maybeRespond();
  });

  req.pipe(busboy);
}

function normalizeDeleteTarget(value) {
  if (!value) return null;
  const decoded = decodeURIComponent(String(value)).replace(/\\/g, "/").replace(/^\/+/, "");
  const match = decoded.match(/^(images|videos)\/([^/]+)$/);
  if (!match) return null;
  const folder = match[1];
  const filename = match[2].replace(/[^a-zA-Z0-9._-]/g, "");
  if (!filename) return null;
  return { folder, filename };
}

async function deleteFileSafe(filePath) {
  return new Promise((resolve) => {
    fs.unlink(filePath, (err) => {
      if (err && err.code !== "ENOENT") {
        resolve(false);
        return;
      }
      resolve(true);
    });
  });
}

async function handleDelete(req, res) {
  ensureUploadDir();

  const clientIp = getClientIp(req);
  if (!UPLOAD_TOKEN) {
    sendJson(res, 500, { success: false, message: "Upload token not configured." });
    return;
  }
  const token = getUploadToken(req);
  if (!token || token !== UPLOAD_TOKEN) {
    sendJson(res, 403, { success: false, message: "Forbidden." });
    return;
  }
  if (!isIpAllowed(clientIp)) {
    sendJson(res, 403, { success: false, message: "IP not allowed." });
    return;
  }

  let payload;
  try {
    payload = await parseJsonBody(req);
  } catch (error) {
    if (error && error.code === "BODY_TOO_LARGE") {
      sendJson(res, 413, { success: false, message: "Payload too large." });
      return;
    }
    sendJson(res, 400, { success: false, message: "Invalid request." });
    return;
  }

  const rawPaths = Array.isArray(payload.paths) ? payload.paths : payload.path ? [payload.path] : [];
  if (rawPaths.length === 0) {
    sendJson(res, 400, { success: false, message: "No paths provided." });
    return;
  }

  let deleted = 0;
  let failed = 0;
  for (const rawPath of rawPaths) {
    const target = normalizeDeleteTarget(rawPath);
    if (!target) {
      failed += 1;
      continue;
    }
    const baseDir = target.folder === "videos" ? VIDEO_DIR : IMAGE_DIR;
    const filePath = path.resolve(baseDir, target.filename);
    if (!filePath.startsWith(path.resolve(baseDir))) {
      failed += 1;
      continue;
    }
    const ok = await deleteFileSafe(filePath);
    if (ok) deleted += 1;
    else failed += 1;
  }

  sendJson(res, 200, {
    success: true,
    deleted,
    failed
  });
}

function handleMedia(req, res, pathname) {
  ensureUploadDir();
  const match = pathname.match(/^\/media\/(images|videos)\/(.+)$/);
  if (!match) {
    sendText(res, 404, "Not Found");
    return;
  }
  const folder = match[1];
  const rawName = match[2];
  const safeName = decodeURIComponent(rawName).replace(/[\\/]/g, "");
  if (!safeName) {
    sendText(res, 404, "Not Found");
    return;
  }

  const baseDir = folder === "videos" ? VIDEO_DIR : IMAGE_DIR;
  const clientIp = getClientIp(req);
  if (downloadLimiter) {
    const rateCheck = downloadLimiter.check(clientIp);
    if (!rateCheck.allowed) {
      res.writeHead(429, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "Retry-After": String(rateCheck.retryAfter || 60),
        ...CORS_HEADERS
      });
      res.end("Too Many Requests");
      return;
    }
  }

  const filePath = path.resolve(baseDir, safeName);
  if (!filePath.startsWith(path.resolve(baseDir))) {
    sendText(res, 400, "Bad Request");
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      sendText(res, 404, "Not Found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = MIME_TYPES[ext] || "application/octet-stream";
    const range = req.headers.range;
    if (range) {
      const matchRange = range.match(/bytes=(\d*)-(\d*)/);
      const fileSize = stats.size;
      if (!matchRange) {
        res.writeHead(416, { "Content-Range": `bytes */${fileSize}`, ...CORS_HEADERS });
        res.end();
        return;
      }

      let start = matchRange[1] ? parseInt(matchRange[1], 10) : 0;
      let end = matchRange[2] ? parseInt(matchRange[2], 10) : fileSize - 1;
      if (Number.isNaN(start)) start = 0;
      if (Number.isNaN(end)) end = fileSize - 1;
      if (start > end || start >= fileSize) {
        res.writeHead(416, { "Content-Range": `bytes */${fileSize}`, ...CORS_HEADERS });
        res.end();
        return;
      }

      res.writeHead(206, {
        "Content-Type": type,
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
        "Cache-Control": "public, max-age=31536000",
        ...CORS_HEADERS
      });

      const stream = fs.createReadStream(filePath, { start, end });
      stream.on("error", () => {
        sendText(res, 500, "Server error");
      });
      stream.pipe(res);
      return;
    }

    res.writeHead(200, {
      "Content-Type": type,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000",
      ...CORS_HEADERS
    });

    const stream = fs.createReadStream(filePath);
    stream.on("error", () => {
      sendText(res, 500, "Server error");
    });
    stream.pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://" + (req.headers.host || "localhost"));
  const pathname = url.pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  if (req.method === "POST" && pathname === "/api/upload") {
    handleUpload(req, res);
    return;
  }

  if (req.method === "POST" && pathname === "/api/delete") {
    handleDelete(req, res);
    return;
  }

  if (req.method === "GET" && pathname.startsWith("/media/")) {
    handleMedia(req, res, pathname);
    return;
  }

  if (req.method === "GET" && pathname === "/health") {
    sendJson(res, 200, { status: "ok" });
    return;
  }

  sendText(res, 404, "Not Found");
});

server.listen(PORT, () => {
  console.log(`Media server listening on ${PORT}`);
});
