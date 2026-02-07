/**
 * 管理员登录验证 API
 * WarmPrompt v5.0
 * 包含防暴力破解安全系统 + 数据库账号管理
 */

const mysql = require('mysql2/promise');

// ============================================
// 数据库配置和连接
// ============================================

// 数据库配置（从环境变量读取）
const DB_CONFIG = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'warmprompt',
    charset: 'utf8mb4',
    timezone: '+08:00',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// 数据库连接池
let dbPool = null;

/**
 * 获取数据库连接池
 */
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

/**
 * 执行数据库查询
 */
async function dbQuery(sql, params = []) {
    const pool = getDbPool();
    if (!pool) return [];
    try {
        const [rows] = await pool.execute(sql, params);
        return rows;
    } catch (error) {
        throw error;
    }
}

/**
 * 执行数据库插入
 */
async function dbInsert(sql, params = []) {
    const pool = getDbPool();
    if (!pool) return 0;
    try {
        const [result] = await pool.execute(sql, params);
        return result.insertId;
    } catch (error) {
        throw error;
    }
}

/**
 * 执行数据库更新/删除
 */
async function dbUpdate(sql, params = []) {
    const pool = getDbPool();
    if (!pool) return 0;
    try {
        const [result] = await pool.execute(sql, params);
        return result.affectedRows;
    } catch (error) {
        throw error;
    }
}

/**
 * 获取单条记录
 */
async function dbQueryOne(sql, params = []) {
    const rows = await dbQuery(sql, params);
    return rows.length > 0 ? rows[0] : null;
}

// ============================================
// 账号数据库操作
// ============================================

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

function normalizeBenefitNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function getAccountBenefits(type) {
    if (!ACCOUNT_BENEFITS[type]) return null;
    return { ...ACCOUNT_BENEFITS[type] };
}

function mapAccountBenefits(account) {
    const preset = getAccountBenefits(account.type) || {};
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
            : Boolean(account.dedicated_server)
    };
}

const AccountDB = {
    async create(account) {
        const benefits = account.benefits || getAccountBenefits(account.type) || {};
        const sql = `INSERT INTO accounts (account_id, password, type, expire_date, expire_at, created_by, remark, daily_generate_limit, netease_playlist_limit, qq_music_limit, image_upload_limit, video_upload_limit, custom_domain, dedicated_server) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        return await dbInsert(sql, [
            account.accountId,
            account.password,
            account.type,
            account.expireDate,
            account.expireAt || account.expireDate,
            account.createdBy,
            account.remark || null,
            normalizeBenefitNumber(benefits.dailyGenerate),
            normalizeBenefitNumber(benefits.neteasePlaylist),
            normalizeBenefitNumber(benefits.qqMusic),
            normalizeBenefitNumber(benefits.imageUpload),
            normalizeBenefitNumber(benefits.videoUpload),
            benefits.customDomain ? 1 : 0,
            benefits.dedicatedServer ? 1 : 0
        ]);
    },

    async findByAccountId(accountId) {
        return await dbQueryOne(`SELECT * FROM accounts WHERE account_id = ?`, [accountId]);
    },

    async findAll(options = {}) {
        let sql = `SELECT * FROM accounts WHERE 1=1`;
        const params = [];
        if (options.type) { sql += ` AND type = ?`; params.push(options.type); }
        if (options.status) { sql += ` AND status = ?`; params.push(options.status); }
        if (options.createdBy) { sql += ` AND created_by = ?`; params.push(options.createdBy); }
        sql += ` ORDER BY created_at DESC`;
        // LIMIT 和 OFFSET 不能使用占位符，直接拼接（已验证为整数）
        if (options.limit) { sql += ` LIMIT ${parseInt(options.limit) || 100}`; }
        if (options.offset) { sql += ` OFFSET ${parseInt(options.offset) || 0}`; }
        return await dbQuery(sql, params);
    },

    async updateStatus(accountId, status) {
        return await dbUpdate(`UPDATE accounts SET status = ? WHERE account_id = ?`, [status, accountId]);
    },

    async delete(accountId) {
        return await dbUpdate(`DELETE FROM accounts WHERE account_id = ?`, [accountId]);
    },

    async getActiveCounts() {
        try {
            // 统计各类型账号数量（不限制状态）
            const rows = await dbQuery(`SELECT type, COUNT(*) as count FROM accounts GROUP BY type`);
            const counts = { trial: 0, air: 0, pro: 0, standard: 0 };
            rows.forEach(row => { if (counts.hasOwnProperty(row.type)) counts[row.type] = row.count; });
            return counts;
        } catch (error) {
            return { trial: 0, air: 0, pro: 0, standard: 0 };
        }
    }
};

const EXPIRED_ACCOUNT_CLEANUP_INTERVAL_MS = 60 * 1000;
const EXPIRED_ACCOUNT_CLEANUP_DELAY_MS = 10 * 1000;

async function cleanupExpiredAccounts() {
    try {
        const affected = await dbUpdate(
            `DELETE FROM accounts
             WHERE (expire_at IS NOT NULL AND expire_at <= NOW())
                OR (expire_at IS NULL AND expire_date < CURDATE())`
        );
    } catch (error) {
        return;
    }
}

function scheduleExpiredAccountCleanup() {
    setTimeout(() => {
        cleanupExpiredAccounts();
        setInterval(cleanupExpiredAccounts, EXPIRED_ACCOUNT_CLEANUP_INTERVAL_MS);
    }, EXPIRED_ACCOUNT_CLEANUP_DELAY_MS);
}

scheduleExpiredAccountCleanup();

const DAILY_LIMIT_TZ_OFFSET = String(process.env.DAILY_LIMIT_TZ_OFFSET || DB_CONFIG.timezone || "+08:00").trim();
const DAILY_QUOTA_RESET_KEY = "daily_quota_reset_date";
const DAILY_QUOTA_RESET_INTERVAL_MS = 60 * 1000;
const DAILY_QUOTA_RESET_DELAY_MS = 15 * 1000;

let systemFlagsReady = false;
let dailyQuotaResetRunning = false;

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

async function ensureSystemFlagsTable() {
    if (systemFlagsReady) return true;
    const pool = getDbPool();
    if (!pool) return false;
    try {
        await pool.execute(
            `CREATE TABLE IF NOT EXISTS system_flags (
                flag_key VARCHAR(64) NOT NULL,
                flag_value VARCHAR(64) NOT NULL,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (flag_key)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
        );
        systemFlagsReady = true;
        return true;
    } catch (error) {
        return false;
    }
}

async function getSystemFlag(key) {
    const ready = await ensureSystemFlagsTable();
    if (!ready) return "";
    try {
        const row = await dbQueryOne(
            `SELECT flag_value FROM system_flags WHERE flag_key = ?`,
            [key]
        );
        return row ? String(row.flag_value || "") : "";
    } catch (error) {
        return "";
    }
}

