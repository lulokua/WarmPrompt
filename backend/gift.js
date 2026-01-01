/**
 * Gift API Router - 礼物提交与获取服务
 * 处理礼物创建、查询、文件上传
 */

const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

// ============================================
// 数据库连接池配置
// ============================================

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'warmprompt',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
});

// ============================================
// 验证配置
// ============================================

const VALIDATION_CONFIG = {
    // 名字限制
    NAME_MAX_LENGTH: parseInt(process.env.NAME_MAX_LENGTH) || 6,

    // 图片限制 (3MB)
    IMAGE_MAX_SIZE: parseInt(process.env.IMAGE_MAX_SIZE) || 3 * 1024 * 1024,

    // 视频限制 (20MB, 15秒)
    VIDEO_MAX_SIZE: parseInt(process.env.VIDEO_MAX_SIZE) || 20 * 1024 * 1024,
    VIDEO_MAX_DURATION: parseInt(process.env.VIDEO_MAX_DURATION) || 15,
};

// ============================================
// 每日生成次数限制配置
// ============================================

const DAILY_GIFT_LIMIT = parseInt(process.env.DAILY_GIFT_LIMIT) || 2;

const validVideoCodes = new Set(
    (process.env.VIDEO_CODES || 'WARMVIDEO2024,VIDEO2024')
        .split(',')
        .map(code => code.trim().toUpperCase())
        .filter(code => code.length > 0)
);

const UPLOAD_RATE_LIMIT_WINDOW_MS = parseInt(process.env.UPLOAD_RATE_LIMIT_WINDOW_MS) || 10 * 60 * 1000;
const UPLOAD_RATE_LIMIT_MAX = parseInt(process.env.UPLOAD_RATE_LIMIT_MAX) || 20;
const uploadRateMap = new Map();

// ============================================
// 文件上传配置 (Multer)
// ============================================

// 确保上传目录存在
const photoDir = path.join(__dirname, '../public/For_Others/photo');
const videoDir = path.join(__dirname, '../public/For_Others/video');

if (!fs.existsSync(photoDir)) {
    fs.mkdirSync(photoDir, { recursive: true });
}
if (!fs.existsSync(videoDir)) {
    fs.mkdirSync(videoDir, { recursive: true });
}

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const allowedVideoTypes = new Set(['video/mp4', 'video/quicktime']);
const mimeExtensionMap = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/quicktime': '.mov'
};

function getSafeExtension(mimeType, originalName) {
    if (mimeExtensionMap[mimeType]) {
        return mimeExtensionMap[mimeType];
    }
    const ext = path.extname(originalName || '').toLowerCase();
    return ext && ext.startsWith('.') ? ext : '';
}

