-- ─────────────────────────────────────────────────────────────────────────────
-- 041_multi_venue.sql
-- Multi-venue support: staff colour coding, cross-venue staff links, new RPCs
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add colour + linked_from_staff_id to staff table
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS colour text,
  ADD COLUMN IF NOT EXISTS linked_from_staff_id uuid
    REFERENCES staff(id) ON DELETE SET NULL;

COMMENT ON COLUMN staff.colour IS
  'Rota display colour (CSS hex, e.g. #3b82f6). NULL = auto-assign from palette.';
COMMENT ON COLUMN staff.linked_from_staff_id IS
  'If this is a shadow record for cross-venue PIN login, points to the original staff row.';

-- 2. staff_venue_links — additive junction table for multi-venue staff
CREATE TABLE IF NOT EXISTS staff_venue_links (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id   uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  venue_id   uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'staff'
             CHECK (role IN ('staff', 'manager', 'owner')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(staff_id, venue_id)
);

CREATE INDEX IF NOT EXISTS idx_svl_staff ON staff_venue_links(staff_id);
CREATE INDEX IF NOT EXISTS idx_svl_venue ON staff_venue_links(venue_id);

ALTER TABLE staff_venue_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "svl_public"
  ON staff_venue_links FOR ALL USING (true) WITH CHECK (true);

-- Prevent linking staff to their own home venue
CREATE OR REPLACE FUNCTION check_svl_not_home_venue()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM staff WHERE id = NEW.staff_id AND venue_id = NEW.venue_id
  ) THEN
    RAISE EXCEPTION 'Cannot link staff to their home venue via staff_venue_links';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_svl_not_home_venue ON staff_venue_links;
CREATE TRIGGER trg_svl_not_home_venue
  BEFORE INSERT OR UPDATE ON staff_venue_links
  FOR EACH ROW EXECUTE FUNCTION check_svl_not_home_venue();

-- 3. get_owner_venues() — all venues owned by the authenticated Supabase Auth user
CREATE OR REPLACE FUNCTION get_owner_venues()
RETURNS TABLE (
  id                uuid,
  name              text,
  slug              text,
  plan              text,
  qr_addon          boolean,
  additional_venues smallint
)
LANGUAGE sql SECURITY DEFINER
SET search_path = public AS $$
  SELECT id, name, slug, plan, qr_addon, additional_venues
  FROM venues
  WHERE owner_id = auth.uid()
  ORDER BY created_at ASC;
$$;

-- 4. create_additional_venue() — creates a new venue under the same owner
--    Requires the caller to already own at least one Pro venue.
CREATE OR REPLACE FUNCTION create_additional_venue(
  p_name text,
  p_slug text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE
  v_venue_id uuid;
  v_owner    uuid := auth.uid();
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM venues WHERE owner_id = v_owner AND plan = 'pro'
  ) THEN
    RAISE EXCEPTION 'Multi-venue requires a Pro plan';
  END IF;

  IF EXISTS (SELECT 1 FROM venues WHERE lower(slug) = lower(p_slug)) THEN
    RAISE EXCEPTION 'Venue slug already taken';
  END IF;

  INSERT INTO venues (name, slug, owner_id, plan)
  VALUES (p_name, p_slug, v_owner, 'pro')
  RETURNING id INTO v_venue_id;

  -- Seed default settings for the new venue
  INSERT INTO app_settings (venue_id, key, value) VALUES
    (v_venue_id, 'venue_name', p_name),
    (v_venue_id, 'manager_email', '');

  RETURN v_venue_id;
END;
$$;