async function setSystemFlag(key, value) {
    const ready = await ensureSystemFlagsTable();
    if (!ready) return false;
    try {
        await dbUpdate(
            `INSERT INTO system_flags (flag_key, flag_value)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE flag_value = VALUES(flag_value)`,
            [key, value]
        );
        return true;
    } catch (error) {
        return false;
    }
}

async function resetDailyQuotaLimits() {
    const pool = getDbPool();
    if (!pool) return false;

    const trial = getAccountBenefits("trial") || {};
    const air = getAccountBenefits("air") || {};
    const standard = getAccountBenefits("standard") || {};
    const pro = getAccountBenefits("pro") || {};

    const values = [
        normalizeBenefitNumber(trial.dailyGenerate),
        normalizeBenefitNumber(air.dailyGenerate),
        normalizeBenefitNumber(standard.dailyGenerate),
        normalizeBenefitNumber(pro.dailyGenerate),
        normalizeBenefitNumber(trial.neteasePlaylist),
        normalizeBenefitNumber(air.neteasePlaylist),
        normalizeBenefitNumber(standard.neteasePlaylist),
        normalizeBenefitNumber(pro.neteasePlaylist),
        normalizeBenefitNumber(trial.qqMusic),
        normalizeBenefitNumber(air.qqMusic),
        normalizeBenefitNumber(standard.qqMusic),
        normalizeBenefitNumber(pro.qqMusic),
        normalizeBenefitNumber(trial.imageUpload),
        normalizeBenefitNumber(air.imageUpload),
        normalizeBenefitNumber(standard.imageUpload),
        normalizeBenefitNumber(pro.imageUpload),
        normalizeBenefitNumber(trial.videoUpload),
        normalizeBenefitNumber(air.videoUpload),
        normalizeBenefitNumber(standard.videoUpload),
        normalizeBenefitNumber(pro.videoUpload)
    ];

    try {
        await pool.execute(
            `UPDATE accounts
             SET
                 daily_generate_limit = CASE
                     WHEN daily_generate_limit < 0 THEN daily_generate_limit
                     WHEN type = 'trial' THEN ?
                     WHEN type = 'air' THEN ?
                     WHEN type = 'standard' THEN ?
                     WHEN type = 'pro' THEN ?
                     ELSE daily_generate_limit
                 END,
                 netease_playlist_limit = CASE
                     WHEN netease_playlist_limit < 0 THEN netease_playlist_limit
                     WHEN type = 'trial' THEN ?
                     WHEN type = 'air' THEN ?
                     WHEN type = 'standard' THEN ?
                     WHEN type = 'pro' THEN ?
                     ELSE netease_playlist_limit
                 END,
                 qq_music_limit = CASE
                     WHEN qq_music_limit < 0 THEN qq_music_limit
                     WHEN type = 'trial' THEN ?
                     WHEN type = 'air' THEN ?
                     WHEN type = 'standard' THEN ?
                     WHEN type = 'pro' THEN ?
                     ELSE qq_music_limit
                 END,
                 image_upload_limit = CASE
                     WHEN image_upload_limit < 0 THEN image_upload_limit
                     WHEN type = 'trial' THEN ?
                     WHEN type = 'air' THEN ?
                     WHEN type = 'standard' THEN ?
                     WHEN type = 'pro' THEN ?
                     ELSE image_upload_limit
                 END,
                 video_upload_limit = CASE
                     WHEN video_upload_limit < 0 THEN video_upload_limit
                     WHEN type = 'trial' THEN ?
                     WHEN type = 'air' THEN ?
                     WHEN type = 'standard' THEN ?
                     WHEN type = 'pro' THEN ?
                     ELSE video_upload_limit
                 END
             WHERE type IN ('trial', 'air', 'standard', 'pro')
               AND status = 'active'`,
            values
        );
        return true;
    } catch (error) {
        return false;
    }
}

async function runDailyQuotaReset() {
    if (dailyQuotaResetRunning) return;
    dailyQuotaResetRunning = true;
    try {
        if (!getDbPool()) return;
        const today = getDateKey();
        const lastReset = await getSystemFlag(DAILY_QUOTA_RESET_KEY);
        if (lastReset === today) return;
        const resetOk = await resetDailyQuotaLimits();
        if (!resetOk) return;
        await setSystemFlag(DAILY_QUOTA_RESET_KEY, today);
    } catch (error) {
        return;
    } finally {
        dailyQuotaResetRunning = false;
    }
}

function scheduleDailyQuotaReset() {
    setTimeout(() => {
        void runDailyQuotaReset();
        setInterval(() => {
            void runDailyQuotaReset();
        }, DAILY_QUOTA_RESET_INTERVAL_MS);
    }, DAILY_QUOTA_RESET_DELAY_MS);
}

scheduleDailyQuotaReset();

// 日志操作（简化版，不写入数据库）
const LogDB = {
    async logAccountAction(log) { return 0; },
    async logAdminLogin(log) { return 0; }
};

// ============================================
// 安全配置 - 防暴力破解
// ============================================

// 登录尝试限制配置
const SECURITY_CONFIG = {
    // 单IP最大失败尝试次数
    MAX_FAILED_ATTEMPTS: 5,
    // 锁定时间（毫秒）- 15分钟
    LOCKOUT_DURATION_MS: 15 * 60 * 1000,
    // 登录延迟基数（毫秒）- 失败后逐渐增加延迟
    BASE_DELAY_MS: 1000,
    // 最大延迟时间（毫秒）
    MAX_DELAY_MS: 10000,
    // 清理过期记录的间隔（毫秒）- 每小时清理一次
    CLEANUP_INTERVAL_MS: 60 * 60 * 1000,
    // 全局每分钟最大登录尝试次数（防止分布式攻击）
    GLOBAL_RATE_LIMIT: 20,
    // 全局速率限制时间窗口（毫秒）
    GLOBAL_RATE_WINDOW_MS: 60 * 1000
};

// IP 黑名单（可配置永久封禁的 IP，从环境变量读取，逗号分隔）
const IP_BLACKLIST = new Set(
    (process.env.ADMIN_IP_BLACKLIST || "")
        .split(",")
        .map(ip => ip.trim())
        .filter(ip => ip.length > 0)
);

// IP 白名单（可选，只允许特定 IP 访问，从环境变量读取）
const IP_WHITELIST = new Set(
    (process.env.ADMIN_IP_WHITELIST || "")
        .split(",")
        .map(ip => ip.trim())
        .filter(ip => ip.length > 0)
);

// 登录失败记录存储 { ip: { attempts: number, lastAttempt: timestamp, lockedUntil: timestamp } }
const loginAttempts = new Map();

// 全局登录尝试记录（用于速率限制）
const globalAttempts = [];

// 管理员凭证从环境变量读取 (区分大小写)
const ADMIN_CREDENTIALS = {
    username: process.env.ADMIN_USERNAME || "",
    password: process.env.ADMIN_PASSWORD || "",
    secretKey: process.env.ADMIN_SECRET_KEY || ""
};

const SESSION_IDLE_MS = 5 * 60 * 1000;
const COOKIE_NAME = "admin_session";

// 会话存储 (简单的内存存储)
const sessions = new Map();

