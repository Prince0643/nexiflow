-- Adds company invite support so existing users can be invited to join additional companies.

CREATE TABLE IF NOT EXISTS company_invites (
  id VARCHAR(255) PRIMARY KEY,
  company_id VARCHAR(255) NOT NULL,
  inviter_user_id VARCHAR(255) NOT NULL,
  invitee_user_id VARCHAR(255) DEFAULT NULL,
  invitee_email VARCHAR(255) NOT NULL,
  role ENUM('employee','hr','admin','super_admin','root') NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  accepted_at DATETIME DEFAULT NULL,
  declined_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_company_invites_token_hash (token_hash),
  KEY idx_company_invites_email (invitee_email),
  KEY idx_company_invites_company (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

