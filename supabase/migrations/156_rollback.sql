-- Rollback for 156_signup_functions_cleanup.sql.
-- Brings back the old 4-argument create_venue_with_owner (as 017 defined it)
-- and the default execute rights on the two PIN functions.

SET lock_timeout = '5s';

BEGIN;

CREATE FUNCTION create_venue_with_owner(
  p_venue_name text,
  p_slug       text,
  p_owner_name text,
  p_owner_pin  text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_venue_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

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
    (v_venue_id, 'manager_email', '');

  RETURN v_venue_id;
END;
$$;

GRANT EXECUTE ON FUNCTION owner_pin_pending(uuid)   TO PUBLIC;
GRANT EXECUTE ON FUNCTION set_owner_pin(uuid, text) TO PUBLIC;

COMMIT;
