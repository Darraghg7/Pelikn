-- Rollback for 151_time_off_manager_writes.sql — back to 091/150's venue-only
-- check: anyone signed in to the venue can again approve leave, set paid_hours
-- and add or delete holiday already paid. No data is touched.

SET lock_timeout = '5s';

BEGIN;

DROP TRIGGER IF EXISTS time_off_requests_guard ON time_off_requests;
DROP FUNCTION IF EXISTS time_off_requests_guard();

DROP POLICY IF EXISTS time_off_requests_manager_delete ON time_off_requests;

DROP POLICY IF EXISTS holiday_paid_out_manager_insert ON holiday_paid_out;
DROP POLICY IF EXISTS holiday_paid_out_manager_update ON holiday_paid_out;
DROP POLICY IF EXISTS holiday_paid_out_manager_delete ON holiday_paid_out;

COMMIT;
