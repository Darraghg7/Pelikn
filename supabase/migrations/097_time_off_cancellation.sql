-- ============================================================================
-- 097: Cancellable time-off requests
-- ============================================================================
-- Staff (and managers) can withdraw a request they have already submitted.
-- Cancelled requests are kept rather than deleted so the leave history in the
-- HR record still shows what was booked, but they stop blocking the rota:
-- every consumer of time_off_requests filters on 'pending' or 'approved'.

ALTER TABLE time_off_requests
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES staff(id);

COMMENT ON COLUMN time_off_requests.status IS
  'pending | approved | rejected | cancelled';
COMMENT ON COLUMN time_off_requests.cancelled_by IS
  'Staff member who withdrew the request — the requester themselves, or a manager acting on their behalf';

-- Availability lookups (rota, calendar) filter by venue + status over a date
-- range; cancelled rows accumulate in the same table, so keep that path indexed.
CREATE INDEX IF NOT EXISTS time_off_requests_venue_status_dates_idx
  ON time_off_requests (venue_id, status, start_date, end_date);
