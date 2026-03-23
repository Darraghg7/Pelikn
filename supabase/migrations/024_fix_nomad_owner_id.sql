-- ============================================================================
-- 024: Fix Nomad Bakes owner_id — handles case where manager_email is ''
-- ============================================================================
-- Migration 023's backfill failed because manager_email was stored as empty
-- string, so the correlated subquery matched nothing.
--
-- This migration identifies the owner from auth.users directly (by picking
-- the single auth user whose email isn't already matched to another venue),
-- then writes it to venues.owner_id.
--
-- INSTRUCTIONS:
-- 1. First run the SELECT below to confirm who the owner is:
--      SELECT id, email FROM auth.users ORDER BY created_at;
-- 2. Copy the correct UUID and email, then run the UPDATE statements below
--    replacing OWNER_AUTH_UUID and owner@email.com.
--
-- Quick version (safe if there is only one auth user):
UPDATE venues
SET owner_id = (
  SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1
)
WHERE id = '00000000-0000-0000-0000-000000000001'
  AND owner_id IS NULL;

-- Fix the empty manager_email to the real email so Strategy 2 also works
UPDATE app_settings
SET value = (
  SELECT email FROM auth.users ORDER BY created_at ASC LIMIT 1
)
WHERE venue_id = '00000000-0000-0000-0000-000000000001'
  AND key = 'manager_email'
  AND (value = '' OR value IS NULL);

-- Upgrade Nomad Bakes to the Pro plan
UPDATE venues
SET plan = 'pro'
WHERE id = '00000000-0000-0000-0000-000000000001';
