-- ============================================================================
-- 108: Point task_templates / task_one_offs / cleaning_tasks at venue_roles
-- (Phase 0 cont'd)
--
-- Adds a nullable role_id, backfilled by matching each row's existing
-- free-text job_role/assigned_role slug against that venue's custom_roles
-- setting (to recover the human label), then against venue_roles.name
-- (populated as a superset of custom_roles by 107). If a row's slug can't be
-- confidently resolved for its venue, role_id is left NULL — fail-open
-- (visible to everyone) rather than guessing a department, and deliberately
-- never falls back to a hardcoded label like "Kitchen" (see the
-- venue-agnostic rule: no food-service assumption for any venue type).
--
-- job_role/assigned_role stay in place, unused by app code after this phase
-- ships, as a rollback path — dropped in a later cleanup migration once
-- verified live across every real venue.
-- ============================================================================

ALTER TABLE task_templates
  ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES venue_roles(id) ON DELETE SET NULL;
ALTER TABLE task_one_offs
  ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES venue_roles(id) ON DELETE SET NULL;
ALTER TABLE cleaning_tasks
  ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES venue_roles(id) ON DELETE SET NULL;

COMMENT ON COLUMN task_templates.role_id  IS 'Supersedes job_role (free text, kept for rollback). NULL = every staff member, fail-open.';
COMMENT ON COLUMN task_one_offs.role_id   IS 'Supersedes job_role (free text, kept for rollback). NULL = every staff member, fail-open.';
COMMENT ON COLUMN cleaning_tasks.role_id IS 'Supersedes assigned_role (free text, kept for rollback). NULL = every staff member, fail-open.';

DO $$
DECLARE
  v_venue_id  uuid;
  raw_value   text;
  parsed      jsonb;
  entry       jsonb;
  slug_to_label jsonb;
  slug        text;
  label       text;
  resolved_role_id uuid;
  t record;
BEGIN
  FOR v_venue_id IN SELECT id FROM venues LOOP
    slug_to_label := '{}'::jsonb;

    SELECT value INTO raw_value
    FROM app_settings
    WHERE venue_id = v_venue_id AND key = 'custom_roles';

    IF raw_value IS NOT NULL AND raw_value <> '' THEN
      BEGIN
        parsed := raw_value::jsonb;
      EXCEPTION WHEN others THEN
        parsed := NULL;
      END;

      IF parsed IS NOT NULL AND jsonb_typeof(parsed) = 'array' THEN
        FOR entry IN SELECT * FROM jsonb_array_elements(parsed) LOOP
          IF jsonb_typeof(entry) = 'string' THEN
            label := trim(both '"' from entry::text);
            slug  := regexp_replace(lower(label), '\s+', '_', 'g');
          ELSE
            label := entry ->> 'label';
            slug  := entry ->> 'value';
          END IF;
          IF slug IS NOT NULL AND label IS NOT NULL THEN
            slug_to_label := slug_to_label || jsonb_build_object(slug, label);
          END IF;
        END LOOP;
      END IF;
    END IF;

    -- task_templates for this venue
    FOR t IN SELECT id, job_role FROM task_templates
             WHERE venue_id = v_venue_id AND role_id IS NULL AND job_role IS NOT NULL
    LOOP
      label := slug_to_label ->> t.job_role;
      resolved_role_id := NULL;
      IF label IS NOT NULL THEN
        SELECT id INTO resolved_role_id FROM venue_roles
        WHERE venue_id = v_venue_id AND lower(name) = lower(label)
        LIMIT 1;
      END IF;
      IF resolved_role_id IS NOT NULL THEN
        UPDATE task_templates SET role_id = resolved_role_id WHERE id = t.id;
      END IF;
    END LOOP;

    -- task_one_offs for this venue
    FOR t IN SELECT id, job_role FROM task_one_offs
             WHERE venue_id = v_venue_id AND role_id IS NULL AND job_role IS NOT NULL
    LOOP
      label := slug_to_label ->> t.job_role;
      resolved_role_id := NULL;
      IF label IS NOT NULL THEN
        SELECT id INTO resolved_role_id FROM venue_roles
        WHERE venue_id = v_venue_id AND lower(name) = lower(label)
        LIMIT 1;
      END IF;
      IF resolved_role_id IS NOT NULL THEN
        UPDATE task_one_offs SET role_id = resolved_role_id WHERE id = t.id;
      END IF;
    END LOOP;

    -- cleaning_tasks for this venue
    FOR t IN SELECT id, assigned_role FROM cleaning_tasks
             WHERE venue_id = v_venue_id AND role_id IS NULL AND assigned_role IS NOT NULL
    LOOP
      label := slug_to_label ->> t.assigned_role;
      resolved_role_id := NULL;
      IF label IS NOT NULL THEN
        SELECT id INTO resolved_role_id FROM venue_roles
        WHERE venue_id = v_venue_id AND lower(name) = lower(label)
        LIMIT 1;
      END IF;
      IF resolved_role_id IS NOT NULL THEN
        UPDATE cleaning_tasks SET role_id = resolved_role_id WHERE id = t.id;
      END IF;
    END LOOP;
  END LOOP;
END $$;