// ============================================
// 定期清理过期的登录失败记录
// ============================================
setInterval(() => {
    const now = Date.now();

    // 清理过期的IP锁定记录
    for (const [ip, record] of loginAttempts.entries()) {
        if (record.lockedUntil && now > record.lockedUntil) {
            // 锁定已过期，重置记录
            loginAttempts.delete(ip);
        } else if (now - record.lastAttempt > SECURITY_CONFIG.LOCKOUT_DURATION_MS * 2) {
            // 太久没有尝试，清理记录
            loginAttempts.delete(ip);
        }
    }

    // 清理过期的全局尝试记录
    const cutoff = now - SECURITY_CONFIG.GLOBAL_RATE_WINDOW_MS;
    while (globalAttempts.length > 0 && globalAttempts[0] < cutoff) {
        globalAttempts.shift();
    }
}, SECURITY_CONFIG.CLEANUP_INTERVAL_MS);

// ============================================
// 安全检查函数
// ============================================

/**
 * 检查IP是否在黑名单中
 */
function isIpBlacklisted(ip) {
    return IP_BLACKLIST.has(ip);
}

/**
 * 检查IP是否被允许（如果启用了白名单）
 */
function isIpAllowed(ip) {
    // 如果白名单为空，允许所有IP（只要不在黑名单中）
    if (IP_WHITELIST.size === 0) {
        return !isIpBlacklisted(ip);
    }
    // 如果设置了白名单，只允许白名单中的IP
    return IP_WHITELIST.has(ip) && !isIpBlacklisted(ip);
}

/**
 * 检查IP是否被锁定
 * @returns {{ locked: boolean, remainingTime?: number, attempts?: number }}
 */
function checkIpLockout(ip) {
    const record = loginAttempts.get(ip);
    if (!record) {
        return { locked: false, attempts: 0 };
    }

    const now = Date.now();

    // 检查是否仍被锁定
    if (record.lockedUntil && now < record.lockedUntil) {
        const remainingTime = Math.ceil((record.lockedUntil - now) / 1000);
        return {
            locked: true,
            remainingTime,
            attempts: record.attempts
        };
    }

    // 锁定已过期，重置
    if (record.lockedUntil && now >= record.lockedUntil) {
        loginAttempts.delete(ip);
        return { locked: false, attempts: 0 };
    }

    return {
        locked: false,
        attempts: record.attempts || 0,
        remainingAttempts: SECURITY_CONFIG.MAX_FAILED_ATTEMPTS - (record.attempts || 0)
    };
}

/**
 * 检查全局速率限制
 */
function checkGlobalRateLimit() {
    const now = Date.now();
    const cutoff = now - SECURITY_CONFIG.GLOBAL_RATE_WINDOW_MS;

    // 清理过期记录
    while (globalAttempts.length > 0 && globalAttempts[0] < cutoff) {
        globalAttempts.shift();
    }

    return globalAttempts.length >= SECURITY_CONFIG.GLOBAL_RATE_LIMIT;
}

/**
 * 记录全局登录尝试
 */
function recordGlobalAttempt() {
    globalAttempts.push(Date.now());
}

/**
 * 记录登录失败
 */
function recordFailedAttempt(ip) {
    const now = Date.now();
    let record = loginAttempts.get(ip);

    if (!record) {
        record = { attempts: 0, lastAttempt: now };
        loginAttempts.set(ip, record);
    }

    record.attempts++;
    record.lastAttempt = now;

    // 检查是否需要锁定
    if (record.attempts >= SECURITY_CONFIG.MAX_FAILED_ATTEMPTS) {
        record.lockedUntil = now + SECURITY_CONFIG.LOCKOUT_DURATION_MS;
    }

    return record;
}

/**
 * 记录登录成功，清除失败记录
 */
function recordSuccessfulLogin(ip) {
    loginAttempts.delete(ip);
}

/**
 * 计算登录延迟时间
 */
function calculateDelay(attempts) {
    if (attempts <= 0) return 0;
    // 指数增长延迟：1s, 2s, 4s, 8s...
    const delay = SECURITY_CONFIG.BASE_DELAY_MS * Math.pow(2, attempts - 1);
    return Math.min(delay, SECURITY_CONFIG.MAX_DELAY_MS);
}

/**
 * 格式化剩余时间
 */
function formatRemainingTime(seconds) {
    if (seconds >= 60) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}分${secs}秒`;
    }
    return `${seconds}秒`;
}

/**
 * 添加IP到黑名单（运行时）
 */
function addToBlacklist(ip) {
    IP_BLACKLIST.add(ip);
}

/**
 * 获取安全统计信息
 */
function getSecurityStats() {
    const now = Date.now();
    let lockedCount = 0;
    let activeCount = 0;

    for (const [, record] of loginAttempts.entries()) {
        if (record.lockedUntil && now < record.lockedUntil) {
            lockedCount++;
        } else {
            activeCount++;
        }
    }

    return {
        lockedIPs: lockedCount,
        activeRecords: activeCount,
        blacklistedIPs: IP_BLACKLIST.size,
        whitelistedIPs: IP_WHITELIST.size,
        globalAttemptsInWindow: globalAttempts.length
    };
}

// ============================================
// 原有函数
// ============================================

function parseCookies(cookieHeader = "") {
    return cookieHeader.split(";").reduce((acc, part) => {
        const trimmed = part.trim();
        if (!trimmed) return acc;
        const [key, ...rest] = trimmed.split("=");
        if (!key) return acc;
        acc[key] = decodeURIComponent(rest.join("="));
        return acc;
    }, {});
}

function normalizeIp(ip) {
    if (!ip) return "";
    if (ip.startsWith("::ffff:")) {
        return ip.substring(7);
    }
    return ip;
}

function getRequestIp(req) {
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) {
        const ip = forwarded.split(",")[0].trim();
        return normalizeIp(ip);
    }
    const realIp = req.headers["x-real-ip"];
    if (realIp) {
        return normalizeIp(realIp);
    }
    return normalizeIp(req.socket.remoteAddress || "");
}

function getTokenFromRequest(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        return authHeader.substring(7);
    }
    const cookies = parseCookies(req.headers.cookie || "");
    return cookies[COOKIE_NAME] || "";
}

function isSecureRequest(req) {
    return Boolean(req.socket.encrypted || req.headers["x-forwarded-proto"] === "https");
}

function buildSessionCookie(req, token, maxAgeSeconds) {
    const parts = [
        `${COOKIE_NAME}=${encodeURIComponent(token)}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Strict",
        `Max-Age=${maxAgeSeconds}`
    ];

    if (isSecureRequest(req)) {
        parts.push("Secure");
    }

    return parts.join("; ");
}

function buildClearCookie(req) {
    const parts = [
        `${COOKIE_NAME}=`,
        "Path=/",
        "HttpOnly",
        "SameSite=Strict",
        "Max-Age=0"
    ];

    if (isSecureRequest(req)) {
        parts.push("Secure");
    }

    return parts.join("; ");
}

