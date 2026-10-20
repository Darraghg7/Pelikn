-- Rollback for 157_clock_location_and_device_rules.sql.
-- Restores 144's record_clock_event (no position / tablet arguments) and
-- removes the rules table and its functions. Any saved rules are lost.

BEGIN;

SET LOCAL lock_timeout = '5s';

DROP FUNCTION IF EXISTS record_clock_event(uuid, text, uuid, timestamptz, double precision, double precision, double precision, text);

CREATE FUNCTION record_clock_event(
  p_staff_id    uuid,
  p_event_type  text,
  p_venue_id    uuid        DEFAULT NULL,
  p_occurred_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  DEDUPE_WINDOW CONSTANT interval := interval '120 seconds';
  MAX_AGE       CONSTANT interval := interval '7 days';
  v_venue_id    uuid;
  v_at          timestamptz;
  v_existing_id uuid;
  v_new_id      uuid;
BEGIN
  IF p_venue_id IS NOT NULL THEN
    v_venue_id := p_venue_id;
  ELSE
    SELECT venue_id INTO v_venue_id FROM staff WHERE id = p_staff_id;
  END IF;

  -- Before anything else, so a refused caller learns nothing (139).
  PERFORM assert_clock_access(p_staff_id, v_venue_id, true);

  v_at := LEAST(COALESCE(p_occurred_at, now()), now());
  IF v_at < now() - MAX_AGE THEN
    RAISE EXCEPTION 'Clock event is more than 7 days old'
      USING ERRCODE = '22023';
  END IF;

  -- Already recorded this exact event around this tap — a retry of a request
  -- that succeeded. Hand back the row we already have.
  SELECT id INTO v_existing_id
  FROM clock_events
  WHERE staff_id    = p_staff_id
    AND event_type  = p_event_type
    AND occurred_at BETWEEN v_at - DEDUPE_WINDOW AND v_at + DEDUPE_WINDOW
    AND (v_venue_id IS NULL OR venue_id = v_venue_id)
  ORDER BY occurred_at DESC
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  INSERT INTO clock_events (staff_id, event_type, venue_id, occurred_at, recorded_at)
  VALUES (p_staff_id, p_event_type, v_venue_id, v_at, now())
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

COMMENT ON FUNCTION record_clock_event(uuid, text, uuid, timestamptz) IS
  'Records a clock event at the tap time (144), ignoring a repeat of the same '
  'event type within 120 s (106). Refuses callers without a venue JWT with 42501 (139).';

REVOKE EXECUTE ON FUNCTION record_clock_event(uuid, text, uuid, timestamptz) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION record_clock_event(uuid, text, uuid, timestamptz) TO authenticated, service_role;

DROP FUNCTION IF EXISTS assert_clock_rules(uuid, uuid, text, double precision, double precision, double precision, text);
DROP FUNCTION IF EXISTS clear_clock_device(uuid);
DROP FUNCTION IF EXISTS set_clock_device_rule(uuid, boolean);
DROP FUNCTION IF EXISTS register_clock_device(uuid, text);
DROP FUNCTION IF EXISTS set_clock_location_rule(uuid, boolean, double precision, double precision, integer);
DROP FUNCTION IF EXISTS get_clock_rules(uuid);
DROP TABLE IF EXISTS venue_clock_rules;

COMMIT;

NOTIFY pgrst, 'reload schema';
