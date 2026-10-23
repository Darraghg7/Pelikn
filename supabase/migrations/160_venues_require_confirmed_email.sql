-- ============================================================================
-- 160: A login must have confirmed its email before it can create a venue
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  APPLY MANUALLY IN SUPABASE SQL EDITOR. Idempotent.                      ║
-- ║  Safe to apply before or after "Confirm email" is switched on.           ║
-- ║  ROLLBACK: 160_rollback.sql (same folder).                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Signup now asks for the email to be confirmed before the venue is made
-- (Supabase Auth → Sign In / Providers → Email → "Confirm email" ON). With
-- that setting on, an unconfirmed login never gets a session, so it can't
-- reach create_venue_with_owner at all. This trigger is the second lock: if
-- the setting is ever switched off again, or some other path inserts a venue
-- for a signed-in user, the database still refuses an unconfirmed owner.
--
-- While "Confirm email" is OFF, Supabase marks every new login confirmed the
-- moment it is made, so this changes nothing until the setting goes on.
--
-- Only checks inserts made by a signed-in user (auth.uid() set). The SQL
-- editor, the service role and the demo seed have no auth.uid() and pass.
-- Existing venues are untouched: it fires on INSERT only.
-- ============================================================================

SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION venues_require_confirmed_owner()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Please confirm your email address before creating a venue'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION venues_require_confirmed_owner() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS venues_require_confirmed_owner ON venues;
CREATE TRIGGER venues_require_confirmed_owner
  BEFORE INSERT ON venues
  FOR EACH ROW EXECUTE FUNCTION venues_require_confirmed_owner();

RESET lock_timeout;
