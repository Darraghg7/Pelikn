-- ============================================================================
-- Rollback for 144 — record_clock_event goes back to 139's 3-argument version
-- (server time on every event, guard unchanged) and recorded_at is dropped.
--
-- The app keeps working: it retries a call without p_occurred_at when the
-- function doesn't accept it. Queued punches then land at their sync time
-- again — the bug 144 fixed.
-- ============================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';

DROP FUNCTION IF EXISTS record_clock_event(uuid, text, uuid, timestamptz);

CREATE FUNCTION record_clock_event(
  p_staff_id   uuid,
  p_event_type text,
  p_venue_id   uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  DEDUPE_WINDOW CONSTANT interval := interval '120 seconds';
  v_venue_id    uuid;
  v_existing_id uuid;
  v_new_id      uuid;
BEGIN
  IF p_venue_id IS NOT NULL THEN
    v_venue_id := p_venue_id;
  ELSE
    SELECT venue_id INTO v_venue_id FROM staff WHERE id = p_staff_id;
  END IF;

  -- Before the dedupe lookup, so a refused caller can't probe for recent
  -- events by watching which ids come back.
  PERFORM assert_clock_access(p_staff_id, v_venue_id, true);

  -- Already recorded this exact event moments ago — almost certainly a retry
  -- of a request that succeeded. Hand back the row we already have.
  SELECT id INTO v_existing_id
  FROM clock_events
  WHERE staff_id    = p_staff_id
    AND event_type  = p_event_type
    AND occurred_at > now() - DEDUPE_WINDOW
    AND (v_venue_id IS NULL OR venue_id = v_venue_id)
  ORDER BY occurred_at DESC
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  INSERT INTO clock_events (staff_id, event_type, venue_id)
  VALUES (p_staff_id, p_event_type, v_venue_id)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION record_clock_event(uuid, text, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION record_clock_event(uuid, text, uuid) TO authenticated, service_role;

ALTER TABLE clock_events DROP COLUMN IF EXISTS recorded_at;

COMMIT;

NOTIFY pgrst, 'reload schema';
