const fs = require("fs");
const path = require("path");
const https = require("https");
const crypto = require("crypto");

// ==================== Cookie 签名系统 ====================

// ===== Cookie 签名配置 =====
const COOKIE_CONFIG = {
  // 签名算法
  algorithm: "sha256",
  // 签名密钥（生产环境应从环境变量读取）
  secretKey: process.env.COOKIE_SECRET || crypto.randomBytes(32).toString("hex"),
  // Cookie 有效期（毫秒）：24小时
  maxAge: 24 * 60 * 60 * 1000,
  // 时间戳容差（毫秒）：防止时钟偏差，允许5分钟误差
  timestampTolerance: 5 * 60 * 1000,
  // 签名分隔符
  separator: ".",
  // 启用时间戳验证
  enableTimestamp: true
};

/**
 * 生成 HMAC 签名
 * @param {string} value - 要签名的值
 * @param {string} timestamp - 时间戳
 * @returns {string} - 签名结果（Base64URL 编码）
 */
function generateSignature(value, timestamp) {
  const data = `${value}${COOKIE_CONFIG.separator}${timestamp}`;
  const hmac = crypto.createHmac(COOKIE_CONFIG.algorithm, COOKIE_CONFIG.secretKey);
  hmac.update(data);
  // 使用 Base64URL 编码（URL 安全）
  return hmac.digest("base64url");
}

/**
 * 签名 Cookie 值
 * @param {string} name - Cookie 名称
 * @param {string} value - Cookie 值
 * @returns {string} - 签名后的 Cookie 值格式：value.timestamp.signature
 */
function signCookie(name, value) {
  const timestamp = Date.now().toString(36); // 使用36进制压缩时间戳
  const signature = generateSignature(`${name}:${value}`, timestamp);
  return `${value}${COOKIE_CONFIG.separator}${timestamp}${COOKIE_CONFIG.separator}${signature}`;
}

/**
 * 验证并解析签名的 Cookie
 * @param {string} name - Cookie 名称
 * @param {string} signedValue - 签名后的 Cookie 值
 * @returns {{ valid: boolean, value?: string, error?: string }}
 */
function verifyCookie(name, signedValue) {
  if (!signedValue || typeof signedValue !== "string") {
    return { valid: false, error: "Cookie 值为空" };
  }

  const parts = signedValue.split(COOKIE_CONFIG.separator);
  if (parts.length !== 3) {
    return { valid: false, error: "Cookie 格式无效" };
  }

  const [value, timestamp, signature] = parts;

  // 验证时间戳
  if (COOKIE_CONFIG.enableTimestamp) {
    const cookieTime = parseInt(timestamp, 36);
    const now = Date.now();

    // 检查 Cookie 是否过期
    if (now - cookieTime > COOKIE_CONFIG.maxAge) {
      return { valid: false, error: "Cookie 已过期" };
    }

    // 检查时间戳是否来自未来（防止时钟攻击）
    if (cookieTime - now > COOKIE_CONFIG.timestampTolerance) {
      return { valid: false, error: "Cookie 时间戳异常" };
    }
  }

  // 重新计算签名并比较
  const expectedSignature = generateSignature(`${name}:${value}`, timestamp);

  // 使用时间安全的比较防止计时攻击
  if (!crypto.timingSafeEqual(
    Buffer.from(signature, "utf8"),
    Buffer.from(expectedSignature, "utf8")
  )) {
    return { valid: false, error: "Cookie 签名无效" };
  }

  return { valid: true, value };
}

/**
 * 解析请求中的 Cookie
 * @param {string} cookieHeader - Cookie 头部字符串
 * @returns {Object} - Cookie 键值对
 */
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(";").forEach((cookie) => {
    const [name, ...rest] = cookie.trim().split("=");
    if (name) {
      cookies[name.trim()] = rest.join("=").trim();
    }
  });

  return cookies;
}

/**
 * 生成安全的 Set-Cookie 头部
 * @param {string} name - Cookie 名称
 * @param {string} value - Cookie 值
 * @param {Object} options - Cookie 选项
 * @returns {string} - Set-Cookie 头部值
 */
function createSecureCookie(name, value, options = {}) {
  const signedValue = signCookie(name, value);

  const cookieParts = [`${encodeURIComponent(name)}=${encodeURIComponent(signedValue)}`];

  // 设置过期时间
  if (options.maxAge !== undefined) {
    cookieParts.push(`Max-Age=${options.maxAge}`);
  } else {
    // 默认使用配置的过期时间
    cookieParts.push(`Max-Age=${Math.floor(COOKIE_CONFIG.maxAge / 1000)}`);
  }

  // 设置路径
  cookieParts.push(`Path=${options.path || "/"}`);

  // 设置域名
  if (options.domain) {
    cookieParts.push(`Domain=${options.domain}`);
  }

  // 安全标志（HTTPS only）
  if (options.secure !== false) {
    cookieParts.push("Secure");
  }

  // HttpOnly 标志（防止 XSS 攻击）
  if (options.httpOnly !== false) {
    cookieParts.push("HttpOnly");
  }

  // SameSite 属性（防止 CSRF 攻击）
  const sameSite = options.sameSite || "Strict";
  cookieParts.push(`SameSite=${sameSite}`);

  return cookieParts.join("; ");
}

/**
 * 获取并验证请求中的签名 Cookie
 * @param {Object} req - HTTP 请求对象
 * @param {string} name - Cookie 名称
 * @returns {{ valid: boolean, value?: string, error?: string }}
 */
function getSignedCookie(req, name) {
  const cookieHeader = req.headers.cookie || "";
  const cookies = parseCookies(cookieHeader);
  const signedValue = cookies[name];

  if (!signedValue) {
    return { valid: false, error: "Cookie 不存在" };
  }

  return verifyCookie(name, decodeURIComponent(signedValue));
}

/**
 * 生成 CSRF Token（基于 Cookie 签名）
 * @param {string} sessionId - 会话 ID
 * @returns {string} - CSRF Token
 */
function generateCSRFToken(sessionId) {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(16).toString("hex");
  const data = `csrf:${sessionId}:${random}:${timestamp}`;
  const signature = generateSignature(data, timestamp);
  return `${random}${COOKIE_CONFIG.separator}${timestamp}${COOKIE_CONFIG.separator}${signature}`;
}

/**
 * 验证 CSRF Token
 * @param {string} token - CSRF Token
 * @param {string} sessionId - 会话 ID
 * @returns {boolean}
 */
