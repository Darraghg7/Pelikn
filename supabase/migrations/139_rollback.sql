-- ============================================================================
-- Rollback for 139 — puts the five clock RPCs back exactly as they were.
--
-- ⚠ This REOPENS the hole 139 closed: anyone holding the public anon key can
-- write clock events (payroll records) for any staff member at any venue.
-- Only roll back to unblock a broken clock screen, and re-apply a fixed 139
-- quickly.
--
-- Bodies are copied verbatim from the migrations that last defined them:
--   record_clock_event, add_clock_session  — 106
--   edit_clock_session                     — 033
--   approve_clock_edit_request             — 094
--   acknowledge_clock_alert (7 args)       — 098
--   acknowledge_clock_alert (6 args)       — 088 (139 dropped this overload)
-- The client change in the same PR (offline queue keeps a 42501-refused event)
-- does not need rolling back with this; nothing raises 42501 without 139.
-- ============================================================================

-- ── record_clock_event / add_clock_session (106) ──
CREATE OR REPLACE FUNCTION record_clock_event(
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

CREATE OR REPLACE FUNCTION add_clock_session(
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

-- ── edit_clock_session (033) ──
CREATE OR REPLACE FUNCTION edit_clock_session(
  p_clock_in_id    uuid,
  p_clock_in_time  timestamptz,
  p_clock_out_id   uuid        DEFAULT NULL,  -- pass existing id to update, NULL to insert
  p_clock_out_time timestamptz DEFAULT NULL,  -- NULL = leave no clock_out (active session)
  p_break_minutes  integer     DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id uuid;
  v_venue_id uuid;
  v_break_mid timestamptz;
BEGIN
  -- Verify the clock_in event exists and fetch owner
  SELECT staff_id, venue_id
  INTO   v_staff_id, v_venue_id
  FROM   clock_events
  WHERE  id = p_clock_in_id
    AND  event_type = 'clock_in';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Clock-in event not found: %', p_clock_in_id;
  END IF;

  -- Update the clock_in timestamp
  UPDATE clock_events
  SET    occurred_at = p_clock_in_time
  WHERE  id = p_clock_in_id;

  -- Update or insert the clock_out event
  IF p_clock_out_time IS NOT NULL THEN
    IF p_clock_out_id IS NOT NULL THEN
      UPDATE clock_events
      SET    occurred_at = p_clock_out_time
      WHERE  id = p_clock_out_id;
    ELSE
      INSERT INTO clock_events (staff_id, event_type, venue_id, occurred_at)
      VALUES (v_staff_id, 'clock_out', v_venue_id, p_clock_out_time);
    END IF;
  END IF;

  -- Remove all break events within this session window
  DELETE FROM clock_events
  WHERE  staff_id   = v_staff_id
    AND  venue_id   = v_venue_id
    AND  event_type IN ('break_start', 'break_end')
    AND  occurred_at > p_clock_in_time
    AND  occurred_at < COALESCE(p_clock_out_time,
                                p_clock_in_time + interval '24 hours');

  -- Re-insert a single break block centred in the shift
  IF p_break_minutes > 0 AND p_clock_out_time IS NOT NULL THEN
    v_break_mid := p_clock_in_time
                 + (p_clock_out_time - p_clock_in_time) / 2;

    INSERT INTO clock_events (staff_id, event_type, venue_id, occurred_at)
    VALUES
      (v_staff_id, 'break_start', v_venue_id,
       v_break_mid - (p_break_minutes * interval '1 minute') / 2),
      (v_staff_id, 'break_end',   v_venue_id,
       v_break_mid + (p_break_minutes * interval '1 minute') / 2);
  END IF;
END;
$$;

-- ── approve_clock_edit_request (094) ──
create or replace function approve_clock_edit_request(
  p_request_id  uuid,
  p_reviewer_id uuid
) returns void
language plpgsql security definer as $$
declare
  r           clock_edit_requests%rowtype;
  v_break_mid timestamptz;
begin
  select * into r from clock_edit_requests where id = p_request_id;
  if not found or r.status <> 'pending' then return; end if;

  -- Apply the clock-in event: update the existing one, or insert a brand
  -- new one when there was no prior clock_events row at all.
  if r.clock_in_id is not null then
    update clock_events set occurred_at = r.requested_clock_in
     where id = r.clock_in_id;
  else
    insert into clock_events (staff_id, venue_id, event_type, occurred_at)
    values (r.staff_id, r.venue_id, 'clock_in', r.requested_clock_in);
  end if;

  -- Apply the clock-out event the same way.
  if r.requested_clock_out is not null then
    if r.clock_out_id is not null then
      update clock_events set occurred_at = r.requested_clock_out
       where id = r.clock_out_id;
    else
      insert into clock_events (staff_id, venue_id, event_type, occurred_at)
      values (r.staff_id, r.venue_id, 'clock_out', r.requested_clock_out);
    end if;
  end if;

  -- Replace any break events inside the session window with the approved
  -- break duration (mirrors edit_clock_session's break handling). Safe to
  -- run unconditionally: for a brand-new "missing shift" session there are
  -- no pre-existing break events in the window, so the delete is a no-op.
  delete from clock_events
   where staff_id   = r.staff_id
     and venue_id   = r.venue_id
     and event_type in ('break_start', 'break_end')
     and occurred_at > r.requested_clock_in
     and occurred_at < coalesce(r.requested_clock_out, r.requested_clock_in + interval '24 hours');

  if r.break_minutes > 0 and r.requested_clock_out is not null then
    v_break_mid := r.requested_clock_in
                 + (r.requested_clock_out - r.requested_clock_in) / 2;
    insert into clock_events (staff_id, venue_id, event_type, occurred_at)
    values
      (r.staff_id, r.venue_id, 'break_start',
       v_break_mid - (r.break_minutes * interval '1 minute') / 2),
      (r.staff_id, r.venue_id, 'break_end',
       v_break_mid + (r.break_minutes * interval '1 minute') / 2);
  end if;

  -- Mark approved
  update clock_edit_requests
     set status = 'approved', reviewed_by = p_reviewer_id, reviewed_at = now()
   where id = p_request_id;
end;
$$;

-- ── acknowledge_clock_alert, 7 args (098) ──
CREATE OR REPLACE FUNCTION acknowledge_clock_alert(
  p_clock_event_id  uuid,
  p_alert_reason    text      DEFAULT NULL,
  p_strike_number   int       DEFAULT NULL,
  p_mins_over       int       DEFAULT NULL,
  p_offence_type    text      DEFAULT NULL,
  p_is_disciplinary boolean   DEFAULT false,
  p_manager_id      uuid      DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id  uuid;
  v_venue_id  uuid;
BEGIN
  -- acknowledged_at is left untouched once set, so a later manager sign-off
  -- (acknowledged_by) can't clobber the staff member's original ack time.
  UPDATE clock_events
     SET acknowledged_at = COALESCE(acknowledged_at, now()),
         alert_reason    = COALESCE(p_alert_reason, alert_reason),
         acknowledged_by = COALESCE(p_manager_id, acknowledged_by)
   WHERE id = p_clock_event_id
  RETURNING staff_id, venue_id INTO v_staff_id, v_venue_id;

  IF p_is_disciplinary AND v_staff_id IS NOT NULL THEN
    INSERT INTO staff_disciplinary_log
      (venue_id, staff_id, clock_event_id, offence_type, strike_number, mins_over, alert_reason, occurred_at)
    VALUES
      (v_venue_id, v_staff_id, p_clock_event_id, p_offence_type, p_strike_number, p_mins_over, p_alert_reason, now());
  END IF;
END;
$$;

-- ── acknowledge_clock_alert, 6 args (088) — the overload 139 dropped ──
CREATE OR REPLACE FUNCTION acknowledge_clock_alert(
  p_clock_event_id  uuid,
  p_alert_reason    text      DEFAULT NULL,
  p_strike_number   int       DEFAULT NULL,
  p_mins_over       int       DEFAULT NULL,
  p_offence_type    text      DEFAULT NULL,
  p_is_disciplinary boolean   DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id  uuid;
  v_venue_id  uuid;
BEGIN
  UPDATE clock_events
     SET acknowledged_at = now(),
         alert_reason    = p_alert_reason
   WHERE id = p_clock_event_id
  RETURNING staff_id, venue_id INTO v_staff_id, v_venue_id;

  IF v_staff_id IS NOT NULL THEN
    INSERT INTO staff_disciplinary_log
      (venue_id, staff_id, clock_event_id, offence_type, strike_number, mins_over, alert_reason, occurred_at)
    VALUES
      (v_venue_id, v_staff_id, p_clock_event_id, p_offence_type, p_strike_number, p_mins_over, p_alert_reason, now());
  END IF;
END;
$$;

-- ── Grants back to how they were (PUBLIC + anon could execute) ──
DO $grants$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'record_clock_event(uuid, text, uuid)',
    'add_clock_session(uuid, uuid, timestamptz, timestamptz, integer, timestamptz, timestamptz)',
    'edit_clock_session(uuid, timestamptz, uuid, timestamptz, integer)',
    'approve_clock_edit_request(uuid, uuid)',
    'acknowledge_clock_alert(uuid, text, int, int, text, boolean, uuid)',
    'acknowledge_clock_alert(uuid, text, int, int, text, boolean)'
  ] LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC, anon, authenticated, service_role', f);
  END LOOP;
END
$grants$;

-- ── Helpers added by 139 ──
DROP FUNCTION IF EXISTS assert_clock_access(uuid, uuid, boolean);
DROP FUNCTION IF EXISTS staff_works_at_venue(uuid, uuid);