// 生成随机 Token
function generateToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 64; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}

// 验证登录
function validateLogin(username, password, secretKey) {
    // 严格区分大小写比较
    return username === ADMIN_CREDENTIALS.username &&
        password === ADMIN_CREDENTIALS.password &&
        secretKey === ADMIN_CREDENTIALS.secretKey;
}

// 创建会话
function createSession(username, ip) {
    const token = generateToken();
    const now = Date.now();
    const expiresAt = now + SESSION_IDLE_MS;

    sessions.set(token, {
        username,
        ip,
        createdAt: now,
        lastActivity: now,
        expiresAt
    });

    return { token, expiresAt };
}

// 验证会话
function validateSession(token, ip) {
    const session = sessions.get(token);

    if (!session) {
        return { valid: false, reason: "会话不存在" };
    }

    if (session.ip && ip && session.ip !== ip) {
        return { valid: false, reason: "IP地址不一致" };
    }

    if (Date.now() - session.lastActivity > SESSION_IDLE_MS) {
        sessions.delete(token);
        return { valid: false, reason: "会话已过期" };
    }

    return { valid: true, session };
}

function touchSession(token) {
    const session = sessions.get(token);
    if (!session) {
        return null;
    }
    const now = Date.now();
    session.lastActivity = now;
    session.expiresAt = now + SESSION_IDLE_MS;
    return session;
}

// ============================================
// 请求处理
// ============================================

// 处理管理员请求
function handleAdminRequest(req, res, pathname) {
    // 允许跨域
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
    }

    const ip = getRequestIp(req);

    // ===== DDoS 防护检查 =====

    // 1. 检查临时封禁
    if (isTempBanned(ip)) {
        const bannedUntil = ddosTracking.tempBannedIps.get(ip);
        const remainingMs = bannedUntil - Date.now();
        const remainingMin = Math.ceil(remainingMs / 60000);

        sendJson(res, 403, {
            success: false,
            message: `您的IP因异常行为已被临时封禁，请${remainingMin}分钟后重试`,
            code: "IP_TEMP_BANNED",
            data: { retryAfter: Math.ceil(remainingMs / 1000) }
        });
        return;
    }

    // 2. 检查IP黑名单
    if (isIpBlacklisted(ip)) {
        sendJson(res, 403, {
            success: false,
            message: "访问被拒绝",
            code: "IP_BLOCKED"
        });
        return;
    }

    // 3. 检查全局速率限制
    const globalLimit = checkGlobalLimit();
    if (!globalLimit.allowed) {
        sendJson(res, 503, {
            success: false,
            message: "服务器繁忙，请稍后重试",
            code: "SERVER_OVERLOAD"
        });
        return;
    }

    // 4. 检查突发请求
    const burstLimit = checkBurstLimit(ip);
    if (!burstLimit.allowed) {
        recordViolation(ip, "请求过于频繁（突发）");
        sendJson(res, 429, {
            success: false,
            message: `请求过于频繁，请${burstLimit.window}秒后重试`,
            code: "BURST_LIMIT_EXCEEDED"
        });
        return;
    }

    // 5. 检查IP白名单（仅对登录接口生效）
    if (pathname === "/api/admin/login" && !isIpAllowed(ip)) {
        sendJson(res, 403, {
            success: false,
            message: "您的IP不在允许列表中",
            code: "IP_NOT_ALLOWED"
        });
        return;
    }

    // 6. 登录相关接口使用最严格的 'auth' 速率限制
    if (pathname === "/api/admin/login" || pathname === "/api/admin/verify" || pathname === "/api/admin/logout") {
        const authRateLimit = checkApiRateLimit(ip, 'auth');

        res.setHeader("X-RateLimit-Limit", authRateLimit.limit);
        res.setHeader("X-RateLimit-Remaining", authRateLimit.remaining);
        res.setHeader("X-RateLimit-Reset", authRateLimit.resetIn);

        if (!authRateLimit.allowed) {
            recordViolation(ip, "认证接口请求超限");
            sendJson(res, 429, {
                success: false,
                message: "请求过于频繁，请稍后再试",
                code: "AUTH_RATE_LIMITED",
                data: { retryAfter: authRateLimit.resetIn }
            });
            return;
        }
    }

    // 登录路由
    if (pathname === "/api/admin/login" && req.method === "POST") {
        handleLogin(req, res);
        return;
    }

    // 验证会话路由
    if (pathname === "/api/admin/verify" && req.method === "POST") {
        handleVerify(req, res);
        return;
    }

    // 登出路由
    if (pathname === "/api/admin/logout" && req.method === "POST") {
        handleLogout(req, res);
        return;
    }

    // 安全状态路由（需要认证）
    if (pathname === "/api/admin/security-stats" && req.method === "GET") {
        const token = getTokenFromRequest(req);
        const sessionResult = validateSession(token, ip);

        if (!sessionResult.valid) {
            sendJson(res, 401, { success: false, message: "未授权" });
            return;
        }

        // 返回包含 DDoS 统计的安全信息
        sendJson(res, 200, {
            success: true,
            data: {
                ...getSecurityStats(),
                ddos: getDdosStats()
            }
        });
        return;
    }

    // 未知路由
    sendJson(res, 404, { success: false, message: "未找到该接口" });
}

// 处理登录请求
function handleLogin(req, res) {
    const ip = getRequestIp(req);

    // 检查全局速率限制
    if (checkGlobalRateLimit()) {
        sendJson(res, 429, {
            success: false,
            message: "系统繁忙，请稍后再试",
            code: "RATE_LIMITED"
        });
        return;
    }

    // 检查IP锁定状态
    const lockStatus = checkIpLockout(ip);
    if (lockStatus.locked) {
        sendJson(res, 429, {
            success: false,
            message: `账号已被锁定，请在 ${formatRemainingTime(lockStatus.remainingTime)} 后重试`,
            code: "IP_LOCKED",
            data: {
                lockedUntil: Date.now() + lockStatus.remainingTime * 1000,
                remainingTime: lockStatus.remainingTime
            }
        });
        return;
    }

    // 记录全局尝试
    recordGlobalAttempt();

    let body = "";

    req.on("data", (chunk) => {
        body += chunk.toString();
    });

    req.on("end", () => {
        // 计算延迟时间
        const delay = calculateDelay(lockStatus.attempts);

        // 延迟执行登录验证（防止时间攻击）
        setTimeout(() => {
            try {
                const data = JSON.parse(body);
                const { username, password, secretKey } = data;

                // 验证必填字段
                if (!username || !password || !secretKey) {
                    sendJson(res, 400, {
                        success: false,
                        message: "请填写所有必填字段"
                    });
                    return;
                }

                // 验证凭证
                if (!validateLogin(username, password, secretKey)) {
                    // 记录失败尝试
                    const record = recordFailedAttempt(ip);
                    const remainingAttempts = SECURITY_CONFIG.MAX_FAILED_ATTEMPTS - record.attempts;

                    // 检查是否刚被锁定
                    if (record.lockedUntil) {
                        const remainingTime = Math.ceil((record.lockedUntil - Date.now()) / 1000);
                        sendJson(res, 429, {
                            success: false,
                            message: `登录失败次数过多，账号已被锁定 ${formatRemainingTime(remainingTime)}`,
                            code: "IP_LOCKED",
                            data: {
                                lockedUntil: record.lockedUntil,
                                remainingTime
                            }
                        });
                    } else {
                        sendJson(res, 401, {
                            success: false,
                            message: `账号、密码或密钥错误，剩余尝试次数: ${remainingAttempts}`,
                            code: "INVALID_CREDENTIALS",
                            data: {
                                remainingAttempts,
                                totalAttempts: record.attempts
                            }
                        });
                    }
                    return;
                }

                // 登录成功，清除失败记录
                recordSuccessfulLogin(ip);

                // 创建会话
                const { token, expiresAt } = createSession(username, ip);

                const cookie = buildSessionCookie(req, token, Math.ceil(SESSION_IDLE_MS / 1000));
                sendJson(res, 200, {
                    success: true,
                    message: "登录成功",
                    data: {
                        token,
                        expiresAt,
                        username
                    }
                }, { "Set-Cookie": cookie });

            } catch (error) {
                sendJson(res, 400, {
                    success: false,
                    message: "请求格式错误"
                });
            }
        }, delay);
    });
}

