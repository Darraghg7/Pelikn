-- Rollback for 159_set_owner_pin_one_row.sql.
-- Restores set_owner_pin exactly as 155 defined it (updates every owner row).

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
  WHERE venue_id = p_venue_id AND role = 'owner';
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
