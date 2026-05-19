-- Migration 073: Equipment maintenance records
-- Logs servicing, calibration and repair events for kitchen equipment

CREATE TABLE IF NOT EXISTS equipment_maintenance_logs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id         uuid        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  equipment_name   text        NOT NULL,
  service_type     text        NOT NULL CHECK (service_type IN ('service','repair','calibration','inspection','other')),
  service_date     date        NOT NULL,
  next_due_date    date,
  engineer_name    text,
  notes            text,
  recorded_by      uuid        REFERENCES staff(id),
  recorded_by_name text,
  recorded_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE equipment_maintenance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "equipment_maintenance_open" ON equipment_maintenance_logs
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX ON equipment_maintenance_logs (venue_id, service_date DESC);
