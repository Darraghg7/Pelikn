-- Rollback for 149_holiday_paid_hours.sql
--
-- Any 'unavailable' requests are turned into 'other' first, so the old
-- constraint can be put back without failing. Recorded paid_hours are lost.
-- is_manual_entry is left in place: it belongs to 079, and the "log past
-- leave" form needs it.

SET lock_timeout = '5s';

BEGIN;

REVOKE SELECT (paid_hours, is_manual_entry) ON time_off_requests FROM anon, authenticated;

UPDATE time_off_requests SET leave_type = 'other' WHERE leave_type = 'unavailable';

ALTER TABLE time_off_requests
  DROP CONSTRAINT IF EXISTS time_off_requests_leave_type_check;

ALTER TABLE time_off_requests
  ADD CONSTRAINT time_off_requests_leave_type_check
    CHECK (leave_type IN ('annual', 'unpaid', 'other'));

ALTER TABLE time_off_requests DROP COLUMN IF EXISTS paid_hours;

COMMIT;
