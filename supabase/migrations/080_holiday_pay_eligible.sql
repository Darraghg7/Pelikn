-- Add holiday pay eligibility flag to staff.
-- Defaults to true so existing staff are unaffected until a manager opts them out.
ALTER TABLE staff ADD COLUMN IF NOT EXISTS holiday_pay_eligible boolean NOT NULL DEFAULT true;
