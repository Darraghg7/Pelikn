-- ─────────────────────────────────────────────────────────────────────────────
-- 152_staff_leaving.sql
-- Staff leaving: last working day, reason, a short checklist, and switching
-- their account off once they have gone.
-- ROLLBACK: 152_rollback.sql (same folder).
-- REQUIRES: 085 (is_venue_hr_manager), 091 (time_off_requests.venue_id),
--           pg_cron (047). Safe to run more than once.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- One row per person who is leaving (or has left). Managers and owners only:
-- the reason ("dismissed") and note are HR information, so the person
-- themselves and their colleagues can't read it either.
--
--   mark_staff_leaving(staff, last_day, reason, note)
--       Records or changes the leaving date. Rota shifts after the last day
--       are removed straight away — they can't be worked. Returns how many.
--
--   finish_staff_leaving(staff)
--       "Switch their account off now": staff.is_active = false, every
--       signed-in device's session deleted, shifts after the last day removed,
--       pending or approved time off after the last day cancelled. Records
--       (clock-ins, timesheets, past shifts, training, HR) are all kept.
--
--   finish_due_staff_leaving()
--       Run by pg_cron every night: does the same for anyone whose last day
--       is before today (UK time). Not callable from the app.
--
-- The checklist (payroll told, keys and uniform back) is a jsonb of ticks the
-- app updates directly; RLS keeps that to managers. Cancelling a leaver who
-- hasn't gone yet deletes their row.
--
-- Note: deleting staff_sessions stops the person's session token working
-- straight away. Their device's venue JWT also stops working once 146 is
-- re-applied; until then it lapses on its own (30 days) — but every RPC that
-- checks staff.is_active (session_actor, is_venue_hr_manager, clock-ins,
-- sign-in) already refuses them as soon as they are deactivated.

SET lock_timeout = '5s';

BEGIN;

CREATE TABLE IF NOT EXISTS staff_leaving (
  staff_id     uuid        PRIMARY KEY REFERENCES staff(id)  ON DELETE CASCADE,
  venue_id     uuid        NOT NULL    REFERENCES venues(id) ON DELETE CASCADE,
  last_day     date        NOT NULL,
  reason       text        CHECK (reason IN ('resigned', 'end_of_contract', 'dismissed', 'redundancy', 'retired', 'other')),
  note         text        CHECK (char_length(note) <= 2000),
  checklist    jsonb       NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(checklist) = 'object'),
  created_by   uuid        REFERENCES staff(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz
);

CREATE INDEX IF NOT EXISTS staff_leaving_venue ON staff_leaving (venue_id);
CREATE INDEX IF NOT EXISTS staff_leaving_due   ON staff_leaving (last_day) WHERE finished_at IS NULL;

ALTER TABLE staff_leaving ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE, DELETE ON staff_leaving TO anon, authenticated;
-- Inserts go through mark_staff_leaving (it also clears the rota).
REVOKE INSERT ON staff_leaving FROM anon, authenticated;

DROP POLICY IF EXISTS staff_leaving_manager_select ON staff_leaving;
CREATE POLICY staff_leaving_manager_select ON staff_leaving
  FOR SELECT USING (is_venue_hr_manager(venue_id));

-- Ticking the checklist. The row can't be moved to another person or venue,
-- and the dates are changed through mark_staff_leaving, not here.
DROP POLICY IF EXISTS staff_leaving_manager_update ON staff_leaving;
CREATE POLICY staff_leaving_manager_update ON staff_leaving
  FOR UPDATE USING (is_venue_hr_manager(venue_id))
  WITH CHECK (is_venue_hr_manager(venue_id));

-- Cancelling: only while they haven't gone. Once finished the row is the
-- record of their leaving and stays.
DROP POLICY IF EXISTS staff_leaving_manager_delete ON staff_leaving;
CREATE POLICY staff_leaving_manager_delete ON staff_leaving
  FOR DELETE USING (is_venue_hr_manager(venue_id) AND finished_at IS NULL);

-- Only the checklist (and updated_at) may change through the API.
CREATE OR REPLACE FUNCTION staff_leaving_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated')
     AND (NEW.staff_id    IS DISTINCT FROM OLD.staff_id
       OR NEW.venue_id    IS DISTINCT FROM OLD.venue_id
       OR NEW.last_day    IS DISTINCT FROM OLD.last_day
       OR NEW.reason      IS DISTINCT FROM OLD.reason
       OR NEW.note        IS DISTINCT FROM OLD.note
       OR NEW.created_by  IS DISTINCT FROM OLD.created_by
       OR NEW.created_at  IS DISTINCT FROM OLD.created_at
       OR NEW.finished_at IS DISTINCT FROM OLD.finished_at) THEN
    RAISE EXCEPTION 'Use "Change leaving date" to change that'
      USING ERRCODE = '42501';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS staff_leaving_guard ON staff_leaving;
CREATE TRIGGER staff_leaving_guard
  BEFORE UPDATE ON staff_leaving
  FOR EACH ROW EXECUTE FUNCTION staff_leaving_guard();

-- ── Shared steps (not callable from the app) ─────────────────────────────────

