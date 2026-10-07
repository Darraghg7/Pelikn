-- Rollback for 141_demo_account_guard.sql.
-- Puts has_venue_access and start_owner_trial back exactly as 091/138 left
-- them, removes the demo trigger and table, and re-opens the seed functions
-- to anon/authenticated (their state before 141). Safe with any client.

SET lock_timeout = '5s';

DROP TRIGGER IF EXISTS trg_venues_demo_owner ON venues;
DROP FUNCTION IF EXISTS enforce_demo_venue_owner();

CREATE OR REPLACE FUNCTION has_venue_access(row_venue_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT row_venue_id IS NOT NULL AND (
    row_venue_id = current_venue_id()
    OR EXISTS (SELECT 1 FROM venues v WHERE v.id = row_venue_id AND v.owner_id = auth.uid())
  )
$$;

CREATE OR REPLACE FUNCTION start_owner_trial()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- Additional venues (create_additional_venue) belong to an owner who already
  -- has a venue: they join that owner's existing billing, or stay
  -- grandfathered if the owner predates billing.
  IF EXISTS (SELECT 1 FROM venues WHERE owner_id = NEW.owner_id AND id <> NEW.id) THEN
    RETURN NEW;
  END IF;
  INSERT INTO billing_accounts (owner_id, trial_ends_at)
  VALUES (NEW.owner_id, now() + interval '7 days')
  ON CONFLICT (owner_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS demo_owner_allowed(uuid, text);
DROP TABLE IF EXISTS demo_accounts;

DO $$
BEGIN
  IF to_regprocedure('public._seed_demo_data_impl(uuid)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION _seed_demo_data_impl(uuid) TO PUBLIC, anon, authenticated;
  END IF;
  IF to_regprocedure('public.seed_demo_data(uuid)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION seed_demo_data(uuid) TO PUBLIC, anon, authenticated;
  END IF;
END $$;

RESET lock_timeout;
