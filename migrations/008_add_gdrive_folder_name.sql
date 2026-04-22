-- Adds per-company override for Google Drive folder name
-- Blank/NULL means backend will use GOOGLE_DRIVE_FOLDER_NAME env or default 'NexiFlow Screenshots'

ALTER TABLE `company_google_drive_integrations`
  ADD COLUMN `folder_name` varchar(80) COLLATE utf8mb4_general_ci DEFAULT NULL AFTER `folder_id`;

