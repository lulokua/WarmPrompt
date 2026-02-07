CREATE TABLE IF NOT EXISTS `accounts` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `account_id` VARCHAR(50) NOT NULL,
    `password` VARCHAR(100) NOT NULL,
    `type` ENUM('trial', 'air', 'pro', 'standard') NOT NULL,
    `status` ENUM('active', 'expired', 'disabled') NOT NULL DEFAULT 'active',
    `expire_date` DATE NOT NULL,
    `expire_at` DATETIME NULL,
    `daily_generate_limit` INT NOT NULL DEFAULT 0,
    `netease_playlist_limit` INT NOT NULL DEFAULT 0,
    `qq_music_limit` INT NOT NULL DEFAULT 0,
    `image_upload_limit` INT NOT NULL DEFAULT 0,
    `video_upload_limit` INT NOT NULL DEFAULT 0,
    `custom_domain` TINYINT(1) NOT NULL DEFAULT 0,
    `dedicated_server` TINYINT(1) NOT NULL DEFAULT 0,
    `created_by` VARCHAR(100) NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `remark` VARCHAR(500) DEFAULT NULL,
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_account_id` (`account_id`),
    KEY `idx_type` (`type`),
    KEY `idx_status` (`status`)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `system_flags` (
    `flag_key` VARCHAR(64) NOT NULL,
    `flag_value` VARCHAR(64) NOT NULL,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`flag_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ALTER TABLE `accounts`
--     MODIFY COLUMN `type` ENUM('trial', 'air', 'pro', 'standard') NOT NULL,
--     ADD COLUMN `daily_generate_limit` INT NOT NULL DEFAULT 0,
--     ADD COLUMN `netease_playlist_limit` INT NOT NULL DEFAULT 0,
--     ADD COLUMN `qq_music_limit` INT NOT NULL DEFAULT 0,
--     ADD COLUMN `image_upload_limit` INT NOT NULL DEFAULT 0,
--     ADD COLUMN `video_upload_limit` INT NOT NULL DEFAULT 0,
--     ADD COLUMN `custom_domain` TINYINT(1) NOT NULL DEFAULT 0,
--     ADD COLUMN `dedicated_server` TINYINT(1) NOT NULL DEFAULT 0;
--
-- ALTER TABLE `accounts`
--     ADD COLUMN `expire_at` DATETIME NULL;
--
-- UPDATE `accounts`
-- SET expire_at = DATE_ADD(expire_date, INTERVAL 1 DAY)
-- WHERE expire_at IS NULL;
--
-- UPDATE `accounts` SET
--     daily_generate_limit = 5,
--     netease_playlist_limit = 2,
--     qq_music_limit = 2,
--     image_upload_limit = 4,
--     video_upload_limit = 1,
--     custom_domain = 0,
--     dedicated_server = 0
-- WHERE type = 'trial';
--
-- UPDATE `accounts` SET
--     daily_generate_limit = 15,
--     netease_playlist_limit = 5,
--     qq_music_limit = 5,
--     image_upload_limit = 10,
--     video_upload_limit = 5,
--     custom_domain = 0,
--     dedicated_server = 0
-- WHERE type = 'air';
--
-- UPDATE `accounts` SET
--     daily_generate_limit = 35,
--     netease_playlist_limit = 30,
--     qq_music_limit = 30,
--     image_upload_limit = 25,
--     video_upload_limit = 12,
--     custom_domain = 0,
--     dedicated_server = 0
-- WHERE type = 'standard';
--
-- UPDATE `accounts` SET
--     daily_generate_limit = 80,
--     netease_playlist_limit = 200,
--     qq_music_limit = 200,
--     image_upload_limit = 80,
--     video_upload_limit = 40,
--     custom_domain = 0,
--     dedicated_server = 0
-- WHERE type = 'pro';
