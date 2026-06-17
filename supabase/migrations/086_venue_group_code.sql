-- Add group_code to venues so multiple venues can share a single access code.
-- When staff enter this code on a device, all venues in the group are added
-- to that device's venue list at once.
-- Managers set this in Settings → Venue. It's optional; NULL = no group code.

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS group_code text;

-- Unique constraint so one code maps to exactly one group
CREATE UNIQUE INDEX IF NOT EXISTS venues_group_code_unique
  ON venues (group_code)
  WHERE group_code IS NOT NULL;

-- Allow group_code lookups without auth (same as slug lookups)
-- RLS on venues already allows public SELECT by slug; group_code is the same pattern.
