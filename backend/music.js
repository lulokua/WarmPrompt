/**
 * Music API Router - 音乐搜索服务
 * 提供 QQ 音乐和网易云音乐的搜索接口
 * 包含防 CC 攻击的 IP 限流功能
 */

const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

// 从环境变量获取配置
const QQ_MUSIC_API = process.env.QQ_MUSIC_API;
const QQ_MUSIC_KEY = process.env.QQ_MUSIC_KEY;
const QQ_MUSIC_COOKIE = process.env.QQ_MUSIC_COOKIE;
const NETEASE_MUSIC_API = process.env.NETEASE_MUSIC_API;
const QQ_MUSIC_SEARCH_URL = 'https://u.y.qq.com/cgi-bin/musicu.fcg';
const QQ_MUSIC_VKEY_URL = 'https://u.y.qq.com/cgi-bin/musicu.fcg';

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

    const response = await fetch(QQ_MUSIC_SEARCH_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json;charset=utf-8',
            'User-Agent': 'Mozilla/5.0',
            'Referer': 'https://y.qq.com/',
            'Origin': 'https://y.qq.com'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`QQ music search failed: ${response.status}`);
    }
    return response.json();
}

async function fetchQqShareData(shareUrl) {
    const params = new URLSearchParams({
        key: QQ_MUSIC_KEY,
        url: shareUrl,
        cookie: QQ_MUSIC_COOKIE || ''
    });

    const response = await fetch(QQ_MUSIC_API, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        },
        body: params.toString()
    });

    if (!response.ok) {
        const error = new Error(`上游服务响应错误: ${response.status}`);
        error.statusCode = 502;
        throw error;
    }

    const result = await response.json();
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
    if (!shareUrl || !QQ_MUSIC_API || !QQ_MUSIC_KEY) return '';
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

            const response = await fetch(QQ_MUSIC_VKEY_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json;charset=utf-8',
                    'User-Agent': 'Mozilla/5.0',
                    'Referer': 'https://y.qq.com/',
                    'Origin': 'https://y.qq.com',
                    ...(QQ_MUSIC_COOKIE ? { Cookie: QQ_MUSIC_COOKIE } : {})
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`QQ music vkey failed: ${response.status}`);
            }

            const result = await response.json();
            const data = result?.req_1?.data;
            const purl = data?.midurlinfo?.[0]?.purl || '';
            if (purl) {
                const base = Array.isArray(data?.sip) ? data.sip[0] : '';
                return base ? `${base}${purl}` : purl;
            }
        }
    }

    return '';
}

// ============================================
// IP 限流与黑名单系统 - 防 CC 攻击
// ============================================

// 配置常量
const RATE_LIMIT_WINDOW = 60 * 1000;      // 限流窗口：1分钟
const RATE_LIMIT_MAX_REQUESTS = 10;        // 最大请求数：10次/分钟
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
        || req.ip
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
 * IP 限流中间件
 */
function rateLimitMiddleware(req, res, next) {
    const clientIP = getClientIP(req);
    const now = Date.now();

    // 检查是否在黑名单中
    if (ipBlacklist.has(clientIP)) {
        const unblockTime = ipBlacklist.get(clientIP);
        if (now < unblockTime) {
            const remainingMinutes = Math.ceil((unblockTime - now) / 60000);
            return res.status(404).json({
                code: 404,
                error: `搜索过多，识别为CC攻击。您的IP已被暂时封禁，请在 ${remainingMinutes} 分钟后重试。`
            });
        } else {
            // 黑名单已过期，移除
            ipBlacklist.delete(clientIP);
        }
    }

    // 获取或创建 IP 请求记录
    let ipData = ipRequestMap.get(clientIP);

    if (!ipData || (now - ipData.firstRequest > RATE_LIMIT_WINDOW)) {
        // 新的时间窗口，重置计数
        ipData = { count: 1, firstRequest: now };
        ipRequestMap.set(clientIP, ipData);
    } else {
        // 在当前时间窗口内，增加计数
        ipData.count++;

        // 检查是否超过限制
        if (ipData.count > RATE_LIMIT_MAX_REQUESTS) {
            // 加入黑名单
            const unblockTime = now + BLACKLIST_DURATION;
            ipBlacklist.set(clientIP, unblockTime);
            ipRequestMap.delete(clientIP);

            return res.status(404).json({
                code: 404,
                error: '搜索过多，识别为CC攻击。您的IP已被暂时封禁10分钟。'
            });
        }
    }

    next();
}

// 对所有音乐 API 路由应用限流中间件（除了状态检查接口）
// router.use(rateLimitMiddleware); // 移到下面的具体路由

/**
 * IP 封禁状态检查接口（不受限流中间件影响）
 * GET /api/music/blocked
 * 返回当前IP是否被封禁及剩余时间
 */
router.get('/blocked', (req, res) => {
    const clientIP = getClientIP(req);
    const now = Date.now();

    if (ipBlacklist.has(clientIP)) {
        const unblockTime = ipBlacklist.get(clientIP);
        if (now < unblockTime) {
            const remainingMinutes = Math.ceil((unblockTime - now) / 60000);
            return res.json({
                code: 404,
                blocked: true,
                remainingMinutes: remainingMinutes,
                error: `搜索过多，识别为CC攻击。您的IP已被暂时封禁，请在 ${remainingMinutes} 分钟后重试。`
            });
        } else {
            ipBlacklist.delete(clientIP);
        }
    }

    res.json({
        code: 200,
        blocked: false
    });
});

