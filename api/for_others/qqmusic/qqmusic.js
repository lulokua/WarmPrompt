/**
 * QQ Music API - QQ音乐搜索与解析服务
 * 提供 QQ 音乐的搜索、解析接口
 * 包含防 CC 攻击的 IP 限流功能
 */

const https = require('https');
const http = require('http');
const mysql = require('mysql2/promise');
const { verifyQqMusicCookie } = require('./qqmusic-auth');

// ============================================
// 配置
// ============================================

// 从环境变量获取配置，或使用默认值
const QQ_MUSIC_API = process.env.QQ_MUSIC_API || 'https://www.52api.cn/api/qq_music';
const QQ_MUSIC_KEY = process.env.QQ_MUSIC_KEY || 'Huyg3QQjDnWLGepR7UtMjiyFoF';
const QQ_MUSIC_COOKIE = process.env.QQ_MUSIC_COOKIE || '';

// 启动时打印配置状态
console.log("QQ音乐 启动成功");

// QQ 音乐官方 API 地址
const QQ_MUSIC_SEARCH_URL = 'https://u.y.qq.com/cgi-bin/musicu.fcg';
const QQ_MUSIC_VKEY_URL = 'https://u.y.qq.com/cgi-bin/musicu.fcg';

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

async function decrementQqMusicLimit(accountId) {
    if (!accountId) return false;
    const pool = getDbPool();
    if (!pool) return false;
    try {
        await pool.execute(
            `UPDATE accounts
             SET qq_music_limit = CASE
                 WHEN qq_music_limit < 0 THEN qq_music_limit
                 WHEN qq_music_limit > 0 THEN qq_music_limit - 1
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

// ============================================
// IP 限流与黑名单系统 - 防 CC 攻击
// ============================================

const RATE_LIMIT_WINDOW = 60 * 1000;      // 限流窗口：1分钟
const RATE_LIMIT_MAX_REQUESTS = 15;        // 最大请求数：15次/分钟
const BLACKLIST_DURATION = 10 * 60 * 1000; // 黑名单时长：10分钟

// 存储 IP 请求记录 { ip: { count: number, firstRequest: timestamp } }
const ipRequestMap = new Map();

// 存储被拉黑的 IP { ip: unblockTimestamp }
const ipBlacklist = new Map();

// 账号限流配置（额外保护 QQ 音乐搜索接口）
const ACCOUNT_RATE_LIMIT_WINDOW = 60 * 1000;      // 限流窗口：1分钟
const ACCOUNT_RATE_LIMIT_MAX_REQUESTS = 10;        // 最大请求数：10次/分钟
const ACCOUNT_BLACKLIST_DURATION = 5 * 60 * 1000;  // 黑名单时长：5分钟

// 存储账号请求记录 { accountId: { count: number, firstRequest: timestamp } }
const accountRequestMap = new Map();

// 存储被拉黑的账号 { accountId: unblockTimestamp }
const accountBlacklist = new Map();

const qqMusicWindowStats = {
    windowStart: Date.now(),
    totalRequests: 0,
    uniqueIPs: new Set(),
    uniqueAccounts: new Set(),
    usageUniqueIPs: new Set(),
    usageUniqueAccounts: new Set(),
    routeCounts: new Map(),
    rateLimitedRoutes: new Map(),
    rateLimitedIPs: new Set(),
    rateLimitedAccounts: new Set()
};

/**
 * 获取客户端真实 IP
 */
function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.headers['x-real-ip']
        || req.connection?.remoteAddress
        || req.socket?.remoteAddress
        || 'unknown';
}

function normalizeAccountId(accountId) {
    return String(accountId || '').trim().toUpperCase();
}

function incrementCount(map, key) {
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
}

function recordQqMusicRequest(req, route, auth, isUsageRoute) {
    qqMusicWindowStats.totalRequests += 1;
    incrementCount(qqMusicWindowStats.routeCounts, route);

    const clientIP = getClientIP(req);
    if (clientIP) {
        qqMusicWindowStats.uniqueIPs.add(clientIP);
        if (isUsageRoute) {
            qqMusicWindowStats.usageUniqueIPs.add(clientIP);
        }
    }

    const accountId = auth && auth.accountId ? normalizeAccountId(auth.accountId) : "";
    if (accountId) {
        qqMusicWindowStats.uniqueAccounts.add(accountId);
        if (isUsageRoute) {
            qqMusicWindowStats.usageUniqueAccounts.add(accountId);
        }
    }
}

function recordQqMusicRateLimit(route, req, auth) {
    incrementCount(qqMusicWindowStats.rateLimitedRoutes, route);

    const clientIP = getClientIP(req);
    if (clientIP) {
        qqMusicWindowStats.rateLimitedIPs.add(clientIP);
    }

    const accountId = auth && auth.accountId ? normalizeAccountId(auth.accountId) : "";
    if (accountId) {
        qqMusicWindowStats.rateLimitedAccounts.add(accountId);
    }
}

function consumeQqMusicReportStats() {
    const now = Date.now();
    const windowMinutes = Math.floor((now - qqMusicWindowStats.windowStart) / 1000 / 60) || 10;
    const snapshot = {
        windowMinutes,
        totalRequests: qqMusicWindowStats.totalRequests,
        uniqueIPs: qqMusicWindowStats.uniqueIPs.size,
        uniqueAccounts: qqMusicWindowStats.uniqueAccounts.size,
        usageUniqueIPs: qqMusicWindowStats.usageUniqueIPs.size,
        usageUniqueAccounts: qqMusicWindowStats.usageUniqueAccounts.size,
        routeCounts: Object.fromEntries(qqMusicWindowStats.routeCounts),
        rateLimitedRoutes: Object.fromEntries(qqMusicWindowStats.rateLimitedRoutes),
        rateLimitedIPs: Array.from(qqMusicWindowStats.rateLimitedIPs),
        rateLimitedAccounts: Array.from(qqMusicWindowStats.rateLimitedAccounts)
    };

    qqMusicWindowStats.windowStart = now;
    qqMusicWindowStats.totalRequests = 0;
    qqMusicWindowStats.uniqueIPs.clear();
    qqMusicWindowStats.uniqueAccounts.clear();
    qqMusicWindowStats.usageUniqueIPs.clear();
    qqMusicWindowStats.usageUniqueAccounts.clear();
    qqMusicWindowStats.routeCounts.clear();
    qqMusicWindowStats.rateLimitedRoutes.clear();
    qqMusicWindowStats.rateLimitedIPs.clear();
    qqMusicWindowStats.rateLimitedAccounts.clear();

    return snapshot;
}

function getQqMusicFirewallSnapshot() {
    const now = Date.now();
    const activeIpBlacklist = [];
    for (const [ip, unblockTime] of ipBlacklist.entries()) {
        if (unblockTime > now) {
            activeIpBlacklist.push(ip);
        }
    }
    const activeAccountBlacklist = [];
    for (const [accountId, unblockTime] of accountBlacklist.entries()) {
        if (unblockTime > now) {
            activeAccountBlacklist.push(accountId);
        }
    }

    return {
        ipBlacklist: activeIpBlacklist,
        accountBlacklist: activeAccountBlacklist
    };
}

/**
 * 清理过期的 IP 记录（定期执行，防止内存泄漏）
 */
function cleanupExpiredRecords() {
    const now = Date.now();

    // 清理过期的请求记录
    for (const [ip, data] of ipRequestMap.entries()) {
        if (now - data.firstRequest > RATE_LIMIT_WINDOW) {
            ipRequestMap.delete(ip);
        }
    }

    // 清理过期的黑名单
    for (const [ip, unblockTime] of ipBlacklist.entries()) {
        if (now >= unblockTime) {
            ipBlacklist.delete(ip);
        }
    }

    // 清理过期的账号请求记录
    for (const [accountId, data] of accountRequestMap.entries()) {
        if (now - data.firstRequest > ACCOUNT_RATE_LIMIT_WINDOW) {
            accountRequestMap.delete(accountId);
        }
    }

    // 清理过期的账号黑名单
    for (const [accountId, unblockTime] of accountBlacklist.entries()) {
        if (now >= unblockTime) {
            accountBlacklist.delete(accountId);
        }
    }
}

// 每分钟清理一次过期记录
setInterval(cleanupExpiredRecords, 60 * 1000);

/**
 * 检查 IP 是否被限流或封禁
 * @returns {{ allowed: boolean, error?: string, remainingMinutes?: number }}
 */
function checkRateLimit(req) {
    const clientIP = getClientIP(req);
    const now = Date.now();

    // 检查是否在黑名单中
    if (ipBlacklist.has(clientIP)) {
        const unblockTime = ipBlacklist.get(clientIP);
        if (now < unblockTime) {
            const remainingMinutes = Math.ceil((unblockTime - now) / 60000);
            return {
                allowed: false,
                error: `搜索过多，识别为CC攻击。您的IP已被暂时封禁，请在 ${remainingMinutes} 分钟后重试。`,
                remainingMinutes
            };
        } else {
            ipBlacklist.delete(clientIP);
        }
    }

    // 获取或创建 IP 请求记录
    let ipData = ipRequestMap.get(clientIP);

    if (!ipData || (now - ipData.firstRequest > RATE_LIMIT_WINDOW)) {
        ipData = { count: 1, firstRequest: now };
        ipRequestMap.set(clientIP, ipData);
    } else {
        ipData.count++;

        if (ipData.count > RATE_LIMIT_MAX_REQUESTS) {
            const unblockTime = now + BLACKLIST_DURATION;
            ipBlacklist.set(clientIP, unblockTime);
            ipRequestMap.delete(clientIP);

            return {
                allowed: false,
                error: '搜索过多，识别为CC攻击。您的IP已被暂时封禁10分钟。',
                remainingMinutes: 10
            };
        }
    }

    return { allowed: true };
}

/**
 * 检查账号是否被限流或封禁
 * @returns {{ allowed: boolean, error?: string, remainingMinutes?: number }}
 */
function checkAccountRateLimit(accountId) {
    const normalizedId = normalizeAccountId(accountId);
    if (!normalizedId) {
        return { allowed: false, error: "登录异常，请重新登录" };
    }

    const now = Date.now();

    if (accountBlacklist.has(normalizedId)) {
        const unblockTime = accountBlacklist.get(normalizedId);
        if (now < unblockTime) {
            const remainingMinutes = Math.ceil((unblockTime - now) / 60000);
            return {
                allowed: false,
                error: `搜索过多，账号已被暂时限制，请在 ${remainingMinutes} 分钟后重试。`,
                remainingMinutes
            };
        }
        accountBlacklist.delete(normalizedId);
    }

    let accountData = accountRequestMap.get(normalizedId);

    if (!accountData || (now - accountData.firstRequest > ACCOUNT_RATE_LIMIT_WINDOW)) {
        accountData = { count: 1, firstRequest: now };
        accountRequestMap.set(normalizedId, accountData);
        return { allowed: true };
    }

    accountData.count++;
    if (accountData.count > ACCOUNT_RATE_LIMIT_MAX_REQUESTS) {
        const unblockTime = now + ACCOUNT_BLACKLIST_DURATION;
        accountBlacklist.set(normalizedId, unblockTime);
        accountRequestMap.delete(normalizedId);
        return {
            allowed: false,
            error: "搜索过多，账号已被暂时限制5分钟。",
            remainingMinutes: Math.ceil(ACCOUNT_BLACKLIST_DURATION / 60000)
        };
    }

    return { allowed: true };
}

// ============================================
// 工具函数
// ============================================

function normalizeQqText(value) {
    return String(value || '').toLowerCase().replace(/[\s-]+/g, '');
}

function parseTitleArtistFromQuery(query) {
    const raw = String(query || '').trim();
    if (!raw) {
        return { title: '', artist: '' };
    }
    const parts = raw.split(/\s*[-/|]\s*/).filter(Boolean);
    if (parts.length >= 2) {
        return {
            title: parts[0].trim(),
            artist: parts.slice(1).join(' ').trim()
        };
    }
    return { title: raw, artist: '' };
}

function getQqSongTitle(item) {
    return item?.songname || item?.name || item?.title || '';
}

function getQqSongArtist(item) {
    if (Array.isArray(item?.singer) && item.singer.length) {
        return item.singer.map((singer) => singer?.name).filter(Boolean).join(' / ');
    }
    return item?.singername || item?.artist || item?.author || '';
}

function getQqSongId(item) {
    return item?.songid || item?.song_id || item?.id || '';
}

function getQqSongMid(item) {
    return item?.songmid || item?.song_mid || item?.mid || '';
}

function getQqAlbumMid(item) {
    return item?.albummid || item?.album?.mid || item?.album?.albummid || '';
}

function buildQqCoverUrl(albumMid) {
    if (!albumMid) return '';
    return `https://y.qq.com/music/photo_new/T002R300x300M000${albumMid}.jpg`;
}

function extractQqSongList(result) {
    const song = result?.req?.data?.body?.song;
    if (Array.isArray(song)) return song;
    if (Array.isArray(song?.list)) return song.list;
    return [];
}

function scoreQqSong(item, title, artist) {
    const normalizedTitle = normalizeQqText(title);
    const normalizedArtist = normalizeQqText(artist);
    const itemTitle = normalizeQqText(getQqSongTitle(item));
    const itemArtist = normalizeQqText(getQqSongArtist(item));

    let score = 0;
    if (normalizedTitle && itemTitle.includes(normalizedTitle)) {
        score += 2;
    }
    if (normalizedArtist && itemArtist.includes(normalizedArtist)) {
        score += 1;
    }
    return score;
}

function pickBestQqSong(list, title, artist) {
    if (!Array.isArray(list) || !list.length) return null;
    if (!title && !artist) return list[0];

    let best = { item: list[0], score: scoreQqSong(list[0], title, artist) };
    for (const item of list) {
        const score = scoreQqSong(item, title, artist);
        if (score > best.score) {
            best = { item, score };
        }
    }

    if (best.score > 0) return best.item;
    if (title && artist) {
        let swapped = { item: list[0], score: scoreQqSong(list[0], artist, title) };
        for (const item of list) {
            const score = scoreQqSong(item, artist, title);
            if (score > swapped.score) {
                swapped = { item, score };
            }
        }
        if (swapped.score > 0) return swapped.item;
    }
    return list[0];
}

function getQqQualityTag(quality) {
    if (quality === 'm4a') return { prefix: 'C400', suffix: 'm4a' };
    if (quality === '128') return { prefix: 'M500', suffix: 'mp3' };
    return { prefix: 'M800', suffix: 'mp3' };
}

function buildQqFilename(songmid, quality, duplicateMid) {
    const { prefix, suffix } = getQqQualityTag(quality);
    const midPart = duplicateMid ? `${songmid}${songmid}` : songmid;
    return `${prefix}${midPart}.${suffix}`;
}

function buildQqShareLinks(songmid) {
    if (!songmid) return [];
    return [
        `https://y.qq.com/n/ryqq/songDetail/${songmid}`,
        `https://y.qq.com/n/ryqq/song/${songmid}`,
        `https://i.y.qq.com/v8/playsong.html?songmid=${songmid}`
    ];
}

// ============================================
// HTTP 请求工具
// ============================================

function makeRequest(urlString, options = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(urlString);
        const isHttps = url.protocol === 'https:';
        const lib = isHttps ? https : http;

        const reqOptions = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname + url.search,
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        const req = lib.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        resolve(data);
                    }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(15000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

// ============================================
// QQ 音乐 API 函数
// ============================================

/**
 * 搜索 QQ 音乐
 */
async function fetchQqSearch(keyword, pageNum = 1, resultNum = 20) {
    const payload = {
        comm: { ct: '19', cv: '1859', uin: '0' },
        req: {
            method: 'DoSearchForQQMusicDesktop',
            module: 'music.search.SearchCgiService',
            param: {
                grp: 1,
                num_per_page: resultNum,
                page_num: pageNum,
                query: keyword,
                search_type: 0
            }
        }
    };

    return makeRequest(QQ_MUSIC_SEARCH_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json;charset=utf-8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://y.qq.com/',
            'Origin': 'https://y.qq.com'
        },
        body: JSON.stringify(payload)
    });
}

/**
 * 通过第三方 API 解析分享链接获取播放地址
 */
async function fetchQqShareData(shareUrl) {
    const params = new URLSearchParams();
    params.append('key', QQ_MUSIC_KEY);
    params.append('url', shareUrl);
    params.append('cookie', QQ_MUSIC_COOKIE || '');

    const postBody = params.toString();
    
    const result = await makeRequest(QQ_MUSIC_API, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: postBody
    });

    if (result.code !== 200 || !result.data) {
        const error = new Error(result.msg || '解析失败');
        error.statusCode = 400;
        throw error;
    }

    return result.data;
}

