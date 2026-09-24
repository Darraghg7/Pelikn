-- ============================================================================
-- 122: Incidents can be closed, have a type and title, and track RIDDOR
--
-- The redesigned Incidents page splits incidents into Open / Closed, shows a
-- type ("Injury", "Near miss") and short title on each, and treats RIDDOR as a
-- flag alongside severity (a serious injury can also be RIDDOR-reportable)
-- with a deadline for reporting it to the HSE.
--
--   - status / closed_at / closed_by / closure_note: open until a manager
--     closes it with a note of what was done. Existing incidents start 'open' —
--     nobody has ever closed them, so that's the honest state.
--     useChecksStatus.js already filters incidents on status = 'open'; until
--     this column exists that query fails and the Checks hub always shows
--     "None open".
--   - title, incident_type: optional; old rows fall back to their description.
--   - riddor + riddor_category drive the reporting deadline (10 days, or 15 for
--     an over-7-day injury). riddor_reported_at / riddor_reference record that
--     it was reported. Old rows with severity = 'riddor' are flagged riddor;
--     their severity value is left as-is (the page reads it as Serious), and
--     'riddor' stays allowed so nothing historic breaks.
--
-- Additive only.
-- ============================================================================

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS title              text,
  ADD COLUMN IF NOT EXISTS incident_type      text
    CHECK (incident_type IN ('injury','near_miss','illness','damage','other')),
  ADD COLUMN IF NOT EXISTS riddor             boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS riddor_category    text
    CHECK (riddor_category IN ('specified_injury','over_7_day','non_worker_hospital','dangerous_occurrence','other')),
  ADD COLUMN IF NOT EXISTS riddor_reported_at timestamptz,
  ADD COLUMN IF NOT EXISTS riddor_reference   text,
  ADD COLUMN IF NOT EXISTS status             text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','closed')),
  ADD COLUMN IF NOT EXISTS closed_at          timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by          uuid REFERENCES staff(id),
  ADD COLUMN IF NOT EXISTS closure_note       text;

UPDATE incidents SET riddor = true WHERE severity = 'riddor' AND riddor = false;

CREATE INDEX IF NOT EXISTS idx_incidents_venue_status ON incidents (venue_id, status);
