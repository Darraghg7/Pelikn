-- 090: Allow managers to dismiss individual strikes in staff_disciplinary_log
-- Soft-delete approach: dismissed rows stay visible in the HR timeline (with
-- a "Dismissed by X" label) but are excluded from strike-count queries so they
-- don't trigger future escalations.

ALTER TABLE staff_disciplinary_log
  ADD COLUMN dismissed_at  timestamptz,
  ADD COLUMN dismissed_by  uuid REFERENCES staff(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_disciplinary_log_active
  ON staff_disciplinary_log(staff_id, venue_id, occurred_at)
  WHERE dismissed_at IS NULL;
