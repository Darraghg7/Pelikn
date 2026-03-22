-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 020: Opening/closing check improvements, ad-hoc task assignment,
--                Fitness to Work (SC7) declarations
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Opening/closing completions: add has_issue + corrective_action ────────
-- Replaces the generic "notes" field with an explicit issue flag so EHO
-- audit reports can clearly separate "all OK" from flagged issues.

ALTER TABLE opening_closing_completions
  ADD COLUMN IF NOT EXISTS has_issue       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS corrective_action text;

-- Migrate any existing notes to corrective_action
UPDATE opening_closing_completions
SET corrective_action = notes,
    has_issue = (notes IS NOT NULL AND notes <> '')
WHERE notes IS NOT NULL AND notes <> '';

-- ── 2. Task one-offs: personal staff assignment ───────────────────────────────
-- Allows managers to assign a one-off task to a specific person rather than
-- just a job role.

ALTER TABLE task_one_offs
  ADD COLUMN IF NOT EXISTS assigned_to_staff_id uuid REFERENCES staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to_name     text;

-- ── 3. Fitness to work declarations (SC7) ────────────────────────────────────
-- Staff must confirm fitness at start of each shift. EHOs specifically check
-- for these records. Keeps 90 days of history.

CREATE TABLE IF NOT EXISTS fitness_declarations (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id      uuid        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  staff_id      uuid        REFERENCES staff(id) ON DELETE SET NULL,
  staff_name    text        NOT NULL,
  declaration_date date     NOT NULL DEFAULT CURRENT_DATE,
  shift_type    text        NOT NULL DEFAULT 'general'
                            CHECK (shift_type IN ('opening','general','closing')),

  -- Core fitness questions
  is_fit               boolean NOT NULL,  -- overall: fit to work?
  has_dv_symptoms      boolean NOT NULL DEFAULT false,  -- D&V / norovirus
  has_skin_infection   boolean NOT NULL DEFAULT false,  -- cuts, sores on hands
  has_other_illness    boolean NOT NULL DEFAULT false,  -- other illness
  illness_details      text,                            -- detail if any above = true

  -- Hygiene confirmation (only when is_fit = true)
  confirm_handwashing  boolean NOT NULL DEFAULT false,
  confirm_clean_uniform boolean NOT NULL DEFAULT false,
  confirm_no_jewellery  boolean NOT NULL DEFAULT false,

  notes         text,
  declared_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fitness_declarations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "venue access" ON fitness_declarations
  FOR ALL USING (true) WITH CHECK (true);

-- Index for daily dashboard query
CREATE INDEX IF NOT EXISTS fitness_declarations_venue_date
  ON fitness_declarations (venue_id, declaration_date DESC);
