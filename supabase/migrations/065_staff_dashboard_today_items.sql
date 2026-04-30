-- Migration 065: Per-staff manager dashboard "Today" preferences
-- Stores which daily sections/checks each manager wants in their Today view.

CREATE TABLE IF NOT EXISTS staff_dashboard_today_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id   uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  staff_id   uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  item_id    text NOT NULL,
  position   integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (venue_id, staff_id, item_id)
);

CREATE INDEX IF NOT EXISTS staff_dashboard_today_items_staff_idx
  ON staff_dashboard_today_items (venue_id, staff_id, position);

ALTER TABLE staff_dashboard_today_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_dashboard_today_items_read ON staff_dashboard_today_items;
CREATE POLICY staff_dashboard_today_items_read
  ON staff_dashboard_today_items FOR SELECT
  USING (true);

DROP POLICY IF EXISTS staff_dashboard_today_items_write ON staff_dashboard_today_items;
CREATE POLICY staff_dashboard_today_items_write
  ON staff_dashboard_today_items FOR ALL
  USING (true)
  WITH CHECK (true);