function verifyCSRFToken(token, sessionId) {
  if (!token || typeof token !== "string") {
    return false;
  }

  const parts = token.split(COOKIE_CONFIG.separator);
  if (parts.length !== 3) {
    return false;
  }

  const [random, timestamp, signature] = parts;

  // 验证时间戳
  const tokenTime = parseInt(timestamp, 36);
  const now = Date.now();
  if (now - tokenTime > COOKIE_CONFIG.maxAge) {
    return false;
  }

  // 验证签名
  const data = `csrf:${sessionId}:${random}:${timestamp}`;
  const expectedSignature = generateSignature(data, timestamp);

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, "utf8"),
      Buffer.from(expectedSignature, "utf8")
    );
  } catch {
    return false;
  }
}

// Cookie 签名密钥信息（静默处理）

// ==================== Cookie 签名系统结束 ====================

// ==================== IP 伪造 & Cookie 伪造防护系统 ====================

// ===== 防伪造配置 =====
const ANTI_SPOOF_CONFIG = {
  // 是否启用严格模式（更严格的检测，可能误伤正常用户）
  strictMode: true,

  // IP 伪造检测配置
  ipSpoof: {
    // 最大允许的 X-Forwarded-For 链长度
    maxProxyChain: 5,
    // 检测私有 IP 伪造
    checkPrivateIP: true,
    // 检测保留 IP 地址
    checkReservedIP: true,
    // IP 变化阈值：短时间内 IP 变化次数超过此值视为可疑
    ipChangeThreshold: 3,
    // IP 变化检测时间窗口（毫秒）
    ipChangeWindow: 5 * 60 * 1000, // 5分钟
  },

  // Cookie 防伪造配置
  cookieSpoof: {
    // 绑定 User-Agent
    bindUserAgent: true,
    // 绑定 IP 地址（可能影响移动用户）
    bindIP: false,
    // 绑定 IP 段（更宽松）
    bindIPSubnet: true,
    // IP 段掩码（/24 网段）
    subnetMask: 24,
  },

  // 可疑请求头检测
  suspiciousHeaders: {
    // 已知的代理/伪造头部
    proxyHeaders: [
      "x-forwarded-host",
      "x-original-url",
      "x-rewrite-url",
      "x-originating-ip",
      "x-remote-ip",
      "x-client-ip",
      "x-host",
      "x-forwarded-server",
      "via",
      "forwarded"
    ],
    // 可疑 User-Agent 关键词
    suspiciousUA: [
      "curl", "wget", "python-requests", "go-http-client",
      "java/", "apache-httpclient", "okhttp",
      "bot", "spider", "crawler", "scraper"
    ],
    // 空 User-Agent 是否可疑
    emptyUASuspicious: true
  },

  // 指纹追踪配置
  fingerprint: {
    // 指纹有效期（毫秒）
    ttl: 30 * 60 * 1000, // 30分钟
    // 最大存储数量
    maxEntries: 10000
  }
};

// ===== 存储结构 =====
// 请求指纹存储 { fingerprint: { ip, userAgent, firstSeen, lastSeen, requestCount, ipHistory } }
const fingerprintStore = new Map();
// IP 变化追踪 { sessionId: { ips: Set, timestamps: [], suspicious: boolean } }
const ipChangeTracker = new Map();
// 可疑活动记录 { ip: { reasons: [], count: number, lastSeen: number } }
const suspiciousActivityStore = new Map();

// ===== 统计信息 =====
const antiSpoofStats = {
  ipSpoofDetected: 0,
  cookieSpoofDetected: 0,
  suspiciousRequests: 0,
  fingerprintsTracked: 0
};

// ===== 访问统计（每10分钟重置） =====
const visitorStats = {
  uniqueIPs: new Set(),           // 唯一访问IP
  totalRequests: 0,               // 总请求数
  blockedRequests: 0,             // 被拦截的请求数
  suspiciousRequests: 0,          // 可疑请求数
  bannedIPs: new Set(),           // 被封禁的IP
  lastReportTime: Date.now()      // 上次报告时间
};

/**
 * 检测 IP 是否为私有/保留地址
 * @param {string} ip - IP 地址
 * @returns {{ isPrivate: boolean, isReserved: boolean, type: string }}
 */
function analyzeIPType(ip) {
  if (!ip || ip === "unknown") {
    return { isPrivate: false, isReserved: true, type: "unknown" };
  }

  // IPv4 私有地址段
  const privateRanges = [
    /^10\./,                          // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // 172.16.0.0/12
    /^192\.168\./,                    // 192.168.0.0/16
    /^127\./,                         // 127.0.0.0/8 (loopback)
    /^169\.254\./                     // 169.254.0.0/16 (link-local)
  ];

  // 保留地址段
  const reservedRanges = [
    /^0\./,                           // 0.0.0.0/8
    /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./, // 100.64.0.0/10 (CGN)
    /^192\.0\.0\./,                   // 192.0.0.0/24
    /^192\.0\.2\./,                   // 192.0.2.0/24 (TEST-NET-1)
    /^198\.5[12]\./,                  // 198.51.100.0/24 (TEST-NET-2)
    /^203\.0\.113\./,                 // 203.0.113.0/24 (TEST-NET-3)
    /^2(2[4-9]|3[0-9])\./,            // 224.0.0.0/4 (Multicast)
    /^2(4[0-9]|5[0-5])\./             // 240.0.0.0/4 (Reserved)
  ];

  // IPv6 特殊地址
  const ipv6Patterns = [
    /^::1$/,                          // Loopback
    /^fe80:/i,                        // Link-local
    /^fc00:/i,                        // Unique local
    /^fd/i                            // Unique local
  ];

  for (const pattern of privateRanges) {
    if (pattern.test(ip)) {
      return { isPrivate: true, isReserved: false, type: "private" };
    }
  }

  for (const pattern of reservedRanges) {
    if (pattern.test(ip)) {
      return { isPrivate: false, isReserved: true, type: "reserved" };
    }
  }

  for (const pattern of ipv6Patterns) {
    if (pattern.test(ip)) {
      return { isPrivate: true, isReserved: false, type: "ipv6-special" };
    }
  }

  return { isPrivate: false, isReserved: false, type: "public" };
}

/**
 * 获取 IP 的子网地址
 * @param {string} ip - IP 地址
 * @param {number} mask - 子网掩码位数
 * @returns {string} - 子网地址
 */