// 文件存储配置
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'photo' || file.mimetype.startsWith('image/')) {
            cb(null, photoDir);
        } else if (file.fieldname === 'video' || file.mimetype.startsWith('video/')) {
            cb(null, videoDir);
        } else {
            cb(new Error('不支持的文件类型'), null);
        }
    },
    filename: (req, file, cb) => {
        const ext = getSafeExtension(file.mimetype, file.originalname);
        const uniqueName = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`;
        cb(null, uniqueName);
    }
});

// 文件类型过滤
const fileFilter = (req, file, cb) => {
    if (allowedImageTypes.has(file.mimetype) || allowedVideoTypes.has(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('不支持的文件格式，仅支持 JPG/PNG/GIF/WebP 图片和 MP4/MOV 视频'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // 先设置较大的限制，后续在路由中进行详细验证
    }
});

// ============================================
// 工具函数
// ============================================

/**
 * 生成唯一的礼物代码
 */
function generateGiftCode() {
    return crypto.randomBytes(12).toString('base64url');
}

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
 * 获取用户今日已创建的礼物数量
 */
async function getTodayGiftCount(connection, clientIP) {
    const [rows] = await connection.execute(
        `SELECT COUNT(*) as count FROM gifts 
         WHERE ip_address = ? 
         AND DATE(created_at) = CURDATE()`,
        [clientIP]
    );
    return rows[0].count;
}

/**
 * 检查用户是否超过每日限制
 */
async function checkDailyLimit(connection, clientIP) {
    const todayCount = await getTodayGiftCount(connection, clientIP);
    const remaining = Math.max(0, DAILY_GIFT_LIMIT - todayCount);

    return {
        allowed: todayCount < DAILY_GIFT_LIMIT,
        remaining: remaining,
        used: todayCount,
        limit: DAILY_GIFT_LIMIT
    };
}

function checkUploadRateLimit(clientIP) {
    const now = Date.now();
    const record = uploadRateMap.get(clientIP);

    if (!record || now - record.start >= UPLOAD_RATE_LIMIT_WINDOW_MS) {
        uploadRateMap.set(clientIP, { count: 1, start: now });
        return { allowed: true, remaining: UPLOAD_RATE_LIMIT_MAX - 1 };
    }

    if (record.count >= UPLOAD_RATE_LIMIT_MAX) {
        return { allowed: false, retryAfterMs: UPLOAD_RATE_LIMIT_WINDOW_MS - (now - record.start) };
    }

    record.count += 1;
    return { allowed: true, remaining: UPLOAD_RATE_LIMIT_MAX - record.count };
}

/**
 * 删除已上传的文件（验证失败时清理）
 */
function deleteUploadedFiles(files) {
    if (!files) return;

    if (files['photo'] && files['photo'][0]) {
        const filePath = path.join(photoDir, files['photo'][0].filename);
        fs.unlink(filePath, (err) => {
            if (err) console.error('删除临时图片失败:', err);
        });
    }
    if (files['video'] && files['video'][0]) {
        const filePath = path.join(videoDir, files['video'][0].filename);
        fs.unlink(filePath, (err) => {
            if (err) console.error('删除临时视频失败:', err);
        });
    }
}

function deleteUploadedFile(file) {
    if (!file) return;
    const filePath = file.path || path.join(file.mimetype.startsWith('video/') ? videoDir : photoDir, file.filename || '');
    if (!filePath) return;
    fs.unlink(filePath, (err) => {
        if (err) console.error('删除临时文件失败:', err);
    });
}

function isValidVideoCode(code) {
    if (!code || typeof code !== 'string') return false;
    return validVideoCodes.has(code.trim().toUpperCase());
}

function normalizeBgType(value) {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === 'default' || normalized === 'white' || normalized === 'image' || normalized === 'video') {
        return normalized;
    }
    return 'default';
}

function resolveBgType(value, files) {
    const normalized = normalizeBgType(value);
    if (files && files['video'] && files['video'][0]) return 'video';
    if (files && files['photo'] && files['photo'][0]) return 'image';
    return normalized;
}

function readFileHeader(filePath, length = 32) {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(length);
    const bytesRead = fs.readSync(fd, buffer, 0, length, 0);
    fs.closeSync(fd);
    return buffer.slice(0, bytesRead);
}

function detectFileTypeBySignature(buffer) {
    if (!buffer || buffer.length < 12) return null;
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image';
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (buffer.slice(0, 8).equals(pngHeader)) return 'image';
    const gifHeader = buffer.toString('ascii', 0, 6);
    if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') return 'image';
    if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image';
    if (buffer.toString('ascii', 4, 8) === 'ftyp') return 'video';
    return null;
}

function validateUploadedFile(file, expectedType) {
    if (!file || !file.path) {
        return { valid: false, error: '无法读取上传文件' };
    }
    let detectedType = null;
    try {
        const header = readFileHeader(file.path);
        detectedType = detectFileTypeBySignature(header);
    } catch (error) {
        return { valid: false, error: '无法读取上传文件' };
    }

    if (!detectedType) {
        return { valid: false, error: '文件格式无法识别或已损坏' };
    }
    if (expectedType && detectedType !== expectedType) {
        return { valid: false, error: '文件类型与上传内容不一致' };
    }
    if (file.mimetype.startsWith('image/') && detectedType !== 'image') {
        return { valid: false, error: '图片文件内容异常' };
    }
    if (file.mimetype.startsWith('video/') && detectedType !== 'video') {
        return { valid: false, error: '视频文件内容异常' };
    }

    return { valid: true, detectedType };
}

function readMp4Box(buffer, offset) {
    if (offset + 8 > buffer.length) return null;
    let size = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    let headerSize = 8;
    if (size === 1) {
        if (offset + 16 > buffer.length) return null;
        size = Number(buffer.readBigUInt64BE(offset + 8));
        headerSize = 16;
    } else if (size === 0) {
        size = buffer.length - offset;
    }
    if (size < headerSize || offset + size > buffer.length) return null;
    return { size, type, headerSize };
}

function findMp4Box(buffer, targetType, start, end) {
    let offset = start;
    while (offset + 8 <= end) {
        const box = readMp4Box(buffer, offset);
        if (!box) break;
        if (box.type === targetType) {
            return { offset, size: box.size, headerSize: box.headerSize };
        }
        offset += box.size;
    }
    return null;
}

function getMp4DurationSeconds(filePath) {
    const data = fs.readFileSync(filePath);
    const moov = findMp4Box(data, 'moov', 0, data.length);
    if (!moov) return null;
    const moovStart = moov.offset + moov.headerSize;
    const moovEnd = moov.offset + moov.size;
    const mvhd = findMp4Box(data, 'mvhd', moovStart, moovEnd);
    if (!mvhd) return null;
    const mvhdBuf = data.slice(mvhd.offset, mvhd.offset + mvhd.size);
    if (mvhdBuf.length < 28) return null;

    const version = mvhdBuf.readUInt8(8);
    let timescale = 0;
    let duration = 0;
    if (version === 0) {
        if (mvhdBuf.length < 28) return null;
        timescale = mvhdBuf.readUInt32BE(20);
        duration = mvhdBuf.readUInt32BE(24);
    } else if (version === 1) {
        if (mvhdBuf.length < 40) return null;
        timescale = mvhdBuf.readUInt32BE(28);
        duration = Number(mvhdBuf.readBigUInt64BE(32));
    } else {
        return null;
    }

    if (!timescale) return null;
    return duration / timescale;
}
/**
 * 验证提交数据
 * @returns {object} { valid: boolean, errors: string[] }
 */
function validateGiftData(body, files) {
    const errors = [];

    // ============================================
    // 1. 验证名字长度
    // ============================================
    const { senderName, recipientName } = body;

    if (!senderName || senderName.trim().length === 0) {
        errors.push('发送者名字不能为空');
    } else if (senderName.trim().length > VALIDATION_CONFIG.NAME_MAX_LENGTH) {
        errors.push(`发送者名字不能超过 ${VALIDATION_CONFIG.NAME_MAX_LENGTH} 个字符（当前: ${senderName.trim().length} 字符）`);
    }

    if (!recipientName || recipientName.trim().length === 0) {
        errors.push('接收者名字不能为空');
    } else if (recipientName.trim().length > VALIDATION_CONFIG.NAME_MAX_LENGTH) {
        errors.push(`接收者名字不能超过 ${VALIDATION_CONFIG.NAME_MAX_LENGTH} 个字符（当前: ${recipientName.trim().length} 字符）`);
    }

    // ============================================
    // 2. 验证图片文件
    // ============================================
    const normalizedBgType = normalizeBgType(body.bgType);
    const hasPhoto = files && files['photo'] && files['photo'][0];
    const hasVideo = files && files['video'] && files['video'][0];

    if (normalizedBgType === 'video' && !hasVideo) {
        errors.push('Video background selected but no video file uploaded.');
    }
    if (normalizedBgType === 'image' && !hasPhoto) {
        errors.push('Image background selected but no image file uploaded.');
    }

    if (files && files['photo'] && files['photo'][0]) {
        const photoFile = files['photo'][0];
        const photoSizeMB = (photoFile.size / (1024 * 1024)).toFixed(2);
        const limitMB = (VALIDATION_CONFIG.IMAGE_MAX_SIZE / (1024 * 1024)).toFixed(0);

        if (photoFile.size > VALIDATION_CONFIG.IMAGE_MAX_SIZE) {
            errors.push(`图片文件过大（${photoSizeMB}MB），最大允许 ${limitMB}MB`);
        }
        const photoCheck = validateUploadedFile(photoFile, 'image');
        if (!photoCheck.valid) {
            errors.push(photoCheck.error);
        }
    }

    // ============================================
    // 3. 验证视频文件
    // ============================================
    if (files && files['video'] && files['video'][0]) {
        const videoFile = files['video'][0];
        const videoSizeMB = (videoFile.size / (1024 * 1024)).toFixed(2);
        const limitMB = (VALIDATION_CONFIG.VIDEO_MAX_SIZE / (1024 * 1024)).toFixed(0);

        // 验证视频大小
        if (videoFile.size > VALIDATION_CONFIG.VIDEO_MAX_SIZE) {
            errors.push(`视频文件过大（${videoSizeMB}MB），最大允许 ${limitMB}MB`);
        }

        const videoCheck = validateUploadedFile(videoFile, 'video');
        if (!videoCheck.valid) {
            errors.push(videoCheck.error);
        }

        if (!isValidVideoCode(body.videoVerifyCode)) {
            errors.push('视频功能需要有效验证码');
        }

        const videoDuration = getMp4DurationSeconds(videoFile.path);
        if (!videoDuration || Number.isNaN(videoDuration)) {
            errors.push('无法解析视频时长，请上传 MP4/MOV 格式的视频');
        } else if (videoDuration > VALIDATION_CONFIG.VIDEO_MAX_DURATION) {
            errors.push(`视频时长过长（${videoDuration.toFixed(1)}秒），最大允许 ${VALIDATION_CONFIG.VIDEO_MAX_DURATION} 秒`);
        }
    }

    return {
        valid: errors.length === 0,
        errors: errors
    };
}

// ============================================
// API 路由
// ============================================

/**
 * 创建礼物
 * POST /api/gift/create
 * 支持文件上传（可选）
 */
router.post('/create', upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'video', maxCount: 1 }
]), async (req, res) => {
    let connection;

    try {
        // 获取客户端信息
        const clientIP = getClientIP(req);
        const userAgent = req.headers['user-agent'] || null;

        // 建立数据库连接
        connection = await pool.getConnection();

        // ============================================
        // 检查每日生成次数限制
        // ============================================
        const limitCheck = await checkDailyLimit(connection, clientIP);

        if (!limitCheck.allowed) {
            deleteUploadedFiles(req.files);

            console.log(`[Gift Limit] 超出每日限制 - IP: ${clientIP}, 已使用: ${limitCheck.used}/${limitCheck.limit}`);

            return res.status(429).json({
                code: 429,
                error: '今日生成次数已达上限',
                message: `每个用户每天最多可以生成 ${DAILY_GIFT_LIMIT} 次礼物，您今日的次数已用完，请明天再来！`,
                data: {
                    used: limitCheck.used,
                    limit: limitCheck.limit,
                    remaining: 0
                }
            });
        }

        // ============================================
        // 验证提交数据
        // ============================================
        const validation = validateGiftData(req.body, req.files);

        if (!validation.valid) {
            deleteUploadedFiles(req.files);

            console.log(`[Validation Failed] IP: ${clientIP}, 错误: ${validation.errors.join('; ')}`);

            return res.status(400).json({
                code: 400,
                error: '提交数据验证失败',
                message: validation.errors.join('\n'),
                errors: validation.errors
            });
        }

        const {
            senderName,
            recipientName,
            boxColor,
            blurLevel,
            bgType,
            musicPlatform,
            musicId,
            musicTitle,
            musicArtist,
            musicCoverUrl,
            musicPlayUrl,
            playbackMode,
            startTime,
            messageMode,
            messageContent,
            hasLetter,
            letterContent
        } = req.body;

        const resolvedBgType = resolveBgType(bgType, req.files);

        // 获取上传的文件名
        let bgFilename = null;
        if (resolvedBgType === 'image' && req.files && req.files['photo'] && req.files['photo'][0]) {
            bgFilename = req.files['photo'][0].filename;
        } else if (resolvedBgType === 'video' && req.files && req.files['video'] && req.files['video'][0]) {
            bgFilename = req.files['video'][0].filename;
        }

        // 生成唯一礼物代码
        const giftCode = generateGiftCode();

        const [result] = await connection.execute(
            `INSERT INTO gifts (
                gift_code, sender_name, recipient_name,
                box_color, blur_level, bg_type, bg_filename,
                music_platform, music_id, music_title, music_artist, music_cover_url, music_play_url,
                playback_mode, start_time,
                message_mode, message_content,
                has_letter, letter_content,
                ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                giftCode,
                senderName.trim(),
                recipientName.trim(),
                boxColor || '#4facfe',
                parseInt(blurLevel) || 15,
                resolvedBgType,
                bgFilename,
                musicPlatform || 'netease',
                musicId || null,
                musicTitle || null,
                musicArtist || null,
                musicCoverUrl || null,
                musicPlayUrl || null,
                playbackMode || 'full',
                parseInt(startTime) || 0,
                messageMode || 'official',
                messageContent || null,
                hasLetter === 'true' || hasLetter === true ? 1 : 0,
                letterContent || null,
                clientIP,
                userAgent
            ]
        );

        // 获取更新后的剩余次数
        const newRemaining = DAILY_GIFT_LIMIT - (limitCheck.used + 1);

        console.log(`[Gift Created] IP: ${clientIP}, 剩余次数: ${newRemaining}/${DAILY_GIFT_LIMIT}`);

        res.json({
            code: 200,
            message: '礼物创建成功',
            data: {
                giftCode: giftCode,
                giftId: result.insertId,
                shareUrl: `/gift/${giftCode}`,
                dailyLimit: {
                    used: limitCheck.used + 1,
                    limit: DAILY_GIFT_LIMIT,
                    remaining: newRemaining
                }
            }
        });

    } catch (error) {
        console.error('创建礼物失败:', error);
        deleteUploadedFiles(req.files);
        res.status(500).json({
            code: 500,
            error: error.message || '服务器内部错误'
        });
    } finally {
        if (connection) connection.release();
    }
});

