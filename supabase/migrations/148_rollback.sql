-- ─────────────────────────────────────────────────────────────────────────────
-- 148_rollback.sql
-- Reverses 148_holiday_pay_allocations.sql. Deletes every holiday pay
-- allocation, carry-over and pay-out — take a backup first if any have been
-- made. The app keeps working: holiday pay goes back to being estimated from
-- approved days, with no carry-over or pay-outs.
-- ─────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS holiday_balance_adjustments;
DROP TABLE IF EXISTS holiday_pay_allocations;
