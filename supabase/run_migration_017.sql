-- ============================================================================
-- RUN THIS IN YOUR SUPABASE SQL EDITOR
-- Migration 017: Multi-tenancy setup for SafeServ
--
-- This script is idempotent and handles missing tables gracefully.
-- ============================================================================

-- ── Pre-flight: Drop functions whose return types are changing ──────────────
-- PostgreSQL won't let you change a function's return type in-place.
DROP FUNCTION IF EXISTS validate_staff_session(uuid);
DROP FUNCTION IF EXISTS verify_staff_pin_and_create_session(uuid, text);
DROP FUNCTION IF EXISTS verify_staff_pin_and_create_session(uuid, text, uuid);
DROP FUNCTION IF EXISTS record_clock_event(uuid, text);
DROP FUNCTION IF EXISTS record_clock_event(uuid, text, uuid);

-- ── 0. First, ensure ALL tables exist (some migrations may not have run) ────

-- From 007_opening_closing
CREATE TABLE IF NOT EXISTS opening_closing_checks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('opening', 'closing')),
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

-- RLS for opening_closing tables
ALTER TABLE opening_closing_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE opening_closing_completions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "oc_checks_select" ON opening_closing_checks;
DROP POLICY IF EXISTS "oc_checks_write" ON opening_closing_checks;
DROP POLICY IF EXISTS "oc_comps_select" ON opening_closing_completions;
DROP POLICY IF EXISTS "oc_comps_write" ON opening_closing_completions;
CREATE POLICY "oc_checks_select"  ON opening_closing_checks      FOR SELECT USING (true);
CREATE POLICY "oc_checks_write"   ON opening_closing_checks      FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "oc_comps_select"   ON opening_closing_completions FOR SELECT USING (true);
CREATE POLICY "oc_comps_write"    ON opening_closing_completions FOR ALL    USING (true) WITH CHECK (true);

-- From 008_waste_orders_photos_push
CREATE TABLE IF NOT EXISTS waste_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name   TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'other',
  quantity    NUMERIC(8,2) NOT NULL DEFAULT 1,
  unit        TEXT NOT NULL DEFAULT 'units',
  cost        NUMERIC(8,2),
  reason      TEXT,
  logged_by   UUID REFERENCES staff(id),
  logged_at   TIMESTAMPTZ DEFAULT now(),
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE waste_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS waste_logs_read ON waste_logs;
DROP POLICY IF EXISTS waste_logs_write ON waste_logs;
CREATE POLICY waste_logs_read  ON waste_logs FOR SELECT USING (true);
CREATE POLICY waste_logs_write ON waste_logs FOR ALL    USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS suppliers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  email      TEXT,
  phone      TEXT,
  notes      TEXT,
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS suppliers_read ON suppliers;
DROP POLICY IF EXISTS suppliers_write ON suppliers;
CREATE POLICY suppliers_read  ON suppliers FOR SELECT USING (true);
CREATE POLICY suppliers_write ON suppliers FOR ALL    USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS supplier_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id   UUID REFERENCES suppliers(id),
  supplier_name TEXT,
  order_date    DATE DEFAULT CURRENT_DATE,
  status        TEXT DEFAULT 'pending',
  notes         TEXT,
  created_by    UUID REFERENCES staff(id),
  created_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE supplier_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS supplier_orders_read ON supplier_orders;
DROP POLICY IF EXISTS supplier_orders_write ON supplier_orders;
CREATE POLICY supplier_orders_read  ON supplier_orders FOR SELECT USING (true);
CREATE POLICY supplier_orders_write ON supplier_orders FOR ALL    USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS supplier_order_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES supplier_orders(id) ON DELETE CASCADE,
  item_name     TEXT NOT NULL,
  quantity      NUMERIC(8,2) DEFAULT 1,
  unit          TEXT DEFAULT 'units',
  notes         TEXT
);
ALTER TABLE supplier_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS supplier_order_items_read ON supplier_order_items;
DROP POLICY IF EXISTS supplier_order_items_write ON supplier_order_items;
CREATE POLICY supplier_order_items_read  ON supplier_order_items FOR SELECT USING (true);
CREATE POLICY supplier_order_items_write ON supplier_order_items FOR ALL    USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     UUID REFERENCES staff(id),
  endpoint     TEXT NOT NULL,
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_subscriptions_read ON push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_write ON push_subscriptions;
CREATE POLICY push_subscriptions_read  ON push_subscriptions FOR SELECT USING (true);
CREATE POLICY push_subscriptions_write ON push_subscriptions FOR ALL    USING (true) WITH CHECK (true);

