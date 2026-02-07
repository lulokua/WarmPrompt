const crypto = require("crypto");
const https = require("https");
const mysql = require("mysql2/promise");

const DB_CONFIG = {
  host: process.env.FEEDBACK_DB_HOST || process.env.MAIN_DB_HOST || process.env.DB_HOST || "localhost",
  port: parseInt(
    process.env.FEEDBACK_DB_PORT || process.env.MAIN_DB_PORT || process.env.DB_PORT,
    10
  ) || 3306,
  user: process.env.FEEDBACK_DB_USER || process.env.MAIN_DB_USER || process.env.DB_USER || "root",
  password: process.env.FEEDBACK_DB_PASSWORD || process.env.MAIN_DB_PASSWORD || process.env.DB_PASSWORD || "",
  database: process.env.FEEDBACK_DB_NAME || process.env.MAIN_DB_NAME || process.env.DB_NAME || "warmprompt",
  charset: "utf8mb4",
  timezone: "+08:00",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const BODY_MAX_BYTES = 200 * 1024;
const MAX_CONTENT_CHARS = parseInt(process.env.FEEDBACK_MAX_CONTENT || "2000", 10) || 2000;
const MAX_COMMENT_CHARS = parseInt(process.env.FEEDBACK_MAX_COMMENT || "500", 10) || 500;
const MAX_TITLE_CHARS = 100;
const MAX_CONTACT_CHARS = 64;
const MAX_PAGE_CHARS = 255;
const MAX_DEVICE_CHARS = 255;
const DEBUG_ERRORS = ["1", "true", "yes"].includes(
  String(process.env.FEEDBACK_DEBUG_ERRORS || "").trim().toLowerCase()
);

let dbPool = null;

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

async function dbQuery(sql, params = []) {
  const pool = getDbPool();
  if (!pool) return null;
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function dbQueryOne(sql, params = []) {
  const rows = await dbQuery(sql, params);
  return rows && rows.length > 0 ? rows[0] : null;
}

async function dbExecute(sql, params = []) {
  const pool = getDbPool();
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

function normalizeType(value) {
  const type = String(value || "").toLowerCase();
  if (type === "bug" || type === "suggestion" || type === "experience" || type === "other") {
    return type;
  }
  return "suggestion";
}

function normalizeContactType(value) {
  const type = String(value || "").toLowerCase();
  if (type === "qq" || type === "wechat" || type === "phone" || type === "email" || type === "other") {
    return type;
  }
  return "";
}

function normalizeName(value, maxLength = 32) {
  if (value === null || value === undefined) return "";
  return String(value).trim().slice(0, maxLength);
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

function getUserAgent(req) {
  return normalizeString(req.headers["user-agent"] || "", MAX_DEVICE_CHARS);
}

function getLikeKey(req) {
  const base = `${getRequestIp(req)}|${req.headers["user-agent"] || ""}`;
  return crypto.createHash("sha256").update(base).digest("hex");
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

function clampNumber(value, minValue, maxValue, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  if (minValue !== undefined && num < minValue) return minValue;
  if (maxValue !== undefined && num > maxValue) return maxValue;
  return num;
}

const MODERATION_SYSTEM_PROMPT = [
  "你是内容审核助手。任务：判断用户提交的内容是否包含辱骂、嘲讽、人身攻击、歧视、恶意挑衅、脏话等不友好内容。",
  "只返回严格 JSON，不要任何额外文字。",
  "格式：{\"ok\":true|false,\"reason\":\"...\"}",
  "reason 需简短、客观，不要复述或引用原文。"
].join("\n");

function parseModerationResult(content) {
  const text = String(content || "").trim();
  if (!text) {
    throw new Error("EMPTY_MODERATION_RESPONSE");
  }

  let jsonText = text;
  if (!jsonText.startsWith("{")) {
    const start = jsonText.indexOf("{");
    const end = jsonText.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      jsonText = jsonText.slice(start, end + 1);
    }
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error("INVALID_MODERATION_JSON");
  }

  const ok = Boolean(parsed && parsed.ok);
  const reason = parsed && typeof parsed.reason === "string" ? parsed.reason.trim() : "";
  return { ok, reason };
}

function requestDeepSeekModeration(text, contextLabel) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";

  if (!apiKey) {
    const error = new Error("MISSING_DEEPSEEK_API_KEY");
    error.code = "MISSING_DEEPSEEK_API_KEY";
    return Promise.reject(error);
  }

  const endpoint = new URL("/v1/chat/completions", baseUrl);
  const payload = JSON.stringify({
    model,
    temperature: 0,
    max_tokens: 120,
    messages: [
      { role: "system", content: MODERATION_SYSTEM_PROMPT },
      {
        role: "user",
        content: `内容类型：${contextLabel || "feedback"}\n内容：\n"""${text}"""`
      }
    ]
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + apiKey,
          "Content-Length": Buffer.byteLength(payload)
        }
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error("DeepSeek API error: " + res.statusCode));
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const choice = parsed && parsed.choices && parsed.choices[0];
            const message = choice && choice.message && choice.message.content;
            resolve(parseModerationResult(message));
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    req.on("error", reject);
    req.setTimeout(12000, () => {
      req.destroy(new Error("DEEPSEEK_TIMEOUT"));
    });
    req.write(payload);
    req.end();
  });
}

async function runModerationOrReject(res, text, contextLabel) {
  try {
    const result = await requestDeepSeekModeration(text, contextLabel);
    if (result.ok) {
      return { ok: true };
    }
    const message = result.reason || "内容包含不友好用语，请修改后再提交。";
    sendJson(res, 400, { success: false, message });
    return { ok: false };
  } catch (error) {
    console.error("Feedback moderation error:", error);
    sendJson(res, 503, { success: false, message: "审核服务不可用，请稍后再试。" });
    return { ok: false };
  }
}

async function handleFeedbackSubmit(req, res) {
  try {
    const data = await parseJsonBody(req);

    const rawContent = data.content === null || data.content === undefined
      ? ""
      : String(data.content).trim();
    if (!rawContent) {
      sendJson(res, 400, { success: false, message: "请填写反馈内容。" });
      return;
    }
    if (rawContent.length > MAX_CONTENT_CHARS) {
      sendJson(res, 413, {
        success: false,
        message: `反馈内容不能超过 ${MAX_CONTENT_CHARS} 字。`
      });
      return;
    }

    const feedbackType = normalizeType(data.type);
    const title = normalizeString(data.title, MAX_TITLE_CHARS);
    const contactType = normalizeContactType(data.contactType);
    const contactValue = normalizeString(data.contact, MAX_CONTACT_CHARS);
    const pagePath = normalizeString(data.page, MAX_PAGE_CHARS);
    const deviceInfo = normalizeString(data.device, MAX_DEVICE_CHARS);
    const userAgent = normalizeString(
      data.userAgent || req.headers["user-agent"],
      MAX_DEVICE_CHARS
    );

    const textForReview = [title, rawContent].filter(Boolean).join("\n");
    const reviewResult = await runModerationOrReject(res, textForReview, "feedback");
    if (!reviewResult.ok) {
      return;
    }

    const result = await dbExecute(
      `INSERT INTO feedback_submissions
        (feedback_type, feedback_title, feedback_content, contact_type, contact_value,
         page_path, device_info, user_agent, client_ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        feedbackType,
        title || null,
        rawContent,
        contactType || null,
        contactValue || null,
        pagePath || null,
        deviceInfo || null,
        userAgent || null,
        getRequestIp(req)
      ]
    );

    if (!result) {
      sendJson(res, 500, { success: false, message: "数据库不可用。" });
      return;
    }

    sendJson(res, 200, {
      success: true,
      message: "感谢你的反馈，我们会尽快处理！"
    });
  } catch (error) {
    if (error && error.code === "BODY_TOO_LARGE") {
      sendJson(res, 413, buildErrorPayload("请求体过大。", error));
      return;
    }
    if (isDbError(error)) {
      console.error("Feedback database error:", error);
      sendJson(res, 500, buildErrorPayload("数据库错误，请检查配置或表结构。", error));
      return;
    }
    console.error("Feedback request error:", error);
    sendJson(res, 400, buildErrorPayload("请求无效。", error));
  }
}

async function handleFeedbackList(req, res) {
  try {
    const url = new URL(req.url, "http://" + req.headers.host);
    const limit = clampNumber(url.searchParams.get("limit"), 1, 5000, 200);
    const page = clampNumber(url.searchParams.get("page"), 1, 100000, 1);
    const offset = (page - 1) * limit;

    const safeLimit = Math.floor(limit);
    const safeOffset = Math.floor(offset);
    const listSql = `SELECT feedback_id, feedback_type, feedback_title, feedback_content,
              contact_type, contact_value, page_path, device_info, created_at,
              (SELECT COUNT(*) FROM feedback_comments c WHERE c.feedback_id = feedback_submissions.feedback_id) AS comment_count,
              (SELECT COUNT(*) FROM feedback_likes l WHERE l.feedback_id = feedback_submissions.feedback_id) AS like_count
         FROM feedback_submissions
        ORDER BY feedback_id DESC
        LIMIT ${safeLimit} OFFSET ${safeOffset}`;
    const items = await dbQuery(listSql);

    if (!items) {
      sendJson(res, 500, { success: false, message: "数据库不可用。" });
      return;
    }

    const totalRow = await dbQueryOne("SELECT COUNT(*) AS total FROM feedback_submissions");
    const total = totalRow ? Number(totalRow.total) || 0 : items.length;

    sendJson(res, 200, {
      success: true,
      data: {
        items,
        total,
        page,
        pageSize: limit
      }
    });
  } catch (error) {
    if (isDbError(error)) {
      console.error("Feedback list database error:", error);
      sendJson(res, 500, buildErrorPayload("数据库错误，请检查配置或表结构。", error));
      return;
    }
    console.error("Feedback list request error:", error);
    sendJson(res, 400, buildErrorPayload("请求无效。", error));
  }
}

async function handleFeedbackDetail(req, res) {
  try {
    const url = new URL(req.url, "http://" + req.headers.host);
    const feedbackId = clampNumber(url.searchParams.get("id"), 1, Number.MAX_SAFE_INTEGER, null);
    if (!feedbackId) {
      sendJson(res, 400, { success: false, message: "缺少反馈 ID。" });
      return;
    }

    const feedback = await dbQueryOne(
      `SELECT feedback_id, feedback_type, feedback_title, feedback_content,
              contact_type, contact_value, page_path, device_info, created_at,
              (SELECT COUNT(*) FROM feedback_comments c WHERE c.feedback_id = feedback_submissions.feedback_id) AS comment_count,
              (SELECT COUNT(*) FROM feedback_likes l WHERE l.feedback_id = feedback_submissions.feedback_id) AS like_count
         FROM feedback_submissions
        WHERE feedback_id = ?
        LIMIT 1`,
      [Math.floor(feedbackId)]
    );

    if (!feedback) {
      sendJson(res, 404, { success: false, message: "未找到反馈内容。" });
      return;
    }

    const comments = await dbQuery(
      `SELECT c.comment_id, c.feedback_id, c.author_name, c.comment_content, c.created_at,
              (SELECT COUNT(*) FROM feedback_comment_likes cl WHERE cl.comment_id = c.comment_id) AS like_count
         FROM feedback_comments c
        WHERE c.feedback_id = ?
        ORDER BY c.comment_id ASC`,
      [Math.floor(feedbackId)]
    );

    const likeKey = getLikeKey(req);
    const likedRow = await dbQueryOne(
      "SELECT like_id FROM feedback_likes WHERE feedback_id = ? AND like_key = ? LIMIT 1",
      [Math.floor(feedbackId), likeKey]
    );

    let likedCommentIds = new Set();
    if (comments && comments.length > 0) {
      const ids = comments.map((item) => item.comment_id);
      const likedRows = await dbQuery(
        "SELECT comment_id FROM feedback_comment_likes WHERE like_key = ? AND comment_id IN (?)",
        [likeKey, ids]
      );
      if (likedRows) {
        likedRows.forEach((row) => likedCommentIds.add(row.comment_id));
      }
    }

    const safeComments = Array.isArray(comments) ? comments : [];
    safeComments.forEach((comment) => {
      comment.liked = likedCommentIds.has(comment.comment_id);
    });

    sendJson(res, 200, {
      success: true,
      data: {
        feedback,
        comments: safeComments,
        liked: Boolean(likedRow)
      }
    });
  } catch (error) {
    if (isDbError(error)) {
      console.error("Feedback detail database error:", error);
      sendJson(res, 500, buildErrorPayload("数据库错误，请检查配置或表结构。", error));
      return;
    }
    console.error("Feedback detail request error:", error);
    sendJson(res, 400, buildErrorPayload("请求无效。", error));
  }
}

async function handleFeedbackComment(req, res) {
  try {
    const data = await parseJsonBody(req);
    const feedbackId = clampNumber(data.feedbackId, 1, Number.MAX_SAFE_INTEGER, null);
    const content = data.content === null || data.content === undefined
      ? ""
      : String(data.content).trim();
    const authorName = normalizeName(data.authorName, 32);

    if (!feedbackId) {
      sendJson(res, 400, { success: false, message: "缺少反馈 ID。" });
      return;
    }
    if (!content) {
      sendJson(res, 400, { success: false, message: "请填写评论内容。" });
      return;
    }
    if (content.length > MAX_COMMENT_CHARS) {
      sendJson(res, 413, {
        success: false,
        message: `评论不能超过 ${MAX_COMMENT_CHARS} 字。`
      });
      return;
    }

    const exists = await dbQueryOne(
      "SELECT feedback_id FROM feedback_submissions WHERE feedback_id = ? LIMIT 1",
      [Math.floor(feedbackId)]
    );
    if (!exists) {
      sendJson(res, 404, { success: false, message: "反馈不存在。" });
      return;
    }

    const reviewResult = await runModerationOrReject(res, content, "comment");
    if (!reviewResult.ok) {
      return;
    }

    const result = await dbExecute(
      `INSERT INTO feedback_comments
        (feedback_id, author_name, comment_content, client_ip, user_agent)
       VALUES (?, ?, ?, ?, ?)`,
      [
        Math.floor(feedbackId),
        authorName || null,
        content,
        getRequestIp(req),
        getUserAgent(req) || null
      ]
    );

    if (!result) {
      sendJson(res, 500, { success: false, message: "数据库不可用。" });
      return;
    }

    sendJson(res, 200, {
      success: true,
      message: "评论成功。",
      data: { commentId: result.insertId }
    });
  } catch (error) {
    if (error && error.code === "BODY_TOO_LARGE") {
      sendJson(res, 413, buildErrorPayload("请求体过大。", error));
      return;
    }
    if (isDbError(error)) {
      console.error("Feedback comment database error:", error);
      sendJson(res, 500, buildErrorPayload("数据库错误，请检查配置或表结构。", error));
      return;
    }
    console.error("Feedback comment request error:", error);
    sendJson(res, 400, buildErrorPayload("请求无效。", error));
  }
}

async function handleFeedbackLike(req, res) {
  try {
    const data = await parseJsonBody(req);
    const feedbackId = clampNumber(data.feedbackId, 1, Number.MAX_SAFE_INTEGER, null);
    if (!feedbackId) {
      sendJson(res, 400, { success: false, message: "缺少反馈 ID。" });
      return;
    }

    const exists = await dbQueryOne(
      "SELECT feedback_id FROM feedback_submissions WHERE feedback_id = ? LIMIT 1",
      [Math.floor(feedbackId)]
    );
    if (!exists) {
      sendJson(res, 404, { success: false, message: "反馈不存在。" });
      return;
    }

    const likeKey = getLikeKey(req);
    const likedRow = await dbQueryOne(
      "SELECT like_id FROM feedback_likes WHERE feedback_id = ? AND like_key = ? LIMIT 1",
      [Math.floor(feedbackId), likeKey]
    );

    let liked = false;
    if (likedRow) {
      await dbExecute("DELETE FROM feedback_likes WHERE like_id = ?", [likedRow.like_id]);
      liked = false;
    } else {
      await dbExecute(
        `INSERT INTO feedback_likes (feedback_id, like_key, client_ip, user_agent)
         VALUES (?, ?, ?, ?)`,
        [Math.floor(feedbackId), likeKey, getRequestIp(req), getUserAgent(req)]
      );
      liked = true;
    }

    const countRow = await dbQueryOne(
      "SELECT COUNT(*) AS total FROM feedback_likes WHERE feedback_id = ?",
      [Math.floor(feedbackId)]
    );
    const likeCount = countRow ? Number(countRow.total) || 0 : 0;

    sendJson(res, 200, {
      success: true,
      data: { liked, likeCount }
    });
  } catch (error) {
    if (error && error.code === "BODY_TOO_LARGE") {
      sendJson(res, 413, buildErrorPayload("请求体过大。", error));
      return;
    }
    if (isDbError(error)) {
      console.error("Feedback like database error:", error);
      sendJson(res, 500, buildErrorPayload("数据库错误，请检查配置或表结构。", error));
      return;
    }
    console.error("Feedback like request error:", error);
    sendJson(res, 400, buildErrorPayload("请求无效。", error));
  }
}

async function handleFeedbackCommentLike(req, res) {
  try {
    const data = await parseJsonBody(req);
    const commentId = clampNumber(data.commentId, 1, Number.MAX_SAFE_INTEGER, null);
    if (!commentId) {
      sendJson(res, 400, { success: false, message: "缺少评论 ID。" });
      return;
    }

    const exists = await dbQueryOne(
      "SELECT comment_id FROM feedback_comments WHERE comment_id = ? LIMIT 1",
      [Math.floor(commentId)]
    );
    if (!exists) {
      sendJson(res, 404, { success: false, message: "评论不存在。" });
      return;
    }

    const likeKey = getLikeKey(req);
    const likedRow = await dbQueryOne(
      "SELECT like_id FROM feedback_comment_likes WHERE comment_id = ? AND like_key = ? LIMIT 1",
      [Math.floor(commentId), likeKey]
    );

    let liked = false;
    if (likedRow) {
      await dbExecute("DELETE FROM feedback_comment_likes WHERE like_id = ?", [likedRow.like_id]);
      liked = false;
    } else {
      await dbExecute(
        `INSERT INTO feedback_comment_likes (comment_id, like_key, client_ip, user_agent)
         VALUES (?, ?, ?, ?)`,
        [Math.floor(commentId), likeKey, getRequestIp(req), getUserAgent(req)]
      );
      liked = true;
    }

    const countRow = await dbQueryOne(
      "SELECT COUNT(*) AS total FROM feedback_comment_likes WHERE comment_id = ?",
      [Math.floor(commentId)]
    );
    const likeCount = countRow ? Number(countRow.total) || 0 : 0;

    sendJson(res, 200, {
      success: true,
      data: { liked, likeCount }
    });
  } catch (error) {
    if (error && error.code === "BODY_TOO_LARGE") {
      sendJson(res, 413, buildErrorPayload("请求体过大。", error));
      return;
    }
    if (isDbError(error)) {
      console.error("Feedback comment like database error:", error);
      sendJson(res, 500, buildErrorPayload("数据库错误，请检查配置或表结构。", error));
      return;
    }
    console.error("Feedback comment like request error:", error);
    sendJson(res, 400, buildErrorPayload("请求无效。", error));
  }
}

function handleFeedbackRequest(req, res, pathname) {
  if (pathname === "/api/feedback/submit" && req.method === "POST") {
    handleFeedbackSubmit(req, res);
    return true;
  }
  if (pathname === "/api/feedback/list" && req.method === "GET") {
    handleFeedbackList(req, res);
    return true;
  }
  if (pathname === "/api/feedback/detail" && req.method === "GET") {
    handleFeedbackDetail(req, res);
    return true;
  }
  if (pathname === "/api/feedback/comment" && req.method === "POST") {
    handleFeedbackComment(req, res);
    return true;
  }
  if (pathname === "/api/feedback/like" && req.method === "POST") {
    handleFeedbackLike(req, res);
    return true;
  }
  if (pathname === "/api/feedback/comment/like" && req.method === "POST") {
    handleFeedbackCommentLike(req, res);
    return true;
  }
  return false;
}

module.exports = {
  handleFeedbackRequest
};
