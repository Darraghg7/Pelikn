-- ─────────────────────────────────────────────────────────────────────────────
-- 150_holiday_paid_out.sql
-- Holiday already paid that isn't a dated booking in Pelikn.
-- ROLLBACK: 150_rollback.sql (same folder).
-- ─────────────────────────────────────────────────────────────────────────────
--
-- When a venue starts tracking holiday in Pelikn part-way through the year,
-- payroll has often already paid some. Recording that as a time-off booking
-- would need made-up dates and would block the rota on them, so it is its own
-- record: an amount of holiday paid for a leave year, which comes off the
-- person's remaining balance.
--
--   hours  — staff whose holiday is counted in hours (zero-hours)
--   days   — staff with a days-based allowance
--
-- Exactly one of the two is set. Rows are deleted, not edited, to correct a
-- mistake, so each one is a record of what was entered and by whom.
--
-- Access follows time_off_requests (091): anyone with access to the venue.
-- The app only offers it to managers.

SET lock_timeout = '5s';

BEGIN;

CREATE TABLE IF NOT EXISTS holiday_paid_out (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id    uuid        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  staff_id    uuid        NOT NULL REFERENCES staff(id)  ON DELETE CASCADE,
  leave_year  smallint    NOT NULL,
  hours       numeric(6,2),
  days        numeric(5,1),
  paid_on     date,
  note        text,
  created_by  uuid        REFERENCES staff(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT holiday_paid_out_one_amount CHECK (
    (hours IS NOT NULL AND days IS NULL AND hours > 0 AND hours <= 999) OR
    (days  IS NOT NULL AND hours IS NULL AND days  > 0 AND days  <= 99)
  )
);

CREATE INDEX IF NOT EXISTS holiday_paid_out_staff_year ON holiday_paid_out (staff_id, leave_year);
CREATE INDEX IF NOT EXISTS holiday_paid_out_venue      ON holiday_paid_out (venue_id);

ALTER TABLE holiday_paid_out ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS holiday_paid_out_venue_access ON holiday_paid_out;
CREATE POLICY holiday_paid_out_venue_access ON holiday_paid_out
  FOR ALL USING (has_venue_access(venue_id)) WITH CHECK (has_venue_access(venue_id));

GRANT SELECT, INSERT, DELETE ON holiday_paid_out TO anon, authenticated;

COMMIT;
