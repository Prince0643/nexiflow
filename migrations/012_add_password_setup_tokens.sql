-- Adds invite-style password setup tokens for admin-created users.

ALTER TABLE users
  ADD COLUMN needs_password_setup TINYINT(1) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS password_setup_tokens (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_password_setup_token_hash (token_hash),
  KEY idx_password_setup_user (user_id),
  CONSTRAINT fk_password_setup_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