/**
 * 获取礼物详情
 * GET /api/gift/:code
 */
router.get('/:code', async (req, res) => {
    let connection;

    try {
        const { code } = req.params;

        if (!code) {
            return res.status(400).json({
                code: 400,
                error: '缺少礼物代码'
            });
        }

        connection = await pool.getConnection();

        // 查询礼物
        const [rows] = await connection.execute(
            'SELECT * FROM gifts WHERE gift_code = ? LIMIT 1',
            [code]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                code: 404,
                error: '礼物不存在或已过期'
            });
        }

        const gift = rows[0];

        // 增加访问计数
        await connection.execute(
            'UPDATE gifts SET view_count = view_count + 1 WHERE id = ?',
            [gift.id]
        );

        // 记录访问
        const clientIP = getClientIP(req);
        const userAgent = req.headers['user-agent'] || null;

        await connection.execute(
            'INSERT INTO gift_views (gift_id, ip_address, user_agent) VALUES (?, ?, ?)',
            [gift.id, clientIP, userAgent]
        );

        // 构建响应数据
        const responseData = {
            giftCode: gift.gift_code,
            senderName: gift.sender_name,
            recipientName: gift.recipient_name,
            boxColor: gift.box_color,
            blurLevel: gift.blur_level,
            bgType: gift.bg_type,
            bgUrl: gift.bg_filename ?
                (gift.bg_type === 'video'
                    ? `/For_Others/video/${gift.bg_filename}`
                    : `/For_Others/photo/${gift.bg_filename}`)
                : null,
            music: {
                platform: gift.music_platform,
                id: gift.music_id,
                title: gift.music_title,
                artist: gift.music_artist,
                coverUrl: gift.music_cover_url,
                playUrl: gift.music_play_url
            },
            playbackMode: gift.playback_mode,
            startTime: gift.start_time,
            messageMode: gift.message_mode,
            messageContent: gift.message_content,
            hasLetter: gift.has_letter === 1,
            letterContent: gift.letter_content,
            viewCount: gift.view_count + 1,
            createdAt: gift.created_at
        };

        res.json({
            code: 200,
            data: responseData
        });

    } catch (error) {
        console.error('获取礼物失败:', error);
        res.status(500).json({
            code: 500,
            error: error.message || '服务器内部错误'
        });
    } finally {
        if (connection) connection.release();
    }
});

