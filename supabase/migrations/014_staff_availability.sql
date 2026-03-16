-- 014: Staff availability tracking + contracted hours
-- Stores manual unavailability per staff per day.
-- Absence of a row = available (default).

CREATE TABLE IF NOT EXISTS staff_availability (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id   uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date       date NOT NULL,
  note       text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(staff_id, date)
);

CREATE INDEX idx_staff_availability_date ON staff_availability(date);
CREATE INDEX idx_staff_availability_staff ON staff_availability(staff_id);

-- RLS
ALTER TABLE staff_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read staff_availability"  ON staff_availability FOR SELECT USING (true);
CREATE POLICY "Public write staff_availability" ON staff_availability FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update staff_availability" ON staff_availability FOR UPDATE USING (true);
CREATE POLICY "Public delete staff_availability" ON staff_availability FOR DELETE USING (true);

-- Add contracted hours to staff table for the rota builder
ALTER TABLE staff ADD COLUMN IF NOT EXISTS contracted_hours numeric DEFAULT 0;
