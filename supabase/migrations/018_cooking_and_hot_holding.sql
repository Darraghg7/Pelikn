-- Migration 018: Cooking temps, reheating temps, and hot holding checks
-- UK EHO requirement: log temperatures for cooking (≥75°C), reheating (≥75°C),
-- and twice-daily hot holding checks (≥63°C).

-- ── cooking_temp_logs ────────────────────────────────────────────────────────
-- Stores cooking and reheating temperature readings per venue.
CREATE TABLE IF NOT EXISTS cooking_temp_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id       uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  check_type     text NOT NULL CHECK (check_type IN ('cooking', 'reheating')),
  food_item      text NOT NULL,
  temperature    numeric NOT NULL,
  target_temp    numeric NOT NULL DEFAULT 75,
  logged_by      uuid,
  logged_by_name text,
  logged_at      timestamptz NOT NULL DEFAULT now(),
  notes          text
);

ALTER TABLE cooking_temp_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cooking_logs_all" ON cooking_temp_logs;
CREATE POLICY "cooking_logs_all" ON cooking_temp_logs
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS cooking_temp_logs_venue_logged ON cooking_temp_logs (venue_id, logged_at DESC);

-- ── hot_holding_items ────────────────────────────────────────────────────────
-- Configurable list of hot-held food items per venue (e.g. soup, gravy, lasagne).
CREATE TABLE IF NOT EXISTS hot_holding_items (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id  uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name      text NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE hot_holding_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hot_holding_items_all" ON hot_holding_items;
CREATE POLICY "hot_holding_items_all" ON hot_holding_items
  FOR ALL USING (true) WITH CHECK (true);

-- ── hot_holding_logs ─────────────────────────────────────────────────────────
-- Stores twice-daily (AM / PM) hot holding temperature readings per venue.
-- UK requirement: hot food held for service must be ≥63°C.
CREATE TABLE IF NOT EXISTS hot_holding_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id       uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  item_id        uuid REFERENCES hot_holding_items(id) ON DELETE SET NULL,
  item_name      text NOT NULL,
  temperature    numeric NOT NULL,
  check_period   text NOT NULL CHECK (check_period IN ('am', 'pm')),
  logged_by      uuid,
  logged_by_name text,
  logged_at      timestamptz NOT NULL DEFAULT now(),
  notes          text
);

ALTER TABLE hot_holding_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hot_holding_logs_all" ON hot_holding_logs;
CREATE POLICY "hot_holding_logs_all" ON hot_holding_logs
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS hot_holding_logs_venue_logged ON hot_holding_logs (venue_id, logged_at DESC);