function getIPSubnet(ip, mask = 24) {
  if (!ip || ip.includes(":")) {
    // IPv6 或无效 IP，返回原值
    return ip;
  }

  const parts = ip.split(".");
  if (parts.length !== 4) return ip;

  const ipNum = parts.reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  const maskNum = (0xffffffff << (32 - mask)) >>> 0;
  const subnetNum = ipNum & maskNum;

  return [
    (subnetNum >>> 24) & 0xff,
    (subnetNum >>> 16) & 0xff,
    (subnetNum >>> 8) & 0xff,
    subnetNum & 0xff
  ].join(".");
}

/**
 * 分析 X-Forwarded-For 头部，检测可疑特征
 * @param {Object} req - HTTP 请求对象
 * @returns {{ ips: string[], suspicious: boolean, reasons: string[] }}
 */
function analyzeForwardedFor(req) {
  const result = {
    ips: [],
    suspicious: false,
    reasons: []
  };

  const xff = req.headers["x-forwarded-for"];
  if (!xff) {
    return result;
  }

  // 解析所有 IP
  const ips = xff.split(",").map(ip => ip.trim()).filter(ip => ip);
  result.ips = ips;

  // 检查链长度
  if (ips.length > ANTI_SPOOF_CONFIG.ipSpoof.maxProxyChain) {
    result.suspicious = true;
    result.reasons.push(`代理链过长 (${ips.length} 层)`);
  }

  // 检查每个 IP
  for (const ip of ips) {
    const analysis = analyzeIPType(ip);

    // 检测公网 IP 后面跟着私有 IP（正常情况是私有->公网）
    if (analysis.isPrivate && ips.indexOf(ip) > 0) {
      const prevIP = ips[ips.indexOf(ip) - 1];
      const prevAnalysis = analyzeIPType(prevIP);
      if (!prevAnalysis.isPrivate && !prevAnalysis.isReserved) {
        result.suspicious = true;
        result.reasons.push("IP 链顺序异常（公网 IP 后出现私有 IP）");
      }
    }

    // 检测保留地址
    if (ANTI_SPOOF_CONFIG.ipSpoof.checkReservedIP && analysis.isReserved) {
      result.suspicious = true;
      result.reasons.push(`检测到保留 IP 地址: ${ip}`);
    }
  }

  // 检测重复 IP
  const uniqueIPs = new Set(ips);
  if (uniqueIPs.size !== ips.length) {
    result.suspicious = true;
    result.reasons.push("IP 链中存在重复 IP");
  }

  return result;
}

/**
 * 检测可疑请求头
 * @param {Object} req - HTTP 请求对象
 * @returns {{ suspicious: boolean, reasons: string[] }}
 */
function detectSuspiciousHeaders(req) {
  const result = {
    suspicious: false,
    reasons: []
  };

  const headers = req.headers;

  // 检测可疑代理头部
  for (const header of ANTI_SPOOF_CONFIG.suspiciousHeaders.proxyHeaders) {
    if (headers[header]) {
      result.suspicious = true;
      result.reasons.push(`可疑代理头部: ${header}`);
    }
  }

  // 检测 User-Agent
  const ua = headers["user-agent"] || "";

  if (!ua && ANTI_SPOOF_CONFIG.suspiciousHeaders.emptyUASuspicious) {
    result.suspicious = true;
    result.reasons.push("空 User-Agent");
  }

  const lowerUA = ua.toLowerCase();
  for (const keyword of ANTI_SPOOF_CONFIG.suspiciousHeaders.suspiciousUA) {
    if (lowerUA.includes(keyword)) {
      result.suspicious = true;
      result.reasons.push(`可疑 User-Agent 包含: ${keyword}`);
      break;
    }
  }

  // 检测头部不一致性
  // 例如：声称是浏览器但缺少常见浏览器头部
  if (ua && (ua.includes("Mozilla") || ua.includes("Chrome") || ua.includes("Safari"))) {
    const browserHeaders = ["accept", "accept-language", "accept-encoding"];
    const missingHeaders = browserHeaders.filter(h => !headers[h]);
    if (missingHeaders.length > 1) {
      result.suspicious = true;
      result.reasons.push("声称是浏览器但缺少浏览器标准头部");
    }
  }

  return result;
}

/**
 * 生成请求指纹
 * @param {Object} req - HTTP 请求对象
 * @returns {string} - 指纹哈希
 */
function generateRequestFingerprint(req) {
  const components = [
    req.headers["user-agent"] || "",
    req.headers["accept-language"] || "",
    req.headers["accept-encoding"] || "",
    req.headers["accept"] || ""
  ];

  const data = components.join("|");
  return crypto.createHash("sha256").update(data).digest("hex").substring(0, 16);
}

/**
 * 创建绑定 IP 和 User-Agent 的安全 Cookie
 * @param {Object} req - HTTP 请求对象
 * @param {string} name - Cookie 名称
 * @param {string} value - Cookie 值
 * @param {Object} options - Cookie 选项
 * @returns {string} - Set-Cookie 头部值
 */
function createBoundCookie(req, name, value, options = {}) {
  const ip = getClientIPSafe(req);
  const ua = req.headers["user-agent"] || "";
  const subnet = getIPSubnet(ip, ANTI_SPOOF_CONFIG.cookieSpoof.subnetMask);

  // 构建绑定数据
  const bindingParts = [value];

  if (ANTI_SPOOF_CONFIG.cookieSpoof.bindUserAgent) {
    // 使用 UA 的哈希而非完整 UA（节省空间）
    const uaHash = crypto.createHash("md5").update(ua).digest("hex").substring(0, 8);
    bindingParts.push(uaHash);
  }

  if (ANTI_SPOOF_CONFIG.cookieSpoof.bindIPSubnet) {
    const subnetHash = crypto.createHash("md5").update(subnet).digest("hex").substring(0, 8);
    bindingParts.push(subnetHash);
  }

  if (ANTI_SPOOF_CONFIG.cookieSpoof.bindIP) {
    const ipHash = crypto.createHash("md5").update(ip).digest("hex").substring(0, 8);
    bindingParts.push(ipHash);
  }

  // 合并并签名
  const boundValue = bindingParts.join(":");
  return createSecureCookie(name, boundValue, options);
}

/**
 * 验证绑定的 Cookie
 * @param {Object} req - HTTP 请求对象
 * @param {string} name - Cookie 名称
 * @returns {{ valid: boolean, value?: string, error?: string, spoofDetected?: boolean }}
 */
