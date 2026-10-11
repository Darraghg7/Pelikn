-- Rollback for 152_staff_leaving.sql — removes staff leaving: the nightly job,
-- the functions and the staff_leaving table (leaving dates, reasons and
-- checklists recorded since are deleted with it).
--
-- Anyone already switched off stays deactivated, and shifts or time off
-- already removed stay removed — reactivate people from Team → Staff.

SET lock_timeout = '5s';

DO $cron$
BEGIN
  -- Nested, not AND-ed: without pg_cron there is no cron.job to look in.
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'finish-staff-leaving') THEN
      PERFORM cron.unschedule('finish-staff-leaving');
    END IF;
  END IF;
END
$cron$;

BEGIN;

DROP FUNCTION IF EXISTS finish_due_staff_leaving();
DROP FUNCTION IF EXISTS finish_staff_leaving(uuid);
DROP FUNCTION IF EXISTS mark_staff_leaving(uuid, date, text, text);
DROP FUNCTION IF EXISTS staff_leaving_finish(uuid);
DROP FUNCTION IF EXISTS staff_leaving_clear_rota(uuid, date);

DROP TABLE IF EXISTS staff_leaving;
DROP FUNCTION IF EXISTS staff_leaving_guard();

COMMIT;
