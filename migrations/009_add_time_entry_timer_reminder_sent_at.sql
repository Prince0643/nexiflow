-- Adds timestamp tracking for "timer is still running" reminder emails

ALTER TABLE `time_entries`
  ADD COLUMN `timer_reminder_sent_at` timestamp NULL DEFAULT NULL AFTER `updated_at`;