function verifyBoundCookie(req, name) {
  // 首先验证签名
  const signedResult = getSignedCookie(req, name);
  if (!signedResult.valid) {
    return signedResult;
  }

  const parts = signedResult.value.split(":");
  if (parts.length < 2) {
    return { valid: true, value: signedResult.value };
  }

  const [originalValue, ...bindings] = parts;
  const ip = getClientIPSafe(req);
  const ua = req.headers["user-agent"] || "";
  const subnet = getIPSubnet(ip, ANTI_SPOOF_CONFIG.cookieSpoof.subnetMask);

  let bindingIndex = 0;

  // 验证 User-Agent 绑定
  if (ANTI_SPOOF_CONFIG.cookieSpoof.bindUserAgent && bindings[bindingIndex]) {
    const expectedUAHash = crypto.createHash("md5").update(ua).digest("hex").substring(0, 8);
    if (bindings[bindingIndex] !== expectedUAHash) {
      antiSpoofStats.cookieSpoofDetected++;
      return {
        valid: false,
        error: "User-Agent 不匹配",
        spoofDetected: true
      };
    }
    bindingIndex++;
  }

  // 验证 IP 子网绑定
  if (ANTI_SPOOF_CONFIG.cookieSpoof.bindIPSubnet && bindings[bindingIndex]) {
    const expectedSubnetHash = crypto.createHash("md5").update(subnet).digest("hex").substring(0, 8);
    if (bindings[bindingIndex] !== expectedSubnetHash) {
      antiSpoofStats.cookieSpoofDetected++;
      return {
        valid: false,
        error: "IP 网段不匹配",
        spoofDetected: true
      };
    }
    bindingIndex++;
  }

  // 验证完整 IP 绑定
  if (ANTI_SPOOF_CONFIG.cookieSpoof.bindIP && bindings[bindingIndex]) {
    const expectedIPHash = crypto.createHash("md5").update(ip).digest("hex").substring(0, 8);
    if (bindings[bindingIndex] !== expectedIPHash) {
      antiSpoofStats.cookieSpoofDetected++;
      return {
        valid: false,
        error: "IP 地址不匹配",
        spoofDetected: true
      };
    }
  }

  return { valid: true, value: originalValue };
}

/**
 * 安全获取客户端 IP（带伪造检测）
 * @param {Object} req - HTTP 请求对象
 * @returns {string} - 客户端 IP
 */
function getClientIPSafe(req) {
  // 直接连接的 IP
  const directIP = req.socket?.remoteAddress || req.connection?.remoteAddress || "unknown";

  // 清理 IPv6 映射的 IPv4
  const cleanDirectIP = directIP.replace(/^::ffff:/, "");

  // 如果有 X-Forwarded-For
  const xff = req.headers["x-forwarded-for"];
  if (xff) {
    const analysis = analyzeForwardedFor(req);

    // 如果检测到可疑特征且启用严格模式，使用直接 IP
    if (analysis.suspicious && ANTI_SPOOF_CONFIG.strictMode) {
      return cleanDirectIP;
    }

    // 获取最外层（第一个）IP
    if (analysis.ips.length > 0) {
      const clientIP = analysis.ips[0];
      const ipAnalysis = analyzeIPType(clientIP);

      // 如果是私有/保留 IP，使用直接 IP
      if (ipAnalysis.isPrivate || ipAnalysis.isReserved) {
        return cleanDirectIP;
      }

      return clientIP;
    }
  }

  // 检查 X-Real-IP
  const realIP = req.headers["x-real-ip"];
  if (realIP) {
    const ipAnalysis = analyzeIPType(realIP);
    if (!ipAnalysis.isPrivate && !ipAnalysis.isReserved) {
      return realIP;
    }
  }

  return cleanDirectIP;
}

/**
 * 追踪 IP 变化（检测会话劫持）
 * @param {string} sessionId - 会话 ID
 * @param {string} ip - 当前 IP
 * @returns {{ suspicious: boolean, reason?: string }}
 */
function trackIPChange(sessionId, ip) {
  const now = Date.now();

  let tracker = ipChangeTracker.get(sessionId);
  if (!tracker) {
    tracker = {
      ips: new Set([ip]),
      timestamps: [{ ip, time: now }],
      suspicious: false
    };
    ipChangeTracker.set(sessionId, tracker);
    return { suspicious: false };
  }

  // 清理过期记录
  const windowStart = now - ANTI_SPOOF_CONFIG.ipSpoof.ipChangeWindow;
  tracker.timestamps = tracker.timestamps.filter(t => t.time >= windowStart);

  // 添加新记录
  if (!tracker.ips.has(ip)) {
    tracker.ips.add(ip);
    tracker.timestamps.push({ ip, time: now });

    // 检查时间窗口内的 IP 变化次数
    const recentChanges = new Set(tracker.timestamps.map(t => t.ip)).size;

    if (recentChanges > ANTI_SPOOF_CONFIG.ipSpoof.ipChangeThreshold) {
      tracker.suspicious = true;
      antiSpoofStats.ipSpoofDetected++;
      return {
        suspicious: true,
        reason: `IP 变化过于频繁（${recentChanges} 次/${ANTI_SPOOF_CONFIG.ipSpoof.ipChangeWindow / 1000}秒）`
      };
    }
  }

  return { suspicious: tracker.suspicious };
}

/**
 * 记录可疑活动
 * @param {string} ip - IP 地址
 * @param {string} reason - 可疑原因
 */
function recordSuspiciousActivity(ip, reason) {
  let record = suspiciousActivityStore.get(ip);
  if (!record) {
    record = { reasons: [], count: 0, lastSeen: 0 };
    suspiciousActivityStore.set(ip, record);
  }

  record.count++;
  record.lastSeen = Date.now();

  // 只保留最近的 5 个原因
  if (!record.reasons.includes(reason)) {
    record.reasons.push(reason);
    if (record.reasons.length > 5) {
      record.reasons.shift();
    }
  }

  antiSpoofStats.suspiciousRequests++;
}

/**
 * 综合防伪造检查
 * @param {Object} req - HTTP 请求对象
 * @returns {{ passed: boolean, ip: string, suspicious: boolean, reasons: string[], fingerprint: string }}
 */
