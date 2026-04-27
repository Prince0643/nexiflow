-- NexiFlow / Clockistry
-- Multi-company memberships migration (Adminer-friendly)
--
-- Why you saw `errno: 150`:
-- Your `users.id` column is not indexed (no PRIMARY KEY / UNIQUE KEY),
-- so MySQL/MariaDB refuses FOREIGN KEY references to it.
--
-- Run this file top-to-bottom in Adminer.

-- 0) Sanity check: ensure `users.id` is unique (should return 0 rows)
SELECT id, COUNT(*) AS c
FROM users
GROUP BY id
HAVING c > 1;

-- 1) Ensure `users.id` is indexed so it can be referenced by a foreign key.
-- If this fails with "Duplicate entry" you must fix duplicates first.
ALTER TABLE users
  ADD UNIQUE KEY uniq_users_id (id);

-- 2) Create memberships table
CREATE TABLE IF NOT EXISTS company_memberships (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  company_id VARCHAR(255) NOT NULL,
  role ENUM('employee','hr','admin','super_admin','root') NOT NULL,
  is_default TINYINT(1) DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uniq_user_company (user_id, company_id),
  KEY idx_company_id (company_id),

  CONSTRAINT fk_company_memberships_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_company_memberships_company
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 3) Backfill memberships from legacy `users.company_id` (safe to re-run)
INSERT IGNORE INTO company_memberships (id, user_id, company_id, role, is_default, is_active, created_at, updated_at)
SELECT
  UUID() AS id,
  u.id AS user_id,
  u.company_id AS company_id,
  u.role AS role,
  1 AS is_default,
  1 AS is_active,
  NOW() AS created_at,
  NOW() AS updated_at
FROM users u
WHERE u.company_id IS NOT NULL;

-- 4) Optional: verify results
SELECT
  COUNT(*) AS memberships,
  COUNT(DISTINCT user_id) AS users_with_memberships,
  COUNT(DISTINCT company_id) AS companies_with_memberships
FROM company_memberships;

