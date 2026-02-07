<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql&logoColor=white" alt="MySQL">
  <img src="https://img.shields.io/badge/Nginx-latest-009639?logo=nginx&logoColor=white" alt="Nginx">
  <img src="https://img.shields.io/badge/Ubuntu-22.04+-E95420?logo=ubuntu&logoColor=white" alt="Ubuntu">
  <img src="https://img.shields.io/badge/License-Private-red" alt="License">
</p>

<h1 align="center">WarmPrompt v5.0</h1>

<p align="center">
  <b>一个温暖的在线礼物卡片 & 信封制作平台</b><br>
  <sub>支持 AI 生成内容 · QQ/网易云音乐嵌入 · 媒体上传 · VIP 账号管理</sub>
</p>

---

## 功能亮点

- **礼物卡片** — 创建精美贺卡，支持自定义背景、边框样式、玻璃透明度、背景音乐
- **信封 / 信件** — 手写信件效果，支持打字动画、字体选择、媒体附件
- **AI 生成** — 集成 DeepSeek / MiMo AI，智能生成卡片与信件内容
- **音乐嵌入** — QQ 音乐 & 网易云音乐歌曲搜索和嵌入播放
- **媒体服务** — 独立的图片/视频上传服务，支持大文件上传和视频流
- **VIP 系统** — 多级账号体系（Trial / Air / Standard / Pro），管理员后台分发
- **意见反馈** — 用户反馈系统，支持评论和点赞
- **分享系统** — 一键生成分享链接，设置访问次数和过期时间
- **暗色模式** — 前端支持明暗主题切换

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Node.js（原生 HTTP，无框架） |
| 前端 | 原生 HTML / CSS / JavaScript |
| 数据库 | MySQL 8.0（mysql2 驱动） |
| 反向代理 | Nginx |
| 进程管理 | PM2 + Systemd |
| 媒体服务 | 独立 Node.js 服务（busboy 处理上传） |

## 项目结构

```
WarmPrompt_v5.0/
├── server.js                  # 主服务入口（端口 3000）
├── package.json               # 项目依赖
├── .env                       # 环境变量配置（需自行生成）
├── deploy.sh                  # Ubuntu 一键部署脚本
│
├── api/                       # 后端 API 模块
│   ├── ai/                    #   AI 聊天接口
│   ├── feedback/              #   意见反馈
│   ├── gift/                  #   礼物卡片
│   ├── letter/                #   信封/信件
│   ├── media/                 #   媒体处理
│   └── for_others/            #   其他接口
│       ├── admin/             #     管理员后台
│       ├── log_in/            #     登录/账号
│       ├── qqmusic/           #     QQ 音乐
│       └── netease/           #     网易云音乐
│
├── public/                    # 前端静态资源
│   ├── index.html             #   主页
│   ├── admini/                #   管理员后台页面
│   ├── letter/                #   信件编辑页
│   ├── letter-share/          #   信件分享页
│   ├── others/                #   其他功能页
│   ├── feedback/              #   反馈页面
│   ├── share/                 #   礼物分享页
│   ├── log_in/                #   登录页
│   └── vip/                   #   VIP 相关页面
│
├── media_server/              # 独立媒体服务（端口 4001）
│   ├── server.js              #   媒体服务入口
│   ├── package.json           #   媒体服务依赖
│   └── .env                   #   媒体服务配置
│
└── sql/                       # 数据库表结构
    ├── accounts.sql           #   账号 + 系统标记表
    ├── gift_submissions.sql   #   礼物卡片表
    ├── letter_submissions.sql #   信件表
    ├── feedback_submissions.sql #  反馈表
    └── feedback_comments.sql  #   反馈评论/点赞表
```

## 快速部署（Ubuntu 22+）

### 一键部署

在 Ubuntu 22.04 或更高版本的服务器上，使用一键部署脚本：

```bash
# 下载部署脚本
wget -O deploy.sh <部署脚本链接>

# 执行部署
sudo bash deploy.sh
```