// 处理会话验证
function handleVerify(req, res) {
    const token = getTokenFromRequest(req);
    if (!token) {
        sendJson(res, 401, {
            success: false,
            message: "未提供有效的授权令牌"
        });
        return;
    }

    const ip = getRequestIp(req);
    const result = validateSession(token, ip);

    if (!result.valid) {
        sendJson(res, 401, {
            success: false,
            message: result.reason
        });
        return;
    }

    const session = touchSession(token);
    const cookie = buildSessionCookie(req, token, Math.ceil(SESSION_IDLE_MS / 1000));
    sendJson(res, 200, {
        success: true,
        message: "会话有效",
        data: {
            username: result.session.username,
            expiresAt: session ? session.expiresAt : result.session.expiresAt
        }
    }, { "Set-Cookie": cookie });
}

// 处理登出
function handleLogout(req, res) {
    const token = getTokenFromRequest(req);

    if (token) {
        sessions.delete(token);
    }

    const cookie = buildClearCookie(req);
    sendJson(res, 200, {
        success: true,
        message: "已登出"
    }, { "Set-Cookie": cookie });
}

// 发送 JSON 响应
function sendJson(res, status, payload, headers = {}) {
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        ...headers
    });
    res.end(JSON.stringify(payload));
}

// ============================================
// 全面 DDoS 防护系统
// ============================================

// 多层速率限制配置
const DDOS_CONFIG = {
    // ===== 全局限制 =====
    // 服务器每秒最大请求数（防止服务器过载）
    GLOBAL_MAX_RPS: 100,
    // 全局限制时间窗口（毫秒）
    GLOBAL_WINDOW_MS: 1000,

    // ===== IP 级别限制 =====
    // 普通 API：每个IP每分钟最大请求数
    API_MAX_REQUESTS_PER_MINUTE: 60,
    // 数据库操作 API：每个IP每分钟最大请求数（更严格）
    DB_MAX_REQUESTS_PER_MINUTE: 30,
    // 登录 API：每个IP每分钟最大请求数（最严格）
    AUTH_MAX_REQUESTS_PER_MINUTE: 10,
    // 时间窗口（毫秒）
    WINDOW_MS: 60 * 1000,

    // ===== 突发检测 =====
    // 短时间内（秒）的请求阈值，超过则视为突发攻击
    BURST_WINDOW_SECONDS: 5,
    // 5秒内最大请求数
    BURST_MAX_REQUESTS: 20,

    // ===== 自动封禁 =====
    // 触发自动封禁的违规次数
    AUTO_BAN_THRESHOLD: 5,
    // 自动封禁时间（毫秒）- 30分钟
    AUTO_BAN_DURATION_MS: 30 * 60 * 1000,

    // ===== 请求体限制 =====
    // 最大请求体大小（字节）- 1MB
    MAX_BODY_SIZE: 1 * 1024 * 1024,

    // ===== 并发连接限制 =====
    // 每个IP最大并发连接数
    MAX_CONCURRENT_PER_IP: 10,

    // ===== 清理间隔 =====
    CLEANUP_INTERVAL_MS: 5 * 60 * 1000
};

// 存储结构
const ddosTracking = {
    // 全局请求计数 { timestamp: count }
    globalRequests: [],
    // IP 请求记录 { ip: { count, windowStart, burstTimestamps, violations, bannedUntil } }
    ipRecords: new Map(),
    // IP 并发连接数 { ip: count }
    concurrentConnections: new Map(),
    // 临时封禁列表（补充静态黑名单）
    tempBannedIps: new Map()
};

// 定期清理过期记录
setInterval(() => {
    const now = Date.now();

    // 清理全局请求记录
    ddosTracking.globalRequests = ddosTracking.globalRequests.filter(
        ts => now - ts < DDOS_CONFIG.GLOBAL_WINDOW_MS * 2
    );

    // 清理 IP 记录
    for (const [ip, record] of ddosTracking.ipRecords.entries()) {
        // 清理过期的 IP 记录
        if (now - record.windowStart > DDOS_CONFIG.WINDOW_MS * 2) {
            ddosTracking.ipRecords.delete(ip);
            continue;
        }
        // 清理过期的突发时间戳
        if (record.burstTimestamps) {
            record.burstTimestamps = record.burstTimestamps.filter(
                ts => now - ts < DDOS_CONFIG.BURST_WINDOW_SECONDS * 1000
            );
        }
    }

    // 清理过期的临时封禁
    for (const [ip, bannedUntil] of ddosTracking.tempBannedIps.entries()) {
        if (now > bannedUntil) {
            ddosTracking.tempBannedIps.delete(ip);
        }
    }

    // 清理并发连接记录（值为0的）
    for (const [ip, count] of ddosTracking.concurrentConnections.entries()) {
        if (count <= 0) {
            ddosTracking.concurrentConnections.delete(ip);
        }
    }
}, DDOS_CONFIG.CLEANUP_INTERVAL_MS);

/**
 * 检查 IP 是否被临时封禁
 */
function isTempBanned(ip) {
    const bannedUntil = ddosTracking.tempBannedIps.get(ip);
    if (!bannedUntil) return false;
    if (Date.now() > bannedUntil) {
        ddosTracking.tempBannedIps.delete(ip);
        return false;
    }
    return true;
}

/**
 * 临时封禁 IP
 */
function tempBanIp(ip, reason) {
    const bannedUntil = Date.now() + DDOS_CONFIG.AUTO_BAN_DURATION_MS;
    ddosTracking.tempBannedIps.set(ip, bannedUntil);
}

/**
 * 记录违规并检查是否需要自动封禁
 */