function extractPlayUrlFromQqApiData(data) {
    if (!data || typeof data !== 'object') return '';
    const urls = data.music_urls;
    if (urls && typeof urls === 'object') {
        const preferredKeys = ['320', '128', 'm4a', 'aac_96', 'aac_48', 'ogg_96', 'ogg_192', 'ogg_640'];
        for (const key of preferredKeys) {
            if (urls[key]?.url) {
                return urls[key].url;
            }
        }
        const fallback = Object.values(urls).find((entry) => entry?.url);
        if (fallback) return fallback.url;
    }
    return data.music_url || data.url || data.play_url || '';
}

async function fetchQqPlayUrlFromShareUrl(shareUrl) {
    if (!shareUrl || !QQ_MUSIC_API || !QQ_MUSIC_KEY) {
        return '';
    }
    
    try {
        const data = await fetchQqShareData(shareUrl);
        return extractPlayUrlFromQqApiData(data);
    } catch (error) {
        return '';
    }
}

async function fetchQqPlayUrlFromApi(songmid) {
    if (!songmid || !QQ_MUSIC_API || !QQ_MUSIC_KEY) return '';
    const shareLinks = buildQqShareLinks(songmid);
    for (const shareUrl of shareLinks) {
        const playUrl = await fetchQqPlayUrlFromShareUrl(shareUrl);
        if (playUrl) return playUrl;
    }
    return '';
}

