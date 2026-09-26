-- Rollback for 132_cron_history_cleanup.sql.
-- Stops the daily clean-up; cron.job_run_details grows again (~1,440 rows a
-- day). Log rows already deleted by 132 cannot be restored.
SELECT cron.unschedule('cron-history-cleanup');
