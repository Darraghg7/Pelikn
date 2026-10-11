-- ============================================================================
-- 144: clock events keep the time they were tapped, not the time they arrived
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  APPLY MANUALLY IN SUPABASE SQL EDITOR. Never `supabase db push`.         ║
-- ║  Safe in either order with the client change in the same PR: until this  ║
-- ║  runs, the app retries without the new p_occurred_at argument.           ║
-- ║  ROLLBACK: 144_rollback.sql (same folder).                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- ── What was wrong ──────────────────────────────────────────────────────────
-- record_clock_event stamped every event with now(). A tap the device couldn't
-- deliver straight away (no signal — the offline queue) was stamped with the
-- moment it finally arrived. A break whose start and end were both held on the
-- device and then sent together landed seconds apart: a 29-minute break became
-- a 0-minute one, and every queued clock-in/out moved to the sync time.
--
-- ── What changes ────────────────────────────────────────────────────────────
--   • record_clock_event takes p_occurred_at — when the button was tapped.
--     Missing (older app builds), it is now() as before. A time in the future
--     (device clock ahead) is pulled back to now(). Older than 7 days — the
--     offline queue's own limit — is refused (22023).
--   • clock_events.recorded_at: when the server actually received the event.
--     NULL for rows written before this migration. A punch whose recorded_at
--     is well after its occurred_at was held on a device, so a backdated
--     punch is always visible for what it is.
--   • The 120 s duplicate guard (106) compares against the tap time, so the
--     same tap retried later is still recognised as one event.
--
-- Caller checks are 139's, unchanged (assert_clock_access).
--
-- The old 3-argument function is dropped, not left as an overload: with both
-- present PostgREST can't choose between them for a 3-argument call.
-- ============================================================================

BEGIN;

-- clock_events is written on every punch; don't queue behind a long lock.
SET LOCAL lock_timeout = '5s';

-- Nullable with a default: existing rows stay NULL (their arrival time is
-- unknown) rather than all claiming this migration's timestamp.
ALTER TABLE clock_events ADD COLUMN IF NOT EXISTS recorded_at timestamptz;
ALTER TABLE clock_events ALTER COLUMN recorded_at SET DEFAULT now();

COMMENT ON COLUMN clock_events.recorded_at IS
  'When the server received the event (144). occurred_at is when it was tapped; '
  'a gap means the punch waited in a device''s offline queue. NULL before 144.';

DROP FUNCTION IF EXISTS record_clock_event(uuid, text, uuid);

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
  'Records a clock event for the caller (or, for a manager/owner, anyone at the '
  'venue) at the tap time p_occurred_at (144; now() when omitted, never in the '
  'future, at most 7 days old), ignoring a repeat of the same event type within '
  '120 s of it (106). Refuses callers without a venue JWT with SQLSTATE 42501 (139).';

REVOKE EXECUTE ON FUNCTION record_clock_event(uuid, text, uuid, timestamptz) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION record_clock_event(uuid, text, uuid, timestamptz) TO authenticated, service_role;

COMMIT;

-- Make PostgREST see the new signature now rather than on its next reload.
NOTIFY pgrst, 'reload schema';