/**
 * QQ 音乐解析接口
 * POST /api/music/qq
 * Body: { url: "QQ音乐分享链接" }
 */
router.post('/qq', rateLimitMiddleware, async (req, res) => {
    try {
        const { url } = req.body;

        if (!url || typeof url !== 'string') {
            return res.status(400).json({
                code: 400,
                error: '请提供有效的分享链接'
            });
        }

        // 检查环境变量是否配置
        if (!QQ_MUSIC_API || !QQ_MUSIC_KEY) {
            return res.status(500).json({
                code: 500,
                error: '服务器配置错误'
            });
        }

        // 返回解析结果 - 包装成数组格式，与搜索接口保持一致
        const data = await fetchQqShareData(url);

        // 将单个结果包装成数组，以便前端能够显示歌曲列表
        const formattedData = Array.isArray(data) ? data : [data];

        res.json({
            code: 200,
            data: formattedData
        });

    } catch (error) {
        res.status(500).json({
            code: 500,
            error: error.message || '服务器内部错误'
        });
    }
});

/**
 * QQ 音乐播放地址接口
 * POST /api/music/qq/play
 * Body: { songmid: string }
 */
router.post('/qq/play', rateLimitMiddleware, async (req, res) => {
    try {
        const { songmid, shareUrl } = req.body || {};
        const normalizedSongmid = typeof songmid === 'string' ? songmid.trim() : '';
        const normalizedShareUrl = typeof shareUrl === 'string' ? shareUrl.trim() : '';
        if (!normalizedSongmid && !normalizedShareUrl) {
            return res.status(400).json({
                code: 400,
                error: 'missing songmid or shareUrl'
            });
        }

        let playUrl = '';
        if (normalizedShareUrl) {
            playUrl = await fetchQqPlayUrlFromShareUrl(normalizedShareUrl);
        }
        if (!playUrl && normalizedSongmid) {
            playUrl = await fetchQqPlayUrlFromApi(normalizedSongmid);
        }
        if (!playUrl && normalizedSongmid) {
            playUrl = await fetchQqPlayUrl(normalizedSongmid);
        }
        if (!playUrl) {
            return res.status(502).json({
                code: 502,
                error: 'failed to resolve play url'
            });
        }

        res.json({
            code: 200,
            data: {
                playUrl: playUrl
            }
        });

    } catch (error) {
        res.status(500).json({
            code: 500,
            error: error.message || 'internal server error'
        });
    }
});

/**
 * QQ 音乐搜索接口（歌名 + 歌手）
 * POST /api/music/qq/search
 * Body: { query?: string, title?: string, artist?: string }
 */
router.post('/qq/search', rateLimitMiddleware, async (req, res) => {
    try {
        const { query, title: rawTitle, artist: rawArtist } = req.body || {};
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
            return res.status(400).json({
                code: 400,
                error: '请提供歌曲名称或歌手信息'
            });
        }

        const searchResult = await fetchQqSearch(keyword);
        const songList = extractQqSongList(searchResult);
        if (!songList.length) {
            return res.status(404).json({
                code: 404,
                error: '未找到相关歌曲'
            });
        }

        // Return the list of songs
        const formattedList = songList.map(song => {
            const albumMid = getQqAlbumMid(song);
            return {
                songmid: getQqSongMid(song),
                songid: getQqSongId(song),
                title: getQqSongTitle(song),
                artist: getQqSongArtist(song),
                cover: buildQqCoverUrl(albumMid),
                // playUrl is not fetched here to save time/bandwidth
            };
        });

        res.json({
            code: 200,
            data: formattedList
        });

    } catch (error) {
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({
            code: statusCode,
            error: error.message || '服务器内部错误'
        });
    }
});

/**
 * 网易云音乐搜索接口
 * GET /api/music/netease
 * Query: input=搜索词&filter=name|id&page=1
 */
router.get('/netease', rateLimitMiddleware, async (req, res) => {
    try {
        const { input, filter = 'name', page = '1' } = req.query;

        if (!input || typeof input !== 'string') {
            return res.status(400).json({
                code: 400,
                error: '请提供搜索关键词'
            });
        }

        // 检查环境变量是否配置
        if (!NETEASE_MUSIC_API) {
            return res.status(500).json({
                code: 500,
                error: '服务器配置错误'
            });
        }

        // 构建请求参数
        const params = new URLSearchParams({
            input: input,
            filter: filter,
            page: page
        });

        const response = await fetch(`${NETEASE_MUSIC_API}?${params.toString()}`);

        if (!response.ok) {
            throw new Error(`上游服务响应错误: ${response.status}`);
        }

        const result = await response.json();

        if (result.code !== 200 || !Array.isArray(result.data)) {
            return res.status(400).json({
                code: 400,
                error: result.error || '搜索失败'
            });
        }

        // 返回搜索结果
        res.json({
            code: 200,
            data: result.data
        });

    } catch (error) {
        res.status(500).json({
            code: 500,
            error: error.message || '服务器内部错误'
        });
    }
});

/**
 * 健康检查接口
 * GET /api/music/health
 */
router.get('/health', (req, res) => {
    res.json({
        code: 200,
        status: 'ok',
        services: {
            qq: !!QQ_MUSIC_API && !!QQ_MUSIC_KEY,
            netease: !!NETEASE_MUSIC_API
        }
    });
});

module.exports = router;
