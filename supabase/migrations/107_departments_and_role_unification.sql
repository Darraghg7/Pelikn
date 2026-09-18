-- ============================================================================
-- 107: Departments + role-list unification (Phase 0 of the closing-checklist
-- feature — see /Users/darraghguy/.claude/plans/purrfect-munching-wadler.md)
--
-- Pelikn has had two disconnected "role" concepts: `venue_roles` (+
-- `staff_role_assignments`), a proper many-to-many table with a real Settings
-- UI (RolesSection.jsx) but only ever used for the AI rota's skill-matching;
-- and `staff.job_role` (free text) + the venue-configured `custom_roles`
-- setting, which is what `task_templates.job_role` / `cleaning_tasks
-- .assigned_role` actually filter staff visibility on today. Free-text role
-- matching already caused a real bug once (a renamed/deleted role silently
-- hid tasks from staff — see src/lib/roleFilter.ts's fail-open fix).
--
-- This migration makes `venue_roles` the one role list everything reads from
-- going forward. It does NOT drop `staff.job_role` or the `custom_roles`
-- setting — they're left in place, unused, as a rollback path until the new
-- code path is verified live (see 108 for the follow-up that repoints
-- task_templates/cleaning_tasks onto venue_roles).
-- ============================================================================

-- 1. Departments — a named grouping of roles, used to scope checks and the
--    closing-checklist workflow. NULL department on a role or a check always
--    means "visible to everyone" (fail-open), never "hidden" — same rule as
--    the existing role-drift fix.
CREATE TABLE IF NOT EXISTS departments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id   uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name       text NOT NULL,
  sort_order int  NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_departments_venue ON departments (venue_id, sort_order);

-- Written directly rather than via 091's _pk_scope(...) helper — that
-- function (and its siblings) went through a rollback-and-redo cycle once
-- already (see 091_rollback.sql), so this migration doesn't assume it's
-- still present in whatever state the live database is in. Mirrors exactly
-- what _pk_scope does: has_venue_access(venue_id) is itself long-lived
-- (defined in 091, depended on by every migration since — 095 through 106).
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY departments_venue_access ON departments
  FOR ALL USING (has_venue_access(venue_id)) WITH CHECK (has_venue_access(venue_id));

-- 2. venue_roles gains department_id. `color` already exists (031b) — no
--    change needed there, it just wasn't surfaced in RolesSection.jsx's UI.
ALTER TABLE venue_roles
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE SET NULL;

COMMENT ON COLUMN venue_roles.department_id IS
  'Groups this role into a department for check/task visibility. NULL = ungrouped, stays visible to everyone (fail-open) — see src/lib/roleFilter.ts.';

-- 3. Backfill: make venue_roles a superset of every venue's custom_roles
--    setting, so nothing currently targetable by job_role goes missing once
--    108 repoints task_templates/cleaning_tasks onto venue_roles.id.
--    custom_roles is stored as JSON text in app_settings — either a legacy
--    array of plain strings, or {value,label,color} objects (see
--    useSettings.ts's fetchAppSettings normalisation, which this mirrors).
DO $$
DECLARE
  v_venue_id uuid;
  raw_value  text;
  parsed     jsonb;
  entry      jsonb;
  role_name  text;
  role_color text;
BEGIN
  FOR v_venue_id IN SELECT id FROM venues LOOP
    SELECT value INTO raw_value
    FROM app_settings
    WHERE venue_id = v_venue_id AND key = 'custom_roles';

    IF raw_value IS NULL OR raw_value = '' THEN
      CONTINUE;
    END IF;

    BEGIN
      parsed := raw_value::jsonb;
    EXCEPTION WHEN others THEN
      CONTINUE; -- malformed value, nothing safe to backfill from
    END;

    IF jsonb_typeof(parsed) IS DISTINCT FROM 'array' THEN
      CONTINUE;
    END IF;

    FOR entry IN SELECT * FROM jsonb_array_elements(parsed) LOOP
      IF jsonb_typeof(entry) = 'string' THEN
        role_name  := trim(both '"' from entry::text);
        role_color := NULL;
      ELSE
        role_name  := trim(entry ->> 'label');
        role_color := entry ->> 'color';
      END IF;

      IF role_name IS NULL OR role_name = '' THEN
        CONTINUE;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM venue_roles
        WHERE venue_id = v_venue_id AND lower(name) = lower(role_name)
      ) THEN
        INSERT INTO venue_roles (venue_id, name, color)
        VALUES (v_venue_id, role_name, COALESCE(role_color, '#1a3c2e'));
      END IF;
    END LOOP;
  END LOOP;
END $$;