function recordViolation(ip, reason) {
    let record = ddosTracking.ipRecords.get(ip);
    if (!record) {
        record = { count: 0, windowStart: Date.now(), burstTimestamps: [], violations: 0 };
        ddosTracking.ipRecords.set(ip, record);
    }

    record.violations = (record.violations || 0) + 1;

    // 检查是否需要自动封禁
    if (record.violations >= DDOS_CONFIG.AUTO_BAN_THRESHOLD) {
        tempBanIp(ip, `累计${record.violations}次违规`);
        record.violations = 0; // 重置违规计数
    }
}

/**
 * 检查全局速率限制（防止服务器过载）
 */
function checkGlobalLimit() {
    const now = Date.now();
    const windowStart = now - DDOS_CONFIG.GLOBAL_WINDOW_MS;

    // 清理过期记录
    ddosTracking.globalRequests = ddosTracking.globalRequests.filter(ts => ts > windowStart);

    // 添加当前请求
    ddosTracking.globalRequests.push(now);

    const currentRPS = ddosTracking.globalRequests.length;
    return {
        allowed: currentRPS <= DDOS_CONFIG.GLOBAL_MAX_RPS,
        currentRPS,
        maxRPS: DDOS_CONFIG.GLOBAL_MAX_RPS
    };
}

/**
 * 检查突发请求（短时间内大量请求）
 */
function checkBurstLimit(ip) {
    const now = Date.now();
    let record = ddosTracking.ipRecords.get(ip);

    if (!record) {
        record = { count: 0, windowStart: now, burstTimestamps: [], violations: 0 };
        ddosTracking.ipRecords.set(ip, record);
    }

    if (!record.burstTimestamps) {
        record.burstTimestamps = [];
    }

    // 清理过期的突发时间戳
    const burstWindow = now - DDOS_CONFIG.BURST_WINDOW_SECONDS * 1000;
    record.burstTimestamps = record.burstTimestamps.filter(ts => ts > burstWindow);

    // 添加当前请求时间戳
    record.burstTimestamps.push(now);

    const burstCount = record.burstTimestamps.length;
    return {
        allowed: burstCount <= DDOS_CONFIG.BURST_MAX_REQUESTS,
        burstCount,
        maxBurst: DDOS_CONFIG.BURST_MAX_REQUESTS,
        window: DDOS_CONFIG.BURST_WINDOW_SECONDS
    };
}

/**
 * 检查并发连接数
 */
function checkConcurrentLimit(ip) {
    const current = ddosTracking.concurrentConnections.get(ip) || 0;
    return {
        allowed: current < DDOS_CONFIG.MAX_CONCURRENT_PER_IP,
        current,
        max: DDOS_CONFIG.MAX_CONCURRENT_PER_IP
    };
}

/**
 * 增加并发连接计数
 */
function incrementConcurrent(ip) {
    const current = ddosTracking.concurrentConnections.get(ip) || 0;
    ddosTracking.concurrentConnections.set(ip, current + 1);
}

/**
 * 减少并发连接计数
 */
function decrementConcurrent(ip) {
    const current = ddosTracking.concurrentConnections.get(ip) || 0;
    ddosTracking.concurrentConnections.set(ip, Math.max(0, current - 1));
}

/**
 * 检查 API 速率限制（分类型）
 * @param {string} ip - 请求IP
 * @param {string} type - 请求类型: 'api', 'db', 'auth'
 * @returns {{ allowed: boolean, remaining: number, resetIn: number }}
 */
function checkApiRateLimit(ip, type = 'api') {
    const now = Date.now();
    let record = ddosTracking.ipRecords.get(ip);

    // 如果没有记录或窗口已过期，创建新记录
    if (!record || now - record.windowStart > DDOS_CONFIG.WINDOW_MS) {
        record = {
            count: 0,
            dbCount: 0,
            authCount: 0,
            windowStart: now,
            burstTimestamps: record?.burstTimestamps || [],
            violations: record?.violations || 0
        };
        ddosTracking.ipRecords.set(ip, record);
    }

    // 根据类型增加计数和获取限制
    let maxRequests;
    let currentCount;

    switch (type) {
        case 'db':
            record.dbCount = (record.dbCount || 0) + 1;
            currentCount = record.dbCount;
            maxRequests = DDOS_CONFIG.DB_MAX_REQUESTS_PER_MINUTE;
            break;
        case 'auth':
            record.authCount = (record.authCount || 0) + 1;
            currentCount = record.authCount;
            maxRequests = DDOS_CONFIG.AUTH_MAX_REQUESTS_PER_MINUTE;
            break;
        default:
            record.count++;
            currentCount = record.count;
            maxRequests = DDOS_CONFIG.API_MAX_REQUESTS_PER_MINUTE;
    }

    const remaining = Math.max(0, maxRequests - currentCount);
    const resetIn = Math.max(0, DDOS_CONFIG.WINDOW_MS - (now - record.windowStart));

    return {
        allowed: currentCount <= maxRequests,
        remaining,
        resetIn: Math.ceil(resetIn / 1000),
        total: currentCount,
        type,
        limit: maxRequests
    };
}

/**
 * 全面的 DDoS 防护检查（用于所有请求）
 * @param {object} req - 请求对象
 * @param {object} res - 响应对象
 * @param {string} apiType - API 类型: 'api', 'db', 'auth'
 * @returns {{ passed: boolean, reason?: string }}
 */