/**
 * 通过 QQ 官方 API 获取播放地址（可能需要 Cookie）
 */
async function fetchQqPlayUrl(songmid, qualities = ['320', '128', 'm4a']) {
    const qualityList = Array.isArray(qualities) ? qualities : [qualities];
    const guid = String(Math.floor(Math.random() * 1000000000));
    const loginflag = QQ_MUSIC_COOKIE ? 1 : 0;

    for (const quality of qualityList) {
        const filenameCandidates = [
            buildQqFilename(songmid, quality, false),
            buildQqFilename(songmid, quality, true)
        ];

        for (const filename of filenameCandidates) {
            try {
                const payload = {
                    req_1: {
                        module: 'vkey.GetVkeyServer',
                        method: 'CgiGetVkey',
                        param: {
                            filename: [filename],
                            guid: guid,
                            songmid: [songmid],
                            songtype: [0],
                            uin: '0',
                            loginflag: loginflag,
                            platform: '20'
                        }
                    },
                    loginUin: '0',
                    comm: { uin: '0', format: 'json', ct: 24, cv: 0 }
                };

                const headers = {
                    'Content-Type': 'application/json;charset=utf-8',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://y.qq.com/',
                    'Origin': 'https://y.qq.com'
                };

                if (QQ_MUSIC_COOKIE) {
                    headers['Cookie'] = QQ_MUSIC_COOKIE;
                }

                const result = await makeRequest(QQ_MUSIC_VKEY_URL, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload)
                });

                const data = result?.req_1?.data;
                const purl = data?.midurlinfo?.[0]?.purl || '';
                if (purl) {
                    const base = Array.isArray(data?.sip) ? data.sip[0] : '';
                    return base ? `${base}${purl}` : purl;
                }
            } catch (error) {
                continue;
            }
        }
    }

    return '';
}

