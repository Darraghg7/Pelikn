-- ============================================================================
-- 148: Holiday booked in hours, and carry-over
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  APPLY MANUALLY IN SUPABASE SQL EDITOR. Idempotent (safe to run twice).  ║
-- ║  Prereqs: 075 (leave_entitlements), 119 (time_off_requests column grants)║
-- ║  ROLLBACK: 148_rollback.sql (same folder).                               ║
-- ║  Guide: docs/apply-migration-148.md                                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- time_off_requests.hours — the holiday hours a request uses and pays. The
-- staff member fills it in when booking (pre-filled from their average
-- shift); the manager can change it when approving. Approving is the decision
-- to pay it: the timesheet pays these hours in the week(s) the leave falls
-- in, and they come off the person's accrued balance. NULL on requests made
-- before this — the app estimates those from days × usual hours, as before.
--
-- leave_entitlements.carry_over_hours — unused holiday hours brought forward
-- into a holiday year, set by a manager. leave_entitlements is already one
-- row per (staff, holiday year), keyed by the year it starts in.
-- ============================================================================

SET lock_timeout = '5s';

ALTER TABLE time_off_requests
  ADD COLUMN IF NOT EXISTS hours numeric(6,2)
    CHECK (hours IS NULL OR (hours > 0 AND hours <= 1000));

COMMENT ON COLUMN time_off_requests.hours IS
  'Holiday hours this request uses and pays (annual leave). NULL = estimate from days × usual hours.';

-- 119 lists the columns staff may read; hours isn't private, so add it
GRANT SELECT (hours) ON time_off_requests TO anon, authenticated;

ALTER TABLE leave_entitlements
  ADD COLUMN IF NOT EXISTS carry_over_hours numeric(6,2)
    CHECK (carry_over_hours IS NULL OR (carry_over_hours >= 0 AND carry_over_hours <= 1000));

COMMENT ON COLUMN leave_entitlements.carry_over_hours IS
  'Unused holiday hours carried over into this holiday year.';

-- Check: one row, both true
SELECT EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'time_off_requests' AND column_name = 'hours') AS hours_ready,
       EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'leave_entitlements' AND column_name = 'carry_over_hours') AS carry_over_ready;
