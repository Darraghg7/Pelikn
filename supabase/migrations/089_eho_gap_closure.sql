-- ─────────────────────────────────────────────────────────────────────────────
-- 089 — EHO gap closure: Allergen Procedure, Illness Policy, Complaints Log
-- ─────────────────────────────────────────────────────────────────────────────
-- Run in Supabase SQL Editor to activate the three new pages:
--   /allergens/procedure  — Allergen Management Procedure
--   /fitness → Illness Policy tab — Illness Exclusion Policy
--   /complaints           — Food Safety Complaints Log
-- ─────────────────────────────────────────────────────────────────────────────

-- Allergen management procedure (one per venue — how staff handle allergen
-- requests during service; required by EHOs post Natasha's Law Oct 2021)
CREATE TABLE IF NOT EXISTS allergen_procedures (
  venue_id            uuid    PRIMARY KEY REFERENCES venues(id) ON DELETE CASCADE,
  procedure_sections  jsonb   DEFAULT '{}',
  procedure_text      text,
  responsible_manager text,
  eho_contact         text,
  updated_at          timestamptz DEFAULT now()
);

ALTER TABLE allergen_procedures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allergen_procedures_all" ON allergen_procedures;
CREATE POLICY "allergen_procedures_all" ON allergen_procedures
  FOR ALL USING (true) WITH CHECK (true);


-- Illness exclusion policy (one per venue — written D&V / reportable illness
-- policy required by EHOs; stores manager contacts, text is rendered in-app)
CREATE TABLE IF NOT EXISTS illness_exclusion_policies (
  venue_id           uuid    PRIMARY KEY REFERENCES venues(id) ON DELETE CASCADE,
  responsible_person text,
  return_contact     text,
  eho_contact        text,
  updated_at         timestamptz DEFAULT now()
);

ALTER TABLE illness_exclusion_policies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "illness_policies_all" ON illness_exclusion_policies;
CREATE POLICY "illness_policies_all" ON illness_exclusion_policies
  FOR ALL USING (true) WITH CHECK (true);


-- Food safety complaints log (separate from workplace incidents / RIDDOR;
-- covers illness reports, allergen reactions, foreign bodies, contamination)
CREATE TABLE IF NOT EXISTS food_complaints (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id             uuid        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  created_at           timestamptz DEFAULT now(),
  date_received        date        NOT NULL,
  complaint_type       text        NOT NULL
                       CHECK (complaint_type IN (
                         'food_illness','allergen_reaction','foreign_body','contamination','other'
                       )),
  product_involved     text,
  complainant_contact  text,
  description          text        NOT NULL,
  investigation_notes  text,
  outcome              text,
  corrective_action    text,
  resolved_at          date
);

CREATE INDEX IF NOT EXISTS food_complaints_venue_idx ON food_complaints (venue_id, date_received DESC);

ALTER TABLE food_complaints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "food_complaints_all" ON food_complaints;
CREATE POLICY "food_complaints_all" ON food_complaints
  FOR ALL USING (true) WITH CHECK (true);