// ============================================
// HTTP 响应工具
// ============================================

function sendJson(res, status, payload) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(payload));
}

function requireQqMusicAccess(req, res) {
    const authResult = verifyQqMusicCookie(req);
    if (!authResult.valid) {
        const errorMessage = authResult.error === "ip_mismatch"
            ? "登录环境异常，请重新登录"
            : "QQ音乐需要登录后才可以使用";
        sendJson(res, 403, {
            code: 403,
            error: errorMessage
        });
        return null;
    }
    if (!authResult.accountId) {
        sendJson(res, 403, {
            code: 403,
            error: "登录已失效，请重新登录"
        });
        return null;
    }
    return authResult;
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
            if (body.length > 100000) {
                req.destroy();
                reject(new Error('Body too large'));
            }
        });
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

// ============================================
// API 路由处理
// ============================================

/**
 * 检查 IP 封禁状态
 * GET /api/qqmusic/blocked
 */
async function handleBlocked(req, res) {
    recordQqMusicRequest(req, "/blocked", null, false);
    const clientIP = getClientIP(req);
    const now = Date.now();

    if (ipBlacklist.has(clientIP)) {
        const unblockTime = ipBlacklist.get(clientIP);
        if (now < unblockTime) {
            const remainingMinutes = Math.ceil((unblockTime - now) / 60000);
            return sendJson(res, 200, {
                code: 403,
                blocked: true,
                remainingMinutes: remainingMinutes,
                error: `搜索过多，识别为CC攻击。您的IP已被暂时封禁，请在 ${remainingMinutes} 分钟后重试。`
            });
        } else {
            ipBlacklist.delete(clientIP);
        }
    }

    sendJson(res, 200, {
        code: 200,
        blocked: false
    });
}

