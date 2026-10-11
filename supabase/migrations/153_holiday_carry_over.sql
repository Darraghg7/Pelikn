-- ─────────────────────────────────────────────────────────────────────────────
-- 153_holiday_carry_over.sql
-- Holiday carried over from last holiday year into this one.
-- ROLLBACK: 153_rollback.sql (same folder).
-- REQUIRES: 085 (is_venue_hr_manager), 091 (has_venue_access). Safe to run
--           more than once.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- A manager can carry some of a person's unused holiday into the new holiday
-- year. It adds to that year's balance.
--
--   leave_year — the holiday year it is carried INTO, named by the calendar
--                year that holiday year starts in (an April 2026 – March 2027
--                holiday year is 2026). Same convention as holiday_paid_out.
--   hours      — staff whose holiday is counted in hours (zero-hours)
--   days       — staff with a days-based allowance
--
-- Exactly one of the two is set, and there is at most one carry-over per
-- person per year. To change it, delete the row and add a new one, so each row
-- is a record of what was entered, by whom and when.
--
-- Reads follow holiday_paid_out (150): anyone with access to the venue — staff
-- need it to see their own balance. Writes are managers and owners only, the
-- same rule 151 gives holiday_paid_out: RESTRICTIVE policies AND-ed with the
-- venue policy.

SET lock_timeout = '5s';

BEGIN;

CREATE TABLE IF NOT EXISTS holiday_carry_over (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id    uuid        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  staff_id    uuid        NOT NULL REFERENCES staff(id)  ON DELETE CASCADE,
  leave_year  smallint    NOT NULL,
  hours       numeric(6,2),
  days        numeric(5,1),
  note        text,
  created_by  uuid        REFERENCES staff(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT holiday_carry_over_one_amount CHECK (
    (hours IS NOT NULL AND days IS NULL AND hours > 0 AND hours <= 999) OR
    (days  IS NOT NULL AND hours IS NULL AND days  > 0 AND days  <= 99)
  ),
  CONSTRAINT holiday_carry_over_once_a_year UNIQUE (staff_id, leave_year)
);

CREATE INDEX IF NOT EXISTS holiday_carry_over_venue ON holiday_carry_over (venue_id);

ALTER TABLE holiday_carry_over ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS holiday_carry_over_venue_access ON holiday_carry_over;
CREATE POLICY holiday_carry_over_venue_access ON holiday_carry_over
  FOR ALL USING (has_venue_access(venue_id)) WITH CHECK (has_venue_access(venue_id));

-- Writes: managers and owners only. (No UPDATE is granted; the policy is there
-- in case one ever is.)
DROP POLICY IF EXISTS holiday_carry_over_manager_insert ON holiday_carry_over;
CREATE POLICY holiday_carry_over_manager_insert ON holiday_carry_over
  AS RESTRICTIVE FOR INSERT
  WITH CHECK (is_venue_hr_manager(venue_id));

DROP POLICY IF EXISTS holiday_carry_over_manager_update ON holiday_carry_over;
CREATE POLICY holiday_carry_over_manager_update ON holiday_carry_over
  AS RESTRICTIVE FOR UPDATE
  USING (is_venue_hr_manager(venue_id))
  WITH CHECK (is_venue_hr_manager(venue_id));

DROP POLICY IF EXISTS holiday_carry_over_manager_delete ON holiday_carry_over;
CREATE POLICY holiday_carry_over_manager_delete ON holiday_carry_over
  AS RESTRICTIVE FOR DELETE
  USING (is_venue_hr_manager(venue_id));

GRANT SELECT, INSERT, DELETE ON holiday_carry_over TO anon, authenticated;

COMMIT;
