-- ============================================================================
-- 131: mock_inspections — keep EHO mock inspection results
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  APPLY MANUALLY IN SUPABASE SQL EDITOR. Prereqs: 085 (is_venue_hr_manager)║
-- ║  and 091 (has_venue_access). Safe before or after the client deploys:    ║
-- ║  the new client names this migration if the table is missing; the old    ║
-- ║  client never touches it. ROLLBACK: 131_rollback.sql.                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Found in the manual E2E run (25 Sep 2026): the Mock Inspection page held
-- answers in component state only. Leaving the page lost them, and a
-- submitted result was never stored — so there was no history to show an
-- inspector or to compare month on month.
--
-- One row per submitted inspection. `answers` is { question_id: 'yes' |
-- 'partial' | 'no' | 'na' } — the questions live in the client
-- (EHOMockPage.jsx), so the row also stores the score as calculated at the
-- time and the name of whoever did it, and stays readable if either changes.
--
-- Read/add: anyone at the venue (the page itself is manager-only in the app).
-- Delete: manager/owner only. No update policy — a result is a record.
-- ============================================================================

CREATE TABLE IF NOT EXISTS mock_inspections (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id          uuid        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  completed_by      uuid        REFERENCES staff(id) ON DELETE SET NULL,
  completed_by_name text,
  answers           jsonb       NOT NULL,
  score             integer     NOT NULL CHECK (score BETWEEN 0 AND 100),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mock_inspections_venue_created_idx
  ON mock_inspections (venue_id, created_at DESC);

ALTER TABLE mock_inspections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mock_inspections_select" ON mock_inspections;
DROP POLICY IF EXISTS "mock_inspections_insert" ON mock_inspections;
DROP POLICY IF EXISTS "mock_inspections_delete" ON mock_inspections;

CREATE POLICY "mock_inspections_select" ON mock_inspections
  FOR SELECT USING (has_venue_access(venue_id));

CREATE POLICY "mock_inspections_insert" ON mock_inspections
  FOR INSERT WITH CHECK (has_venue_access(venue_id));

CREATE POLICY "mock_inspections_delete" ON mock_inspections
  FOR DELETE USING (is_venue_hr_manager(venue_id));

GRANT SELECT, INSERT, DELETE ON mock_inspections TO anon, authenticated;

-- PostgREST caches the schema; make the new table reachable immediately.
NOTIFY pgrst, 'reload schema';