-- From 010_delivery_probe_corrective
CREATE TABLE IF NOT EXISTS delivery_checks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name TEXT NOT NULL,
  items_desc    TEXT,
  temp_reading  NUMERIC(4,1),
  temp_pass     BOOLEAN DEFAULT true,
  packaging_ok  BOOLEAN DEFAULT true,
  use_by_ok     BOOLEAN DEFAULT true,
  overall_pass  BOOLEAN DEFAULT true,
  photo_url     TEXT,
  notes         TEXT,
  checked_by    UUID REFERENCES staff(id),
  checked_at    TIMESTAMPTZ DEFAULT now(),
  created_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE delivery_checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS delivery_checks_read ON delivery_checks;
DROP POLICY IF EXISTS delivery_checks_write ON delivery_checks;
CREATE POLICY delivery_checks_read  ON delivery_checks FOR SELECT USING (true);
CREATE POLICY delivery_checks_write ON delivery_checks FOR ALL    USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS probe_calibrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  probe_name      TEXT NOT NULL DEFAULT 'Probe 1',
  method          TEXT NOT NULL DEFAULT 'ice_water',
  expected_temp   NUMERIC(4,1) NOT NULL DEFAULT 0.0,
  actual_reading  NUMERIC(4,1) NOT NULL,
  tolerance       NUMERIC(3,1) NOT NULL DEFAULT 1.0,
  pass            BOOLEAN GENERATED ALWAYS AS (abs(actual_reading - expected_temp) <= tolerance) STORED,
  calibrated_by   UUID REFERENCES staff(id),
  calibrated_at   TIMESTAMPTZ DEFAULT now(),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE probe_calibrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS probe_calibrations_read ON probe_calibrations;
DROP POLICY IF EXISTS probe_calibrations_write ON probe_calibrations;
CREATE POLICY probe_calibrations_read  ON probe_calibrations FOR SELECT USING (true);
CREATE POLICY probe_calibrations_write ON probe_calibrations FOR ALL    USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS corrective_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category        TEXT NOT NULL DEFAULT 'other',
  title           TEXT NOT NULL,
  description     TEXT,
  action_taken    TEXT NOT NULL,
  severity        TEXT NOT NULL DEFAULT 'minor',
  status          TEXT NOT NULL DEFAULT 'open',
  reported_by     UUID REFERENCES staff(id),
  resolved_by     UUID REFERENCES staff(id),
  reported_at     TIMESTAMPTZ DEFAULT now(),
  resolved_at     TIMESTAMPTZ,
  linked_type     TEXT,
  linked_id       UUID,
  created_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE corrective_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS corrective_actions_read ON corrective_actions;
DROP POLICY IF EXISTS corrective_actions_write ON corrective_actions;
CREATE POLICY corrective_actions_read  ON corrective_actions FOR SELECT USING (true);
CREATE POLICY corrective_actions_write ON corrective_actions FOR ALL    USING (true) WITH CHECK (true);

-- From 011_dashboard_widgets
CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id   UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  widget_id  TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_widgets_staff_widget
  ON dashboard_widgets (staff_id, widget_id);
ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dashboard_widgets_read ON dashboard_widgets;
DROP POLICY IF EXISTS dashboard_widgets_write ON dashboard_widgets;
CREATE POLICY dashboard_widgets_read  ON dashboard_widgets FOR SELECT USING (true);
CREATE POLICY dashboard_widgets_write ON dashboard_widgets FOR ALL    USING (true) WITH CHECK (true);

-- From 012_supplier_items
CREATE TABLE IF NOT EXISTS supplier_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  unit        TEXT DEFAULT 'units',
  par_level   NUMERIC(8,2),
  notes       TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE supplier_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS supplier_items_read ON supplier_items;
