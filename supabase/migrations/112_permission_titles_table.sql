-- ============================================================================
-- 112: Promote Permission Titles from an app_settings JSON blob into a real,
-- assignable table.
--
-- Previously a "permission title" (e.g. "Supervisor") was only ever a
-- one-time quick-fill preset for the granular permissions checklist on the
-- staff form — nothing recorded which title, if any, a staff member actually
-- had, so reopening their profile just showed raw checkboxes. This makes
-- titles a real, referenced thing: assign one to a staff member, and their
-- permissions are read live from the title from then on (edit the title
-- later, everyone holding it updates with it).
--
-- Owner/Manager are NOT rows here — they stay the fixed, hardcoded tiers on
-- staff.role that the app's security rules depend on. Titles only apply to
-- staff.role = 'staff'; permission_title_id is meaningless for anyone else.
-- ============================================================================

CREATE TABLE IF NOT EXISTS permission_titles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id    uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  label       text NOT NULL,
  permissions text[] NOT NULL DEFAULT '{}',
  sort_order  int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_permission_titles_venue ON permission_titles (venue_id, sort_order);

ALTER TABLE permission_titles ENABLE ROW LEVEL SECURITY;
CREATE POLICY permission_titles_venue_access ON permission_titles
  FOR ALL USING (has_venue_access(venue_id)) WITH CHECK (has_venue_access(venue_id));

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS permission_title_id uuid REFERENCES permission_titles(id) ON DELETE SET NULL;

COMMENT ON COLUMN staff.permission_title_id IS
  'Only meaningful when role = ''staff''. NULL means permissions come from the legacy per-person staff_permissions rows instead — see SessionContext.jsx''s fetchLivePermissions.';

-- Backfill: recover any titles a venue already saved as app_settings JSON
-- (PermissionTitlesSection previously wrote key = 'permission_titles').
-- Venues that never customised titles get no rows here — the settings UI's
-- existing "show the built-in presets as an editable starting point when
-- empty" behaviour covers that case client-side, same as before.
DO $$
DECLARE
  v_venue_id uuid;
  raw_value  text;
  parsed     jsonb;
  entry      jsonb;
  label      text;
  perms      text[];
  idx        int;
BEGIN
  FOR v_venue_id IN SELECT id FROM venues LOOP
    SELECT value INTO raw_value
    FROM app_settings
    WHERE venue_id = v_venue_id AND key = 'permission_titles';

    IF raw_value IS NULL OR raw_value = '' THEN
      CONTINUE;
    END IF;

    BEGIN
      parsed := raw_value::jsonb;
    EXCEPTION WHEN others THEN
      CONTINUE;
    END;

    IF jsonb_typeof(parsed) IS DISTINCT FROM 'array' THEN
      CONTINUE;
    END IF;

    idx := 0;
    FOR entry IN SELECT * FROM jsonb_array_elements(parsed) LOOP
      label := trim(entry ->> 'label');
      IF label IS NULL OR label = '' THEN
        idx := idx + 1;
        CONTINUE;
      END IF;

      SELECT COALESCE(array_agg(value), '{}'::text[])
      INTO perms
      FROM jsonb_array_elements_text(COALESCE(entry -> 'permissions', '[]'::jsonb));

      INSERT INTO permission_titles (venue_id, label, permissions, sort_order)
      VALUES (v_venue_id, label, perms, idx);

      idx := idx + 1;
    END LOOP;
  END LOOP;
END $$;