function ddosProtection(req, res, apiType = 'api') {
    const ip = getRequestIp(req);

    // 1. 检查静态黑名单
    if (isIpBlacklisted(ip)) {
        sendJson(res, 403, {
            success: false,
            message: "访问被拒绝",
            code: "IP_BLOCKED"
        });
        return { passed: false, reason: "IP在黑名单中" };
    }

    // 2. 检查临时封禁
    if (isTempBanned(ip)) {
        const bannedUntil = ddosTracking.tempBannedIps.get(ip);
        const remainingMs = bannedUntil - Date.now();
        const remainingMin = Math.ceil(remainingMs / 60000);

        sendJson(res, 403, {
            success: false,
            message: `您的IP因异常行为已被临时封禁，请${remainingMin}分钟后重试`,
            code: "IP_TEMP_BANNED",
            data: { retryAfter: Math.ceil(remainingMs / 1000) }
        });
        return { passed: false, reason: "IP被临时封禁" };
    }

    // 3. 检查全局速率限制（防止服务器过载）
    const globalLimit = checkGlobalLimit();
    if (!globalLimit.allowed) {
        sendJson(res, 503, {
            success: false,
            message: "服务器繁忙，请稍后重试",
            code: "SERVER_OVERLOAD"
        });
        return { passed: false, reason: "服务器过载" };
    }

    // 4. 检查并发连接限制
    const concurrentLimit = checkConcurrentLimit(ip);
    if (!concurrentLimit.allowed) {
        recordViolation(ip, "并发连接过多");
        sendJson(res, 429, {
            success: false,
            message: "并发连接过多，请稍后重试",
            code: "TOO_MANY_CONNECTIONS",
            data: { current: concurrentLimit.current, max: concurrentLimit.max }
        });
        return { passed: false, reason: "并发连接过多" };
    }

    // 5. 检查突发请求
    const burstLimit = checkBurstLimit(ip);
    if (!burstLimit.allowed) {
        recordViolation(ip, "请求过于频繁（突发）");
        sendJson(res, 429, {
            success: false,
            message: `请求过于频繁，请${burstLimit.window}秒后重试`,
            code: "BURST_LIMIT_EXCEEDED",
            data: {
                current: burstLimit.burstCount,
                max: burstLimit.maxBurst,
                window: burstLimit.window
            }
        });
        return { passed: false, reason: "突发请求过多" };
    }

    // 6. 检查 API 速率限制（按类型）
    const rateLimit = checkApiRateLimit(ip, apiType);

    // 设置速率限制响应头
    res.setHeader("X-RateLimit-Limit", rateLimit.limit);
    res.setHeader("X-RateLimit-Remaining", rateLimit.remaining);
    res.setHeader("X-RateLimit-Reset", rateLimit.resetIn);
    res.setHeader("X-RateLimit-Type", apiType);

    if (!rateLimit.allowed) {
        recordViolation(ip, `${apiType}类型请求超限`);
        sendJson(res, 429, {
            success: false,
            message: "请求过于频繁，请稍后再试",
            code: "RATE_LIMITED",
            data: {
                retryAfter: rateLimit.resetIn,
                type: apiType,
                limit: rateLimit.limit
            }
        });
        return { passed: false, reason: "速率限制" };
    }

    // 7. 增加并发计数（请求结束时需要减少）
    incrementConcurrent(ip);

    // 在响应结束时减少并发计数
    res.on('finish', () => decrementConcurrent(ip));
    res.on('close', () => decrementConcurrent(ip));

    return { passed: true };
}

/**
 * 检查请求体大小
 * @param {object} req - 请求对象
 * @returns {boolean} - 是否在限制范围内
 */
function checkBodySize(req) {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    return contentLength <= DDOS_CONFIG.MAX_BODY_SIZE;
}

/**
 * 获取 DDoS 防护统计信息
 */
function getDdosStats() {
    return {
        globalRequestsInWindow: ddosTracking.globalRequests.length,
        trackedIPs: ddosTracking.ipRecords.size,
        tempBannedIPs: ddosTracking.tempBannedIps.size,
        activeConnections: Array.from(ddosTracking.concurrentConnections.values()).reduce((a, b) => a + b, 0),
        config: {
            globalMaxRPS: DDOS_CONFIG.GLOBAL_MAX_RPS,
            apiMaxPerMinute: DDOS_CONFIG.API_MAX_REQUESTS_PER_MINUTE,
            dbMaxPerMinute: DDOS_CONFIG.DB_MAX_REQUESTS_PER_MINUTE,
            authMaxPerMinute: DDOS_CONFIG.AUTH_MAX_REQUESTS_PER_MINUTE,
            burstMax: DDOS_CONFIG.BURST_MAX_REQUESTS,
            maxConcurrentPerIP: DDOS_CONFIG.MAX_CONCURRENT_PER_IP
        }
    };
}

// 兼容旧代码 - 保留原有变量名
const API_RATE_CONFIG = DDOS_CONFIG;
const apiRequestCounts = ddosTracking.ipRecords;

/**
 * 验证请求身份（用于受保护的 API）
 * @param {object} req - 请求对象
 * @returns {{ valid: boolean, session?: object, reason?: string }}
 */
function authenticateRequest(req) {
    const token = getTokenFromRequest(req);
    if (!token) {
        return { valid: false, reason: "未提供授权令牌" };
    }

    const ip = getRequestIp(req);
    return validateSession(token, ip);
}

/**
 * 受保护 API 中间件 - 全面 DDoS 防护 + 验证登录状态
 * @param {object} req - 请求对象
 * @param {object} res - 响应对象
 * @param {function} next - 下一步处理函数
 * @param {string} apiType - API 类型: 'api', 'db', 'auth'
 */
function protectedApiMiddleware(req, res, next, apiType = 'db') {
    // 1. 检查请求体大小
    if (!checkBodySize(req)) {
        const ip = getRequestIp(req);
        recordViolation(ip, "请求体过大");
        sendJson(res, 413, {
            success: false,
            message: "请求体过大",
            code: "PAYLOAD_TOO_LARGE",
            data: { maxSize: DDOS_CONFIG.MAX_BODY_SIZE }
        });
        return;
    }

    // 2. 全面 DDoS 防护检查
    const ddosCheck = ddosProtection(req, res, apiType);
    if (!ddosCheck.passed) {
        return; // ddosProtection 已发送响应
    }

    // 3. 验证登录状态
    const auth = authenticateRequest(req);
    if (!auth.valid) {
        sendJson(res, 401, {
            success: false,
            message: auth.reason || "未授权访问",
            code: "UNAUTHORIZED"
        });
        return;
    }

    // 4. 刷新会话
    const token = getTokenFromRequest(req);
    touchSession(token);

    // 验证通过，执行下一步
    next(auth.session);
}

/**
 * 处理受保护的管理 API 请求
 */
function handleProtectedAdminApi(req, res, pathname) {
    // 设置 CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return true;
    }

    // 检查是否是受保护的 API 路径
    const protectedPaths = [
        "/api/admin/accounts",
        "/api/admin/accounts/generate",
        "/api/admin/accounts/list",
        "/api/admin/accounts/history",
        "/api/admin/accounts/delete",
        "/api/admin/accounts/stats"
    ];

    const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
    if (!isProtectedPath) {
        return false; // 不是受保护路径，交给其他处理器
    }

    // 根据路径确定 API 类型（用于不同的速率限制）
    // 写入操作（generate, delete）使用更严格的 'db' 限制
    // 读取操作（list, history, stats）使用普通的 'api' 限制
    const isWriteOperation = pathname.includes('/generate') || pathname.includes('/delete');
    const apiType = isWriteOperation ? 'db' : 'api';

    // 使用保护中间件，传入 API 类型
    protectedApiMiddleware(req, res, (session) => {
        // 生成账号
        if (pathname === "/api/admin/accounts/generate" && req.method === "POST") {
            handleGenerateAccount(req, res, session);
            return;
        }

        // 获取账号列表
        if (pathname === "/api/admin/accounts/list" && req.method === "GET") {
            handleGetAccountList(req, res, session);
            return;
        }

        // 获取账号历史（兼容旧接口）
        if (pathname === "/api/admin/accounts/history" && req.method === "GET") {
            handleGetAccountHistory(req, res, session);
            return;
        }

        // 删除账号
        if (pathname === "/api/admin/accounts/delete" && req.method === "POST") {
            handleDeleteAccount(req, res, session);
            return;
        }

        // 获取账号统计
        if (pathname === "/api/admin/accounts/stats" && req.method === "GET") {
            handleGetAccountStats(req, res, session);
            return;
        }

        // 未知的受保护路由
        sendJson(res, 404, { success: false, message: "未找到该接口" });
    }, apiType);

    return true;
}

