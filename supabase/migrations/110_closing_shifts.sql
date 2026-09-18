-- ============================================================================
-- 110: Closing shifts + acceptance records (Phase 2)
--
-- is_closing is a manual per-assignment flag set on the rota — several staff,
-- across different departments, can each be flagged closing the same day.
-- closing_acceptances records the "I've checked this too" step for every
-- closer after the first: one row per (day, department, staff), so the first
-- closer's own completions (in opening_closing_completions) plus this table
-- together answer "is everyone signed off to leave."
-- ============================================================================

ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS is_closing boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS closing_acceptances (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id      uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  session_date  date NOT NULL,
  department_id uuid REFERENCES departments(id) ON DELETE CASCADE,
  staff_id      uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  accepted_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_date, department_id, staff_id)
);
CREATE INDEX IF NOT EXISTS idx_closing_acceptances_lookup
  ON closing_acceptances (venue_id, session_date, department_id);

ALTER TABLE closing_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY closing_acceptances_venue_access ON closing_acceptances
  FOR ALL USING (has_venue_access(venue_id)) WITH CHECK (has_venue_access(venue_id));

COMMENT ON COLUMN shifts.is_closing IS
  'Manual flag set on the rota. This person is accountable for their department''s closing checklist today.';