/**
 * 仅上传文件（不创建礼物）
 * POST /api/gift/upload
 */
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                code: 400,
                error: '没有上传文件'
            });
        }

        const clientIP = getClientIP(req);
        const uploadLimit = checkUploadRateLimit(clientIP);
        if (!uploadLimit.allowed) {
            deleteUploadedFile(req.file);
            const retryAfterSeconds = Math.ceil((uploadLimit.retryAfterMs || UPLOAD_RATE_LIMIT_WINDOW_MS) / 1000);
            res.set('Retry-After', String(retryAfterSeconds));
            return res.status(429).json({
                code: 429,
                error: '上传过于频繁，请稍后再试',
                retryAfter: retryAfterSeconds
            });
        }

        const fileType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
        if (fileType === 'image' && req.file.size > VALIDATION_CONFIG.IMAGE_MAX_SIZE) {
            deleteUploadedFile(req.file);
            return res.status(400).json({
                code: 400,
                error: '图片文件过大'
            });
        }
        if (fileType === 'video' && req.file.size > VALIDATION_CONFIG.VIDEO_MAX_SIZE) {
            deleteUploadedFile(req.file);
            return res.status(400).json({
                code: 400,
                error: '视频文件过大'
            });
        }

        const fileCheck = validateUploadedFile(req.file, fileType);
        if (!fileCheck.valid) {
            deleteUploadedFile(req.file);
            return res.status(400).json({
                code: 400,
                error: fileCheck.error
            });
        }

        if (fileType === 'video') {
            if (!isValidVideoCode(req.body.videoVerifyCode)) {
                deleteUploadedFile(req.file);
                return res.status(400).json({
                    code: 400,
                    error: '视频功能需要有效验证码'
                });
            }

            const videoDuration = getMp4DurationSeconds(req.file.path);
            if (!videoDuration || Number.isNaN(videoDuration)) {
                deleteUploadedFile(req.file);
                return res.status(400).json({
                    code: 400,
                    error: '无法解析视频时长，请上传 MP4/MOV 格式的视频'
                });
            }
            if (videoDuration > VALIDATION_CONFIG.VIDEO_MAX_DURATION) {
                deleteUploadedFile(req.file);
                return res.status(400).json({
                    code: 400,
                    error: `视频时长过长（${videoDuration.toFixed(1)}秒），最大允许 ${VALIDATION_CONFIG.VIDEO_MAX_DURATION} 秒`
                });
            }
        }

        const fileUrl = fileType === 'video'
            ? `/For_Others/video/${req.file.filename}`
            : `/For_Others/photo/${req.file.filename}`;

        res.json({
            code: 200,
            message: '文件上传成功',
            data: {
                filename: req.file.filename,
                type: fileType,
                url: fileUrl,
                size: req.file.size
            }
        });

    } catch (error) {
        console.error('文件上传失败:', error);
        deleteUploadedFile(req.file);
        res.status(500).json({
            code: 500,
            error: error.message || '服务器内部错误'
        });
    }
});