脚本会自动完成以下操作：

1. 环境预检（系统版本、磁盘空间、网络）
2. 交互式配置（域名、QQ 音乐 API、AI 密钥等）
3. 并行安装 MySQL、Nginx、Node.js 20.x、PM2
4. 创建 4 个数据库并导入表结构
5. 自动生成 `.env` 配置文件（随机密码、Token、管理员凭据）
6. 配置 Nginx 反向代理
7. PM2 启动服务 + Systemd 开机自启
8. 显示管理员账号密码和访问链接

### 手动部署

<details>
<summary>点击展开手动部署步骤</summary>

**1. 安装依赖**

```bash
# Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs mysql-server nginx

# PM2
sudo npm install -g pm2
```

**2. 配置 MySQL**

```sql
CREATE DATABASE admini CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE meani CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE letter CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE feedback CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 为每个库创建用户并授权
CREATE USER 'admini'@'localhost' IDENTIFIED BY '你的密码';
GRANT ALL PRIVILEGES ON admini.* TO 'admini'@'localhost';
-- ... 其他库同理
```

导入表结构：

```bash
mysql admini < sql/accounts.sql
mysql meani < sql/gift_submissions.sql
mysql letter < sql/letter_submissions.sql
mysql feedback < sql/feedback_submissions.sql
mysql feedback < sql/feedback_comments.sql
```

**3. 配置环境变量**

复制并修改环境变量：

```bash
cp 测试.env .env
# 编辑 .env，填入数据库密码、API 密钥等
```

同时配置 `media_server/.env`。

**4. 安装依赖并启动**

```bash
npm install --production
cd media_server && npm install --production && cd ..

pm2 start server.js --name warmprompt-main
pm2 start media_server/server.js --name warmprompt-media
pm2 save
pm2 startup
```

</details>

## 环境变量说明

| 变量 | 说明 | 必填 |
|---|---|:---:|
| `ADMIN_USERNAME` | 管理员用户名 | 是 |
| `ADMIN_PASSWORD` | 管理员密码 | 是 |
| `ADMIN_SECRET_KEY` | 管理员密钥 | 是 |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | VIP 数据库 | 是 |
| `MAIN_DB_*` | 主数据库（礼物卡片等） | 是 |
| `LETTER_DB_*` | 信封数据库 | 是 |
| `FEEDBACK_DB_*` | 反馈数据库（可复用主数据库） | 否 |
| `MEDIA_SERVER_UPLOAD_URL` | 媒体上传地址 | 是 |
| `MEDIA_UPLOAD_TOKEN` | 媒体上传 Token | 是 |
| `DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL` | DeepSeek AI | 否 |
| `MIMO_API_KEY` / `MIMO_BASE_URL` | MiMo AI | 否 |
| `QQ_MUSIC_API` / `QQ_MUSIC_KEY` / `QQ_MUSIC_COOKIE` | QQ 音乐 API | 否 |

## 常用命令

```bash
# 查看服务状态
pm2 status

# 查看实时日志
pm2 logs

# 重启所有服务
pm2 restart all

# 重启单个服务
pm2 restart warmprompt-main
pm2 restart warmprompt-media
```

## 数据库架构

| 数据库 | 表 | 用途 |
|---|---|---|
| `admini` | accounts, system_flags | VIP 账号管理、系统配置 |
| `meani` | gift_submissions | 礼物卡片数据 |
| `letter` | letter_submissions | 信件数据 |
| `feedback` | feedback_submissions, feedback_comments, feedback_likes, feedback_comment_likes | 用户反馈系统 |

## 端口说明

| 服务 | 默认端口 | 说明 |
|---|---|---|
| 主应用 | 3000 | API 路由 + 静态文件服务 |
| 媒体服务 | 4001 | 图片/视频上传、流媒体 |
| Nginx | 80 | 反向代理，统一入口 |

---

<p align="center">
  <sub>Made with ❤️ by <b>Lokua</b></sub>
</p>
