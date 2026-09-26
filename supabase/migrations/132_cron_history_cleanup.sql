-- ============================================================================
-- 132: cron history cleanup — stop pg_cron's run log filling the database
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  APPLY MANUALLY IN SUPABASE SQL EDITOR. No client change depends on it. ║
-- ║  Touches only pg_cron's own run log — no venue data. ROLLBACK:           ║
-- ║  132_rollback.sql (stops the daily cleanup; deleted log rows are gone).  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Found 26 Sep 2026 while chasing ~10 s PIN logins: fridge-check-reminder
-- (047) runs every minute and pg_cron writes a row to cron.job_run_details
-- for every run. Nothing ever deleted them — 242,714 rows, 40 MB of a 62 MB
-- database. On the Nano instance, which was already out of memory and deep
-- in swap, that log was two-thirds of the database, and pg_cron's own
-- start-up sweep over it took ~10 s.
--
-- Keeps the last 7 days (enough to see whether the reminder is running) and
-- schedules the same delete daily so the log can't grow back. This is the
-- clean-up Supabase's pg_cron docs recommend.
--
-- Optional, afterwards, as a SEPARATE run in the SQL editor (VACUUM can't
-- share a run with other statements): VACUUM cron.job_run_details;
-- If it answers "only table or database owner can vacuum it", that's fine —
-- autovacuum reclaims the space on its own.
-- ============================================================================

DELETE FROM cron.job_run_details
 WHERE end_time < now() - interval '7 days';

-- Daily at 03:17 UTC. Scheduling an existing job name replaces it, so
-- re-running this migration is safe.
SELECT cron.schedule(
  'cron-history-cleanup',
  '17 3 * * *',
  $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'$$
);