// ============================================
// 受保护的账号管理 API（使用数据库）
// ============================================

/**
 * 处理生成账号请求
 */
async function handleGenerateAccount(req, res, session) {
    let body = "";

    req.on("data", (chunk) => {
        body += chunk.toString();
    });

    req.on("end", async () => {
        try {
            const data = JSON.parse(body);
            const { type, remark } = data;

            if (!type || !["trial", "air", "pro", "standard"].includes(type)) {
                sendJson(res, 400, {
                    success: false,
                    message: "无效的账号类型"
                });
                return;
            }

            const benefits = getAccountBenefits(type);
            if (!benefits) {
                sendJson(res, 400, {
                    success: false,
                    message: "账号权益配置缺失"
                });
                return;
            }

            // 生成账号逻辑
            const prefix = { trial: "TRY", air: "AIR", pro: "PRO", standard: "STD" };
            const timestamp = Date.now().toString(36).toUpperCase();
            const random = Math.random().toString(36).substring(2, 8).toUpperCase();
            const accountId = `${prefix[type]}-${timestamp}-${random}`;

            const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
            let password = "";
            for (let i = 0; i < 12; i++) {
                password += chars.charAt(Math.floor(Math.random() * chars.length));
            }

            // 计算过期日期
            const expireDate = new Date();
            if (type === "trial") {
                expireDate.setDate(expireDate.getDate() + 7);
            } else {
                expireDate.setDate(expireDate.getDate() + 30);
            }

            // 格式化日期为 YYYY-MM-DD
            const expireDateStr = expireDate.toISOString().split('T')[0];

            // 保存到数据库
            try {
                const insertId = await AccountDB.create({
                    accountId,
                    password,
                    type,
                    expireDate: expireDateStr,
                    expireAt: expireDate,
                    createdBy: session.username,
                    remark: remark || null,
                    benefits
                });

                // 记录操作日志
                await LogDB.logAccountAction({
                    accountId,
                    action: 'create',
                    operator: session.username,
                    ipAddress: null,
                    details: { type, expireDate: expireDateStr }
                });

            } catch (dbError) {
                // 数据库保存失败，账号仍然生成
            }

            sendJson(res, 200, {
                success: true,
                message: "账号生成成功",
                data: {
                    accountId,
                    password,
                    type,
                    expireDate: expireDate.toLocaleDateString("zh-CN"),
                    createdBy: session.username,
                    createdAt: new Date().toISOString(),
                    benefits
                }
            });

        } catch (error) {
            sendJson(res, 400, {
                success: false,
                message: "请求格式错误"
            });
        }
    });
}

/**
 * 处理获取账号列表请求
 */
async function handleGetAccountList(req, res, session) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const type = url.searchParams.get('type');
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit')) || 100;
    const offset = parseInt(url.searchParams.get('offset')) || 0;

    try {
        const options = { limit, offset };
        if (type) options.type = type;
        if (status) options.status = status;

        const accounts = await AccountDB.findAll(options);

        const formattedAccounts = accounts.map(account => ({
            id: account.id,
            accountId: account.account_id,
            password: account.password,
            type: account.type,
            status: account.status,
            expireDate: account.expire_date,
            createdBy: account.created_by,
            createdAt: account.created_at,
            lastUsedAt: account.last_used_at,
            usageCount: account.usage_count,
            remark: account.remark,
            benefits: mapAccountBenefits(account)
        }));

        sendJson(res, 200, {
            success: true,
            message: "获取成功",
            data: { accounts: formattedAccounts, total: formattedAccounts.length, limit, offset }
        });

    } catch (error) {
        sendJson(res, 500, { success: false, message: "获取账号列表失败" });
    }
}

/**
 * 处理获取账号历史请求（按类型）
 */
async function handleGetAccountHistory(req, res, session) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const type = url.searchParams.get('type');

    try {
        const options = { limit: 100 };
        if (type) options.type = type;

        const accounts = await AccountDB.findAll(options);

        const formattedAccounts = accounts.map(account => ({
            accountId: account.account_id,
            password: account.password,
            type: account.type,
            status: account.status,
            expireDate: new Date(account.expire_date).toLocaleDateString("zh-CN"),
            createdAt: account.created_at,
            benefits: mapAccountBenefits(account)
        }));

        sendJson(res, 200, {
            success: true,
            message: "获取成功",
            data: { accounts: formattedAccounts, total: formattedAccounts.length }
        });

    } catch (error) {
        sendJson(res, 200, {
            success: true,
            message: "获取成功",
            data: { accounts: [], note: "数据库查询失败" }
        });
    }
}

/**
 * 处理删除账号请求
 */
async function handleDeleteAccount(req, res, session) {
    let body = "";

    req.on("data", (chunk) => {
        body += chunk.toString();
    });

    req.on("end", async () => {
        try {
            const data = JSON.parse(body);
            const { accountId } = data;

            if (!accountId) {
                sendJson(res, 400, { success: false, message: "缺少账号ID" });
                return;
            }

            try {
                const account = await AccountDB.findByAccountId(accountId);
                if (!account) {
                    sendJson(res, 404, { success: false, message: "账号不存在" });
                    return;
                }

                const affected = await AccountDB.delete(accountId);

                if (affected > 0) {
                    await LogDB.logAccountAction({
                        accountId,
                        action: 'delete',
                        operator: session.username,
                        details: { type: account.type, deletedAt: new Date().toISOString() }
                    });

                    sendJson(res, 200, { success: true, message: "账号已删除" });
                } else {
                    sendJson(res, 500, { success: false, message: "删除失败" });
                }

            } catch (dbError) {
                sendJson(res, 500, { success: false, message: "删除账号失败" });
            }

        } catch (error) {
            sendJson(res, 400, { success: false, message: "请求格式错误" });
        }
    });
}

/**
 * 处理获取账号统计请求
 */
async function handleGetAccountStats(req, res, session) {
    try {
        const activeCounts = await AccountDB.getActiveCounts();

        sendJson(res, 200, {
            success: true,
            message: "获取成功",
            data: { activeCounts }
        });

    } catch (error) {
        sendJson(res, 200, {
            success: true,
            message: "获取成功",
            data: { activeCounts: { trial: 0, air: 0, pro: 0, standard: 0 } }
        });
    }
}

// ============================================
// 导出模块
// ============================================

module.exports = {
    // 主要请求处理器
    handleAdminRequest,
    handleProtectedAdminApi,

    // 认证相关
    validateSession,
    authenticateRequest,
    protectedApiMiddleware,
    getTokenFromRequest,

    // DDoS 防护
    ddosProtection,
    checkApiRateLimit,
    checkBodySize,
    isTempBanned,
    tempBanIp,
    getDdosStats,
    DDOS_CONFIG,

    // IP 管理
    getRequestIp,
    addToBlacklist,
    isIpBlacklisted,

    // 安全统计
    getSecurityStats,

    // 数据库操作
    AccountDB,
    LogDB
};

// 启动时显示管理模式状态
console.log("Admin 启动成功");
