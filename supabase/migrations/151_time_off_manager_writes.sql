-- ─────────────────────────────────────────────────────────────────────────────
-- 151_time_off_manager_writes.sql
-- Only managers can approve leave, record holiday hours or holiday already paid.
-- ROLLBACK: 151_rollback.sql (same folder).
-- REQUIRES: 085 (is_venue_hr_manager), 091, 145 (session_actor), 149, 150.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- What was wrong: time_off_requests (091) and holiday_paid_out (150) only check
-- that the caller belongs to the venue — has_venue_access() is the same for a
-- manager and a kitchen porter. The app only shows approve / reject, "hours
-- paid" and "holiday already paid" to managers, but anyone signed in to the
-- venue could call the API directly and:
--
--   • approve their own request, or reject a colleague's
--   • set paid_hours on their own leave (their holiday balance)
--   • add or delete "holiday already paid" rows (their holiday balance)
--   • change a colleague's request, or a manager-logged one
--
-- The rule now, matching lib/api/timeOff.ts timeOffPermissions:
--
--   Managers and owners (is_venue_hr_manager — a PIN manager/owner at the JWT's
--   venue, or the venue's owner signed in by email even when no venue JWT is
--   present) — anything, as before.
--
--   Everyone else, on time_off_requests:
--     insert  — their own request, as 'pending', with none of the manager
--               fields filled in.
--     update  — their own request, while it is pending or approved, was not
--               logged by a manager, and has not started yet. They may change
--               dates, type and reason; withdraw it ('cancelled', by
--               themselves); or send an approved one back to 'pending'. They
--               may clear the manager's fields (reviewed_by, reviewed_at,
--               manager_note, paid_hours) — the app does exactly that when an
--               approved booking goes back for re-approval — but never set
--               them. Any column not on that list (including ones added
--               later) must stay as it was.
--     delete  — never (the app never deletes; withdrawing is a status change).
--
--   Everyone else, on holiday_paid_out: no inserts or deletes. Reads are
--   unchanged.
--
-- How: holiday_paid_out and deletes on time_off_requests are plain RESTRICTIVE
-- policies, which are AND-ed with 091/150's existing venue policy, so nothing
-- existing is dropped or rewritten. The time_off_requests insert/update rule
-- needs to compare the row before and after, which a policy cannot see, so it
-- is a BEFORE trigger.
--
-- The trigger only judges requests made through the API (roles anon and
-- authenticated). SECURITY DEFINER functions, the service role and the SQL
-- editor run as other roles and are not affected — they are trusted code or
-- Darragh. Foreign-key cascades (deleting a staff member) skip RLS, so the
-- DELETE policy does not get in their way either.
--
-- Refusals use SQLSTATE 42501 with a sentence the app's toast can show as is.

SET lock_timeout = '5s';

BEGIN;

-- ── time_off_requests: who may insert / update what ─────────────────────────

