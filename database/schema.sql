-- ============================================
-- WarmPrompt 礼物数据表
-- 用于存储用户创建的礼物祝福信息
-- ============================================

-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS warmprompt
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;

USE warmprompt;

-- 礼物主表
CREATE TABLE IF NOT EXISTS gifts (
    -- 主键
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    
    -- 唯一礼物标识（用于分享链接）
    gift_code VARCHAR(32) NOT NULL UNIQUE COMMENT '礼物唯一代码，用于分享链接',
    
    -- 用户信息
    sender_name VARCHAR(100) NOT NULL COMMENT '发送者名字（用户自己）',
    recipient_name VARCHAR(100) NOT NULL COMMENT '接收者名字（朋友）',
    
    -- 样式设置
    box_color VARCHAR(20) NOT NULL DEFAULT '#4facfe' COMMENT '方框颜色，十六进制',
    blur_level INT UNSIGNED NOT NULL DEFAULT 15 COMMENT '毛玻璃模糊程度 0-30',
    
    -- 背景媒体
    bg_type ENUM('default', 'white', 'image', 'video') NOT NULL DEFAULT 'default' COMMENT '背景类型',
    bg_filename VARCHAR(255) DEFAULT NULL COMMENT '背景图片或视频文件名（存储在 public/For_Others/photo 或 video）',
    
    -- 音乐信息
    music_platform ENUM('netease', 'qq') NOT NULL DEFAULT 'netease' COMMENT '音乐平台',
    music_id VARCHAR(100) DEFAULT NULL COMMENT '音乐ID',
    music_title VARCHAR(255) DEFAULT NULL COMMENT '音乐标题',
    music_artist VARCHAR(255) DEFAULT NULL COMMENT '音乐艺术家',
    music_cover_url TEXT DEFAULT NULL COMMENT '音乐封面URL',
    music_play_url TEXT DEFAULT NULL COMMENT '音乐播放URL',
    
    -- 播放模式
    playback_mode ENUM('full', 'highlight') NOT NULL DEFAULT 'full' COMMENT '播放模式：完整播放/高潮播放',
    start_time INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '高潮播放开始时间（秒）',
    
    -- 祝福语
    message_mode ENUM('official', 'custom') NOT NULL DEFAULT 'official' COMMENT '祝福语模式：官方/自定义',
    message_content TEXT DEFAULT NULL COMMENT '祝福语内容',
    
    -- 信件
    has_letter TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否有信件 0-否 1-是',
    letter_content TEXT DEFAULT NULL COMMENT '信件内容',
    
    -- 元数据
    ip_address VARCHAR(45) DEFAULT NULL COMMENT '创建者IP地址',
    user_agent TEXT DEFAULT NULL COMMENT '创建者浏览器信息',
    view_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '被查看次数',
    
    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    expires_at TIMESTAMP DEFAULT NULL COMMENT '过期时间（可选）',
    
    -- 索引
    INDEX idx_gift_code (gift_code),
    INDEX idx_sender_name (sender_name),
    INDEX idx_recipient_name (recipient_name),
    INDEX idx_created_at (created_at),
    INDEX idx_music_platform (music_platform)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='礼物祝福表';

-- 礼物访问记录表（用于统计和防刷）
CREATE TABLE IF NOT EXISTS gift_views (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    gift_id INT UNSIGNED NOT NULL COMMENT '关联的礼物ID',
    ip_address VARCHAR(45) DEFAULT NULL COMMENT '访问者IP',
    user_agent TEXT DEFAULT NULL COMMENT '访问者浏览器信息',
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '访问时间',
    
    FOREIGN KEY (gift_id) REFERENCES gifts(id) ON DELETE CASCADE,
    INDEX idx_gift_id (gift_id),
    INDEX idx_viewed_at (viewed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='礼物访问记录表';

-- ============================================
-- 示例查询
-- ============================================

-- 获取单个礼物详情
-- SELECT * FROM gifts WHERE gift_code = 'xxx' LIMIT 1;

-- 增加访问计数
-- UPDATE gifts SET view_count = view_count + 1 WHERE gift_code = 'xxx';

-- 获取最近创建的礼物
-- SELECT * FROM gifts ORDER BY created_at DESC LIMIT 10;

-- 统计总礼物数量
-- SELECT COUNT(*) as total_gifts FROM gifts;
