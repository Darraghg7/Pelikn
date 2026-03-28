-- ─────────────────────────────────────────────────────────────────────────────
-- Allow managers to mark an out-of-range fridge reading as "resolved /
-- actioned" so it stops appearing in the needs-attention section.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE fridge_temperature_logs
  ADD COLUMN IF NOT EXISTS is_resolved  boolean    NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resolved_at  timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by  text;