DROP POLICY IF EXISTS supplier_items_write ON supplier_items;
CREATE POLICY supplier_items_read  ON supplier_items FOR SELECT USING (true);
CREATE POLICY supplier_items_write ON supplier_items FOR ALL    USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS delivery_check_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_check_id UUID NOT NULL REFERENCES delivery_checks(id) ON DELETE CASCADE,
  item_name         TEXT NOT NULL,
  quantity          NUMERIC(8,2),
  unit              TEXT DEFAULT 'units',
  temp_reading      NUMERIC(4,1),
  temp_pass         BOOLEAN DEFAULT true,
  notes             TEXT
);
ALTER TABLE delivery_check_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS delivery_check_items_read ON delivery_check_items;
DROP POLICY IF EXISTS delivery_check_items_write ON delivery_check_items;
CREATE POLICY delivery_check_items_read  ON delivery_check_items FOR SELECT USING (true);
CREATE POLICY delivery_check_items_write ON delivery_check_items FOR ALL    USING (true) WITH CHECK (true);

-- From 013_time_off
CREATE TABLE IF NOT EXISTS time_off_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id      UUID NOT NULL REFERENCES staff(id),
  staff_name    TEXT,
  type          TEXT NOT NULL DEFAULT 'annual_leave',
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',
  manager_note  TEXT,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE time_off_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS time_off_requests_read ON time_off_requests;
DROP POLICY IF EXISTS time_off_requests_write ON time_off_requests;
CREATE POLICY time_off_requests_read  ON time_off_requests FOR SELECT USING (true);
CREATE POLICY time_off_requests_write ON time_off_requests FOR ALL    USING (true) WITH CHECK (true);

