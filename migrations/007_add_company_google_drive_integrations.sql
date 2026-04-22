-- Adds per-company Google Drive integration storage (encrypted refresh token + cached folder ID)
-- Used by backend OAuth flow:
--   GET  /api/admin/google-drive/connect
--   GET  /api/admin/google-drive/callback
--   POST /api/screenshots

CREATE TABLE IF NOT EXISTS `company_google_drive_integrations` (
  `company_id` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `refresh_token_enc` text COLLATE utf8mb4_general_ci NOT NULL,
  `folder_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `connected_by_user_id` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`company_id`),
  KEY `idx_company_gdrive_connected_by` (`connected_by_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