/**
 * 验证视频功能验证码
 * POST /api/gift/verify-video-code
 */
router.post('/verify-video-code', async (req, res) => {
    try {
        const { code } = req.body;

        if (!code || typeof code !== 'string') {
            return res.status(400).json({
                success: false,
                message: '请输入验证码'
            });
        }

        const normalizedCode = code.trim().toUpperCase();

        if (validVideoCodes.has(normalizedCode)) {
            const clientIP = getClientIP(req);
            console.log(`[Video Code] 验证成功 - IP: ${clientIP}, Code: ${normalizedCode}`);

            return res.json({
                success: true,
                message: '验证成功'
            });
        } else {
            const clientIP = getClientIP(req);
            console.log(`[Video Code] 验证失败 - IP: ${clientIP}, Code: ${normalizedCode}`);

            return res.json({
                success: false,
                message: '验证码无效，请确认后重试'
            });
        }

    } catch (error) {
        console.error('视频验证码验证失败:', error);
        res.status(500).json({
            success: false,
            message: '验证服务暂时不可用'
        });
    }
});

/**
 * 检查用户每日剩余生成次数
 * GET /api/gift/daily-limit
 */
router.get('/daily-limit', async (req, res) => {
    let connection;
    try {
        const clientIP = getClientIP(req);
        connection = await pool.getConnection();

        const limitCheck = await checkDailyLimit(connection, clientIP);

        res.json({
            code: 200,
            data: {
                allowed: limitCheck.allowed,
                used: limitCheck.used,
                limit: limitCheck.limit,
                remaining: limitCheck.remaining
            }
        });
    } catch (error) {
        console.error('检查每日限制失败:', error);
        res.status(500).json({
            code: 500,
            error: '服务器内部错误'
        });
    } finally {
        if (connection) connection.release();
    }
});

