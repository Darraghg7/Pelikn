-- ============================================================================
-- 141: Demo accounts can only ever own and reach the demo venues
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  APPLY MANUALLY IN SUPABASE SQL EDITOR. Idempotent.                      ║
-- ║  Prereqs: 091 (has_venue_access), 138 (start_owner_trial).               ║
-- ║  ROLLBACK: 141_rollback.sql (same folder).                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- The demo login (demo@safeserv.com, id 33e56f5b-…, same id 056 pins) is
-- shared publicly. Until now the only thing keeping it to the demo venues was
-- a filter in AuthContext.jsx, which only hid venues from the picker, and
-- whose email list didn't even contain the real demo account.
--
-- What the database already did: has_venue_access() lets an email login into
-- the venues it OWNS (venues.owner_id). So the demo login was safe only for as
-- long as nobody ever made it the owner of another venue. Nothing enforced
-- that: it could create new venues through signup, and any slip in the SQL
-- editor that pointed a real venue's owner_id at it would have opened that
-- venue to anyone holding the demo password.
--
--  1. demo_accounts — which auth users are demo logins, and the venue slugs
--     each may own. Keyed by user id, so renaming the email can't undo it.
--     Slugs, not venue ids, because the demo seed deletes and recreates the
--     venues (new ids every time); slugs are unique (idx_venues_slug).
--  2. Trigger on venues: a demo account may only own its listed slugs. Blocks
--     creating venues (signup, create_additional_venue, anything else) and any
--     owner/slug change that would break the rule. Every owner_id check in the
--     app (policies, RPCs, the billing edge function) is safe as a result.
--  3. has_venue_access() — second lock: the owner branch also refuses a demo
--     account on a venue outside its list, whatever the data says.
--  4. start_owner_trial() skips demo accounts. Re-seeding recreates the demo
--     venues, which would otherwise start a 7-day trial and lock the demo
--     when it ran out. Any such row is deleted.
--  5. The demo seed functions are server-only. _seed_demo_data_impl had no
--     guard at all and both were callable by anon: anyone could wipe and
--     rebuild the demo at will. seed-demo (edge function) uses the service
--     role and is unaffected.
-- ============================================================================

SET lock_timeout = '5s';

-- ── 1. demo_accounts ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS demo_accounts (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_slugs text[] NOT NULL,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE demo_accounts ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: read only by the SECURITY DEFINER functions below.
REVOKE ALL ON demo_accounts FROM anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = '33e56f5b-5034-4c8b-8cc6-edccfc696afe') THEN
    RAISE EXCEPTION '141: demo auth user 33e56f5b-5034-4c8b-8cc6-edccfc696afe not found — nothing applied';
  END IF;
END $$;

INSERT INTO demo_accounts (user_id, venue_slugs, note)
VALUES ('33e56f5b-5034-4c8b-8cc6-edccfc696afe',
        ARRAY['brew-and-bloom', 'the-corner-cup'],
        'demo@safeserv.com — shared demo login')
ON CONFLICT (user_id) DO UPDATE SET venue_slugs = EXCLUDED.venue_slugs;

-- True unless p_owner is a demo account and p_slug isn't one of its venues.
CREATE OR REPLACE FUNCTION demo_owner_allowed(p_owner uuid, p_slug text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM demo_accounts d
    WHERE d.user_id = p_owner
      AND NOT (lower(p_slug) = ANY (SELECT lower(s) FROM unnest(d.venue_slugs) s))
  )
$$;
REVOKE ALL ON FUNCTION demo_owner_allowed(uuid, text) FROM PUBLIC, anon, authenticated;

-- Stop here if a demo account already owns something it shouldn't, so the
-- trigger below never goes live over bad data. Fix the data, then re-run.
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(v.slug, ', ') INTO bad
  FROM venues v
  WHERE v.owner_id IS NOT NULL AND NOT demo_owner_allowed(v.owner_id, v.slug);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION '141: demo account owns non-demo venue(s): % — nothing applied', bad;
  END IF;
END $$;

-- ── 2. A demo account may only own its demo venues ──────────────────────────
CREATE OR REPLACE FUNCTION enforce_demo_venue_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL AND NOT demo_owner_allowed(NEW.owner_id, NEW.slug) THEN
    RAISE EXCEPTION 'Demo accounts can''t create or own other venues'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_venues_demo_owner ON venues;
CREATE TRIGGER trg_venues_demo_owner
  BEFORE INSERT OR UPDATE OF owner_id, slug ON venues
  FOR EACH ROW EXECUTE FUNCTION enforce_demo_venue_owner();

-- ── 3. Shared venue-access check: same as 091, plus the demo rule ──────────
-- CREATE OR REPLACE keeps the grants and every policy that calls it.
CREATE OR REPLACE FUNCTION has_venue_access(row_venue_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT row_venue_id IS NOT NULL AND (
    row_venue_id = current_venue_id()
    OR EXISTS (
      SELECT 1 FROM venues v
      WHERE v.id = row_venue_id
        AND v.owner_id = auth.uid()
        AND demo_owner_allowed(v.owner_id, v.slug)
    )
  )
$$;

-- ── 4. No billing trial for demo accounts ───────────────────────────────────
-- 138's function, plus the demo_accounts check.
CREATE OR REPLACE FUNCTION start_owner_trial()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- Demo logins never pay; a trial would lock the demo when it ran out.
  IF EXISTS (SELECT 1 FROM demo_accounts WHERE user_id = NEW.owner_id) THEN
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

DELETE FROM billing_accounts
WHERE owner_id IN (SELECT user_id FROM demo_accounts)
  AND stripe_subscription_id IS NULL;

-- ── 5. Demo seed: server (service role) only ────────────────────────────────
DO $$
BEGIN
  IF to_regprocedure('public._seed_demo_data_impl(uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION _seed_demo_data_impl(uuid) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION _seed_demo_data_impl(uuid) TO service_role;
  END IF;
  IF to_regprocedure('public.seed_demo_data(uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION seed_demo_data(uuid) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION seed_demo_data(uuid) TO service_role;
  END IF;
END $$;

RESET lock_timeout;
