require('dotenv').config();

const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// 引入路由
const aiRoutes = require('./backend/ai');
const musicRoutes = require('./backend/music');
const giftRoutes = require('./backend/gift');

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json()); // 允许解析 JSON 请求体

// AI 聊天路由
app.use('/api/ai', aiRoutes);

// 音乐 API 路由
app.use('/api/music', musicRoutes);

// 礼物 API 路由
app.use('/api/gift', giftRoutes);

// Contact Route
app.post('/api/contact', (req, res) => {
    const { message } = req.body;
    console.log(`[Signal Received]: ${message}`);
    // 模拟网络延迟
    setTimeout(() => {
        res.json({ status: 'success', response: '信号已捕获。引导者稍后将与您建立连接。' });
    }, 1000);
});


// Default route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Gift View Route - 礼物展示页面
app.get('/gift/:code', (req, res) => {
    // 返回礼物展示页面，前端会通过 API 获取礼物数据
    res.sendFile(path.join(__dirname, 'public', 'gift', 'index.html'));
});

// --- New Year Online Count Logic ---
const activeUsers = new Map(); // ip -> lastSeen timestamp

// Clean up inactive users every 30 seconds
setInterval(() => {
    const now = Date.now();
    for (const [ip, lastSeen] of activeUsers.entries()) {
        if (now - lastSeen > 60000) { // Remove if inactive for > 60 seconds
            activeUsers.delete(ip);
        }
    }
}, 30000);

// Trust proxy for IP headers if behind Nginx/Heroku etc.
app.set('trust proxy', true);

app.post('/api/newyear/heartbeat', (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;
    activeUsers.set(ip, Date.now());
    res.json({ count: activeUsers.size });
});


app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