function performAntiSpoofCheck(req) {
  const result = {
    passed: true,
    ip: "",
    suspicious: false,
    reasons: [],
    fingerprint: ""
  };

  // 1. 获取安全的 IP
  result.ip = getClientIPSafe(req);

  // 2. 分析 X-Forwarded-For
  const xffAnalysis = analyzeForwardedFor(req);
  if (xffAnalysis.suspicious) {
    result.suspicious = true;
    result.reasons.push(...xffAnalysis.reasons);
  }

  // 3. 检测可疑请求头
  const headerAnalysis = detectSuspiciousHeaders(req);
  if (headerAnalysis.suspicious) {
    result.suspicious = true;
    result.reasons.push(...headerAnalysis.reasons);
  }

  // 4. 生成请求指纹
  result.fingerprint = generateRequestFingerprint(req);

  // 5. 追踪指纹
  const now = Date.now();
  let fpRecord = fingerprintStore.get(result.fingerprint);
  if (!fpRecord) {
    fpRecord = {
      ip: result.ip,
      userAgent: req.headers["user-agent"] || "",
      firstSeen: now,
      lastSeen: now,
      requestCount: 1,
      ipHistory: new Set([result.ip])
    };
    fingerprintStore.set(result.fingerprint, fpRecord);
    antiSpoofStats.fingerprintsTracked++;
  } else {
    fpRecord.lastSeen = now;
    fpRecord.requestCount++;
    fpRecord.ipHistory.add(result.ip);

    // 检测同一指纹使用多个 IP
    if (fpRecord.ipHistory.size > 5) {
      result.suspicious = true;
      result.reasons.push(`同一浏览器指纹使用了 ${fpRecord.ipHistory.size} 个不同 IP`);
    }
  }

  // 6. 如果检测到可疑活动，记录
  if (result.suspicious) {
    for (const reason of result.reasons) {
      recordSuspiciousActivity(result.ip, reason);
    }

    // 在严格模式下，可疑请求直接拒绝
    if (ANTI_SPOOF_CONFIG.strictMode) {
      result.passed = false;
    }
  }

  return result;
}

/**
 * 定期清理防伪造存储（每5分钟）
 */
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;

  // 清理过期指纹
  for (const [fp, record] of fingerprintStore.entries()) {
    if (now - record.lastSeen > ANTI_SPOOF_CONFIG.fingerprint.ttl) {
      fingerprintStore.delete(fp);
      cleaned++;
    }
  }

  // 限制存储大小
  if (fingerprintStore.size > ANTI_SPOOF_CONFIG.fingerprint.maxEntries) {
    const entries = Array.from(fingerprintStore.entries())
      .sort((a, b) => a[1].lastSeen - b[1].lastSeen);
    const toRemove = entries.slice(0, fingerprintStore.size - ANTI_SPOOF_CONFIG.fingerprint.maxEntries);
    for (const [fp] of toRemove) {
      fingerprintStore.delete(fp);
      cleaned++;
    }
  }

  // 清理 IP 变化追踪
  for (const [sessionId, tracker] of ipChangeTracker.entries()) {
    const windowStart = now - ANTI_SPOOF_CONFIG.ipSpoof.ipChangeWindow;
    if (tracker.timestamps.every(t => t.time < windowStart)) {
      ipChangeTracker.delete(sessionId);
      cleaned++;
    }
  }

  // 清理过期可疑活动记录（24小时）
  for (const [ip, record] of suspiciousActivityStore.entries()) {
    if (now - record.lastSeen > 24 * 60 * 60 * 1000) {
      suspiciousActivityStore.delete(ip);
      cleaned++;
    }
  }
}, 5 * 60 * 1000);

// ==================== IP 伪造 & Cookie 伪造防护系统结束 ====================

// ==================== DDoS 防护系统 ====================

// ===== 配置参数 =====
const SECURITY_CONFIG = {
  // 速率限制配置
  rateLimit: {
    windowMs: 60 * 1000,        // 1分钟时间窗口
    maxRequests: 10,            // 每分钟最大请求次数
  },

  // 突发请求检测（短时间内大量请求）
  burst: {
    windowMs: 5 * 1000,         // 5秒时间窗口
    maxRequests: 5,             // 5秒内最大请求次数
  },

  // IP 封禁配置
  ban: {
    threshold: 3,               // 触发封禁的违规次数
    duration: 30 * 60 * 1000,   // 封禁时长：30分钟
  },

  // 并发控制
  concurrency: {
    maxGlobal: 50,              // 全局最大并发请求数
    maxPerIP: 3,                // 每个IP最大并发请求数
  },

  // 请求超时（防止慢速攻击）
  timeout: {
    request: 30 * 1000,         // 请求处理超时：30秒
  }
};

// ===== 存储结构 =====
// 速率限制存储
const rateLimitStore = new Map();
// 突发请求检测存储
const burstStore = new Map();
// IP 封禁列表 { ip: { bannedUntil: number, violations: number } }
const banList = new Map();
// 当前并发请求计数
let globalConcurrentRequests = 0;
const ipConcurrentRequests = new Map();

// ===== 统计信息 =====
const stats = {
  totalRequests: 0,
  blockedRequests: 0,
  bannedIPs: 0,
  startTime: Date.now()
};

/**
 * 获取客户端 IP 地址
 */
function getClientIP(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIP = req.headers["x-real-ip"];
  if (realIP) {
    return realIP;
  }
  return req.socket?.remoteAddress || req.connection?.remoteAddress || "unknown";
}

/**
 * 检查 IP 是否被封禁
 */
function isIPBanned(ip) {
  const banRecord = banList.get(ip);
  if (!banRecord) return false;

  const now = Date.now();
  if (now >= banRecord.bannedUntil) {
    // 封禁已过期，移除记录
    banList.delete(ip);
    return false;
  }
  return true;
}

/**
 * 封禁 IP
 */
function banIP(ip, reason) {
  const now = Date.now();
  const bannedUntil = now + SECURITY_CONFIG.ban.duration;
  banList.set(ip, { bannedUntil, reason });
  stats.bannedIPs++;
  visitorStats.bannedIPs.add(ip);
}

/**
 * 记录违规行为，达到阈值时封禁
 */
function recordViolation(ip, reason) {
  let record = rateLimitStore.get(ip);
  if (!record) {
    record = { count: 0, resetTime: Date.now() + SECURITY_CONFIG.rateLimit.windowMs, violations: 0 };
    rateLimitStore.set(ip, record);
  }

  record.violations = (record.violations || 0) + 1;

  if (record.violations >= SECURITY_CONFIG.ban.threshold) {
    banIP(ip, reason);
    return true;
  }

  return false;
}

/**
 * 检查突发请求
 */
function checkBurst(ip) {
  const now = Date.now();
  let record = burstStore.get(ip);

  if (!record || now >= record.resetTime) {
    record = {
      count: 1,
      resetTime: now + SECURITY_CONFIG.burst.windowMs
    };
    burstStore.set(ip, record);
    return { allowed: true };
  }

  record.count++;

  if (record.count > SECURITY_CONFIG.burst.maxRequests) {
    return {
      allowed: false,
      reason: `突发请求过多 (${record.count} 次/${SECURITY_CONFIG.burst.windowMs / 1000}秒)`
    };
  }

  return { allowed: true };
}