/**
 * 获取验证配置（供前端使用）
 * GET /api/gift/validation-config
 */
router.get('/validation-config', (req, res) => {
    res.json({
        code: 200,
        data: {
            nameMaxLength: VALIDATION_CONFIG.NAME_MAX_LENGTH,
            imageMaxSize: VALIDATION_CONFIG.IMAGE_MAX_SIZE,
            imageMaxSizeMB: (VALIDATION_CONFIG.IMAGE_MAX_SIZE / (1024 * 1024)).toFixed(0),
            videoMaxSize: VALIDATION_CONFIG.VIDEO_MAX_SIZE,
            videoMaxSizeMB: (VALIDATION_CONFIG.VIDEO_MAX_SIZE / (1024 * 1024)).toFixed(0),
            videoMaxDuration: VALIDATION_CONFIG.VIDEO_MAX_DURATION,
            dailyLimit: DAILY_GIFT_LIMIT
        }
    });
});

/**
 * 健康检查
 * GET /api/gift/health/check
 */
router.get('/health/check', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.ping();

        res.json({
            code: 200,
            status: 'ok',
            database: 'connected'
        });
    } catch (error) {
        res.status(500).json({
            code: 500,
            status: 'error',
            database: 'disconnected',
            error: error.message
        });
    } finally {
        if (connection) connection.release();
    }
});

// 错误处理中间件（处理 multer 错误）
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                code: 400,
                error: '文件太大，最大允许 50MB'
            });
        }
        return res.status(400).json({
            code: 400,
            error: error.message
        });
    }

    if (error) {
        return res.status(500).json({
            code: 500,
            error: error.message || '服务器内部错误'
        });
    }

    next();
});

module.exports = router;
