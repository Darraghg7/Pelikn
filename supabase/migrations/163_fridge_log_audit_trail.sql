-- ============================================================================
-- 163: Fridge readings keep an audit trail an inspector can rely on
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  APPLY MANUALLY IN THE SUPABASE SQL EDITOR. ROLLBACK: 163_rollback.sql.  ║
-- ║  Safe to run more than once. Existing rows are not changed (the new      ║
-- ║  columns stay empty for them, meaning "unknown").                        ║
-- ║  Apply BEFORE merging the app change that reads these columns.           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Three gaps in fridge_temperature_logs, all about what a reading can claim:
--
-- 1. A "backfilled" reading (a missed check added later) was indistinguishable
--    from one taken at the time: the table had no timestamp for when the row
--    was written, only logged_at, which the person chooses. The screen said
--    backfilled readings "are flagged in your audit log"; nothing flagged them.
--      recorded_at   — when the row actually reached the database (set here,
--                      not by the client)
--      is_backfilled — true when logged_at is more than 30 minutes before
--                      recorded_at
--
-- 2. Pass or fail was judged against the fridge's CURRENT min/max, so widening
--    a range afterwards turned past failures into passes (and the reverse).
--      range_min / range_max — the fridge's range when the reading was taken
--
-- 3. A manager could change a reading's exceedance reason ("equipment" to
--    "defrost" removes the penalty) with no trace of the change.
--      reason_previous / reason_changed_at / reason_changed_by
--
-- All of these are filled by triggers, so every way a row can be written
-- (dashboard, the log form, backfill, direct API) gets them, and a client
-- can't set or edit them.
-- ============================================================================

ALTER TABLE fridge_temperature_logs
  ADD COLUMN IF NOT EXISTS recorded_at       timestamptz,
  ADD COLUMN IF NOT EXISTS is_backfilled     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS range_min         numeric,
  ADD COLUMN IF NOT EXISTS range_max         numeric,
  ADD COLUMN IF NOT EXISTS reason_previous   text,
  ADD COLUMN IF NOT EXISTS reason_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reason_changed_by text;

COMMENT ON COLUMN fridge_temperature_logs.recorded_at IS
  'When the row was written (server time). NULL on rows from before 163. logged_at is when the reading says it was taken.';
COMMENT ON COLUMN fridge_temperature_logs.range_min IS
  'The fridge''s minimum when the reading was taken; pass/fail uses this, not the fridge''s current range. NULL on rows from before 163.';


-- ── On insert: stamp the entry time, flag late entries, snapshot the range ──
CREATE OR REPLACE FUNCTION fridge_log_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.recorded_at   := now();
  NEW.is_backfilled := NEW.logged_at < now() - interval '30 minutes';

  SELECT f.min_temp, f.max_temp INTO NEW.range_min, NEW.range_max
    FROM fridges f WHERE f.id = NEW.fridge_id;

  -- Not something a client gets to set on a new row.
  NEW.reason_previous   := NULL;
  NEW.reason_changed_at := NULL;
  NEW.reason_changed_by := NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS fridge_log_before_insert ON fridge_temperature_logs;
CREATE TRIGGER fridge_log_before_insert
  BEFORE INSERT ON fridge_temperature_logs
  FOR EACH ROW EXECUTE FUNCTION fridge_log_before_insert();


-- ── On update: lock the audit fields, and record any change of reason ──────
CREATE OR REPLACE FUNCTION fridge_log_before_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Entry time, late-entry flag and range snapshot never change.
  NEW.recorded_at   := OLD.recorded_at;
  NEW.is_backfilled := OLD.is_backfilled;
  NEW.range_min     := OLD.range_min;
  NEW.range_max     := OLD.range_max;

  IF NEW.exceedance_reason IS DISTINCT FROM OLD.exceedance_reason THEN
    NEW.reason_previous   := OLD.exceedance_reason;
    NEW.reason_changed_at := now();
    NEW.reason_changed_by := COALESCE(
      (SELECT s.name FROM staff s WHERE s.id = auth.uid()),
      'Account owner');
  ELSE
    NEW.reason_previous   := OLD.reason_previous;
    NEW.reason_changed_at := OLD.reason_changed_at;
    NEW.reason_changed_by := OLD.reason_changed_by;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS fridge_log_before_update ON fridge_temperature_logs;
CREATE TRIGGER fridge_log_before_update
  BEFORE UPDATE ON fridge_temperature_logs
  FOR EACH ROW EXECUTE FUNCTION fridge_log_before_update();