/**
 * 检查速率限制
 */
function checkRateLimit(ip) {
  const now = Date.now();
  let record = rateLimitStore.get(ip);

  if (!record || now >= record.resetTime) {
    record = {
      count: 1,
      resetTime: now + SECURITY_CONFIG.rateLimit.windowMs,
      violations: record?.violations || 0
    };
    rateLimitStore.set(ip, record);
    return {
      allowed: true,
      remaining: SECURITY_CONFIG.rateLimit.maxRequests - 1,
      resetTime: record.resetTime
    };
  }

  if (record.count >= SECURITY_CONFIG.rateLimit.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
      reason: `超过速率限制 (${SECURITY_CONFIG.rateLimit.maxRequests}次/分钟)`
    };
  }

  record.count++;
  return {
    allowed: true,
    remaining: SECURITY_CONFIG.rateLimit.maxRequests - record.count,
    resetTime: record.resetTime
  };
}

/**
 * 检查并发限制
 */
function checkConcurrency(ip) {
  // 检查全局并发
  if (globalConcurrentRequests >= SECURITY_CONFIG.concurrency.maxGlobal) {
    return {
      allowed: false,
      reason: "服务器繁忙，请稍后再试"
    };
  }

  // 检查单 IP 并发
  const ipConcurrent = ipConcurrentRequests.get(ip) || 0;
  if (ipConcurrent >= SECURITY_CONFIG.concurrency.maxPerIP) {
    return {
      allowed: false,
      reason: `单IP并发请求过多 (最大 ${SECURITY_CONFIG.concurrency.maxPerIP} 个)`
    };
  }

  return { allowed: true };
}

/**
 * 增加并发计数
 */
function incrementConcurrency(ip) {
  globalConcurrentRequests++;
  ipConcurrentRequests.set(ip, (ipConcurrentRequests.get(ip) || 0) + 1);
}

/**
 * 减少并发计数
 */
function decrementConcurrency(ip) {
  globalConcurrentRequests = Math.max(0, globalConcurrentRequests - 1);
  const current = ipConcurrentRequests.get(ip) || 0;
  if (current <= 1) {
    ipConcurrentRequests.delete(ip);
  } else {
    ipConcurrentRequests.set(ip, current - 1);
  }
}

/**
 * 综合安全检查
 * @returns {{ allowed: boolean, statusCode?: number, message?: string, headers?: object }}
 */
function performSecurityCheck(ip) {
  stats.totalRequests++;

  // 1. 检查是否被封禁
  if (isIPBanned(ip)) {
    stats.blockedRequests++;
    const banRecord = banList.get(ip);
    const retryAfter = Math.ceil((banRecord.bannedUntil - Date.now()) / 1000);
    return {
      allowed: false,
      statusCode: 403,
      message: "您的IP已被临时封禁，请稍后再试",
      error: "Forbidden - IP Banned",
      retryAfter
    };
  }

  // 2. 检查并发限制
  const concurrencyCheck = checkConcurrency(ip);
  if (!concurrencyCheck.allowed) {
    stats.blockedRequests++;
    return {
      allowed: false,
      statusCode: 503,
      message: concurrencyCheck.reason,
      error: "Service Unavailable"
    };
  }

  // 3. 检查突发请求
  const burstCheck = checkBurst(ip);
  if (!burstCheck.allowed) {
    stats.blockedRequests++;
    const banned = recordViolation(ip, burstCheck.reason);
    return {
      allowed: false,
      statusCode: 429,
      message: "请求过于频繁，请稍后再试",
      error: "Too Many Requests - Burst Detected",
      banned
    };
  }

  // 4. 检查速率限制
  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    stats.blockedRequests++;
    const banned = recordViolation(ip, rateCheck.reason);
    const retryAfter = Math.ceil((rateCheck.resetTime - Date.now()) / 1000);
    return {
      allowed: false,
      statusCode: 429,
      message: "请求过于频繁，请稍后再试",
      error: "Too Many Requests",
      retryAfter,
      remaining: 0,
      resetTime: rateCheck.resetTime,
      banned
    };
  }

  return {
    allowed: true,
    remaining: rateCheck.remaining,
    resetTime: rateCheck.resetTime
  };
}

/**
 * 定期清理过期记录（每2分钟）
 */
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;

  // 清理速率限制记录
  for (const [ip, record] of rateLimitStore.entries()) {
    if (now >= record.resetTime && !record.violations) {
      rateLimitStore.delete(ip);
      cleaned++;
    }
  }

  // 清理突发检测记录
  for (const [ip, record] of burstStore.entries()) {
    if (now >= record.resetTime) {
      burstStore.delete(ip);
      cleaned++;
    }
  }

  // 清理过期封禁
  for (const [ip, record] of banList.entries()) {
    if (now >= record.bannedUntil) {
      banList.delete(ip);
      cleaned++;
    }
  }
}, 2 * 60 * 1000);

function consumeAiReportStats() {
  const now = Date.now();
  const periodMinutes = Math.floor((now - visitorStats.lastReportTime) / 1000 / 60) || 10;
  const snapshot = {
    windowMinutes: periodMinutes,
    uniqueIPs: visitorStats.uniqueIPs.size,
    totalRequests: visitorStats.totalRequests,
    blockedRequests: visitorStats.blockedRequests,
    suspiciousRequests: visitorStats.suspiciousRequests,
    bannedIPs: Array.from(visitorStats.bannedIPs)
  };

  visitorStats.uniqueIPs.clear();
  visitorStats.totalRequests = 0;
  visitorStats.blockedRequests = 0;
  visitorStats.suspiciousRequests = 0;
  visitorStats.bannedIPs.clear();
  visitorStats.lastReportTime = now;

  return snapshot;
}

function getAiFirewallSnapshot() {
  const now = Date.now();
  const activeBans = [];
  for (const [ip, record] of banList.entries()) {
    if (record && record.bannedUntil && record.bannedUntil > now) {
      activeBans.push({
        ip,
        bannedUntil: record.bannedUntil,
        reason: record.reason || ""
      });
    }
  }

  return {
    bannedIpCount: activeBans.length,
    bannedIps: activeBans.map(item => item.ip),
    totalBannedIps: stats.bannedIPs,
    totalBlockedRequests: stats.blockedRequests,
    antiSpoofStats: {
      ipSpoofDetected: antiSpoofStats.ipSpoofDetected,
      cookieSpoofDetected: antiSpoofStats.cookieSpoofDetected,
      suspiciousRequests: antiSpoofStats.suspiciousRequests,
      fingerprintsTracked: antiSpoofStats.fingerprintsTracked
    }
  };
}

