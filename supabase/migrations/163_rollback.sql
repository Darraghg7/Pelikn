-- Rollback for 163_fridge_log_audit_trail.sql.
-- Drops the triggers and the audit columns. The recorded entry times, backfill
-- flags, range snapshots and reason-change history are lost; the readings
-- themselves are untouched. Roll the app change back first, or it will ask for
-- columns that no longer exist.

DROP TRIGGER IF EXISTS fridge_log_before_insert ON fridge_temperature_logs;
DROP TRIGGER IF EXISTS fridge_log_before_update ON fridge_temperature_logs;
DROP FUNCTION IF EXISTS fridge_log_before_insert();
DROP FUNCTION IF EXISTS fridge_log_before_update();

ALTER TABLE fridge_temperature_logs
  DROP COLUMN IF EXISTS recorded_at,
  DROP COLUMN IF EXISTS is_backfilled,
  DROP COLUMN IF EXISTS range_min,
  DROP COLUMN IF EXISTS range_max,
  DROP COLUMN IF EXISTS reason_previous,
  DROP COLUMN IF EXISTS reason_changed_at,
  DROP COLUMN IF EXISTS reason_changed_by;
