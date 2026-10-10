-- ─────────────────────────────────────────────────────────────────────────────
-- 148_rollback.sql
-- Reverses 148_holiday_pay_allocations.sql. Deletes every holiday pay
-- allocation — take a backup first if any have been made. The app keeps
-- working: the timesheet shows no holiday pay allocated and balances go back
-- to estimating hours from approved days.
-- ─────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS holiday_pay_allocations;
