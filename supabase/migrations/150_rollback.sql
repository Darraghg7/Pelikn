-- Rollback for 150_holiday_paid_out.sql — removes the table and everything recorded in it.

SET lock_timeout = '5s';

BEGIN;

DROP TABLE IF EXISTS holiday_paid_out;

COMMIT;
