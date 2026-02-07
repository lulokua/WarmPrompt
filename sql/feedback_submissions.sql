CREATE TABLE IF NOT EXISTS feedback_submissions (
  feedback_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  feedback_type VARCHAR(16) NOT NULL DEFAULT 'suggestion',
  feedback_title VARCHAR(100) DEFAULT NULL,
  feedback_content TEXT NOT NULL,
  contact_type VARCHAR(16) DEFAULT NULL,
  contact_value VARCHAR(64) DEFAULT NULL,
  page_path VARCHAR(255) DEFAULT NULL,
  device_info VARCHAR(255) DEFAULT NULL,
  user_agent VARCHAR(255) DEFAULT NULL,
  client_ip VARCHAR(64) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (feedback_id),
  KEY idx_feedback_type (feedback_type),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
