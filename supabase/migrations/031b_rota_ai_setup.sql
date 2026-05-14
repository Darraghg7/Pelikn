-- ============================================================================
-- Migration 031: AI Rota Builder setup
-- Creates: venue_roles, staff_role_assignments, rota_requirements
-- ============================================================================

-- Venue-defined roles (Barista, Chef, FOH, Baker…)
CREATE TABLE IF NOT EXISTS venue_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id    uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name        text NOT NULL,
  color       text NOT NULL DEFAULT '#1a3c2e',
  sort_order  int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE venue_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "venue_roles_all" ON venue_roles FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_venue_roles_venue ON venue_roles (venue_id, sort_order);

-- Many-to-many: staff ↔ roles (a barista can also be FOH etc.)
CREATE TABLE IF NOT EXISTS staff_role_assignments (
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  role_id  uuid NOT NULL REFERENCES venue_roles(id) ON DELETE CASCADE,
  PRIMARY KEY (staff_id, role_id)
);
ALTER TABLE staff_role_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_role_assignments_all" ON staff_role_assignments FOR ALL USING (true) WITH CHECK (true);

-- Rota requirements template (what staff are needed each day of the week)
-- Each row = one shift slot that needs filling.
-- Multiple rows on the same day/role = staggered shifts.
CREATE TABLE IF NOT EXISTS rota_requirements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id    uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  day_of_week int  NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1=Mon … 7=Sun
  role_id     uuid REFERENCES venue_roles(id) ON DELETE SET NULL,
  role_name   text NOT NULL,             -- denormalised so display works if role deleted
  staff_count int  NOT NULL DEFAULT 1,   -- how many staff needed for this slot
  start_time  time NOT NULL,
  end_time    time NOT NULL,
  label       text,                      -- optional label e.g. "Morning", "Closer"
  sort_order  int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE rota_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rota_requirements_all" ON rota_requirements FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_rota_req_venue_day ON rota_requirements (venue_id, day_of_week);
