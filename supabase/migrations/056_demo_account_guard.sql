-- ============================================================================
-- 056: guard seed_demo_data to only run for the demo account
--
-- The demo auth account (demo@safeserv.com) already exists and already owns
-- both demo venues (brew-and-bloom, the-corner-cup). This migration wraps the
-- existing seed function with a guard so it raises an exception if called with
-- any owner_id other than the demo account's UUID.
--
-- Demo account: demo@safeserv.com
-- Demo owner_id: 33e56f5b-5034-4c8b-8cc6-edccfc696afe
-- ============================================================================

-- 1. Fix app_settings manager_email that was seeded with the real account email
UPDATE app_settings
SET value = '"demo@safeserv.com"'
WHERE key = 'manager_email'
  AND venue_id IN (
    SELECT id FROM venues
    WHERE owner_id = '33e56f5b-5034-4c8b-8cc6-edccfc696afe'
  )
  AND value = '"darraghguy1@gmail.com"';

-- 2. Rename the real implementation so the guard wrapper can call it
ALTER FUNCTION seed_demo_data(uuid) RENAME TO _seed_demo_data_impl;

-- 3. Public-facing guard wrapper — rejects any caller that isn't the demo account
CREATE OR REPLACE FUNCTION seed_demo_data(p_owner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_owner_id <> '33e56f5b-5034-4c8b-8cc6-edccfc696afe'::uuid THEN
    RAISE EXCEPTION 'seed_demo_data may only be called for the demo account (demo@safeserv.com)';
  END IF;

  PERFORM _seed_demo_data_impl(p_owner_id);
END;
$$;