/**
 * QQ 音乐解析接口
 * POST /api/qqmusic/parse
 * Body: { url: "QQ音乐分享链接" }
 */
async function handleParse(req, res) {
    const auth = requireQqMusicAccess(req, res);
    if (!auth) {
        return;
    }

    recordQqMusicRequest(req, "/parse", auth, true);

    // 检查限流
    const rateCheck = checkRateLimit(req);
    if (!rateCheck.allowed) {
        recordQqMusicRateLimit("/parse", req, auth);
        return sendJson(res, 429, {
            code: 429,
            error: rateCheck.error
        });
    }

    const accountRateCheck = checkAccountRateLimit(auth.accountId);
    if (!accountRateCheck.allowed) {
        recordQqMusicRateLimit("/parse", req, auth);
        return sendJson(res, 429, {
            code: 429,
            error: accountRateCheck.error
        });
    }

    try {
        const body = await readBody(req);
        const data = JSON.parse(body || '{}');
        const { url } = data;

        if (!url || typeof url !== 'string') {
            return sendJson(res, 400, {
                code: 400,
                error: '请提供有效的分享链接'
            });
        }

        // 解析分享链接
        const result = await fetchQqShareData(url);

        // 将单个结果包装成数组
        const formattedData = Array.isArray(result) ? result : [result];

        sendJson(res, 200, {
            code: 200,
            data: formattedData
        });

    } catch (error) {
        sendJson(res, 500, {
            code: 500,
            error: error.message || '服务器内部错误'
        });
    }
}