-- Rota shifts after the last day, at any venue.
CREATE OR REPLACE FUNCTION staff_leaving_clear_rota(p_staff uuid, p_last_day date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_n integer;
BEGIN
  DELETE FROM shifts WHERE staff_id = p_staff AND shift_date > p_last_day;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

CREATE OR REPLACE FUNCTION staff_leaving_finish(p_staff uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_last date;
BEGIN
  SELECT last_day INTO v_last FROM staff_leaving WHERE staff_id = p_staff FOR UPDATE;
  IF v_last IS NULL THEN
    RETURN;
  END IF;

  UPDATE staff SET is_active = false WHERE id = p_staff;
  DELETE FROM staff_sessions WHERE staff_id = p_staff;
  PERFORM staff_leaving_clear_rota(p_staff, v_last);

  UPDATE time_off_requests
     SET status = 'cancelled', cancelled_at = now()
   WHERE staff_id = p_staff
     AND status IN ('pending', 'approved')
     AND start_date > v_last;

  UPDATE staff_leaving SET finished_at = now(), updated_at = now()
   WHERE staff_id = p_staff AND finished_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION staff_leaving_clear_rota(uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION staff_leaving_finish(uuid)           FROM PUBLIC, anon, authenticated;

-- ── What the app calls ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION mark_staff_leaving(
  p_staff_id uuid,
  p_last_day date,
  p_reason   text DEFAULT NULL,
  p_note     text DEFAULT NULL
) RETURNS integer
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_venue   uuid;
  v_active  boolean;
  v_creator uuid;
BEGIN
  SELECT venue_id, is_active INTO v_venue, v_active FROM staff WHERE id = p_staff_id;
  IF v_venue IS NULL OR NOT is_venue_hr_manager(v_venue) THEN
    RAISE EXCEPTION 'Only a manager can do that' USING ERRCODE = '42501';
  END IF;
  IF NOT v_active THEN
    RAISE EXCEPTION 'They have already left — reactivate them first if they are coming back'
      USING ERRCODE = '22023';
  END IF;
  IF p_last_day IS NULL THEN
    RAISE EXCEPTION 'Choose their last working day' USING ERRCODE = '22023';
  END IF;

  -- created_by is a staff id; an owner signed in by email has none.
  SELECT id INTO v_creator FROM staff WHERE id = auth.uid();

  INSERT INTO staff_leaving (staff_id, venue_id, last_day, reason, note, created_by)
  VALUES (p_staff_id, v_venue, p_last_day, NULLIF(p_reason, ''), NULLIF(btrim(p_note), ''), v_creator)
  ON CONFLICT (staff_id) DO UPDATE
    SET last_day    = EXCLUDED.last_day,
        reason      = EXCLUDED.reason,
        note        = EXCLUDED.note,
        venue_id    = EXCLUDED.venue_id,
        -- A finished row being re-used means they came back and are leaving
        -- again: start the checklist afresh.
        checklist   = CASE WHEN staff_leaving.finished_at IS NULL THEN staff_leaving.checklist ELSE '{}'::jsonb END,
        created_by  = CASE WHEN staff_leaving.finished_at IS NULL THEN staff_leaving.created_by ELSE EXCLUDED.created_by END,
        created_at  = CASE WHEN staff_leaving.finished_at IS NULL THEN staff_leaving.created_at ELSE now() END,
        finished_at = NULL,
        updated_at  = now();

  RETURN staff_leaving_clear_rota(p_staff_id, p_last_day);
END;
$$;

CREATE OR REPLACE FUNCTION finish_staff_leaving(p_staff_id uuid)
RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_venue uuid;
BEGIN
  SELECT venue_id INTO v_venue FROM staff_leaving WHERE staff_id = p_staff_id;
  IF v_venue IS NULL OR NOT is_venue_hr_manager(v_venue) THEN
    RAISE EXCEPTION 'Only a manager can do that' USING ERRCODE = '42501';
  END IF;
  PERFORM staff_leaving_finish(p_staff_id);
END;
$$;

CREATE OR REPLACE FUNCTION finish_due_staff_leaving()
RETURNS integer
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Europe/London')::date;
  v_staff uuid;
  v_n     integer := 0;
BEGIN
  FOR v_staff IN
    SELECT staff_id FROM staff_leaving WHERE finished_at IS NULL AND last_day < v_today
  LOOP
    PERFORM staff_leaving_finish(v_staff);
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION mark_staff_leaving(uuid, date, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION finish_staff_leaving(uuid)                 FROM PUBLIC;
REVOKE ALL ON FUNCTION finish_due_staff_leaving()                 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION mark_staff_leaving(uuid, date, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION finish_staff_leaving(uuid)                 TO anon, authenticated;

COMMIT;

-- Every night at 01:05 UTC (01:05 or 02:05 UK time, so "yesterday" is always
-- finished). Scheduling an existing job name replaces it, so re-running is safe.
-- Outside the transaction so a project without pg_cron still gets the rest.
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('finish-staff-leaving', '5 1 * * *', 'SELECT finish_due_staff_leaving()');
  ELSE
    RAISE NOTICE 'pg_cron is not installed: leavers will only be switched off from the app';
  END IF;
END
$cron$;
