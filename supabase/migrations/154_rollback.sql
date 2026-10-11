-- Rollback for 154_timesheet_remove_shift_and_holiday_payout.sql.
-- Drops the flag: timesheet holiday payouts stay in holiday_paid_out but stop
-- being added to pay.

SET lock_timeout = '5s';

BEGIN;

DROP FUNCTION IF EXISTS delete_clock_session(uuid[]);
DROP INDEX IF EXISTS holiday_paid_out_timesheet;
ALTER TABLE holiday_paid_out DROP COLUMN IF EXISTS on_timesheet;

COMMIT;
