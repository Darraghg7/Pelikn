-- Rollback for 155_signup_slug_and_owner_pin.sql.
-- Restores create_venue_with_owner exactly as 023b defined it (PIN required) and
-- drops the three new functions. Venues still flagged owner_pin_pending keep
-- their placeholder PIN: set one first (or have the owner reset it) before
-- rolling back, then clear the flags at the end.

SET lock_timeout = '5s';

BEGIN;

DROP FUNCTION IF EXISTS set_owner_pin(uuid, text);
DROP FUNCTION IF EXISTS owner_pin_pending(uuid);
DROP FUNCTION IF EXISTS suggest_venue_slug(text);

CREATE OR REPLACE FUNCTION create_venue_with_owner(
  p_venue_name   text,
  p_slug         text,
  p_owner_name   text,
  p_owner_pin    text,
  p_owner_email  text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_venue_id uuid;
  v_email    text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_email := COALESCE(NULLIF(p_owner_email, ''), auth.email());

  IF EXISTS (SELECT 1 FROM venues WHERE lower(slug) = lower(p_slug)) THEN
    RAISE EXCEPTION 'Venue slug already taken';
  END IF;

  INSERT INTO venues (name, slug, owner_id)
  VALUES (p_venue_name, p_slug, auth.uid())
  RETURNING id INTO v_venue_id;

  INSERT INTO staff (name, pin_hash, role, job_role, venue_id, is_active)
  VALUES (p_owner_name, crypt(p_owner_pin, gen_salt('bf')), 'owner', 'foh', v_venue_id, true);

  INSERT INTO app_settings (venue_id, key, value) VALUES
    (v_venue_id, 'venue_name', p_venue_name),
    (v_venue_id, 'manager_email', COALESCE(v_email, ''))
  ON CONFLICT (venue_id, key) DO UPDATE SET value = EXCLUDED.value;

  RETURN v_venue_id;
END;
$$;

COMMIT;
