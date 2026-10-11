-- Rollback for 153_holiday_carry_over.sql — removes the table and every
-- carry-over recorded in it. Balances go back to not including carry-over.
-- The "holiday year starts in" setting lives in app_settings and needs no
-- rollback (the app treats a missing value as January).

SET lock_timeout = '5s';

BEGIN;

DROP TABLE IF EXISTS holiday_carry_over;

COMMIT;
