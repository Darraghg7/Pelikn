-- ============================================================================
-- 106: Stop a retried write from creating duplicate clock events, and let a
--      manually-added session keep the break times the manager actually typed.
--
-- ── Why (the Nomad "her hours weren't recorded" report) ─────────────────────
-- `makeRetryFetch` in src/lib/supabase.js aborts any request after 20 s and
-- retries writes twice (1 s, 2 s back-off). An RPC POST is a write, so on a
-- slow mobile connection a clock-in that the server *did* process but whose
-- response didn't arrive in time is sent again — up to three times. Nothing in
-- record_clock_event stopped that: it was an unconditional INSERT, so each
-- attempt that reached the database added another `clock_in` row.
--
-- One extra clock_in poisons the timesheet in a way that looks like the hours
-- were never recorded at all. Timesheet grouping starts a new session at every
-- clock_in and attaches the clock_out to the most recent one, so the duplicate
-- leaves an earlier session permanently open. The day then renders as "Off"
-- with an "Add" button — and pressing Add inserts a *third* clock_in, which
-- lands in front of the same dangling row, so the manually-added hours don't
-- show up either. Both reported symptoms, one root cause.
--
-- ── The guard ───────────────────────────────────────────────────────────────
-- Suppress an event that repeats the same (staff_id, event_type) within
-- DEDUPE_WINDOW. The whole retry chain is bounded at ~63 s (20 + 1 + 20 + 2 +
-- 20), so 120 s covers it with margin, while staying far short of any
-- legitimate repeat: nobody clocks in twice inside two minutes and means it,
-- and a genuine second shift the same day is hours away.
--
-- Deliberately a narrow time window rather than a full clocked-in/clocked-out
-- state machine. A state machine would also have to decide what to do about a
-- staff member who forgot to clock out last night — and the safe answers there
-- ("refuse today's clock-in" or "fabricate a clock-out") are both worse than
-- the problem. This kills the retry duplicates and touches nothing else.
--
-- Returns the clock_events id — the new row, or the existing one when the call
-- was suppressed — so a caller can tell the two apart if it ever needs to.
-- The old signature returned void; RETURNS is not replaceable in place, hence
-- the DROP. Callers (ClockPanel.jsx, MobileManagerDashboard.jsx) ignore the
-- result, so widening it is backward compatible.
-- ============================================================================

DROP FUNCTION IF EXISTS record_clock_event(uuid, text, uuid);

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

COMMENT ON FUNCTION record_clock_event(uuid, text, uuid) IS
  'Records a clock event, ignoring a repeat of the same event type within 120 s '
  'so that an aborted-and-retried write cannot create a duplicate punch (106). '
  'Returns the clock_events id — existing row if the call was suppressed.';


-- ============================================================================
-- add_clock_session: keep the manager's actual break times
--
-- The old version took p_break_minutes and synthesised a break centred in the
-- shift. AddSessionModal asks the manager for a break *start and end*, which is
-- why it was inserting into clock_events directly instead of calling this —
-- bypassing the SECURITY DEFINER path 038 created it for. Accept the real times
-- so that surface can route through the RPC like every other write.
--
-- p_break_start/p_break_end are optional and take precedence over
-- p_break_minutes; the centred-break behaviour is unchanged when they are NULL,
-- so RecentShifts.jsx's existing call keeps working untouched.
--
-- Added parameters mean a new signature, so the old one must be dropped rather
-- than replaced — leaving both would make every 5-argument call ambiguous
-- against the new defaults, which is exactly the trap the superseded 102
-- get_dashboard_snapshot draft fell into (see 105).
-- ============================================================================

DROP FUNCTION IF EXISTS add_clock_session(uuid, uuid, timestamptz, timestamptz, integer);

CREATE FUNCTION add_clock_session(
  p_staff_id       uuid,
  p_venue_id       uuid,
  p_clock_in_time  timestamptz,
  p_clock_out_time timestamptz DEFAULT NULL,
  p_break_minutes  integer     DEFAULT 0,
  p_break_start    timestamptz DEFAULT NULL,
  p_break_end      timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clock_in_id uuid;
  v_break_mid   timestamptz;
BEGIN
  IF p_clock_out_time IS NOT NULL AND p_clock_out_time <= p_clock_in_time THEN
    RAISE EXCEPTION 'Clock out must be after clock in';
  END IF;

  INSERT INTO clock_events (staff_id, venue_id, event_type, occurred_at)
  VALUES (p_staff_id, p_venue_id, 'clock_in', p_clock_in_time)
  RETURNING id INTO v_clock_in_id;

  IF p_clock_out_time IS NOT NULL THEN
    INSERT INTO clock_events (staff_id, venue_id, event_type, occurred_at)
    VALUES (p_staff_id, p_venue_id, 'clock_out', p_clock_out_time);
  END IF;

  IF p_break_start IS NOT NULL AND p_break_end IS NOT NULL THEN
    -- Explicit break times from the manager. Must sit inside the shift, or the
    -- timesheet would subtract break minutes that were never part of it.
    IF p_break_start <= p_clock_in_time
       OR p_break_end <= p_break_start
       OR (p_clock_out_time IS NOT NULL AND p_break_end >= p_clock_out_time) THEN
      RAISE EXCEPTION 'Break times must fall within the shift';
    END IF;
    INSERT INTO clock_events (staff_id, venue_id, event_type, occurred_at)
    VALUES (p_staff_id, p_venue_id, 'break_start', p_break_start),
           (p_staff_id, p_venue_id, 'break_end',   p_break_end);

  ELSIF p_break_minutes > 0 AND p_clock_out_time IS NOT NULL THEN
    -- No specific times given — centre a break of the requested length.
    v_break_mid := p_clock_in_time
                 + (p_clock_out_time - p_clock_in_time) / 2;
    INSERT INTO clock_events (staff_id, venue_id, event_type, occurred_at)
    VALUES
      (p_staff_id, p_venue_id, 'break_start',
       v_break_mid - (p_break_minutes * interval '1 minute') / 2),
      (p_staff_id, p_venue_id, 'break_end',
       v_break_mid + (p_break_minutes * interval '1 minute') / 2);
  END IF;

  RETURN v_clock_in_id;
END;
$$;

COMMENT ON FUNCTION add_clock_session(uuid, uuid, timestamptz, timestamptz, integer, timestamptz, timestamptz) IS
  'Adds a missed-punch clock session server-side. Accepts explicit break start/end '
  '(preferred) or a break length to centre in the shift (106).';
