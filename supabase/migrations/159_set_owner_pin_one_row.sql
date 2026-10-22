-- ============================================================================
-- 159: set_owner_pin only sets the signup owner's PIN
--
-- 155's set_owner_pin() updated EVERY staff row with role = 'owner' at the
-- venue. A venue can have several owners, so if another owner was added before
-- the signup owner chose their PIN, both rows got the same PIN and the second
-- owner's own PIN was lost.
--
-- Now it updates only the owner row create_venue_with_owner() made at signup:
-- the earliest-created owner at the venue. Same signature, same grants, same
-- checks (signed-in venue holder, PIN still pending).
--
-- Idempotent. Rollback: 159_rollback.sql
-- ============================================================================

SET lock_timeout = '5s';

BEGIN;

CREATE OR REPLACE FUNCTION set_owner_pin(p_venue_id uuid, p_pin text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_updated int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{4,6}$' THEN
    RAISE EXCEPTION 'PIN must be 4 to 6 digits';
  END IF;
  IF NOT owner_pin_pending(p_venue_id) THEN
    RAISE EXCEPTION 'PIN already set';
  END IF;

  UPDATE staff
  SET pin_hash = crypt(p_pin, gen_salt('bf'))
  WHERE id = (
    SELECT s.id FROM staff s
    WHERE s.venue_id = p_venue_id AND s.role = 'owner'
    ORDER BY s.created_at ASC, s.id ASC
    LIMIT 1
  );
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Owner not found';
  END IF;

  DELETE FROM app_settings WHERE venue_id = p_venue_id AND key = 'owner_pin_pending';
END;
$$;

GRANT EXECUTE ON FUNCTION set_owner_pin(uuid, text) TO authenticated;

COMMIT;

RESET lock_timeout;
