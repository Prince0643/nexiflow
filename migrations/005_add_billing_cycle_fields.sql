-- Migration: Add billing cycle tracking fields to companies table
-- This supports the manual monthly invoicing system (Option B)

-- Add billing fields to companies table
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS next_billing_date DATE NULL AFTER max_members,
ADD COLUMN IF NOT EXISTS last_payment_date DATE NULL AFTER next_billing_date,
ADD COLUMN IF NOT EXISTS grace_period_end_date DATE NULL AFTER last_payment_date,
ADD COLUMN IF NOT EXISTS is_in_grace_period TINYINT(1) DEFAULT 0 AFTER grace_period_end_date,
ADD COLUMN IF NOT EXISTS billing_status VARCHAR(50) DEFAULT 'active' AFTER is_in_grace_period,
ADD COLUMN IF NOT EXISTS payment_reminder_sent_at TIMESTAMP NULL AFTER billing_status;

-- Create index for efficient billing queries
CREATE INDEX idx_companies_billing_date ON companies(next_billing_date);
CREATE INDEX idx_companies_billing_status ON companies(billing_status);

-- Update existing companies to have a next billing date 30 days from now
-- if they are on office or enterprise plans
UPDATE companies 
SET next_billing_date = DATE_ADD(CURDATE(), INTERVAL 30 DAY),
    last_payment_date = CURDATE(),
    billing_status = 'active'
WHERE pricing_level IN ('office', 'enterprise')
AND next_billing_date IS NULL;

-- For solo plans, set billing_status as 'free' (no billing needed)
UPDATE companies 
SET billing_status = 'free'
WHERE pricing_level = 'solo';

-- Update payment_transactions table to add billing cycle info
ALTER TABLE payment_transactions
ADD COLUMN IF NOT EXISTS billing_period_start DATE NULL AFTER metadata,
ADD COLUMN IF NOT EXISTS billing_period_end DATE NULL AFTER billing_period_start,
ADD COLUMN IF NOT EXISTS is_renewal TINYINT(1) DEFAULT 0 AFTER billing_period_end;

-- Create table for billing reminders log (optional, for tracking)
CREATE TABLE IF NOT EXISTS billing_reminders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id VARCHAR(255) NOT NULL,
  reminder_type VARCHAR(50) NOT NULL, -- 'upcoming', 'due', 'overdue', 'grace_period'
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_to_email VARCHAR(255),
  status VARCHAR(50), -- 'sent', 'bounced', 'opened'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_billing_reminders_company ON billing_reminders(company_id);
CREATE INDEX idx_billing_reminders_sent_at ON billing_reminders(sent_at);
