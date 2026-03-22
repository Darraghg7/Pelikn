-- Add under-18 flag to staff for UK break law compliance
-- Under-18 staff are entitled to a 30-min unpaid break for shifts over 4.5 hours
-- (Working Time Regulations 1998 — Young Workers)

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS is_under_18 boolean NOT NULL DEFAULT false;
