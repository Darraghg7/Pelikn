-- ============================================================================
-- 148: Holiday pay allocations — the hours a manager pays for each day off
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  APPLY MANUALLY IN SUPABASE SQL EDITOR. Idempotent (safe to run twice).  ║
-- ║  Prereqs: 091 (has_venue_access).                                        ║
-- ║  ROLLBACK: 148_rollback.sql (same folder).                               ║
-- ║  Guide: docs/apply-migration-148.md                                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Until now holiday pay was worked out on the fly: every approved day off was
-- paid at an estimate (contracted hours ÷ working days, or a zero-hours
-- person's average shift), and the same estimate came off their balance. The
-- estimate moved as the average moved, so last month's payroll and today's
-- balance could disagree.
--
-- Now a manager allocates holiday pay from the timesheet: one row per day off,
-- with the hours they chose. Those exact hours are what the timesheet pays and
-- what comes off the person's accrued balance.
--
-- One row per (request, day) rather than one per request, because a holiday
-- can run across two pay periods and each period is paid separately.
--
-- Access is the same as time_off_requests: anyone signed in to the venue
-- (staff need to read their own hours for their balance). The allocate and
-- undo buttons are on the manager-only timesheet.
-- ============================================================================

SET lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS holiday_pay_allocations (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id            uuid        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  staff_id            uuid        NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  time_off_request_id uuid        NOT NULL REFERENCES time_off_requests(id) ON DELETE CASCADE,
  leave_date          date        NOT NULL,
  hours               numeric(5,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  allocated_by        uuid        REFERENCES staff(id) ON DELETE SET NULL,
  allocated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (time_off_request_id, leave_date)
);

COMMENT ON TABLE holiday_pay_allocations IS
  'Holiday pay a manager allocated from the timesheet: hours paid for one day of an approved time-off request. Also what comes off the staff member''s accrued balance.';

CREATE INDEX IF NOT EXISTS holiday_pay_allocations_venue_date_idx
  ON holiday_pay_allocations (venue_id, leave_date);
CREATE INDEX IF NOT EXISTS holiday_pay_allocations_staff_date_idx
  ON holiday_pay_allocations (staff_id, leave_date);

ALTER TABLE holiday_pay_allocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS holiday_pay_allocations_venue_access ON holiday_pay_allocations;
CREATE POLICY holiday_pay_allocations_venue_access ON holiday_pay_allocations
  FOR ALL USING (has_venue_access(venue_id)) WITH CHECK (has_venue_access(venue_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON holiday_pay_allocations TO authenticated;
REVOKE ALL ON holiday_pay_allocations FROM anon;

-- Check: one row, table_ready = true
SELECT to_regclass('public.holiday_pay_allocations') IS NOT NULL AS table_ready;