-- 5. link_staff_to_venue() — manager links a staff member to another of their venues
CREATE OR REPLACE FUNCTION link_staff_to_venue(
  p_session_token   uuid,
  p_staff_id        uuid,
  p_target_venue_id uuid,
  p_role            text DEFAULT 'staff'
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_session_venue uuid;
  v_target_owner  uuid;
  v_staff_home    uuid;
BEGIN
  -- Validate: caller is manager/owner and their session is at the target venue
  SELECT ss.venue_id INTO v_session_venue
  FROM staff_sessions ss
  JOIN staff s ON s.id = ss.staff_id
  WHERE ss.token = p_session_token
    AND ss.expires_at > now()
    AND s.role IN ('manager', 'owner')
    AND s.is_active = true;

  IF v_session_venue IS NULL OR v_session_venue <> p_target_venue_id THEN
    RAISE EXCEPTION 'Unauthorized — must be a manager at the target venue';
  END IF;

  -- Both venues must belong to the same owner
  SELECT owner_id INTO v_target_owner FROM venues WHERE id = p_target_venue_id;
  SELECT venue_id INTO v_staff_home   FROM staff   WHERE id = p_staff_id;

  IF NOT EXISTS (
    SELECT 1 FROM venues WHERE id = v_staff_home AND owner_id = v_target_owner
  ) THEN
    RAISE EXCEPTION 'Staff member belongs to a venue you do not own';
  END IF;

  INSERT INTO staff_venue_links (staff_id, venue_id, role)
  VALUES (p_staff_id, p_target_venue_id, p_role)
  ON CONFLICT (staff_id, venue_id) DO UPDATE SET role = EXCLUDED.role;
END;
$$;

-- 6. unlink_staff_from_venue() — removes a cross-venue link
CREATE OR REPLACE FUNCTION unlink_staff_from_venue(
  p_session_token   uuid,
  p_staff_id        uuid,
  p_target_venue_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_session_venue uuid;
  v_target_owner  uuid;
  v_staff_home    uuid;
BEGIN
  SELECT ss.venue_id INTO v_session_venue
  FROM staff_sessions ss
  JOIN staff s ON s.id = ss.staff_id
  WHERE ss.token = p_session_token
    AND ss.expires_at > now()
    AND s.role IN ('manager', 'owner')
    AND s.is_active = true;

  IF v_session_venue IS NULL OR v_session_venue <> p_target_venue_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT owner_id INTO v_target_owner FROM venues WHERE id = p_target_venue_id;
  SELECT venue_id INTO v_staff_home   FROM staff   WHERE id = p_staff_id;

  IF NOT EXISTS (
    SELECT 1 FROM venues WHERE id = v_staff_home AND owner_id = v_target_owner
  ) THEN
    RAISE EXCEPTION 'Staff member belongs to a venue you do not own';
  END IF;

  DELETE FROM staff_venue_links
  WHERE staff_id = p_staff_id AND venue_id = p_target_venue_id;
END;
$$;

-- 7. get_staff_cross_venue_shifts() — shift conflicts for cross-venue staff
--    SECURITY DEFINER so it can read shifts across venue boundaries.
--    Only exposes the minimum fields needed for conflict display.
CREATE OR REPLACE FUNCTION get_staff_cross_venue_shifts(
  p_staff_ids        uuid[],
  p_date_from        date,
  p_date_to          date,
  p_exclude_venue_id uuid
)
RETURNS TABLE (
  staff_id   uuid,
  shift_date date,
  start_time time,
  end_time   time,
  venue_name text,
  venue_slug text
)
LANGUAGE sql SECURITY DEFINER
SET search_path = public AS $$
  SELECT
    sh.staff_id,
    sh.shift_date::date,
    sh.start_time::time,
    sh.end_time::time,
    v.name AS venue_name,
    v.slug AS venue_slug
  FROM shifts sh
  JOIN venues v ON v.id = sh.venue_id
  WHERE sh.staff_id = ANY(p_staff_ids)
    AND sh.shift_date BETWEEN p_date_from AND p_date_to
    AND sh.venue_id <> p_exclude_venue_id;
$$;

-- 8. Update update_staff_member RPC to accept p_colour
CREATE OR REPLACE FUNCTION update_staff_member(
  p_session_token  uuid,
  p_staff_id       uuid,
  p_name           text           DEFAULT NULL,
  p_role           text           DEFAULT NULL,
  p_job_role       text           DEFAULT NULL,
  p_email          text           DEFAULT NULL,
  p_hourly_rate    numeric        DEFAULT NULL,
  p_contracted_hours numeric      DEFAULT NULL,
  p_show_temp_logs boolean        DEFAULT NULL,
  p_show_allergens boolean        DEFAULT NULL,
  p_skills         text[]         DEFAULT NULL,
  p_is_under_18    boolean        DEFAULT NULL,
  p_working_days   int[]          DEFAULT NULL,
  p_sort_order     int            DEFAULT NULL,
  p_colour         text           DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_venue uuid;
BEGIN
  -- Validate caller is manager/owner in the same venue
  SELECT ss.venue_id INTO v_venue
  FROM staff_sessions ss
  JOIN staff s ON s.id = ss.staff_id
  WHERE ss.token = p_session_token
    AND ss.expires_at > now()
    AND s.role IN ('manager', 'owner')
    AND s.is_active = true;

  IF v_venue IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE staff SET
    name             = COALESCE(p_name,             name),
    role             = COALESCE(p_role,             role),
    job_role         = COALESCE(p_job_role,         job_role),
    email            = COALESCE(p_email,            email),
    hourly_rate      = COALESCE(p_hourly_rate,      hourly_rate),
    contracted_hours = COALESCE(p_contracted_hours, contracted_hours),
    show_temp_logs   = COALESCE(p_show_temp_logs,   show_temp_logs),
    show_allergens   = COALESCE(p_show_allergens,   show_allergens),
    skills           = COALESCE(p_skills,           skills),
    is_under_18      = COALESCE(p_is_under_18,      is_under_18),
    working_days     = COALESCE(p_working_days,     working_days),
    sort_order       = COALESCE(p_sort_order,       sort_order),
    colour           = CASE WHEN p_colour IS NOT NULL THEN NULLIF(p_colour, '') ELSE colour END
  WHERE id = p_staff_id
    AND venue_id = v_venue;
END;
$$;
