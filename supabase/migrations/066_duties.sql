-- ============================================================================
-- 066: Shift duties
--
-- Managers create reusable duty templates (e.g. "Opening Barista") with an
-- ordered list of sub-tasks. When building the rota, a duty can be optionally
-- assigned to a specific staff member's shift. Staff see and complete their
-- duties on the dashboard.
-- ============================================================================

-- 1. Templates ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS duty_templates (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id   uuid        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  title      text        NOT NULL,
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS duty_templates_venue_idx ON duty_templates (venue_id) WHERE is_active = true;

ALTER TABLE duty_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "duty_templates_read"  ON duty_templates;
DROP POLICY IF EXISTS "duty_templates_write" ON duty_templates;
CREATE POLICY "duty_templates_read"  ON duty_templates FOR SELECT USING (true);
CREATE POLICY "duty_templates_write" ON duty_templates FOR ALL
  USING (true) WITH CHECK (true);

-- 2. Template items (sub-tasks) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS duty_template_items (
  id                uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  duty_template_id  uuid  NOT NULL REFERENCES duty_templates(id) ON DELETE CASCADE,
  title             text  NOT NULL,
  sort_order        int   NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS duty_template_items_template_idx ON duty_template_items (duty_template_id, sort_order);

ALTER TABLE duty_template_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "duty_template_items_read"  ON duty_template_items;
DROP POLICY IF EXISTS "duty_template_items_write" ON duty_template_items;
CREATE POLICY "duty_template_items_read"  ON duty_template_items FOR SELECT USING (true);
CREATE POLICY "duty_template_items_write" ON duty_template_items FOR ALL
  USING (true) WITH CHECK (true);

-- 3. Assignments — one duty per shift (shift cascade-deletes the assignment) ─
CREATE TABLE IF NOT EXISTS duty_assignments (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id              uuid        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  shift_id              uuid        NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  duty_template_id      uuid        NOT NULL REFERENCES duty_templates(id) ON DELETE CASCADE,
  assigned_by_staff_id  uuid        REFERENCES staff(id) ON DELETE SET NULL,
  assigned_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shift_id)
);

CREATE INDEX IF NOT EXISTS duty_assignments_venue_shift_idx ON duty_assignments (venue_id, shift_id);

ALTER TABLE duty_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "duty_assignments_read"  ON duty_assignments;
DROP POLICY IF EXISTS "duty_assignments_write" ON duty_assignments;
CREATE POLICY "duty_assignments_read"  ON duty_assignments FOR SELECT USING (true);
CREATE POLICY "duty_assignments_write" ON duty_assignments FOR ALL
  USING (true) WITH CHECK (true);

-- 4. Item completions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS duty_item_completions (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id              uuid        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  duty_assignment_id    uuid        NOT NULL REFERENCES duty_assignments(id) ON DELETE CASCADE,
  duty_template_item_id uuid        NOT NULL REFERENCES duty_template_items(id) ON DELETE CASCADE,
  completed_by_staff_id uuid        REFERENCES staff(id) ON DELETE SET NULL,
  completed_by_name     text        NOT NULL,
  completed_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (duty_assignment_id, duty_template_item_id)
);

CREATE INDEX IF NOT EXISTS duty_item_completions_assignment_idx ON duty_item_completions (duty_assignment_id);

ALTER TABLE duty_item_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "duty_item_completions_read" ON duty_item_completions;
CREATE POLICY "duty_item_completions_read" ON duty_item_completions FOR SELECT USING (true);

-- 5. Complete a duty item (validates session) ─────────────────────────────
CREATE OR REPLACE FUNCTION complete_duty_item(
  p_token               uuid,
  p_venue_slug          text,
  p_assignment_id       uuid,
  p_item_id             uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id   uuid;
  v_staff_name text;
  v_venue_id   uuid;
BEGIN
  SELECT ss.staff_id, s.name, v.id
    INTO v_staff_id, v_staff_name, v_venue_id
  FROM staff_sessions ss
  JOIN staff   s ON s.id  = ss.staff_id
  JOIN venues  v ON v.id  = ss.venue_id AND v.slug = p_venue_slug
  WHERE ss.token      = p_token
    AND ss.expires_at > now()
    AND s.is_active   = true;

  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO duty_item_completions (
    venue_id, duty_assignment_id, duty_template_item_id,
    completed_by_staff_id, completed_by_name
  )
  VALUES (v_venue_id, p_assignment_id, p_item_id, v_staff_id, v_staff_name)
  ON CONFLICT (duty_assignment_id, duty_template_item_id) DO NOTHING;
END;
$$;

-- 6. Uncomplete a duty item ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION uncomplete_duty_item(
  p_token         uuid,
  p_venue_slug    text,
  p_assignment_id uuid,
  p_item_id       uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id uuid;
  v_venue_id uuid;
BEGIN
  SELECT ss.staff_id, v.id
    INTO v_staff_id, v_venue_id
  FROM staff_sessions ss
  JOIN staff  s ON s.id = ss.staff_id
  JOIN venues v ON v.id = ss.venue_id AND v.slug = p_venue_slug
  WHERE ss.token      = p_token
    AND ss.expires_at > now()
    AND s.is_active   = true;

  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM duty_item_completions
  WHERE duty_assignment_id    = p_assignment_id
    AND duty_template_item_id = p_item_id;
END;
$$;

GRANT EXECUTE ON FUNCTION complete_duty_item(uuid, text, uuid, uuid)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION uncomplete_duty_item(uuid, text, uuid, uuid) TO anon, authenticated;