/**
 * QQ 音乐播放地址接口
 * POST /api/qqmusic/play
 * Body: { songmid: string, shareUrl?: string }
 */
async function handlePlay(req, res) {
    const auth = requireQqMusicAccess(req, res);
    if (!auth) {
        return;
    }

    recordQqMusicRequest(req, "/play", auth, true);

    // 检查限流
    const rateCheck = checkRateLimit(req);
    if (!rateCheck.allowed) {
        recordQqMusicRateLimit("/play", req, auth);
        return sendJson(res, 429, {
            code: 429,
            error: rateCheck.error
        });
    }

    try {
        const body = await readBody(req);
        const data = JSON.parse(body || '{}');
        const { songmid, shareUrl } = data;

        const normalizedSongmid = typeof songmid === 'string' ? songmid.trim() : '';
        const normalizedShareUrl = typeof shareUrl === 'string' ? shareUrl.trim() : '';

        if (!normalizedSongmid && !normalizedShareUrl) {
            return sendJson(res, 400, {
                code: 400,
                error: '请提供 songmid 或 shareUrl'
            });
        }

        let playUrl = '';

        // 优先使用第三方 API 解析
        if (normalizedShareUrl) {
            playUrl = await fetchQqPlayUrlFromShareUrl(normalizedShareUrl);
        }
        
        // 如果 shareUrl 解析失败，用 songmid 构建 shareUrl 再试
        if (!playUrl && normalizedSongmid) {
            const generatedShareUrl = `https://y.qq.com/n/ryqq/songDetail/${normalizedSongmid}`;
            playUrl = await fetchQqPlayUrlFromShareUrl(generatedShareUrl);
        }
        
        // 尝试官方 API
        if (!playUrl && normalizedSongmid) {
            playUrl = await fetchQqPlayUrl(normalizedSongmid);
        }

        if (!playUrl) {
            return sendJson(res, 502, {
                code: 502,
                error: '无法获取播放地址，可能需要VIP权限'
            });
        }

        sendJson(res, 200, {
            code: 200,
            data: {
                playUrl: playUrl
            }
        });

    } catch (error) {
        sendJson(res, 500, {
            code: 500,
            error: error.message || '服务器内部错误'
        });
    }
}

