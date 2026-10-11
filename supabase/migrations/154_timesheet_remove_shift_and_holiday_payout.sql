-- ─────────────────────────────────────────────────────────────────────────────
-- 154_timesheet_remove_shift_and_holiday_payout.sql
-- Two timesheet tools for managers.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- 1. delete_clock_session(p_event_ids)  — remove a shift from the timesheet.
--    Takes the ids of one session's clock events (clock in, clock out and
--    its break punches). Managers only. Every id must belong to the same
--    staff member and venue, so a crafted list can't reach anyone else's
--    punches.
--
-- 2. holiday_paid_out.on_timesheet — holiday paid out on a date ("the cafe
--    closes for Christmas, pay everyone 8 hours"). Rows from before this
--    column are holiday payroll already paid elsewhere and must NOT be added
--    to a timesheet's pay again, so the flag defaults to false. Rows created
--    from the timesheet set it true and paid_on puts them in that period.
--    They still come off the person's holiday balance like any paid-out row.

SET lock_timeout = '5s';

BEGIN;

ALTER TABLE holiday_paid_out
  ADD COLUMN IF NOT EXISTS on_timesheet boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS holiday_paid_out_timesheet
  ON holiday_paid_out (venue_id, paid_on) WHERE on_timesheet;

CREATE OR REPLACE FUNCTION delete_clock_session(p_event_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_ids uuid[];
  v_venue_ids uuid[];
  v_found     integer;
  v_deleted   integer;
BEGIN
  IF p_event_ids IS NULL OR cardinality(p_event_ids) = 0 THEN
    RAISE EXCEPTION 'No shift given';
  END IF;

  SELECT array_agg(DISTINCT staff_id), array_agg(DISTINCT venue_id), count(*)
  INTO   v_staff_ids, v_venue_ids, v_found
  FROM   clock_events
  WHERE  id = ANY (p_event_ids);

  IF v_found IS NULL OR v_found = 0 THEN
    RAISE EXCEPTION 'Shift not found';
  END IF;
  IF cardinality(v_staff_ids) <> 1 OR cardinality(v_venue_ids) <> 1 THEN
    RAISE EXCEPTION 'Those punches are not one shift';
  END IF;

  PERFORM assert_clock_access(v_staff_ids[1], v_venue_ids[1], false);
  IF NOT COALESCE(is_venue_hr_manager(v_venue_ids[1]), false) THEN
    RAISE EXCEPTION 'Only a manager can remove a shift'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM clock_events
  WHERE  id = ANY (p_event_ids)
    AND  staff_id = v_staff_ids[1]
    AND  venue_id = v_venue_ids[1];
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION delete_clock_session(uuid[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION delete_clock_session(uuid[]) TO authenticated, service_role;

COMMIT;
