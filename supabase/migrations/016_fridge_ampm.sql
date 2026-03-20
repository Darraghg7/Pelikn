-- Add AM/PM check period to fridge temperature logs (UK EHO requirement: twice-daily checks)
ALTER TABLE fridge_temperature_logs
  ADD COLUMN check_period text CHECK (check_period IN ('am', 'pm'));

-- Backfill existing records based on logged_at hour
UPDATE fridge_temperature_logs
SET check_period = CASE
  WHEN EXTRACT(HOUR FROM logged_at AT TIME ZONE 'Europe/London') < 12 THEN 'am'
  ELSE 'pm'
END;

-- Make NOT NULL after backfill
ALTER TABLE fridge_temperature_logs
  ALTER COLUMN check_period SET NOT NULL;
