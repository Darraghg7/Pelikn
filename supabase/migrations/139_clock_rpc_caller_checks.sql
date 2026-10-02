-- ============================================================================
-- 139: Clock RPCs check who is calling — closes an anonymous payroll write
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  APPLY MANUALLY IN SUPABASE SQL EDITOR.                                   ║
-- ║  Prereqs: 091 (current_venue_id / has_venue_access), 085                 ║
-- ║  (is_venue_hr_manager), 106 (record_clock_event / add_clock_session).    ║
-- ║  Safe in either order with the client change in the same PR — that only ║
-- ║  stops the offline queue throwing away a refused clock event.            ║
-- ║  ROLLBACK: 139_rollback.sql (restores the 033/088/094/098/106 bodies).   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- ── What was wrong ──────────────────────────────────────────────────────────
-- Five SECURITY DEFINER clock functions trusted their arguments completely:
--
--   record_clock_event          clock anyone in/out/on break
--   add_clock_session           add a whole shift for anyone
--   edit_clock_session          rewrite any shift's times (by event id)
--   approve_clock_edit_request  apply any pending request
--   acknowledge_clock_alert     sign off a late clock-in, as any "manager"
--
-- SECURITY DEFINER bypasses the venue-scoped RLS on clock_events (091), and
-- none of them looked at the caller. Probed on 2 Oct 2026: a POST to
-- /rest/v1/rpc/record_clock_event with only the public anon key and a made-up
-- staff id reached the INSERT and failed on the staff_id foreign key (23503).
-- With a real staff id it would have written a payroll punch. Staff ids are
-- not secret — they appear in rota links, URLs and every shared device's
-- localStorage.
--
-- ── The rule ────────────────────────────────────────────────────────────────
-- Same model as every other venue write since 091/085, not a new one:
--
--   1. The caller holds a venue JWT for the venue being written
--      (has_venue_access: pin-login's venue_id claim, or Supabase-Auth owner).
--   2. A PIN caller whose staff row has since been deactivated is refused.
--      The JWT lives 30 days; the job may not.
--   3. The staff member being written works at that venue — home venue or a
--      staff_venue_links row (the same closed set 114 uses for reads).
--   4. Per function:
--        record_clock_event      — the staff member themself, or a manager /
--                                  owner at the venue (is_venue_hr_manager).
--        acknowledge_clock_alert — same as above.
--        add / edit_clock_session — anyone at the venue. The Timesheet screen
--                                  lets staff holding the `view_timesheet`
--                                  permission edit hours, so restricting these
--                                  to managers would break a live screen. The
--                                  venue boundary is the hole being closed.
--        approve_clock_edit_request — managers / owners only.
--
-- Why "self or manager" for punches rather than "anyone at the venue": every
-- clock card in the app (ClockPanel, the mobile dashboard card, ClockInPage)
-- punches the signed-in person's own staff id, and a manager on a shared
-- device is still allowed to punch for someone else. What it refuses is one
-- staff member clocking a colleague in — the classic buddy-punch.
--
-- Honest limit: clock_events itself is still writable by anyone at the venue
-- through the table API (091's has_venue_access policy), so rule 4 is
-- defence-in-depth until that table policy is tightened too. Rules 1–3 — the
-- anonymous / cross-venue hole — are fully closed here.
--
-- Refusals RAISE with SQLSTATE 42501 (insufficient_privilege), so the client's
-- offline queue can tell "not allowed right now" from "bad data" and keep the
-- event instead of dropping it (src/lib/offlineSupabase.js).
--
-- Finally EXECUTE is revoked from anon (and PUBLIC, which Postgres grants by
-- default). Every legitimate caller sends the venue JWT, whose role claim is
-- 'authenticated'.
-- ============================================================================


-- ── Helpers ──────────────────────────────────────────────────────────────────

-- Does this staff member work at this venue (home venue or linked)?
CREATE OR REPLACE FUNCTION staff_works_at_venue(p_staff_id uuid, p_venue_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    p_staff_id IS NOT NULL AND p_venue_id IS NOT NULL AND (
      EXISTS (SELECT 1 FROM staff s
              WHERE s.id = p_staff_id AND s.venue_id = p_venue_id)
      OR EXISTS (SELECT 1 FROM staff_venue_links l
                 WHERE l.staff_id = p_staff_id AND l.venue_id = p_venue_id)
    ),
    false)
$$;

-- Raise unless the caller may write clock data for p_staff_id at p_venue_id.
-- p_self_or_manager adds rule 4's "the staff member themself, or a manager".
CREATE OR REPLACE FUNCTION assert_clock_access(
  p_staff_id        uuid,
  p_venue_id        uuid,
  p_self_or_manager boolean
)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT COALESCE(has_venue_access(p_venue_id), false) THEN
    RAISE EXCEPTION 'Not signed in to this venue'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM staff s WHERE s.id = auth.uid() AND s.is_active = false) THEN
    RAISE EXCEPTION 'This account has been deactivated'
      USING ERRCODE = '42501';
  END IF;

  IF NOT staff_works_at_venue(p_staff_id, p_venue_id) THEN
    RAISE EXCEPTION 'Staff member does not work at this venue'
      USING ERRCODE = '42501';
  END IF;

  IF p_self_or_manager
     AND auth.uid() IS DISTINCT FROM p_staff_id
     AND NOT is_venue_hr_manager(p_venue_id) THEN
    RAISE EXCEPTION 'Only this staff member or a manager can do that'
      USING ERRCODE = '42501';
  END IF;
END;
$$;


-- ── record_clock_event ───────────────────────────────────────────────────────
-- 106's body unchanged apart from the guard: same signature, same uuid return,
-- same 120 s dedupe. CREATE OR REPLACE keeps the function's identity.
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

COMMENT ON FUNCTION record_clock_event(uuid, text, uuid) IS
  'Records a clock event for the caller (or, for a manager/owner, anyone at the '
  'venue), ignoring a repeat of the same event type within 120 s (106). '
  'Refuses callers without a venue JWT with SQLSTATE 42501 (139).';


-- ── add_clock_session ────────────────────────────────────────────────────────
-- 106's body plus the guard.
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
  PERFORM assert_clock_access(p_staff_id, p_venue_id, false);

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
    IF p_break_start <= p_clock_in_time
       OR p_break_end <= p_break_start
       OR (p_clock_out_time IS NOT NULL AND p_break_end >= p_clock_out_time) THEN
      RAISE EXCEPTION 'Break times must fall within the shift';
    END IF;
    INSERT INTO clock_events (staff_id, venue_id, event_type, occurred_at)
    VALUES (p_staff_id, p_venue_id, 'break_start', p_break_start),
           (p_staff_id, p_venue_id, 'break_end',   p_break_end);

  ELSIF p_break_minutes > 0 AND p_clock_out_time IS NOT NULL THEN
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


-- ── edit_clock_session ───────────────────────────────────────────────────────
-- 033's body plus the guard. Also: the clock-out UPDATE matched on id alone,
-- so a caller could pass any clock_events id — another person's, another
-- venue's — and rewrite it. It is now pinned to the same staff member and
-- venue as the clock-in, and RAISES rather than silently matching nothing.
CREATE OR REPLACE FUNCTION edit_clock_session(
  p_clock_in_id    uuid,
  p_clock_in_time  timestamptz,
  p_clock_out_id   uuid        DEFAULT NULL,
  p_clock_out_time timestamptz DEFAULT NULL,
  p_break_minutes  integer     DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id  uuid;
  v_venue_id  uuid;
  v_break_mid timestamptz;
BEGIN
  SELECT staff_id, venue_id
  INTO   v_staff_id, v_venue_id
  FROM   clock_events
  WHERE  id = p_clock_in_id
    AND  event_type = 'clock_in';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Clock-in event not found: %', p_clock_in_id;
  END IF;

  PERFORM assert_clock_access(v_staff_id, v_venue_id, false);

  UPDATE clock_events
  SET    occurred_at = p_clock_in_time
  WHERE  id = p_clock_in_id;

  IF p_clock_out_time IS NOT NULL THEN
    IF p_clock_out_id IS NOT NULL THEN
      UPDATE clock_events
      SET    occurred_at = p_clock_out_time
      WHERE  id         = p_clock_out_id
        AND  staff_id   = v_staff_id
        AND  venue_id   = v_venue_id
        AND  event_type = 'clock_out';
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Clock-out event not found for this session: %', p_clock_out_id;
      END IF;
    ELSE
      INSERT INTO clock_events (staff_id, event_type, venue_id, occurred_at)
      VALUES (v_staff_id, 'clock_out', v_venue_id, p_clock_out_time);
    END IF;
  END IF;

  DELETE FROM clock_events
  WHERE  staff_id   = v_staff_id
    AND  venue_id   = v_venue_id
    AND  event_type IN ('break_start', 'break_end')
    AND  occurred_at > p_clock_in_time
    AND  occurred_at < COALESCE(p_clock_out_time,
                                p_clock_in_time + interval '24 hours');

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


-- ── approve_clock_edit_request ───────────────────────────────────────────────
-- 094's body plus: managers/owners of the request's venue only. The request
-- row itself comes from submit_clock_edit_request, which is still unguarded
-- (see the PR), so its clock_in_id / clock_out_id are not trusted either —
-- the UPDATEs are pinned to the request's own staff member and venue.
CREATE OR REPLACE FUNCTION approve_clock_edit_request(
  p_request_id  uuid,
  p_reviewer_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r           clock_edit_requests%rowtype;
  v_break_mid timestamptz;
BEGIN
  SELECT * INTO r FROM clock_edit_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF NOT is_venue_hr_manager(r.venue_id) THEN
    RAISE EXCEPTION 'Only a manager can approve clock changes'
      USING ERRCODE = '42501';
  END IF;
  PERFORM assert_clock_access(r.staff_id, r.venue_id, false);

  IF r.status <> 'pending' THEN RETURN; END IF;

  IF r.clock_in_id IS NOT NULL THEN
    UPDATE clock_events SET occurred_at = r.requested_clock_in
     WHERE id = r.clock_in_id
       AND staff_id = r.staff_id AND venue_id = r.venue_id;
  ELSE
    INSERT INTO clock_events (staff_id, venue_id, event_type, occurred_at)
    VALUES (r.staff_id, r.venue_id, 'clock_in', r.requested_clock_in);
  END IF;

  IF r.requested_clock_out IS NOT NULL THEN
    IF r.clock_out_id IS NOT NULL THEN
      UPDATE clock_events SET occurred_at = r.requested_clock_out
       WHERE id = r.clock_out_id
         AND staff_id = r.staff_id AND venue_id = r.venue_id;
    ELSE
      INSERT INTO clock_events (staff_id, venue_id, event_type, occurred_at)
      VALUES (r.staff_id, r.venue_id, 'clock_out', r.requested_clock_out);
    END IF;
  END IF;

  DELETE FROM clock_events
   WHERE staff_id   = r.staff_id
     AND venue_id   = r.venue_id
     AND event_type IN ('break_start', 'break_end')
     AND occurred_at > r.requested_clock_in
     AND occurred_at < COALESCE(r.requested_clock_out, r.requested_clock_in + interval '24 hours');

  IF r.break_minutes > 0 AND r.requested_clock_out IS NOT NULL THEN
    v_break_mid := r.requested_clock_in
                 + (r.requested_clock_out - r.requested_clock_in) / 2;
    INSERT INTO clock_events (staff_id, venue_id, event_type, occurred_at)
    VALUES
      (r.staff_id, r.venue_id, 'break_start',
       v_break_mid - (r.break_minutes * interval '1 minute') / 2),
      (r.staff_id, r.venue_id, 'break_end',
       v_break_mid + (r.break_minutes * interval '1 minute') / 2);
  END IF;

  UPDATE clock_edit_requests
     SET status = 'approved', reviewed_by = p_reviewer_id, reviewed_at = now()
   WHERE id = p_request_id;
END;
$$;


-- ── acknowledge_clock_alert ──────────────────────────────────────────────────
-- 098's body plus the guard. Callers: the staff member's own late/overrun
-- modal (useClockAlerts — may pass a manager id after the kiosk "hand to
-- manager" PIN check), and the manager's Attendance-today page. p_manager_id
-- must now name an active manager/owner who works at that venue; it cannot
-- be proven to be the person who typed the PIN, but it can no longer be an
-- arbitrary id.
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
  SELECT staff_id, venue_id INTO v_staff_id, v_venue_id
  FROM clock_events WHERE id = p_clock_event_id;
  IF NOT FOUND THEN RETURN; END IF;   -- 098 updated zero rows here, silently

  PERFORM assert_clock_access(v_staff_id, v_venue_id, true);

  IF p_manager_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM staff m
    WHERE m.id = p_manager_id
      AND m.role IN ('manager', 'owner')
      AND m.is_active = true
      AND staff_works_at_venue(m.id, v_venue_id)
  ) THEN
    RAISE EXCEPTION 'Signing manager is not a manager at this venue'
      USING ERRCODE = '42501';
  END IF;

  UPDATE clock_events
     SET acknowledged_at = COALESCE(acknowledged_at, now()),
         alert_reason    = COALESCE(p_alert_reason, alert_reason),
         acknowledged_by = COALESCE(p_manager_id, acknowledged_by)
   WHERE id = p_clock_event_id;

  IF p_is_disciplinary THEN
    INSERT INTO staff_disciplinary_log
      (venue_id, staff_id, clock_event_id, offence_type, strike_number, mins_over, alert_reason, occurred_at)
    VALUES
      (v_venue_id, v_staff_id, p_clock_event_id, p_offence_type, p_strike_number, p_mins_over, p_alert_reason, now());
  END IF;
END;
$$;


-- ── Stale overloads ──────────────────────────────────────────────────────────
-- 098 added p_manager_id with CREATE OR REPLACE, which made a SECOND function
-- rather than replacing 081/088's six-argument one. Production still has both
-- (probed 2 Oct 2026: a six-argument call returns PGRST203 "could not choose
-- the best candidate"). The old one is unguarded and reachable by anyone who
-- adds or omits a parameter, so it goes. Every app call passes p_manager_id
-- and so already resolves to the seven-argument version.
DROP FUNCTION IF EXISTS acknowledge_clock_alert(uuid, text, int, int, text, boolean);

-- 001's original two-argument version. Not present on production as of the
-- same probe (a two-argument call resolved to the three-argument function),
-- dropped defensively in case any other database still has it.
DROP FUNCTION IF EXISTS record_clock_event(uuid, text);


-- ── No anonymous EXECUTE ─────────────────────────────────────────────────────
-- Postgres grants EXECUTE to PUBLIC by default and Supabase adds anon on top,
-- so both must go. The guard above already refuses anon; this makes PostgREST
-- refuse before the function body runs at all.
DO $grants$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'staff_works_at_venue(uuid, uuid)',
    'assert_clock_access(uuid, uuid, boolean)',
    'record_clock_event(uuid, text, uuid)',
    'add_clock_session(uuid, uuid, timestamptz, timestamptz, integer, timestamptz, timestamptz)',
    'edit_clock_session(uuid, timestamptz, uuid, timestamptz, integer)',
    'approve_clock_edit_request(uuid, uuid)',
    'acknowledge_clock_alert(uuid, text, int, int, text, boolean, uuid)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END
$grants$;
