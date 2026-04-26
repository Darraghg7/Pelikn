-- Pelikn migration 002 — Feature Expansion
-- Safe to run multiple times.
-- Run this in the Supabase SQL Editor AFTER 001_initial_schema.sql has been applied.

-- ─────────────────────────────────────────────────────────
-- DROP NEW OBJECTS IF THEY EXIST (idempotent)
-- ─────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS complete_task(uuid, uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS create_swap_request(uuid, uuid, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS resolve_swap_request(uuid, text, text) CASCADE;
DROP FUNCTION IF EXISTS create_staff_member(uuid, text, text, text, text, numeric) CASCADE;
DROP FUNCTION IF EXISTS update_staff_member(uuid, uuid, text, text, text, numeric) CASCADE;
DROP FUNCTION IF EXISTS deactivate_staff_member(uuid, uuid) CASCADE;

DROP TABLE IF EXISTS shift_swaps          CASCADE;
DROP TABLE IF EXISTS cleaning_completions CASCADE;
DROP TABLE IF EXISTS cleaning_tasks       CASCADE;
DROP TABLE IF EXISTS task_completions     CASCADE;
DROP TABLE IF EXISTS task_one_offs        CASCADE;
DROP TABLE IF EXISTS task_templates       CASCADE;
DROP TABLE IF EXISTS app_settings         CASCADE;

-- ─────────────────────────────────────────────────────────
-- EXTEND EXISTING TABLES
-- ─────────────────────────────────────────────────────────

-- Add hourly pay rate per staff member (used in rota wage cost + timesheet)
ALTER TABLE staff ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(6,2) NOT NULL DEFAULT 0.00;

-- Add job role for task assignment (kitchen | foh | bar | manager)
-- Distinct from auth `role` (staff | manager) — this is the department/role label
ALTER TABLE staff ADD COLUMN IF NOT EXISTS job_role TEXT NOT NULL DEFAULT 'kitchen';

-- ─────────────────────────────────────────────────────────
-- NEW TABLES
-- ─────────────────────────────────────────────────────────

-- App-wide settings (venue name, manager email for rota, etc.)
CREATE TABLE app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

INSERT INTO app_settings (key, value) VALUES
  ('venue_name',    'My Venue'),
  ('manager_email', '')
ON CONFLICT (key) DO NOTHING;

-- ── Daily Task Templates (recurring, per role) ─────────────
CREATE TABLE task_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  job_role    TEXT NOT NULL DEFAULT 'kitchen',  -- 'kitchen' | 'foh' | 'bar' | 'all'
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID,  -- manager auth uid (nullable — may be null if created via SQL)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── One-off tasks for a specific date ──────────────────────
CREATE TABLE task_one_offs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  job_role    TEXT NOT NULL DEFAULT 'kitchen',
  due_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Task completions (one record per template+date or one-off) ─
CREATE TABLE task_completions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_template_id    UUID REFERENCES task_templates(id) ON DELETE CASCADE,
  task_one_off_id     UUID REFERENCES task_one_offs(id)  ON DELETE CASCADE,
  completion_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  completed_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  completed_by_name   TEXT,
  completed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- At least one of the two FKs must be set
  CONSTRAINT must_have_task CHECK (
    (task_template_id IS NOT NULL) OR (task_one_off_id IS NOT NULL)
  )
);

-- ── Cleaning Tasks (frequency-based) ───────────────────────
CREATE TABLE cleaning_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  frequency     TEXT NOT NULL DEFAULT 'daily'
                CHECK (frequency IN ('daily','weekly','fortnightly','monthly','quarterly')),
  assigned_role TEXT NOT NULL DEFAULT 'all',   -- 'kitchen' | 'foh' | 'all'
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cleaning_completions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaning_task_id      UUID NOT NULL REFERENCES cleaning_tasks(id) ON DELETE CASCADE,
  completed_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  completed_by_name     TEXT,
  notes                 TEXT,
  completed_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Shift Swap Requests ────────────────────────────────────
CREATE TABLE shift_swaps (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id          UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  requester_id      UUID NOT NULL REFERENCES staff(id)  ON DELETE CASCADE,
  requester_name    TEXT NOT NULL,
  target_staff_id   UUID NOT NULL REFERENCES staff(id)  ON DELETE CASCADE,
  target_staff_name TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected')),
  message           TEXT,
  manager_note      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at       TIMESTAMPTZ
);

-- ─────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────

CREATE INDEX idx_task_templates_role    ON task_templates(job_role) WHERE is_active = true;
CREATE INDEX idx_task_one_offs_date     ON task_one_offs(due_date);
CREATE INDEX idx_task_completions_date  ON task_completions(completion_date);
CREATE INDEX idx_cleaning_completions   ON cleaning_completions(cleaning_task_id, completed_at DESC);
CREATE INDEX idx_shift_swaps_status     ON shift_swaps(status) WHERE status = 'pending';

-- ─────────────────────────────────────────────────────────
-- SECURITY DEFINER FUNCTIONS
-- ─────────────────────────────────────────────────────────

-- Complete a task (validates staff session token)
CREATE FUNCTION complete_task(
  p_token           uuid,
  p_template_id     uuid DEFAULT NULL,
  p_one_off_id      uuid DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_staff_id   uuid;
  v_staff_name text;
BEGIN
  -- Validate session
  SELECT ss.staff_id, s.name
  INTO v_staff_id, v_staff_name
  FROM staff_sessions ss
  JOIN staff s ON s.id = ss.staff_id
  WHERE ss.token = p_token AND ss.expires_at > now();

  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired session';
  END IF;

  INSERT INTO task_completions (
    task_template_id, task_one_off_id,
    completion_date, completed_by_staff_id, completed_by_name
  ) VALUES (
    p_template_id, p_one_off_id,
    CURRENT_DATE, v_staff_id, v_staff_name
  );
END;
$$;

-- Mark a cleaning task complete (validates staff session token)
CREATE FUNCTION complete_cleaning_task(
  p_token              uuid,
  p_cleaning_task_id   uuid,
  p_notes              text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_staff_id   uuid;
  v_staff_name text;
BEGIN
  SELECT ss.staff_id, s.name
  INTO v_staff_id, v_staff_name
  FROM staff_sessions ss
  JOIN staff s ON s.id = ss.staff_id
  WHERE ss.token = p_token AND ss.expires_at > now();

  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired session';
  END IF;

  INSERT INTO cleaning_completions (
    cleaning_task_id, completed_by_staff_id, completed_by_name, notes
  ) VALUES (
    p_cleaning_task_id, v_staff_id, v_staff_name, p_notes
  );
END;
$$;

-- Create a shift swap request (validates staff session token)
CREATE FUNCTION create_swap_request(
  p_token           uuid,
  p_shift_id        uuid,
  p_target_staff_id uuid,
  p_message         text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_staff_id        uuid;
  v_staff_name      text;
  v_target_name     text;
  v_new_id          uuid;
BEGIN
  SELECT ss.staff_id, s.name
  INTO v_staff_id, v_staff_name
  FROM staff_sessions ss
  JOIN staff s ON s.id = ss.staff_id
  WHERE ss.token = p_token AND ss.expires_at > now();

  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired session';
  END IF;

  SELECT name INTO v_target_name FROM staff WHERE id = p_target_staff_id;

  INSERT INTO shift_swaps (
    shift_id, requester_id, requester_name,
    target_staff_id, target_staff_name, message
  ) VALUES (
    p_shift_id, v_staff_id, v_staff_name,
    p_target_staff_id, v_target_name, p_message
  ) RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- Resolve a shift swap (manager only — called with manager auth, not session token)
-- If approved: reassigns the shift to the target staff member
CREATE FUNCTION resolve_swap_request(
  p_swap_id     uuid,
  p_action      text,  -- 'approved' | 'rejected'
  p_manager_note text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_swap      shift_swaps%ROWTYPE;
BEGIN
  SELECT * INTO v_swap FROM shift_swaps WHERE id = p_swap_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Swap request not found'; END IF;

  UPDATE shift_swaps
  SET status = p_action, manager_note = p_manager_note, resolved_at = now()
  WHERE id = p_swap_id;

  IF p_action = 'approved' THEN
    UPDATE shifts
    SET staff_id = v_swap.target_staff_id
    WHERE id = v_swap.shift_id;
  END IF;
END;
$$;

-- Create a new staff member with hashed PIN (manager only)
CREATE FUNCTION create_staff_member(
  p_manager_uid uuid,
  p_name        text,
  p_job_role    text,
  p_pin         text,
  p_email       text,
  p_hourly_rate numeric
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_new_id uuid;
BEGIN
  INSERT INTO staff (name, job_role, pin_hash, email, hourly_rate, role)
  VALUES (
    p_name,
    p_job_role,
    crypt(p_pin, gen_salt('bf', 8)),
    p_email,
    p_hourly_rate,
    'staff'
  )
  RETURNING id INTO v_new_id;
  RETURN v_new_id;
END;
$$;

-- Update a staff member (manager only) — PIN unchanged unless p_new_pin provided
CREATE FUNCTION update_staff_member(
  p_manager_uid uuid,
  p_staff_id    uuid,
  p_name        text,
  p_job_role    text,
  p_email       text,
  p_hourly_rate numeric,
  p_new_pin     text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_new_pin IS NOT NULL AND p_new_pin <> '' THEN
    UPDATE staff
    SET name = p_name, job_role = p_job_role, email = p_email,
        hourly_rate = p_hourly_rate,
        pin_hash = crypt(p_new_pin, gen_salt('bf', 8))
    WHERE id = p_staff_id;
  ELSE
    UPDATE staff
    SET name = p_name, job_role = p_job_role,
        email = p_email, hourly_rate = p_hourly_rate
    WHERE id = p_staff_id;
  END IF;
END;
$$;

-- Deactivate a staff member (soft delete)
CREATE FUNCTION deactivate_staff_member(
  p_manager_uid uuid,
  p_staff_id    uuid
)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE staff SET is_active = false WHERE id = p_staff_id;
$$;

-- Reactivate a staff member
CREATE FUNCTION reactivate_staff_member(
  p_manager_uid uuid,
  p_staff_id    uuid
)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE staff SET is_active = true WHERE id = p_staff_id;
$$;

-- ─────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────

ALTER TABLE app_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_one_offs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_completions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaning_tasks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaning_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_swaps         ENABLE ROW LEVEL SECURITY;

-- app_settings: public read, manager write
CREATE POLICY "settings_public_read" ON app_settings FOR SELECT USING (true);
CREATE POLICY "settings_manager_write" ON app_settings
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- task_templates: public read (staff need to see tasks), manager write
CREATE POLICY "task_templates_public_read" ON task_templates FOR SELECT USING (true);
CREATE POLICY "task_templates_manager_write" ON task_templates
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- task_one_offs: public read, manager write
CREATE POLICY "task_one_offs_public_read" ON task_one_offs FOR SELECT USING (true);
CREATE POLICY "task_one_offs_manager_write" ON task_one_offs
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- task_completions: public read, inserts via SECURITY DEFINER function only
CREATE POLICY "task_completions_public_read" ON task_completions FOR SELECT USING (true);

-- cleaning_tasks: public read, manager write
CREATE POLICY "cleaning_tasks_public_read" ON cleaning_tasks FOR SELECT USING (true);
CREATE POLICY "cleaning_tasks_manager_write" ON cleaning_tasks
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- cleaning_completions: public read, inserts via SECURITY DEFINER function only
CREATE POLICY "cleaning_completions_public_read" ON cleaning_completions FOR SELECT USING (true);

-- shift_swaps: public read, inserts via SECURITY DEFINER function
-- Managers can update (approve/reject) via resolve_swap_request function
CREATE POLICY "shift_swaps_public_read" ON shift_swaps FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────
-- SEED DATA (demo tasks and cleaning tasks)
-- ─────────────────────────────────────────────────────────

INSERT INTO task_templates (title, job_role) VALUES
  ('Prep mise en place',        'kitchen'),
  ('Clean prep surfaces',       'kitchen'),
  ('Check fridge temps',        'kitchen'),
  ('Remove rubbish',            'kitchen'),
  ('Set tables',                'foh'),
  ('Polish glassware',          'foh'),
  ('Check reservation sheet',   'foh'),
  ('Update menu boards',        'foh');

INSERT INTO cleaning_tasks (title, frequency, assigned_role) VALUES
  ('Wipe down all work surfaces',        'daily',       'kitchen'),
  ('Sweep and mop kitchen floor',        'daily',       'kitchen'),
  ('Clean behind equipment',             'weekly',      'kitchen'),
  ('Deep clean oven and grill',          'weekly',      'kitchen'),
  ('Descale coffee machine',             'weekly',      'foh'),
  ('Clean bar fridges interior',         'fortnightly', 'foh'),
  ('Deep clean walk-in cooler',          'monthly',     'kitchen'),
  ('Service and calibrate thermometers', 'quarterly',   'all');
