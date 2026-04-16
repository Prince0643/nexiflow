-- Migration: Add email verification support

-- Track whether a user has verified their email
ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_verified TINYINT(1) DEFAULT 0 AFTER is_active;

-- Store hashed verification tokens (24h expiry)
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_verification_user_id (user_id),
  INDEX idx_email_verification_token_hash (token_hash)
);
