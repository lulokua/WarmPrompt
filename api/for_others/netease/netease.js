/**
 * Netease Music API - 网易云音乐搜索与解析服务
 * 提供网易云音乐的搜索、解析接口
 * 包含防 CC 攻击的 IP 限流功能
 */

const https = require('https');
const http = require('http');

// ============================================
// 配置
// ============================================

// 从环境变量获取配置，或使用默认值
// API 文档: https://lokuamusic.top/
const NETEASE_API_BASE = process.env.NETEASE_API_BASE || 'https://lokuamusic.top/api/netease';

// 启动时打印配置状态
console.log("网易云音乐 启动成功");

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
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                ...options.headers
            }
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
// 网易云音乐 API 函数
// ============================================

/**
 * 搜索网易云音乐
 * API: https://lokuamusic.top/api/netease?input=关键词&filter=name&page=1
 * @param {string} keyword - 搜索关键词或歌曲ID
 * @param {string} filter - 搜索类型：name (名称) | id (ID)
 * @param {number} page - 页码
 */
async function fetchNeteaseSearch(keyword, filter = 'name', page = 1) {
    const params = new URLSearchParams();
    params.append('input', keyword);
    params.append('filter', filter);
    params.append('page', String(page));

    const apiUrl = `${NETEASE_API_BASE}?${params.toString()}`;

    try {
        const result = await makeRequest(apiUrl);
        return result;
    } catch (error) {
        throw error;
    }
}

/**
 * 通过歌曲 ID 获取详情
 * @param {string} songId - 歌曲 ID
 */
async function fetchNeteaseSongById(songId) {
    return fetchNeteaseSearch(songId, 'id', 1);
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
 * GET /api/netease/blocked
 */
async function handleBlocked(req, res) {
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
 * 网易云音乐搜索接口
 * POST /api/netease/search
 * Body: { query: string, page?: number }
 * 
 * 或者 GET /api/netease/search?input=xxx&page=1
 */
async function handleSearch(req, res) {
    // 检查限流
    const rateCheck = checkRateLimit(req);
    if (!rateCheck.allowed) {
        return sendJson(res, 429, {
            code: 429,
            error: rateCheck.error
        });
    }

    try {
        let keyword = '';
        let page = 1;

        if (req.method === 'GET') {
            const url = new URL(req.url, `http://${req.headers.host}`);
            keyword = url.searchParams.get('input') || url.searchParams.get('query') || '';
            page = parseInt(url.searchParams.get('page') || '1', 10);
        } else if (req.method === 'POST') {
            const body = await readBody(req);
            const data = JSON.parse(body || '{}');
            keyword = data.query || data.input || '';
            page = data.page || 1;
        }

        keyword = String(keyword).trim();
        
        if (!keyword) {
            return sendJson(res, 400, {
                code: 400,
                error: '请提供搜索关键词'
            });
        }

        const searchResult = await fetchNeteaseSearch(keyword, 'name', page);

        // 解析返回结果并格式化
        const formattedList = parseNeteaseSearchResult(searchResult);

        if (!formattedList || formattedList.length === 0) {
            return sendJson(res, 404, {
                code: 404,
                error: '未找到相关歌曲'
            });
        }

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
 * 解析网易云音乐搜索结果
 * 根据 API 返回格式进行适配
 */
function parseNeteaseSearchResult(result) {
    // 如果返回的是数组格式
    if (Array.isArray(result)) {
        return result.map(song => ({
            songid: song.id || song.songid || '',
            songmid: song.id || song.songid || '', // 网易云用 ID
            title: song.title || song.name || song.songname || '',
            artist: song.author || song.artist || song.singer || '',
            cover: song.cover || song.pic || song.album_pic || '',
            url: song.url || song.play_url || '', // 播放地址
            lrc: song.lrc || '' // 歌词
        }));
    }

    // 如果返回的是对象格式，可能有 data 或 list 字段
    if (result && typeof result === 'object') {
        // 单曲结果
        if (result.title || result.name || result.songname) {
            return [{
                songid: result.id || result.songid || '',
                songmid: result.id || result.songid || '',
                title: result.title || result.name || result.songname || '',
                artist: result.author || result.artist || result.singer || '',
                cover: result.cover || result.pic || result.album_pic || '',
                url: result.url || result.play_url || '',
                lrc: result.lrc || ''
            }];
        }

        // 列表结果
        const list = result.data || result.list || result.songs || result.result?.songs || [];
        if (Array.isArray(list)) {
            return list.map(song => ({
                songid: song.id || song.songid || '',
                songmid: song.id || song.songid || '',
                title: song.title || song.name || song.songname || '',
                artist: song.author || song.artist || song.singer || 
                       (Array.isArray(song.artists) ? song.artists.map(a => a.name).join(' / ') : ''),
                cover: song.cover || song.pic || song.album_pic || 
                       (song.album?.picUrl || song.al?.picUrl || ''),
                url: song.url || song.play_url || '',
                lrc: song.lrc || ''
            }));
        }
    }

    return [];
}

/**
 * 网易云音乐播放地址接口
 * POST /api/netease/play
 * Body: { songid: string }
 */
async function handlePlay(req, res) {
    // 检查限流
    const rateCheck = checkRateLimit(req);
    if (!rateCheck.allowed) {
        return sendJson(res, 429, {
            code: 429,
            error: rateCheck.error
        });
    }

    try {
        let songid = '';

        if (req.method === 'GET') {
            const url = new URL(req.url, `http://${req.headers.host}`);
            songid = url.searchParams.get('id') || url.searchParams.get('songid') || '';
        } else if (req.method === 'POST') {
            const body = await readBody(req);
            const data = JSON.parse(body || '{}');
            songid = data.songid || data.id || '';
        }

        songid = String(songid).trim();

        if (!songid) {
            return sendJson(res, 400, {
                code: 400,
                error: '请提供歌曲 ID'
            });
        }

        // 通过 ID 获取歌曲信息
        const result = await fetchNeteaseSongById(songid);
        const parsed = parseNeteaseSearchResult(result);

        if (!parsed || parsed.length === 0 || !parsed[0].url) {
            return sendJson(res, 502, {
                code: 502,
                error: '无法获取播放地址'
            });
        }

        sendJson(res, 200, {
            code: 200,
            data: {
                playUrl: parsed[0].url,
                title: parsed[0].title,
                artist: parsed[0].artist,
                cover: parsed[0].cover,
                lrc: parsed[0].lrc
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
 * 健康检查接口
 * GET /api/netease/health
 */
async function handleHealth(req, res) {
    sendJson(res, 200, {
        code: 200,
        status: 'ok'
    });
}

/**
 * 主路由处理函数
 */
async function handleNeteaseRequest(req, res, pathname) {
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

    // 移除前缀 /api/netease
    const route = pathname.replace(/^\/api\/netease/, '') || '/';

    try {
        // GET 请求
        if (req.method === 'GET') {
            if (route === '/blocked') {
                return await handleBlocked(req, res);
            }
            if (route === '/health') {
                return await handleHealth(req, res);
            }
            if (route === '/search' || route === '/') {
                return await handleSearch(req, res);
            }
            if (route === '/play') {
                return await handlePlay(req, res);
            }
        }

        // POST 请求
        if (req.method === 'POST') {
            if (route === '/search' || route === '/') {
                return await handleSearch(req, res);
            }
            if (route === '/play') {
                return await handlePlay(req, res);
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
    handleNeteaseRequest,
    getClientIP,
    checkRateLimit
};
