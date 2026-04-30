-- ============================================================================
-- 017: Multi-tenancy — venues table, venue_id on all tables, RPC updates
-- ============================================================================

-- ── 1. Venues table ─────────────────────────────────────────────────────────

CREATE TABLE venues (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text NOT NULL,
  owner_id   uuid,  -- references auth.users(id), nullable for migration
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_venues_slug ON venues (lower(slug));

ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "venues_public_read" ON venues FOR SELECT USING (true);
CREATE POLICY "venues_public_write" ON venues FOR ALL USING (true) WITH CHECK (true);

-- ── 2. Create venues ──────────────────────────────────────────────────────

-- Nomad Bakes — all existing data gets assigned to this venue
INSERT INTO venues (id, name, slug)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  COALESCE((SELECT value FROM app_settings WHERE key = 'venue_name' LIMIT 1), 'Nomad Bakes'),
  'nomad-bakes'
);

-- Sandbox — empty test venue
INSERT INTO venues (id, name, slug)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Sandbox',
  'sandbox'
);

-- ── 3. Add venue_id to all tables (nullable first) ──────────────────────────

ALTER TABLE staff ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE staff_sessions ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE fridges ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE fridge_temperature_logs ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE food_items ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE food_allergens ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE shifts ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE clock_events ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE task_templates ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE task_one_offs ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE task_completions ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE cleaning_tasks ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE cleaning_completions ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE opening_closing_checks ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE opening_closing_completions ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE waste_logs ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE suppliers ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE supplier_items ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE supplier_orders ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE supplier_order_items ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE delivery_checks ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE delivery_check_items ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE probe_calibrations ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE corrective_actions ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE staff_training ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE shift_swaps ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE time_off_requests ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE staff_availability ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE dashboard_widgets ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE push_subscriptions ADD COLUMN venue_id uuid REFERENCES venues(id);

-- app_settings needs special handling (composite PK)
ALTER TABLE app_settings ADD COLUMN venue_id uuid REFERENCES venues(id);

-- ── 4. Backfill all tables with default venue ───────────────────────────────

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

-- ── 5. Make venue_id NOT NULL on all tables ─────────────────────────────────

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
ALTER TABLE app_settings DROP CONSTRAINT app_settings_pkey;
ALTER TABLE app_settings ADD PRIMARY KEY (venue_id, key);

-- Fix suppliers unique constraint to be per-venue
DROP INDEX IF EXISTS idx_suppliers_name;
CREATE UNIQUE INDEX idx_suppliers_name ON suppliers (venue_id, lower(name));

-- Fix fridges unique constraint to be per-venue
ALTER TABLE fridges DROP CONSTRAINT IF EXISTS fridges_name_key;
CREATE UNIQUE INDEX idx_fridges_name_venue ON fridges (venue_id, lower(name));

-- ── 6. Add venue_id indexes ─────────────────────────────────────────────────

CREATE INDEX idx_staff_venue ON staff(venue_id);
CREATE INDEX idx_fridges_venue ON fridges(venue_id);
CREATE INDEX idx_fridge_logs_venue ON fridge_temperature_logs(venue_id);
CREATE INDEX idx_shifts_venue ON shifts(venue_id, week_start);
CREATE INDEX idx_clock_events_venue ON clock_events(venue_id);
CREATE INDEX idx_cleaning_tasks_venue ON cleaning_tasks(venue_id);
CREATE INDEX idx_cleaning_completions_venue ON cleaning_completions(venue_id);
CREATE INDEX idx_food_items_venue ON food_items(venue_id);
CREATE INDEX idx_task_templates_venue ON task_templates(venue_id);
CREATE INDEX idx_task_completions_venue ON task_completions(venue_id);
CREATE INDEX idx_opening_closing_checks_venue ON opening_closing_checks(venue_id);
CREATE INDEX idx_suppliers_venue ON suppliers(venue_id);
CREATE INDEX idx_supplier_orders_venue ON supplier_orders(venue_id);
CREATE INDEX idx_delivery_checks_venue ON delivery_checks(venue_id);
CREATE INDEX idx_probe_calibrations_venue ON probe_calibrations(venue_id);
CREATE INDEX idx_corrective_actions_venue ON corrective_actions(venue_id);
CREATE INDEX idx_staff_training_venue ON staff_training(venue_id);
CREATE INDEX idx_waste_logs_venue ON waste_logs(venue_id);
CREATE INDEX idx_time_off_requests_venue ON time_off_requests(venue_id);
CREATE INDEX idx_shift_swaps_venue ON shift_swaps(venue_id);
CREATE INDEX idx_staff_availability_venue ON staff_availability(venue_id);