CREATE OR REPLACE FUNCTION time_off_requests_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_caller  uuid;
  v_today   date := (now() AT TIME ZONE 'UTC')::date;   -- the app's "today" (toISOString)
  v_changed text[];
  -- Columns staff may change on their own request. Everything else is fixed.
  v_staff_editable constant text[] := ARRAY[
    'start_date', 'end_date', 'leave_type', 'reason', 'status',
    'cancelled_at', 'cancelled_by',
    -- clear-only (checked below)
    'reviewed_by', 'reviewed_at', 'manager_note', 'paid_hours'
  ];
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  -- Managers and owners: unchanged. An update that moves a row between venues
  -- needs them to manage both.
  IF is_venue_hr_manager(NEW.venue_id)
     AND (TG_OP = 'INSERT' OR is_venue_hr_manager(OLD.venue_id)) THEN
    RETURN NEW;
  END IF;

  -- Who is asking: 145's session_actor — the venue JWT's subject, active, and
  -- working at the JWT's venue. (A SECURITY DEFINER lookup, so this does not
  -- depend on what the staff table's column grants let the caller read.)
  BEGIN
    v_caller := (session_actor(NULL)).staff_id;
  EXCEPTION WHEN insufficient_privilege THEN
    v_caller := NULL;
  END;
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Only a manager can do that'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.staff_id IS DISTINCT FROM v_caller THEN
      RAISE EXCEPTION 'Only a manager can book time off for someone else'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.status IS DISTINCT FROM 'pending'
       OR NEW.reviewed_by  IS NOT NULL
       OR NEW.reviewed_at  IS NOT NULL
       OR NEW.manager_note IS NOT NULL
       OR NEW.paid_hours   IS NOT NULL
       OR NEW.cancelled_at IS NOT NULL
       OR NEW.cancelled_by IS NOT NULL
       OR NEW.is_manual_entry THEN
      RAISE EXCEPTION 'Time off requests start as pending — only a manager can approve them or log leave'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE by a non-manager: their own, still-changeable request only.
  IF OLD.staff_id IS DISTINCT FROM v_caller THEN
    RAISE EXCEPTION 'Only a manager can change someone else''s time off'
      USING ERRCODE = '42501';
  END IF;
  IF OLD.status NOT IN ('pending', 'approved') THEN
    RAISE EXCEPTION 'This request is closed — submit a new one if you still need the time off'
      USING ERRCODE = '42501';
  END IF;
  IF OLD.is_manual_entry THEN
    RAISE EXCEPTION 'This leave was logged by a manager — ask them to change it'
      USING ERRCODE = '42501';
  END IF;
  IF OLD.start_date < v_today THEN
    RAISE EXCEPTION 'This leave has already started — ask a manager to change it'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(array_agg(n.key), '{}')
    INTO v_changed
  FROM jsonb_each(to_jsonb(NEW)) n
  WHERE n.value IS DISTINCT FROM (to_jsonb(OLD) -> n.key);

  IF NOT v_changed <@ v_staff_editable THEN
    RAISE EXCEPTION 'Only a manager can change that'
      USING ERRCODE = '42501';
  END IF;

  -- Manager fields: staff may clear them, never set them.
  IF ('reviewed_by'  = ANY (v_changed) AND NEW.reviewed_by  IS NOT NULL)
     OR ('reviewed_at'  = ANY (v_changed) AND NEW.reviewed_at  IS NOT NULL)
     OR ('manager_note' = ANY (v_changed) AND NEW.manager_note IS NOT NULL)
     OR ('paid_hours'   = ANY (v_changed) AND NEW.paid_hours   IS NOT NULL) THEN
    RAISE EXCEPTION 'Only a manager can approve leave or record holiday hours'
      USING ERRCODE = '42501';
  END IF;

  -- Status: back to pending, or withdrawn. Approval stays a manager's call,
  -- and an approved booking can't be changed while keeping its approval.
  IF 'status' = ANY (v_changed) AND NEW.status NOT IN ('pending', 'cancelled') THEN
    RAISE EXCEPTION 'Only a manager can approve or reject time off'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.status = 'approved' AND cardinality(v_changed) > 0 THEN
    RAISE EXCEPTION 'Changing approved leave sends it back to your manager for approval'
      USING ERRCODE = '42501';
  END IF;

  -- Withdrawing is recorded as themselves.
  IF ('cancelled_at' = ANY (v_changed) OR 'cancelled_by' = ANY (v_changed))
     AND (NEW.status IS DISTINCT FROM 'cancelled'
          OR NEW.cancelled_by IS DISTINCT FROM v_caller) THEN
    RAISE EXCEPTION 'Only a manager can withdraw time off on someone''s behalf'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION time_off_requests_guard() IS
  'Staff may only request, edit and withdraw their own time off; approving, '
  'paid_hours and other people''s rows are manager/owner only (151).';

DROP TRIGGER IF EXISTS time_off_requests_guard ON time_off_requests;
CREATE TRIGGER time_off_requests_guard
  BEFORE INSERT OR UPDATE ON time_off_requests
  FOR EACH ROW EXECUTE FUNCTION time_off_requests_guard();

-- ── time_off_requests: deletes are manager/owner only ───────────────────────
DROP POLICY IF EXISTS time_off_requests_manager_delete ON time_off_requests;
CREATE POLICY time_off_requests_manager_delete ON time_off_requests
  AS RESTRICTIVE FOR DELETE
  USING (is_venue_hr_manager(venue_id));

-- ── holiday_paid_out: writes are manager/owner only ─────────────────────────
-- (No UPDATE is granted on this table; the policy is there in case one ever is.)
DROP POLICY IF EXISTS holiday_paid_out_manager_insert ON holiday_paid_out;
CREATE POLICY holiday_paid_out_manager_insert ON holiday_paid_out
  AS RESTRICTIVE FOR INSERT
  WITH CHECK (is_venue_hr_manager(venue_id));

DROP POLICY IF EXISTS holiday_paid_out_manager_update ON holiday_paid_out;
CREATE POLICY holiday_paid_out_manager_update ON holiday_paid_out
  AS RESTRICTIVE FOR UPDATE
  USING (is_venue_hr_manager(venue_id))
  WITH CHECK (is_venue_hr_manager(venue_id));

DROP POLICY IF EXISTS holiday_paid_out_manager_delete ON holiday_paid_out;
CREATE POLICY holiday_paid_out_manager_delete ON holiday_paid_out
  AS RESTRICTIVE FOR DELETE
  USING (is_venue_hr_manager(venue_id));

COMMIT;
