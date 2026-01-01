<div align="center">

# 🎁 WarmPrompt

<img src="https://img.shields.io/badge/version-4.0.0-blue?style=for-the-badge" alt="Version 4.0.0" />
<img src="https://img.shields.io/badge/license-Non--Commercial-orange?style=for-the-badge" alt="License" />
<img src="https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen?style=for-the-badge&logo=node.js" alt="Node.js" />
<img src="https://img.shields.io/badge/express-5.x-yellow?style=for-the-badge&logo=express" alt="Express" />

**🌸 一款温暖人心的数字礼物创作平台 | A heartfelt digital gift creation platform 🌸**

[中文](#-项目简介) | [English](#-introduction)

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=22&pause=1000&color=F7B2CC&center=true&vCenter=true&width=435&lines=为+Ta+制作专属数字礼物+💝;Create+Special+Gifts+for+Loved+Ones;With+Music%2C+Letters+%26+Love+💌" alt="Typing SVG" />

</div>

---

## 📖 项目简介

**WarmPrompt** 是一款精心设计的数字礼物创作平台，让你能够为心爱的人制作独一无二的电子礼物。支持音乐、信件、个性化消息等多种元素，打造沉浸式的情感体验。

### ✨ 核心特性

| 特性 | 描述 |
|------|------|
| 🎵 **音乐集成** | 支持 QQ 音乐 & 网易云音乐，为礼物配上专属背景音乐 |
| 💌 **个性化信件** | 书写真挚的心意，打造感人的阅读体验 |
| 🎨 **主题定制** | 多种配色方案和背景效果，打造独特视觉风格 |
| 🎆 **跨年特别版** | 内置实时倒计时和绚丽烟花动画 |
| 🤖 **AI 智能助手** | DeepSeek 驱动的智能客服系统 |
| 📱 **全端适配** | 完美支持桌面端和移动端设备 |

### 🎬 功能预览

```
┌─────────────────────────────────────────────────────────────┐
│  📦 礼物创作流程                                              │
├─────────────────────────────────────────────────────────────┤
│  1️⃣ 输入收礼人姓名    →  2️⃣ 选择主题颜色                      │
│  3️⃣ 添加背景图片/视频  →  4️⃣ 挑选背景音乐                      │
│  5️⃣ 书写暖心信件      →  6️⃣ 添加个性消息                      │
│  7️⃣ 预览并生成专属链接  →  8️⃣ 分享给 Ta !                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 📖 Introduction

**WarmPrompt** is a beautifully crafted digital gift creation platform that allows you to create unique electronic gifts for your loved ones. Supporting music, letters, personalized messages, and more elements to create an immersive emotional experience.

### ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🎵 **Music Integration** | Support for QQ Music & NetEase Cloud Music for background music |
| 💌 **Personalized Letters** | Write heartfelt messages with beautiful reading experience |
| 🎨 **Theme Customization** | Multiple color schemes and background effects |
| 🎆 **New Year Special Edition** | Built-in real-time countdown with stunning firework animations |
| 🤖 **AI Assistant** | DeepSeek-powered intelligent customer service |
| 📱 **Responsive Design** | Perfect support for both desktop and mobile devices |

---

## 🚀 快速开始 | Quick Start

### 📋 环境要求 | Prerequisites

- **Node.js** >= 16.0.0
- **MySQL** >= 5.7
- **npm** >= 7.0.0

### 📦 安装步骤 | Installation

```bash
# 1. 克隆项目 | Clone the repository
git clone https://github.com/your-username/WarmPrompt.git
cd WarmPrompt

# 2. 安装依赖 | Install dependencies
npm install

# 3. 配置环境变量 | Configure environment variables
cp .env.example .env
# 编辑 .env 文件，填入你的配置信息 | Edit .env file with your configurations

# 4. 初始化数据库 | Initialize database
# 导入 database 目录下的 SQL 文件 | Import SQL files from database directory

# 5. 启动服务 | Start the server
npm start
```

### ⚙️ 环境配置 | Environment Configuration

在 `.env` 文件中配置以下参数 | Configure the following in `.env` file:

```env
# DeepSeek API 配置 | DeepSeek API Configuration
DEEPSEEK_API_KEY=your_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com

# QQ 音乐配置 | QQ Music Configuration
QQ_MUSIC_API=https://your-api-endpoint
QQ_MUSIC_KEY=your_key
QQ_MUSIC_COOKIE=your_cookie

# 网易云音乐配置 | NetEase Music Configuration
NETEASE_MUSIC_API=https://your-api-endpoint

# 数据库配置 | Database Configuration
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=warmprompt

# 其他配置 | Other Configurations
DAILY_GIFT_LIMIT=2       # 每日礼物创建限制 | Daily gift creation limit
NAME_MAX_LENGTH=6        # 名字最大长度 | Maximum name length
IMAGE_MAX_SIZE=3145728   # 图片最大大小(bytes) | Max image size
VIDEO_MAX_SIZE=20971520  # 视频最大大小(bytes) | Max video size
VIDEO_MAX_DURATION=15    # 视频最大时长(秒) | Max video duration
```

---

## 📁 项目结构 | Project Structure

```
WarmPrompt_v4.0/
├── 📂 backend/              # 后端 API 路由
│   ├── ai.js                # AI 聊天接口
│   ├── gift.js              # 礼物 CRUD 接口
│   └── music.js             # 音乐搜索接口
│
├── 📂 database/             # 数据库脚本
│
├── 📂 public/               # 前端静态资源
│   ├── 📂 For_Others/       # 礼物创作页面
│   │   ├── 📂 CSS/          # 模块化样式
│   │   └── 📂 JS/           # 模块化脚本
│   ├── 📂 New_Year/         # 跨年特别版页面
│   ├── 📂 gift/             # 礼物展示页面
│   ├── index.html           # 主入口页面
│   ├── main.js              # 主逻辑脚本
│   └── style.css            # 主样式表
│
├── 📂 md/                   # 项目文档
├── .env                     # 环境变量配置
├── package.json             # 项目依赖
└── server.js                # Express 服务入口
```

---

## 🛠️ 技术栈 | Tech Stack

<div align="center">

| 类别 | 技术 |
|------|------|
| **后端框架** | ![Express](https://img.shields.io/badge/Express-5.x-000000?style=flat-square&logo=express) |
| **运行时** | ![Node.js](https://img.shields.io/badge/Node.js-16+-339933?style=flat-square&logo=node.js) |
| **数据库** | ![MySQL](https://img.shields.io/badge/MySQL-5.7+-4479A1?style=flat-square&logo=mysql&logoColor=white) |
| **AI 服务** | ![DeepSeek](https://img.shields.io/badge/DeepSeek-API-blue?style=flat-square) |
| **前端** | ![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white) ![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3) ![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=flat-square&logo=javascript&logoColor=black) |
| **样式框架** | ![TailwindCSS](https://img.shields.io/badge/TailwindCSS-CDN-06B6D4?style=flat-square&logo=tailwindcss) |

</div>

---

## 📄 使用许可 | License

<div align="center">

### ⚖️ 非商业使用许可证 | Non-Commercial License

</div>

#### ✅ 允许 | Allowed

| 用途 | 说明 |
|------|------|
| 📚 **个人学习** | 学习代码结构、技术实现等 |
| 🏠 **自用部署** | 在自己的服务器上部署使用 |
| 🎁 **免费分享** | 免费分享给朋友使用 |
| 🏫 **非盈利用途** | 非盈利社团、学校等公益用途 |

#### ❌ 禁止（商业/盈利）| Prohibited (Commercial/Profit)

| 行为 | 说明 |
|------|------|
| 💰 **收费服务** | 收费提供服务 / 付费代部署 |
| 📺 **广告变现** | 加广告、引流变现、会员/赞助解锁功能 |
| ☁️ **SaaS 服务** | 作为 SaaS/托管服务对外提供 |
| 🏢 **商业用途** | 公司/工作室用于业务或赚钱项目（哪怕不直接收费） |

---

#### ✅ Allowed

| Usage | Description |
|-------|-------------|
| 📚 **Personal Learning** | Learning code structure, technical implementation, etc. |
| 🏠 **Self-deployment** | Deploy on your own server for personal use |
| 🎁 **Free Sharing** | Share freely with friends |
| 🏫 **Non-profit Use** | Non-profit organizations, schools, and public welfare purposes |

#### ❌ Prohibited (Commercial/Profit)

| Action | Description |
|--------|-------------|
| 💰 **Paid Services** | Charging for services / Paid deployment |
| 📺 **Ad Monetization** | Adding ads, traffic monetization, member/sponsor unlock features |
| ☁️ **SaaS Services** | Providing as SaaS/hosted service externally |
| 🏢 **Commercial Use** | Company/studio use for business or money-making projects (even if not charging directly) |

---

<div align="center">

### 💬 需要商用？| Need Commercial License?

**联系我获取商业授权 | Contact me for commercial licensing**

[![QQ](https://img.shields.io/badge/QQ-457089368-12B7F5?style=for-the-badge&logo=tencentqq&logoColor=white)](https://qm.qq.com/cgi-bin/qm/qr?k=your_qr_code)

</div>

---

## 💖 鸣谢 | Acknowledgments

<div align="center">

感谢以下赞助商的支持 | Thanks to the following sponsors

| 赞助商 | 说明 |
|--------|------|
| 🔷 **[宝塔面板砺行计划](https://www.bt.cn)** | 服务器运维支持 |
| 🌧️ **[润雨科技](https://www.rainyun.com)** | 云服务赞助 |

</div>

---

## 📞 联系方式 | Contact

<div align="center">

| 平台 | 联系方式 |
|------|----------|
| 📧 **QQ** | 457089368 |

---

**Made with ❤️ by Lokua**

© 2025 Lokua WarmPrompt. All Rights Reserved.

</div>
