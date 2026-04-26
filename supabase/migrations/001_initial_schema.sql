-- Pelikn initial schema
-- Safe to run multiple times — drops everything and recreates from scratch.
-- Paste the entire file into the Supabase SQL Editor and click Run.

-- ─────────────────────────────────────────────────────────
-- CLEAN SLATE  (drop in reverse dependency order)
-- ─────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS record_clock_event(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS invalidate_staff_session(uuid) CASCADE;
DROP FUNCTION IF EXISTS validate_staff_session(uuid) CASCADE;
DROP FUNCTION IF EXISTS verify_staff_pin(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS verify_staff_pin_and_create_session(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS hash_staff_pin(text) CASCADE;

DROP TABLE IF EXISTS clock_events       CASCADE;
DROP TABLE IF EXISTS shifts             CASCADE;
DROP TABLE IF EXISTS food_allergens     CASCADE;
DROP TABLE IF EXISTS food_items         CASCADE;
DROP TABLE IF EXISTS fridge_temperature_logs CASCADE;
DROP TABLE IF EXISTS fridges            CASCADE;
DROP TABLE IF EXISTS staff_sessions     CASCADE;
DROP TABLE IF EXISTS staff              CASCADE;

-- ─────────────────────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────────────────
-- TABLES
-- ─────────────────────────────────────────────────────────

CREATE TABLE staff (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  email      text,
  pin_hash   text NOT NULL,
  role       text NOT NULL DEFAULT 'staff' CHECK (role IN ('staff', 'manager')),
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE staff_sessions (
  token      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id   uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '8 hours')
);

CREATE TABLE fridges (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name      text NOT NULL UNIQUE,
  min_temp  numeric(4,1) NOT NULL DEFAULT 0.0,
  max_temp  numeric(4,1) NOT NULL DEFAULT 5.0,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE fridge_temperature_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fridge_id      uuid REFERENCES fridges(id),
  fridge_name    text NOT NULL,
  temperature    numeric(5,1) NOT NULL,
  logged_by      uuid REFERENCES staff(id),
  logged_by_name text,
  notes          text,
  logged_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE food_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE food_allergens (
  food_item_id uuid NOT NULL REFERENCES food_items(id) ON DELETE CASCADE,
  allergen     text NOT NULL,
  PRIMARY KEY (food_item_id, allergen),
  CONSTRAINT valid_allergen CHECK (allergen IN (
    'Celery', 'Gluten', 'Crustaceans', 'Eggs', 'Fish',
    'Lupin', 'Milk', 'Molluscs', 'Mustard', 'Tree Nuts',
    'Peanuts', 'Sesame', 'Soya', 'Sulphur Dioxide'
  ))
);

CREATE TABLE shifts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL,
  staff_id   uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  shift_date date NOT NULL,
  start_time time NOT NULL,
  end_time   time NOT NULL,
  role_label text NOT NULL,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE clock_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  event_type  text NOT NULL CHECK (event_type IN ('clock_in','break_start','break_end','clock_out')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  notes       text
);

-- ─────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────

CREATE INDEX idx_fridge_logs_fridge_id   ON fridge_temperature_logs(fridge_id);
CREATE INDEX idx_fridge_logs_logged_at   ON fridge_temperature_logs(logged_at DESC);
CREATE INDEX idx_shifts_week_start       ON shifts(week_start);
CREATE INDEX idx_clock_events_staff_date ON clock_events(staff_id, occurred_at DESC);
CREATE INDEX idx_staff_sessions_expiry   ON staff_sessions(expires_at);

-- ─────────────────────────────────────────────────────────
-- FUNCTIONS  (SECURITY DEFINER — bypass RLS for PIN auth)
-- ─────────────────────────────────────────────────────────

-- Hash a PIN with bcrypt (used when creating/updating staff)
CREATE FUNCTION hash_staff_pin(p_pin text)
RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT crypt(p_pin, gen_salt('bf', 8));
$$;

-- Verify PIN and return a new session token (NULL on failure)
CREATE FUNCTION verify_staff_pin_and_create_session(p_staff_id uuid, p_pin text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_hash  text;
  v_token uuid;
BEGIN
  SELECT pin_hash INTO v_hash FROM staff WHERE id = p_staff_id AND is_active = true;
  IF v_hash IS NULL THEN RETURN NULL; END IF;
  IF crypt(p_pin, v_hash) <> v_hash THEN RETURN NULL; END IF;

  DELETE FROM staff_sessions WHERE staff_id = p_staff_id AND expires_at < now();
  INSERT INTO staff_sessions (staff_id) VALUES (p_staff_id) RETURNING token INTO v_token;
  RETURN v_token;
END;
$$;

-- Verify a PIN without creating a session (used on Clock In page for quick check)
CREATE FUNCTION verify_staff_pin(p_staff_id uuid, p_pin text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_hash text;
BEGIN
  SELECT pin_hash INTO v_hash FROM staff WHERE id = p_staff_id AND is_active = true;
  IF v_hash IS NULL THEN RETURN false; END IF;
  RETURN crypt(p_pin, v_hash) = v_hash;
END;
$$;

-- Validate a session token (true = valid and not expired)
CREATE FUNCTION validate_staff_session(p_token uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff_sessions
    WHERE token = p_token AND expires_at > now()
  );
$$;

-- Invalidate a session token on sign-out
CREATE FUNCTION invalidate_staff_session(p_token uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  DELETE FROM staff_sessions WHERE token = p_token;
$$;

-- Record a clock event — PIN must be verified by the app before calling this
CREATE FUNCTION record_clock_event(p_staff_id uuid, p_event_type text)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO clock_events (staff_id, event_type) VALUES (p_staff_id, p_event_type);
$$;

-- ─────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────

ALTER TABLE staff                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE fridges                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE fridge_temperature_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_allergens          ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE clock_events            ENABLE ROW LEVEL SECURITY;

-- staff: public read (name picker needs id + name without auth)
CREATE POLICY "staff_public_read" ON staff
  FOR SELECT USING (true);

-- fridges: public read
CREATE POLICY "fridges_public_read" ON fridges
  FOR SELECT USING (true);

-- fridge_temperature_logs: public read + public insert
-- Staff are PIN-based (not Supabase Auth users) so INSERT must be open.
CREATE POLICY "fridge_logs_public_read" ON fridge_temperature_logs
  FOR SELECT USING (true);

CREATE POLICY "fridge_logs_public_insert" ON fridge_temperature_logs
  FOR INSERT WITH CHECK (true);

-- Managers can update/delete log entries if needed
CREATE POLICY "fridge_logs_manager_modify" ON fridge_temperature_logs
  FOR ALL USING (auth.role() = 'authenticated');

-- food_items: public read (active items only), manager write
CREATE POLICY "food_items_public_read" ON food_items
  FOR SELECT USING (is_active = true);

CREATE POLICY "food_items_manager_write" ON food_items
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- food_allergens: public read, manager write
CREATE POLICY "food_allergens_public_read" ON food_allergens
  FOR SELECT USING (true);

CREATE POLICY "food_allergens_manager_write" ON food_allergens
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- shifts: public read, manager write
CREATE POLICY "shifts_public_read" ON shifts
  FOR SELECT USING (true);

CREATE POLICY "shifts_manager_write" ON shifts
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- clock_events: public read (staff need to check their own status),
-- inserts handled by SECURITY DEFINER record_clock_event() function
CREATE POLICY "clock_events_public_read" ON clock_events
  FOR SELECT USING (true);

-- Managers can also read clock events directly (for timesheets)
-- (covered by the public read policy above)

-- staff_sessions: no direct access — SECURITY DEFINER functions only
CREATE POLICY "no_direct_session_access" ON staff_sessions
  FOR ALL USING (false);

-- ─────────────────────────────────────────────────────────
-- SEED DATA  (test staff + fridges — edit to suit your venue)
-- ─────────────────────────────────────────────────────────

INSERT INTO fridges (name, min_temp, max_temp) VALUES
  ('Main Kitchen Fridge', 0.0, 5.0),
  ('Walk-in Cooler',      0.0, 5.0),
  ('Bar Fridge',          0.0, 8.0);

-- Test staff  (PIN for Alice = 1234, PIN for Bob = 5678)
INSERT INTO staff (name, email, pin_hash, role) VALUES
  ('Alice Chef',  'alice@example.com', hash_staff_pin('1234'), 'staff'),
  ('Bob Manager', 'bob@example.com',   hash_staff_pin('5678'), 'manager');

-- IMPORTANT: Bob also needs a Supabase Auth account to use the manager login screen.
-- Go to Supabase > Authentication > Users > Add user
-- Use email: bob@example.com and set a password.