// ==================== DDoS 防护系统结束 ====================

// 读取问题.md知识库文件
function readFAQKnowledge() {
  try {
    const faqPath = path.join(__dirname, "问题.md");
    if (fs.existsSync(faqPath)) {
      return fs.readFileSync(faqPath, "utf8");
    }
    return "知识库文件不存在";
  } catch (error) {
    return "无法读取知识库文件";
  }
}

// 定义AI可用的工具
const AI_TOOLS = [
  {
    type: "function",
    function: {
      name: "read_faq_knowledge",
      description: "读取常见问题解答知识库。当用户询问关于保存失败、上传图片失败、网络问题、使用问题等常见问题时，调用此工具获取解决方案。",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  }
];

// 执行工具调用
function executeToolCall(toolName, toolArgs) {
  if (toolName === "read_faq_knowledge") {
    return readFAQKnowledge();
  }
  return "未知工具";
}

function loadEnvFile() {
  const rootDir = path.resolve(__dirname, "..", "..");
  const envPaths = [
    path.join(rootDir, ".env"),
    path.join(rootDir, "测试.env")
  ];

  envPaths.forEach((envPath) => {
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
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1000000) {
        req.destroy();
        reject(new Error("Body too large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

// 解析聊天响应（支持工具调用）
function parseChatResponseWithTools(data) {
  let parsed;
  try {
    parsed = JSON.parse(data);
  } catch (error) {
    throw new Error("Invalid JSON response");
  }

  const choice = parsed && parsed.choices && parsed.choices[0];
  if (!choice || !choice.message) {
    throw new Error("Empty response");
  }

  const message = choice.message;
  const finishReason = choice.finish_reason;

  // 检查是否有工具调用
  if (finishReason === "tool_calls" && message.tool_calls && message.tool_calls.length > 0) {
    return {
      type: "tool_calls",
      toolCalls: message.tool_calls,
      assistantMessage: message
    };
  }

  // 普通文本响应
  const content = message.content;
  if (!content) {
    throw new Error("Empty response content");
  }

  return {
    type: "content",
    content: content.trim()
  };
}

function parseChatResponse(data) {
  const result = parseChatResponseWithTools(data);
  if (result.type === "content") {
    return result.content;
  }
  throw new Error("Unexpected tool call response");
}

// 发送DeepSeek请求（支持工具调用）
function requestDeepSeekWithTools(messages, tools = null) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  const temperature = Number.parseFloat(process.env.DEEPSEEK_TEMPERATURE || "1.3");
  const endpoint = new URL("/v1/chat/completions", baseUrl);

  const requestBody = {
    model,
    temperature,
    messages
  };

  // 如果提供了工具，添加到请求中
  if (tools && tools.length > 0) {
    requestBody.tools = tools;
    requestBody.tool_choice = "auto";
  }

  const payload = JSON.stringify(requestBody);

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
            resolve(parseChatResponseWithTools(data));
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function requestDeepSeek(messages) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  const temperature = Number.parseFloat(process.env.DEEPSEEK_TEMPERATURE || "1.3");
  const endpoint = new URL("/v1/chat/completions", baseUrl);
  const payload = JSON.stringify({
    model,
    temperature,
    messages
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
          resolve(parseChatResponse(data));
        });
      }
    );

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function requestMimo(messages) {
  const apiKey = process.env.MIMO_API_KEY;
  const baseUrl = process.env.MIMO_BASE_URL || "https://api.xiaomimimo.com";
  const model = process.env.MIMO_MODEL || "mimo-v2-flash";
  const temperature = Number.parseFloat(process.env.MIMO_TEMPERATURE || "0.7");
  const topP = Number.parseFloat(process.env.MIMO_TOP_P || "0.95");
  const maxTokens = Number.parseInt(process.env.MIMO_MAX_TOKENS || "512", 10);
  const thinkingType = process.env.MIMO_THINKING || "disabled";
  const endpoint = new URL("/v1/chat/completions", baseUrl);
  const payload = JSON.stringify({
    model,
    messages,
    max_completion_tokens: maxTokens,
    temperature,
    top_p: topP,
    thinking: { type: thinkingType }
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
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
            reject(new Error("Mimo API error: " + res.statusCode));
            return;
          }
          resolve(parseChatResponse(data));
        });
      }
    );

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function handleAiRequest(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { message: "Method Not Allowed" });
    return;
  }

  // ==================== IP/Cookie 防伪造检查 ====================
  const antiSpoofResult = performAntiSpoofCheck(req);

  // 如果防伪造检查未通过（严格模式下）
  if (!antiSpoofResult.passed) {
    visitorStats.blockedRequests++;
    sendJson(res, 403, {
      message: "请求被安全系统拦截",
      error: "Forbidden - Suspicious Request",
      reasons: antiSpoofResult.reasons
    });
    return;
  }

  // 如果检测到可疑但未拒绝，记录统计
  if (antiSpoofResult.suspicious) {
    visitorStats.suspiciousRequests++;
  }
  // ==================== IP/Cookie 防伪造检查结束 ====================

  // ==================== DDoS 防护检查 ====================
  // 使用防伪造系统获取的安全 IP
  const clientIP = antiSpoofResult.ip;
  
  // 记录访客统计
  visitorStats.uniqueIPs.add(clientIP);
  visitorStats.totalRequests++;
  
  const securityCheck = performSecurityCheck(clientIP);

  // 添加速率限制相关的响应头
  res.setHeader("X-RateLimit-Limit", SECURITY_CONFIG.rateLimit.maxRequests);
  res.setHeader("X-RateLimit-Remaining", securityCheck.remaining || 0);
  res.setHeader("X-Request-Fingerprint", antiSpoofResult.fingerprint);
  if (securityCheck.resetTime) {
    res.setHeader("X-RateLimit-Reset", Math.ceil(securityCheck.resetTime / 1000));
  }

  if (!securityCheck.allowed) {
    // 请求被拒绝
    visitorStats.blockedRequests++;
    if (securityCheck.retryAfter) {
      res.setHeader("Retry-After", securityCheck.retryAfter);
    }
    sendJson(res, securityCheck.statusCode || 429, {
      message: securityCheck.message,
      error: securityCheck.error,
      retryAfter: securityCheck.retryAfter
    });
    return;
  }

  // 增加并发计数
  incrementConcurrency(clientIP);

  // 确保请求结束时减少并发计数
  const cleanup = () => {
    decrementConcurrency(clientIP);
  };

  // 设置请求超时保护
  const timeoutId = setTimeout(() => {
    cleanup();
    if (!res.headersSent) {
      sendJson(res, 504, { message: "请求超时，请稍后再试", error: "Gateway Timeout" });
    }
  }, SECURITY_CONFIG.timeout.request);

  // 监听连接关闭事件（客户端断开）
  res.on("close", () => {
    clearTimeout(timeoutId);
    cleanup();
  });
  // ==================== DDoS 防护检查结束 ====================

  let data = {};
  try {
    const body = await readBody(req);
    data = JSON.parse(body || "{}");
  } catch (error) {
    sendJson(res, 400, { message: "Invalid JSON" });
    return;
  }

  const provider = data.provider === "mimo" || data.provider === "deepseek"
    ? data.provider
    : "deepseek";

  // DeepSeek V3 客服系统提示词（包含工具使用说明）
  const deepseekSystemPrompt = {
    role: "system",
    content: `你是DeepSeek V3模型，你现在是WarmPrompt方框爱心网站的专属客服。

你的性格特点：
- 温柔体贴：用温暖、友善的语气与用户交流
- 耐心细致：认真倾听用户的问题，给予详细的解答
- 积极乐观：用正能量的态度帮助用户解决问题
- 亲切可爱：偶尔使用一些可爱的表情符号让对话更加生动 ✨💕

你的职责：
- 解答用户关于WarmPrompt方框爱心网站的各类问题
- 帮助用户解决使用过程中遇到的困难
- 提供温馨贴心的服务体验
- 如果解决不了去加入QQ群：243838604

重要：当用户询问关于保存失败、上传图片失败、网络问题等常见问题时，请使用 read_faq_knowledge 工具查阅知识库获取准确的解决方案。

请记住：无论用户遇到什么问题，都要温柔耐心地回复他们，让每一位用户都感受到被关怀和重视~`
  };

  // 小爱同学 客服系统提示词
  const mimoSystemPrompt = {
    role: "system",
    content: `你是小爱同学，你现在是WarmPrompt方框爱心网站的专属客服。

你的性格特点：
- 温柔体贴：用温暖、友善的语气与用户交流
- 耐心细致：认真倾听用户的问题，给予详细的解答
- 积极乐观：用正能量的态度帮助用户解决问题
- 亲切可爱：偶尔使用一些可爱的表情符号让对话更加生动 ✨💕

你的职责：
- 解答用户关于WarmPrompt方框爱心网站的各类问题
- 帮助用户解决使用过程中遇到的困难
- 提供温馨贴心的服务体验
- 如果解决不了去加入QQ群：243838604
请记住：无论用户遇到什么问题，都要温柔耐心地回复他们，让每一位用户都感受到被关怀和重视~`
  };

  const userMessages = Array.isArray(data.messages) ? data.messages : [];
  if (!userMessages.length) {
    sendJson(res, 400, { message: "Messages required" });
    return;
  }

  // 根据provider选择对应的系统提示词
  const systemPrompt = provider === "mimo" ? mimoSystemPrompt : deepseekSystemPrompt;
  const messages = [systemPrompt, ...userMessages];

  try {
    if (provider === "deepseek" && !process.env.DEEPSEEK_API_KEY) {
      sendJson(res, 500, { message: "Missing DeepSeek API key" });
      return;
    }
    if (provider === "mimo" && !process.env.MIMO_API_KEY) {
      sendJson(res, 500, { message: "Missing Mimo API key" });
      return;
    }

    // 对于mimo，不使用工具调用
    if (provider === "mimo") {
      const reply = await requestMimo(messages);
      sendJson(res, 200, { message: reply, toolUsed: false });
      return;
    }

    // 对于DeepSeek，使用工具调用
    let toolsUsed = [];
    let currentMessages = [...messages];
    let response = await requestDeepSeekWithTools(currentMessages, AI_TOOLS);

    // 处理工具调用循环（最多3次以防止无限循环）
    let iterations = 0;
    const maxIterations = 3;

    while (response.type === "tool_calls" && iterations < maxIterations) {
      iterations++;

      // 添加assistant的工具调用消息
      currentMessages.push(response.assistantMessage);

      // 执行每个工具调用并添加结果
      for (const toolCall of response.toolCalls) {
        const toolName = toolCall.function.name;
        let toolArgs = {};
        try {
          toolArgs = JSON.parse(toolCall.function.arguments || "{}");
        } catch (e) {
          toolArgs = {};
        }

        // 记录使用的工具
        toolsUsed.push({
          name: toolName,
          id: toolCall.id
        });

        // 执行工具
        const toolResult = executeToolCall(toolName, toolArgs);

        // 添加工具结果到消息
        currentMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolResult
        });
      }

      // 继续请求获取最终回复
      response = await requestDeepSeekWithTools(currentMessages, AI_TOOLS);
    }

    // 获取最终回复
    let reply;
    if (response.type === "content") {
      reply = response.content;
    } else {
      // 如果仍然是工具调用，尝试不带工具再次请求
      const simpleResponse = await requestDeepSeekWithTools(currentMessages, null);
      reply = simpleResponse.type === "content" ? simpleResponse.content : "暂时无法回复，请稍后再试。";
    }

    // 请求成功，清除超时定时器
    clearTimeout(timeoutId);

    sendJson(res, 200, {
      message: reply,
      toolUsed: toolsUsed.length > 0,
      toolsUsed: toolsUsed.map(t => t.name)
    });

  } catch (error) {
    // 请求失败，清除超时定时器
    clearTimeout(timeoutId);
    sendJson(res, 500, { message: "AI service error" });
  }
}

module.exports = {
  // 原有导出
  loadEnvFile,
  handleAiRequest,
  consumeAiReportStats,
  getAiFirewallSnapshot,

  // Cookie 签名系统导出
  signCookie,
  verifyCookie,
  parseCookies,
  createSecureCookie,
  getSignedCookie,
  generateCSRFToken,
  verifyCSRFToken,
  COOKIE_CONFIG,

  // IP 伪造 & Cookie 伪造防护系统导出
  analyzeIPType,
  getIPSubnet,
  analyzeForwardedFor,
  detectSuspiciousHeaders,
  generateRequestFingerprint,
  createBoundCookie,
  verifyBoundCookie,
  getClientIPSafe,
  trackIPChange,
  recordSuspiciousActivity,
  performAntiSpoofCheck,
  ANTI_SPOOF_CONFIG,
  antiSpoofStats,
  visitorStats
};

console.log("AI 启动成功");