-- ── 7. Update RPC functions with venue_id ───────────────────────────────────

-- 7a. verify_staff_pin_and_create_session — now accepts venue_id
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

  -- If venue_id provided, verify staff belongs to that venue
  IF p_venue_id IS NOT NULL AND v_venue_id <> p_venue_id THEN RETURN NULL; END IF;

  DELETE FROM staff_sessions WHERE staff_id = p_staff_id AND expires_at < now();
  INSERT INTO staff_sessions (staff_id, venue_id)
  VALUES (p_staff_id, v_venue_id)
  RETURNING token INTO v_token;
  RETURN v_token;
END;
$$;

-- 7b. validate_staff_session — now returns venue_id as text (NULL if invalid)
CREATE OR REPLACE FUNCTION validate_staff_session(p_token uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT venue_id::text FROM staff_sessions
  WHERE token = p_token AND expires_at > now()
  LIMIT 1;
$$;

-- 7c. invalidate_staff_session — no change needed (deletes by token)
-- Already correct: DELETE FROM staff_sessions WHERE token = p_token;

-- 7d. verify_staff_pin — no change needed (used for inline PIN checks)

-- 7e. record_clock_event — now includes venue_id
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

-- 7f. complete_task — now includes venue_id
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

-- 7g. complete_cleaning_task — now includes venue_id
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

-- 7h. create_staff_member — now includes venue_id
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

-- 7i. update_staff_member — scoped by venue via session
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

-- 7j. deactivate_staff_member — scoped by venue
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

-- 7k. reactivate_staff_member — scoped by venue
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

-- 7l. create_swap_request — now includes venue_id
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

-- 7m. resolve_swap_request — scoped by venue
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

-- ── 8. New RPC: create_venue_with_owner ─────────────────────────────────────

CREATE FUNCTION create_venue_with_owner(
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
  -- Require Supabase Auth
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check slug uniqueness
  IF EXISTS (SELECT 1 FROM venues WHERE lower(slug) = lower(p_slug)) THEN
    RAISE EXCEPTION 'Venue slug already taken';
  END IF;

  -- Create venue
  INSERT INTO venues (name, slug, owner_id)
  VALUES (p_venue_name, p_slug, auth.uid())
  RETURNING id INTO v_venue_id;

  -- Create owner as staff member
  INSERT INTO staff (name, pin_hash, role, job_role, venue_id, is_active)
  VALUES (p_owner_name, crypt(p_owner_pin, gen_salt('bf')), 'owner', 'foh', v_venue_id, true);

  -- Seed default settings
  INSERT INTO app_settings (venue_id, key, value) VALUES
    (v_venue_id, 'venue_name', p_venue_name),
    (v_venue_id, 'manager_email', '');

  RETURN v_venue_id;
END;
$$;

-- ── 9. Set up manager_email entries for both venues ───────────────────────

-- Update existing Nomad manager_email to include venue_id
-- (Already backfilled to 00..01, just ensure value is correct)
UPDATE app_settings
SET value = 'nomad.bakes1@gmail.com'
WHERE key = 'manager_email'
  AND venue_id = '00000000-0000-0000-0000-000000000001';

-- Seed Sandbox settings
INSERT INTO app_settings (venue_id, key, value) VALUES
  ('00000000-0000-0000-0000-000000000002', 'venue_name', 'Sandbox'),
  ('00000000-0000-0000-0000-000000000002', 'manager_email', 'sandbox@pelikn.app')
ON CONFLICT (venue_id, key) DO UPDATE SET value = EXCLUDED.value;
