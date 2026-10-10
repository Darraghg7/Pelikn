-- ─────────────────────────────────────────────────────────────────────────────
-- 148_rollback.sql
-- Reverses 148_holiday_hours.sql. Deletes the hours on every time-off request
-- and every carry-over — take a backup first if any have been entered. The
-- app keeps working: holiday hours go back to being estimated from days.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE time_off_requests  DROP COLUMN IF EXISTS hours;
ALTER TABLE leave_entitlements DROP COLUMN IF EXISTS carry_over_hours;
