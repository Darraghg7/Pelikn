-- ============================================================================
-- 070: Incident & accident log
--
-- Legally required workplace incident records with severity tracking.
-- ============================================================================

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE incidents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id        uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  incident_date   timestamptz NOT NULL,
  location        text NOT NULL,
  description     text NOT NULL,
  injury_details  text,
  first_aid_given text,
  witnesses       text,
  follow_up_actions text,
  severity        text NOT NULL CHECK (severity IN ('minor','moderate','serious','riddor')),
  reported_by     uuid NOT NULL REFERENCES staff(id),
  people_involved jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "incidents_read" ON incidents
  FOR SELECT USING (true);

CREATE POLICY "incidents_write" ON incidents
  FOR ALL
  USING  (venue_id IN (SELECT id FROM venues WHERE owner_id = auth.uid()))
  WITH CHECK (venue_id IN (SELECT id FROM venues WHERE owner_id = auth.uid()));

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_incidents_venue_date ON incidents(venue_id, incident_date DESC);
