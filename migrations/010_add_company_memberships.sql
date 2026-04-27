-- Adds multi-company membership support.
-- Users can belong to multiple companies with per-company roles.

CREATE TABLE IF NOT EXISTS company_memberships (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  company_id VARCHAR(255) NOT NULL,
  role ENUM('employee', 'hr', 'admin', 'super_admin', 'root') NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_company (user_id, company_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Best-effort migration from legacy users.company_id. Safe to re-run.
INSERT IGNORE INTO company_memberships (id, user_id, company_id, role, is_default, is_active, created_at, updated_at)
SELECT
  UUID() as id,
  u.id as user_id,
  u.company_id as company_id,
  u.role as role,
  1 as is_default,
  1 as is_active,
  NOW() as created_at,
  NOW() as updated_at
FROM users u
WHERE u.company_id IS NOT NULL;

