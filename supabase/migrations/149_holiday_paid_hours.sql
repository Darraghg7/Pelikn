-- ─────────────────────────────────────────────────────────────────────────────
-- 149_holiday_paid_hours.sql
-- Zero-hours holiday: record the hours actually paid, and a "Not available" type.
-- ROLLBACK: 149_rollback.sql (same folder).
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Two problems found checking Nomad's zero-hours balances (Oct 2026):
--
-- 1. Staff with no other way to say "I can't work" booked it as annual leave,
--    so it came off their holiday balance. Eve's 16 days of "annual leave"
--    were availability, not holiday. 'unavailable' is a new leave_type: it
--    still needs a manager's approval and still blocks the rota, but it is
--    never paid and never touches a holiday balance.
--
-- 2. A zero-hours worker's leave was converted to hours by guessing from the
--    dates (days × average shift). paid_hours records what was actually paid.
--    The app asks for it when a manager approves annual leave for a
--    zero-hours worker; NULL means "not recorded", and the app falls back to
--    the estimate and says so.
--
-- Also adds is_manual_entry, which 079 was meant to add but which is missing
-- from the live database (found when this migration first failed on the GRANT
-- below, 10 Oct 2026). Without it the manager's "log past leave" form has been
-- failing on every save, because it writes that column. Then grants SELECT on
-- it: 119 replaced the table-wide SELECT grant with a column list and left it
-- out, so the app's "logged by a manager" lock (lib/api/timeOff.ts) could never
-- see it. It is a plain flag, not sensitive.
--
-- Safe to run before the app update: nothing writes 'unavailable' or
-- paid_hours until then, and the current app selects neither.

SET lock_timeout = '5s';

BEGIN;

-- 075 added the check inline, so Postgres named it. Drop whatever check
-- mentions leave_type rather than trusting the generated name.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.time_off_requests'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%leave_type%'
  LOOP
    EXECUTE format('ALTER TABLE time_off_requests DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE time_off_requests
  ADD CONSTRAINT time_off_requests_leave_type_check
    CHECK (leave_type IN ('annual', 'unpaid', 'unavailable', 'other'));

ALTER TABLE time_off_requests
  ADD COLUMN IF NOT EXISTS paid_hours numeric(6,2)
    CHECK (paid_hours IS NULL OR (paid_hours >= 0 AND paid_hours <= 999));

COMMENT ON COLUMN time_off_requests.paid_hours IS
  'Holiday hours paid for this request (zero-hours staff). NULL = not recorded; the app estimates from the person''s average week.';

-- 079, re-run safely: a constant default adds the column without rewriting the table.
ALTER TABLE time_off_requests
  ADD COLUMN IF NOT EXISTS is_manual_entry boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN time_off_requests.is_manual_entry IS
  'True when a manager manually logged this leave (e.g. paper records from before the app was used)';

GRANT SELECT (paid_hours, is_manual_entry) ON time_off_requests TO anon, authenticated;

COMMIT;
