-- ============================================================
-- Migration 005 — Staff training records
-- ============================================================

CREATE TABLE IF NOT EXISTS staff_training (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    UUID        NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  issued_date DATE,
  expiry_date DATE,
  notes       TEXT,
  file_url    TEXT,
  file_name   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE staff_training ENABLE ROW LEVEL SECURITY;

CREATE POLICY "training_select" ON staff_training FOR SELECT USING (true);
CREATE POLICY "training_insert" ON staff_training FOR INSERT WITH CHECK (true);
CREATE POLICY "training_update" ON staff_training FOR UPDATE USING (true);
CREATE POLICY "training_delete" ON staff_training FOR DELETE USING (true);
