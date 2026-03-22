-- Add plan tier to venues table
-- Tracks which pricing plan each venue is on (starter / pro / multi)
ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'starter'
    CHECK (plan IN ('starter', 'pro', 'multi'));
