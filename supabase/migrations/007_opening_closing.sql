-- Opening / Closing checks
CREATE TABLE IF NOT EXISTS opening_closing_checks (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT    NOT NULL,
  type       TEXT    NOT NULL CHECK (type IN ('opening', 'closing')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS opening_closing_completions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id     UUID NOT NULL REFERENCES opening_closing_checks(id) ON DELETE CASCADE,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  session_type TEXT NOT NULL CHECK (session_type IN ('opening', 'closing')),
  staff_id     UUID REFERENCES staff(id),
  staff_name   TEXT,
  notes        TEXT,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE opening_closing_checks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE opening_closing_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oc_checks_select"  ON opening_closing_checks      FOR SELECT USING (true);
CREATE POLICY "oc_checks_write"   ON opening_closing_checks      FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "oc_comps_select"   ON opening_closing_completions FOR SELECT USING (true);
CREATE POLICY "oc_comps_write"    ON opening_closing_completions FOR ALL    USING (true) WITH CHECK (true);

-- Fix missing fridges write policy (RLS blocks all writes without it)
CREATE POLICY "fridges_all_write" ON fridges
  FOR ALL USING (true) WITH CHECK (true);

-- Fix fridge_logs_manager_modify which uses auth.role() = 'authenticated' (never true in this app)
DROP POLICY IF EXISTS "fridge_logs_manager_modify" ON fridge_temperature_logs;
CREATE POLICY "fridge_logs_all_write" ON fridge_temperature_logs
  FOR ALL USING (true) WITH CHECK (true);
