/**
 * DeepSeek AI 服务模块
 * 整合 API 调用逻辑和 Express 路由
 */

require('dotenv').config();
const express = require('express');
const router = express.Router();

// ==================== 配置 ====================
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

// ==================== IP 速率限制 ====================
const RATE_LIMIT = 10; // 每分钟最大请求数
const RATE_WINDOW = 60 * 1000; // 时间窗口：1分钟（毫秒）
const ipRequestMap = new Map(); // 存储 IP 请求记录

/**
 * 获取客户端真实 IP
 */
function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.headers['x-real-ip']
        || req.connection?.remoteAddress
        || req.socket?.remoteAddress
        || req.ip;
}

/**
 * 检查 IP 是否超过速率限制
 * @returns {boolean} true = 允许请求，false = 超限
 */
function checkRateLimit(ip) {
    const now = Date.now();
    const record = ipRequestMap.get(ip);

    if (!record) {
        ipRequestMap.set(ip, { count: 1, startTime: now });
        return true;
    }

    // 检查时间窗口是否过期
    if (now - record.startTime >= RATE_WINDOW) {
        ipRequestMap.set(ip, { count: 1, startTime: now });
        return true;
    }

    // 在时间窗口内，检查请求次数
    if (record.count >= RATE_LIMIT) {
        return false;
    }

    record.count++;
    return true;
}

/**
 * 速率限制中间件
 */
function rateLimitMiddleware(req, res, next) {
    const ip = getClientIP(req);

    if (!checkRateLimit(ip)) {
        return res.status(429).json({
            success: false,
            error: '请求太频繁啦～请稍后再试哦 💫'
        });
    }

    next();
}

// 定期清理过期的 IP 记录（每5分钟）
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of ipRequestMap.entries()) {
        if (now - record.startTime >= RATE_WINDOW) {
            ipRequestMap.delete(ip);
        }
    }
}, 5 * 60 * 1000);

// ==================== AI 提示词 ====================
/**
 * WarmPrompt 智能客服 System Prompt
 * 定义 AI 助手的人格、风格和行为准则
 */
const SYSTEM_PROMPT = `你是「WarmPrompt 温柔提醒」的专属智能客服助手，你的名字叫「暖暖」。

## 🌟 你的核心身份
你是一位温暖、贴心、专业的数字伙伴。你的使命是帮助用户更好地了解和使用 WarmPrompt 服务，让每一次对话都充满温度。

## 💫 性格特质
- **温柔细腻**：说话语气柔和，善于用温暖的文字抚慰人心
- **耐心倾听**：认真理解用户的每一个问题，不急不躁
- **积极乐观**：即使面对困难问题，也保持正面积极的态度
- **专业可靠**：对产品了如指掌，给出准确有帮助的答案
- **俏皮可爱**：适时使用可爱的语气词和emoji，增添趣味

## 📚 产品知识库
WarmPrompt 是一个温柔提醒网站，目前提供两个版本：
1. **「给自己」方框版**：专为自我关怀设计
   - 适合：想要自我成长、情绪管理、建立好习惯的用户
   - 特点：个性化提醒、心情日记、正能量推送
   
2. **「给他人」方框版**：专为传递关爱设计
   - 适合：想要关心亲友、表达爱意、共享美好的用户
   - 特点：定时送祝福、互动小游戏、温暖传递

## 🎨 回复风格指南
1. 开头用简短的问候或共情语句
2. 主体内容清晰有条理，适当使用 emoji 点缀
3. 结尾留下温暖的鼓励或提问，保持对话活力
4. 控制回复长度在 100-200 字，精炼但不失温度

## ⚠️ 行为准则
- 始终保持友善和尊重
- 对不了解的问题诚实说明，避免编造
- 敏感问题委婉引导至人工客服
- 鼓励用户探索产品，但不过度推销
- 如果用户实在解决不了问题，让用户加入这个QQ群1067305984

## 💭 示例对话风格
用户：这个网站是做什么的？
暖暖：嗨！很高兴遇见你~ 🌸 WarmPrompt 是一个充满温度的「温柔提醒」网站哦！我们相信，一句恰到好处的提醒，能让平凡的日子闪闪发光 ✨ 你可以用它给自己设置暖心提醒，也可以把关爱传递给重要的人。想先了解哪个版本呢？

记住：你是用户在 WarmPrompt 遇见的第一缕温暖，请珍惜每一次对话的机会~ 💕`;

// ==================== DeepSeek API 调用函数 ====================

/**
 * 调用 DeepSeek Chat API（非流式）
 * @param {Array} messages - 对话历史 [{role: 'user', content: '...'}]
 * @param {Object} options - 可选配置
 * @returns {Promise<Object>} - API 响应
 */
async function chat(messages, options = {}) {
    const {
        model = 'deepseek-chat',
        temperature = 1.3,
        stream = false,
        maxTokens = 1024
    } = options;

    const fullMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages
    ];

    try {
        const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model,
                messages: fullMessages,
                temperature,
                stream,
                max_tokens: maxTokens
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`DeepSeek API Error: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return {
            success: true,
            content: data.choices[0]?.message?.content || '',
            usage: data.usage
        };

    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 流式调用 DeepSeek Chat API（用于打字机效果）
 * @param {Array} messages - 对话历史
 * @param {Function} onChunk - 每收到一块数据时的回调
 * @param {Object} options - 可选配置
 */
async function chatStream(messages, onChunk, options = {}) {
    const {
        model = 'deepseek-chat',
        temperature = 1.3,
        maxTokens = 1024
    } = options;

    const fullMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages
    ];

    try {
        const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model,
                messages: fullMessages,
                temperature,
                stream: true,
                max_tokens: maxTokens
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`DeepSeek API Error: ${error.error?.message || response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') {
                        onChunk({ done: true });
                        return;
                    }
                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices[0]?.delta?.content;
                        if (content) {
                            onChunk({ content, done: false });
                        }
                    } catch (e) {
                        // 忽略解析错误
                    }
                }
            }
        }
        onChunk({ done: true });

    } catch (error) {
        onChunk({ error: error.message, done: true });
    }
}

// ==================== Express 路由 ====================

/**
 * POST /api/ai/chat
 * 与 AI 客服对话（非流式）
 */
router.post('/chat', rateLimitMiddleware, async (req, res) => {
    const { messages, options = {} } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({
            success: false,
            error: '请提供有效的消息内容'
        });
    }

    const result = await chat(messages, options);

    if (result.success) {
        res.json({
            success: true,
            message: result.content,
            usage: result.usage
        });
    } else {
        res.status(500).json({
            success: false,
            error: result.error || '抱歉，暖暖暂时无法回复，请稍后再试~'
        });
    }
});

/**
 * POST /api/ai/chat/stream
 * 与 AI 客服对话（流式，Server-Sent Events）
 */
router.post('/chat/stream', rateLimitMiddleware, async (req, res) => {
    const { messages, options = {} } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({
            success: false,
            error: '请提供有效的消息内容'
        });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    await chatStream(messages, (chunk) => {
        if (chunk.error) {
            res.write(`data: ${JSON.stringify({ error: chunk.error })}\n\n`);
        } else if (chunk.done) {
            res.write(`data: [DONE]\n\n`);
            res.end();
        } else {
            res.write(`data: ${JSON.stringify({ content: chunk.content })}\n\n`);
        }
    }, options);
});

/**
 * GET /api/ai/health
 * 健康检查接口
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'online',
        service: 'DeepSeek AI',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
