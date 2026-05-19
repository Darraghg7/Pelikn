-- Add employment type, start date, and emergency contact fields to staff profiles

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS employment_type       text CHECK (employment_type IN ('full_time', 'part_time', 'zero_hours', 'fixed_term')),
  ADD COLUMN IF NOT EXISTS start_date            date,
  ADD COLUMN IF NOT EXISTS emergency_contact_name  text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text;