-- From 014_staff_availability
CREATE TABLE IF NOT EXISTS staff_availability (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id   UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time  TIME,
  end_time    TIME,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE staff_availability ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_availability_read ON staff_availability;
DROP POLICY IF EXISTS staff_availability_write ON staff_availability;
CREATE POLICY staff_availability_read  ON staff_availability FOR SELECT USING (true);
CREATE POLICY staff_availability_write ON staff_availability FOR ALL    USING (true) WITH CHECK (true);

-- ============================================================================
-- Now proceed with the actual multi-tenancy migration
-- ============================================================================

-- ── 1. Venues table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS venues (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL,
  owner_id   UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_venues_slug ON venues (lower(slug));

ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "venues_public_read" ON venues;
CREATE POLICY "venues_public_read" ON venues FOR SELECT USING (true);
DROP POLICY IF EXISTS "venues_public_write" ON venues;
CREATE POLICY "venues_public_write" ON venues FOR ALL USING (true) WITH CHECK (true);

-- ── 2. Create venues ────────────────────────────────────────────────────────

INSERT INTO venues (id, name, slug)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  COALESCE((SELECT value FROM app_settings WHERE key = 'venue_name' LIMIT 1), 'Nomad Bakes'),
  'nomad-bakes'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO venues (id, name, slug)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Sandbox',
  'sandbox'
)
ON CONFLICT (id) DO NOTHING;

-- ── 3. Add venue_id to all tables ───────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='venue_id') THEN
    ALTER TABLE staff ADD COLUMN venue_id uuid REFERENCES venues(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_sessions' AND column_name='venue_id') THEN
    ALTER TABLE staff_sessions ADD COLUMN venue_id uuid REFERENCES venues(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fridges' AND column_name='venue_id') THEN
    ALTER TABLE fridges ADD COLUMN venue_id uuid REFERENCES venues(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fridge_temperature_logs' AND column_name='venue_id') THEN
    ALTER TABLE fridge_temperature_logs ADD COLUMN venue_id uuid REFERENCES venues(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='food_items' AND column_name='venue_id') THEN
    ALTER TABLE food_items ADD COLUMN venue_id uuid REFERENCES venues(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='food_allergens' AND column_name='venue_id') THEN
    ALTER TABLE food_allergens ADD COLUMN venue_id uuid REFERENCES venues(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shifts' AND column_name='venue_id') THEN
    ALTER TABLE shifts ADD COLUMN venue_id uuid REFERENCES venues(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clock_events' AND column_name='venue_id') THEN
    ALTER TABLE clock_events ADD COLUMN venue_id uuid REFERENCES venues(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='task_templates' AND column_name='venue_id') THEN
    ALTER TABLE task_templates ADD COLUMN venue_id uuid REFERENCES venues(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='task_one_offs' AND column_name='venue_id') THEN
    ALTER TABLE task_one_offs ADD COLUMN venue_id uuid REFERENCES venues(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='task_completions' AND column_name='venue_id') THEN
    ALTER TABLE task_completions ADD COLUMN venue_id uuid REFERENCES venues(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cleaning_tasks' AND column_name='venue_id') THEN
    ALTER TABLE cleaning_tasks ADD COLUMN venue_id uuid REFERENCES venues(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cleaning_completions' AND column_name='venue_id') THEN
    ALTER TABLE cleaning_completions ADD COLUMN venue_id uuid REFERENCES venues(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='opening_closing_checks' AND column_name='venue_id') THEN
    ALTER TABLE opening_closing_checks ADD COLUMN venue_id uuid REFERENCES venues(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='opening_closing_completions' AND column_name='venue_id') THEN
    ALTER TABLE opening_closing_completions ADD COLUMN venue_id uuid REFERENCES venues(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='waste_logs' AND column_name='venue_id') THEN
    ALTER TABLE waste_logs ADD COLUMN venue_id uuid REFERENCES venues(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='venue_id') THEN
    ALTER TABLE suppliers ADD COLUMN venue_id uuid REFERENCES venues(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='supplier_items' AND column_name='venue_id') THEN
    ALTER TABLE supplier_items ADD COLUMN venue_id uuid REFERENCES venues(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='supplier_orders' AND column_name='venue_id') THEN
    ALTER TABLE supplier_orders ADD COLUMN venue_id uuid REFERENCES venues(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='supplier_order_items' AND column_name='venue_id') THEN
    ALTER TABLE supplier_order_items ADD COLUMN venue_id uuid REFERENCES venues(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_checks' AND column_name='venue_id') THEN
    ALTER TABLE delivery_checks ADD COLUMN venue_id uuid REFERENCES venues(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_check_items' AND column_name='venue_id') THEN
    ALTER TABLE delivery_check_items ADD COLUMN venue_id uuid REFERENCES venues(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='probe_calibrations' AND column_name='venue_id') THEN
    ALTER TABLE probe_calibrations ADD COLUMN venue_id uuid REFERENCES venues(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='corrective_actions' AND column_name='venue_id') THEN
    ALTER TABLE corrective_actions ADD COLUMN venue_id uuid REFERENCES venues(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_training' AND column_name='venue_id') THEN
    ALTER TABLE staff_training ADD COLUMN venue_id uuid REFERENCES venues(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shift_swaps' AND column_name='venue_id') THEN
    ALTER TABLE shift_swaps ADD COLUMN venue_id uuid REFERENCES venues(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='time_off_requests' AND column_name='venue_id') THEN
    ALTER TABLE time_off_requests ADD COLUMN venue_id uuid REFERENCES venues(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_availability' AND column_name='venue_id') THEN
    ALTER TABLE staff_availability ADD COLUMN venue_id uuid REFERENCES venues(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dashboard_widgets' AND column_name='venue_id') THEN
    ALTER TABLE dashboard_widgets ADD COLUMN venue_id uuid REFERENCES venues(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='push_subscriptions' AND column_name='venue_id') THEN
    ALTER TABLE push_subscriptions ADD COLUMN venue_id uuid REFERENCES venues(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='app_settings' AND column_name='venue_id') THEN
    ALTER TABLE app_settings ADD COLUMN venue_id uuid REFERENCES venues(id);
  END IF;
END $$;

-- ── 4. Backfill all rows with Nomad Bakes venue ────────────────────────────

UPDATE staff SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;
UPDATE staff_sessions SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;
UPDATE fridges SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;
UPDATE fridge_temperature_logs SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;
UPDATE food_items SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;
UPDATE food_allergens SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;
UPDATE shifts SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;
UPDATE clock_events SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;
UPDATE task_templates SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;
UPDATE task_one_offs SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;
UPDATE task_completions SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;
UPDATE cleaning_tasks SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;
UPDATE cleaning_completions SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;
UPDATE opening_closing_checks SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;
UPDATE opening_closing_completions SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;
UPDATE waste_logs SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;
UPDATE suppliers SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;
UPDATE supplier_items SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;
UPDATE supplier_orders SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;
UPDATE supplier_order_items SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;
UPDATE delivery_checks SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;
UPDATE delivery_check_items SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;
UPDATE probe_calibrations SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;
UPDATE corrective_actions SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;
UPDATE staff_training SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;
UPDATE shift_swaps SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;
UPDATE time_off_requests SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;
UPDATE staff_availability SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;
UPDATE dashboard_widgets SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;
UPDATE push_subscriptions SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;
UPDATE app_settings SET venue_id = '00000000-0000-0000-0000-000000000001' WHERE venue_id IS NULL;

-- ── 5. Make venue_id NOT NULL ───────────────────────────────────────────────

ALTER TABLE staff ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE staff_sessions ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE fridges ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE fridge_temperature_logs ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE food_items ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE food_allergens ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE shifts ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE clock_events ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE task_templates ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE task_one_offs ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE task_completions ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE cleaning_tasks ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE cleaning_completions ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE opening_closing_checks ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE opening_closing_completions ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE waste_logs ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE suppliers ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE supplier_items ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE supplier_orders ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE supplier_order_items ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE delivery_checks ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE delivery_check_items ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE probe_calibrations ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE corrective_actions ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE staff_training ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE shift_swaps ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE time_off_requests ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE staff_availability ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE dashboard_widgets ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE push_subscriptions ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE app_settings ALTER COLUMN venue_id SET NOT NULL;

-- Fix app_settings PK to be composite (venue_id, key)
ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_pkey;
ALTER TABLE app_settings ADD PRIMARY KEY (venue_id, key);

-- Fix suppliers unique constraint to be per-venue
DROP INDEX IF EXISTS idx_suppliers_name;
CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers (venue_id, lower(name));

-- Fix fridges unique constraint to be per-venue
ALTER TABLE fridges DROP CONSTRAINT IF EXISTS fridges_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_fridges_name_venue ON fridges (venue_id, lower(name));

-- ── 6. Indexes ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_staff_venue ON staff(venue_id);
CREATE INDEX IF NOT EXISTS idx_fridges_venue ON fridges(venue_id);
CREATE INDEX IF NOT EXISTS idx_fridge_logs_venue ON fridge_temperature_logs(venue_id);
CREATE INDEX IF NOT EXISTS idx_shifts_venue ON shifts(venue_id, week_start);
CREATE INDEX IF NOT EXISTS idx_clock_events_venue ON clock_events(venue_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_venue ON cleaning_tasks(venue_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_completions_venue ON cleaning_completions(venue_id);
CREATE INDEX IF NOT EXISTS idx_food_items_venue ON food_items(venue_id);
CREATE INDEX IF NOT EXISTS idx_task_templates_venue ON task_templates(venue_id);
CREATE INDEX IF NOT EXISTS idx_task_completions_venue ON task_completions(venue_id);
CREATE INDEX IF NOT EXISTS idx_opening_closing_checks_venue ON opening_closing_checks(venue_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_venue ON suppliers(venue_id);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_venue ON supplier_orders(venue_id);
CREATE INDEX IF NOT EXISTS idx_delivery_checks_venue ON delivery_checks(venue_id);
CREATE INDEX IF NOT EXISTS idx_probe_calibrations_venue ON probe_calibrations(venue_id);
CREATE INDEX IF NOT EXISTS idx_corrective_actions_venue ON corrective_actions(venue_id);
CREATE INDEX IF NOT EXISTS idx_staff_training_venue ON staff_training(venue_id);
CREATE INDEX IF NOT EXISTS idx_waste_logs_venue ON waste_logs(venue_id);
CREATE INDEX IF NOT EXISTS idx_time_off_requests_venue ON time_off_requests(venue_id);
CREATE INDEX IF NOT EXISTS idx_shift_swaps_venue ON shift_swaps(venue_id);
CREATE INDEX IF NOT EXISTS idx_staff_availability_venue ON staff_availability(venue_id);

-- ── 7. Update RPC functions ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION verify_staff_pin_and_create_session(
  p_staff_id uuid,
  p_pin      text,
  p_venue_id uuid DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_hash     text;
  v_token    uuid;
  v_venue_id uuid;
BEGIN
  SELECT pin_hash, venue_id INTO v_hash, v_venue_id
  FROM staff
  WHERE id = p_staff_id AND is_active = true;

  IF v_hash IS NULL THEN RETURN NULL; END IF;
  IF crypt(p_pin, v_hash) <> v_hash THEN RETURN NULL; END IF;
  IF p_venue_id IS NOT NULL AND v_venue_id <> p_venue_id THEN RETURN NULL; END IF;

  DELETE FROM staff_sessions WHERE staff_id = p_staff_id AND expires_at < now();
  INSERT INTO staff_sessions (staff_id, venue_id)
  VALUES (p_staff_id, v_venue_id)
  RETURNING token INTO v_token;
  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION validate_staff_session(p_token uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT venue_id::text FROM staff_sessions
  WHERE token = p_token AND expires_at > now()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION record_clock_event(
  p_staff_id   uuid,
  p_event_type text,
  p_venue_id   uuid DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_venue_id uuid;
BEGIN
  IF p_venue_id IS NOT NULL THEN
    v_venue_id := p_venue_id;
  ELSE
    SELECT venue_id INTO v_venue_id FROM staff WHERE id = p_staff_id;
  END IF;
  INSERT INTO clock_events (staff_id, event_type, venue_id)
  VALUES (p_staff_id, p_event_type, v_venue_id);
END;
$$;

CREATE OR REPLACE FUNCTION complete_task(
  p_token       uuid,
  p_template_id uuid DEFAULT NULL,
  p_one_off_id  uuid DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_staff_id   uuid;
  v_staff_name text;
  v_venue_id   uuid;
BEGIN
  SELECT ss.staff_id, s.name, ss.venue_id
  INTO v_staff_id, v_staff_name, v_venue_id
  FROM staff_sessions ss
  JOIN staff s ON s.id = ss.staff_id
  WHERE ss.token = p_token AND ss.expires_at > now();

  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired session';
  END IF;

  INSERT INTO task_completions (
    task_template_id, task_one_off_id,
    completion_date, completed_by_staff_id, completed_by_name, venue_id
  ) VALUES (
    p_template_id, p_one_off_id,
    CURRENT_DATE, v_staff_id, v_staff_name, v_venue_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION complete_cleaning_task(
  p_token            uuid,
  p_cleaning_task_id uuid,
  p_notes            text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_staff_id   uuid;
  v_staff_name text;
  v_venue_id   uuid;
BEGIN
  SELECT ss.staff_id, s.name, ss.venue_id
  INTO v_staff_id, v_staff_name, v_venue_id
  FROM staff_sessions ss
  JOIN staff s ON s.id = ss.staff_id
  WHERE ss.token = p_token AND ss.expires_at > now();

  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired session';
  END IF;

  INSERT INTO cleaning_completions (
    cleaning_task_id, completed_by_staff_id, completed_by_name, notes, venue_id
  ) VALUES (
    p_cleaning_task_id, v_staff_id, v_staff_name, p_notes, v_venue_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION create_staff_member(
  p_session_token UUID,
  p_name          TEXT,
  p_job_role      TEXT,
  p_pin           TEXT,
  p_role          TEXT     DEFAULT 'staff',
  p_email         TEXT     DEFAULT NULL,
  p_hourly_rate   NUMERIC  DEFAULT 0,
  p_skills        text[]   DEFAULT '{}'
) RETURNS UUID
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, extensions
AS $$
DECLARE
  v_new_id   UUID;
  v_venue_id UUID;
BEGIN
  SELECT ss.venue_id INTO v_venue_id
  FROM staff_sessions ss
  JOIN staff s ON s.id = ss.staff_id
  WHERE ss.token = p_session_token
    AND ss.expires_at > now()
    AND s.role IN ('manager', 'owner')
    AND s.is_active = true;

  IF v_venue_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_role NOT IN ('staff', 'manager', 'owner') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  INSERT INTO staff (name, email, pin_hash, role, job_role, hourly_rate, skills, is_active, venue_id)
  VALUES (p_name, p_email, crypt(p_pin, gen_salt('bf')), p_role, p_job_role, p_hourly_rate, p_skills, true, v_venue_id)
  RETURNING id INTO v_new_id;
  RETURN v_new_id;
END;
$$;

CREATE OR REPLACE FUNCTION update_staff_member(
  p_session_token  UUID,
  p_staff_id       UUID,
  p_name           TEXT,
  p_job_role       TEXT,
  p_role           TEXT     DEFAULT NULL,
  p_email          TEXT     DEFAULT NULL,
  p_hourly_rate    NUMERIC  DEFAULT NULL,
  p_new_pin        TEXT     DEFAULT NULL,
  p_show_temp_logs BOOLEAN  DEFAULT NULL,
  p_show_allergens BOOLEAN  DEFAULT NULL,
  p_skills         text[]   DEFAULT NULL
) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, extensions
AS $$
DECLARE
  v_venue_id UUID;
BEGIN
  SELECT ss.venue_id INTO v_venue_id
  FROM staff_sessions ss
  JOIN staff s ON s.id = ss.staff_id
  WHERE ss.token = p_session_token
    AND ss.expires_at > now()
    AND s.role IN ('manager', 'owner')
    AND s.is_active = true;

  IF v_venue_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE staff SET
    name           = p_name,
    job_role       = p_job_role,
    role           = COALESCE(p_role,           role),
    email          = COALESCE(p_email,          email),
    hourly_rate    = COALESCE(p_hourly_rate,    hourly_rate),
    pin_hash       = CASE WHEN p_new_pin IS NOT NULL
                      THEN crypt(p_new_pin, gen_salt('bf'))
                      ELSE pin_hash END,
    show_temp_logs = COALESCE(p_show_temp_logs, show_temp_logs),
    show_allergens = COALESCE(p_show_allergens, show_allergens),
    skills         = COALESCE(p_skills,         skills)
  WHERE id = p_staff_id AND venue_id = v_venue_id;
END;
$$;

CREATE OR REPLACE FUNCTION deactivate_staff_member(
  p_session_token UUID,
  p_staff_id      UUID
) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_venue_id UUID;
BEGIN
  SELECT ss.venue_id INTO v_venue_id
  FROM staff_sessions ss
  JOIN staff s ON s.id = ss.staff_id
  WHERE ss.token = p_session_token
    AND ss.expires_at > now()
    AND s.role IN ('manager', 'owner')
    AND s.is_active = true;

  IF v_venue_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE staff SET is_active = false WHERE id = p_staff_id AND venue_id = v_venue_id;
END;
$$;

CREATE OR REPLACE FUNCTION reactivate_staff_member(
  p_session_token UUID,
  p_staff_id      UUID
) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_venue_id UUID;
BEGIN
  SELECT ss.venue_id INTO v_venue_id
  FROM staff_sessions ss
  JOIN staff s ON s.id = ss.staff_id
  WHERE ss.token = p_session_token
    AND ss.expires_at > now()
    AND s.role IN ('manager', 'owner')
    AND s.is_active = true;

  IF v_venue_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE staff SET is_active = true WHERE id = p_staff_id AND venue_id = v_venue_id;
END;
$$;

CREATE OR REPLACE FUNCTION create_swap_request(
  p_token           uuid,
  p_shift_id        uuid,
  p_target_staff_id uuid,
  p_message         text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_staff_id    uuid;
  v_staff_name  text;
  v_target_name text;
  v_venue_id    uuid;
  v_new_id      uuid;
BEGIN
  SELECT ss.staff_id, s.name, ss.venue_id
  INTO v_staff_id, v_staff_name, v_venue_id
  FROM staff_sessions ss
  JOIN staff s ON s.id = ss.staff_id
  WHERE ss.token = p_token AND ss.expires_at > now();

  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired session';
  END IF;

  SELECT name INTO v_target_name FROM staff WHERE id = p_target_staff_id AND venue_id = v_venue_id;

  INSERT INTO shift_swaps (
    shift_id, requester_id, requester_name,
    target_staff_id, target_staff_name, message, venue_id
  ) VALUES (
    p_shift_id, v_staff_id, v_staff_name,
    p_target_staff_id, v_target_name, p_message, v_venue_id
  ) RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

CREATE OR REPLACE FUNCTION resolve_swap_request(
  p_session_token UUID,
  p_swap_id       UUID,
  p_action        TEXT,
  p_manager_note  TEXT DEFAULT NULL
) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_venue_id  UUID;
  v_shift_id  UUID;
  v_target_id UUID;
BEGIN
  SELECT ss.venue_id INTO v_venue_id
  FROM staff_sessions ss
  JOIN staff s ON s.id = ss.staff_id
  WHERE ss.token = p_session_token
    AND ss.expires_at > now()
    AND s.role IN ('manager', 'owner')
    AND s.is_active = true;

  IF v_venue_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_action = 'approved' THEN
    SELECT shift_id, target_staff_id INTO v_shift_id, v_target_id
    FROM shift_swaps WHERE id = p_swap_id AND venue_id = v_venue_id;
    UPDATE shifts SET staff_id = v_target_id WHERE id = v_shift_id AND venue_id = v_venue_id;
  END IF;

  UPDATE shift_swaps SET
    status       = p_action,
    manager_note = p_manager_note,
    resolved_at  = now()
  WHERE id = p_swap_id AND venue_id = v_venue_id;
END;
$$;

CREATE OR REPLACE FUNCTION create_venue_with_owner(
  p_venue_name text,
  p_slug       text,
  p_owner_name text,
  p_owner_pin  text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_venue_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM venues WHERE lower(slug) = lower(p_slug)) THEN
    RAISE EXCEPTION 'Venue slug already taken';
  END IF;

  INSERT INTO venues (name, slug, owner_id)
  VALUES (p_venue_name, p_slug, auth.uid())
  RETURNING id INTO v_venue_id;

  INSERT INTO staff (name, pin_hash, role, job_role, venue_id, is_active)
  VALUES (p_owner_name, crypt(p_owner_pin, gen_salt('bf')), 'owner', 'foh', v_venue_id, true);

  INSERT INTO app_settings (venue_id, key, value) VALUES
    (v_venue_id, 'venue_name', p_venue_name),
    (v_venue_id, 'manager_email', '');

  RETURN v_venue_id;
END;
$$;

-- ── 8. Set up manager_email entries ─────────────────────────────────────────

UPDATE app_settings
SET value = 'nomad.bakes1@gmail.com'
WHERE key = 'manager_email'
  AND venue_id = '00000000-0000-0000-0000-000000000001';

-- If no manager_email row existed, insert it
INSERT INTO app_settings (venue_id, key, value)
VALUES ('00000000-0000-0000-0000-000000000001', 'manager_email', 'nomad.bakes1@gmail.com')
ON CONFLICT (venue_id, key) DO UPDATE SET value = EXCLUDED.value;

-- Sandbox settings
INSERT INTO app_settings (venue_id, key, value) VALUES
  ('00000000-0000-0000-0000-000000000002', 'venue_name', 'Sandbox'),
  ('00000000-0000-0000-0000-000000000002', 'manager_email', 'sandbox@safeserv.app')
ON CONFLICT (venue_id, key) DO UPDATE SET value = EXCLUDED.value;

-- ============================================================================
-- DONE!
--
-- Next steps:
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Verify nomad.bakes1@gmail.com exists (it should)
-- 3. Create user: sandbox@safeserv.app / Dearbhala31! (Auto Confirm)
-- 4. Test login at your app URL
-- ============================================================================