/**
 * QQ 音乐搜索接口
 * POST /api/qqmusic/search
 * Body: { query?: string, title?: string, artist?: string }
 */
async function handleSearch(req, res) {
    const auth = requireQqMusicAccess(req, res);
    if (!auth) {
        return;
    }

    recordQqMusicRequest(req, "/search", auth, true);

    // 检查限流
    const rateCheck = checkRateLimit(req);
    if (!rateCheck.allowed) {
        recordQqMusicRateLimit("/search", req, auth);
        return sendJson(res, 429, {
            code: 429,
            error: rateCheck.error
        });
    }

    const accountRateCheck = checkAccountRateLimit(auth.accountId);
    if (!accountRateCheck.allowed) {
        recordQqMusicRateLimit("/search", req, auth);
        return sendJson(res, 429, {
            code: 429,
            error: accountRateCheck.error
        });
    }

    try {
        const body = await readBody(req);
        const data = JSON.parse(body || '{}');
        const { query, title: rawTitle, artist: rawArtist } = data;

        let title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
        let artist = typeof rawArtist === 'string' ? rawArtist.trim() : '';
        const rawQuery = typeof query === 'string' ? query.trim() : '';

        if (!title && !artist && rawQuery) {
            const parsed = parseTitleArtistFromQuery(rawQuery);
            title = parsed.title;
            artist = parsed.artist;
        }

        const keyword = [title, artist].filter(Boolean).join(' ').trim() || rawQuery;
        if (!keyword) {
            return sendJson(res, 400, {
                code: 400,
                error: '请提供歌曲名称或歌手信息'
            });
        }

        await decrementQqMusicLimit(auth.accountId);

        const searchResult = await fetchQqSearch(keyword);
        const songList = extractQqSongList(searchResult);

        if (!songList.length) {
            return sendJson(res, 404, {
                code: 404,
                error: '未找到相关歌曲'
            });
        }

        // 格式化返回列表
        const formattedList = songList.map(song => {
            const albumMid = getQqAlbumMid(song);
            return {
                songmid: getQqSongMid(song),
                songid: getQqSongId(song),
                title: getQqSongTitle(song),
                artist: getQqSongArtist(song),
                cover: buildQqCoverUrl(albumMid),
                albummid: albumMid
            };
        });

        sendJson(res, 200, {
            code: 200,
            data: formattedList
        });

    } catch (error) {
        sendJson(res, 500, {
            code: 500,
            error: error.message || '服务器内部错误'
        });
    }
}

/**
 * 健康检查接口
 * GET /api/qqmusic/health
 */
async function handleHealth(req, res) {
    recordQqMusicRequest(req, "/health", null, false);
    sendJson(res, 200, {
        code: 200,
        status: 'ok',
        config: {
            apiConfigured: !!QQ_MUSIC_KEY,
            cookieConfigured: !!QQ_MUSIC_COOKIE
        }
    });
}

/**
 * 主路由处理函数
 */
async function handleQQMusicRequest(req, res, pathname) {
    // 处理 CORS 预检请求
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400'
        });
        res.end();
        return;
    }

    // 移除前缀 /api/qqmusic
    const route = pathname.replace(/^\/api\/qqmusic/, '') || '/';

    try {
        // GET 请求
        if (req.method === 'GET') {
            if (route === '/blocked') {
                return await handleBlocked(req, res);
            }
            if (route === '/health') {
                return await handleHealth(req, res);
            }
        }

        // POST 请求
        if (req.method === 'POST') {
            if (route === '/parse') {
                return await handleParse(req, res);
            }
            if (route === '/play') {
                return await handlePlay(req, res);
            }
            if (route === '/search') {
                return await handleSearch(req, res);
            }
        }

        // 未匹配的路由
        sendJson(res, 404, {
            code: 404,
            error: 'Not Found'
        });

    } catch (error) {
        sendJson(res, 500, {
            code: 500,
            error: '服务器内部错误'
        });
    }
}

module.exports = {
    handleQQMusicRequest,
    getClientIP,
    checkRateLimit,
    consumeQqMusicReportStats,
    getQqMusicFirewallSnapshot
};
