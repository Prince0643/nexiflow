-- Fixes company_pdf_settings.id so inserts work without specifying an id.
-- Root cause: schema has `id INT NOT NULL` without AUTO_INCREMENT.

-- If the table does not exist yet, create it in the expected shape.
CREATE TABLE IF NOT EXISTS company_pdf_settings (
  id INT NOT NULL AUTO_INCREMENT,
  company_id VARCHAR(255) NOT NULL,
  company_name VARCHAR(255) DEFAULT NULL,
  logo_url TEXT,
  primary_color VARCHAR(7) DEFAULT '#3B82F6',
  secondary_color VARCHAR(7) DEFAULT '#10B981',
  show_powered_by TINYINT(1) DEFAULT 1,
  custom_footer_text TEXT,
  PRIMARY KEY (id),
  UNIQUE KEY unique_company_pdf (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- If the table exists but id is not auto-increment, fix it.
ALTER TABLE company_pdf_settings
  MODIFY id INT NOT NULL AUTO_INCREMENT;

