-- ============================================================================
-- 162: Writes to the rota, dishes and departments follow the app's permissions
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  APPLY MANUALLY IN THE SUPABASE SQL EDITOR. ROLLBACK: 162_rollback.sql.  ║
-- ║  Safe to run more than once. No data is changed.                         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- 091 scoped these tables with has_venue_access FOR ALL, so any signed-in
-- staff member could write them directly through the API, whatever the app
-- let them see. Reads stay venue-wide; writes now need what the app needs:
--
--   shifts, shift_swaps          manager/owner, or the 'edit_rota' permission
--   food_items, food_allergens   manager/owner, or 'manage_allergens'
--   departments,
--   staff_departments            manager/owner (Settings is manager-only)
--
-- Staff swap requests are created by create_swap_request, and dish edits go
-- through replace_food_item_allergens; both are SECURITY DEFINER and keep
-- working. replace_food_item_allergens now also honours job-title
-- permissions and works for managers in a linked second venue (it required
-- the staff row's home venue to be the dish's venue).
--
-- The public read on food_items (active dishes only, 161) and food_allergens
-- is unchanged.
-- ============================================================================


-- ── 1. Does the caller hold a permission at this venue? ────────────────────
-- Mirrors the app (SessionContext fetchLivePermissions): managers and owners
-- have every permission; other staff get their job title's permissions, or
-- their own staff_permissions rows when they have no title.
CREATE OR REPLACE FUNCTION caller_has_permission(p_venue uuid, p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    is_venue_hr_manager(p_venue)
    OR (
      p_venue = current_venue_id()
      AND EXISTS (
        SELECT 1 FROM staff s
        WHERE s.id = auth.uid()
          AND s.is_active = true
          AND (
            (s.permission_title_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM permission_titles t
              WHERE t.id = s.permission_title_id AND p_permission = ANY (t.permissions)))
            OR
            (s.permission_title_id IS NULL AND EXISTS (
              SELECT 1 FROM staff_permissions sp
              WHERE sp.staff_id = s.id AND sp.venue_id = p_venue AND sp.permission = p_permission))
          )
      )
    ),
    false)
$$;
REVOKE ALL ON FUNCTION caller_has_permission(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION caller_has_permission(uuid, text) TO anon, authenticated;


-- ── 2. Replace each table's policies: read venue-wide, write by permission ─
CREATE OR REPLACE FUNCTION _p162_scope(p_tbl text, p_write_check text, p_keep_read boolean)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE r record;
BEGIN
  IF to_regclass('public.' || p_tbl) IS NULL THEN
    RAISE NOTICE '162: table % not found, skipped', p_tbl;
    RETURN;
  END IF;

  FOR r IN SELECT policyname, cmd FROM pg_policies
            WHERE schemaname = 'public' AND tablename = p_tbl
  LOOP
    -- p_keep_read: leave an existing SELECT policy alone (the public menu read).
    CONTINUE WHEN p_keep_read AND r.cmd = 'SELECT';
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, p_tbl);
  END LOOP;

  IF NOT p_keep_read THEN
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (has_venue_access(venue_id))',
                   p_tbl || '_venue_read', p_tbl);
  END IF;
  EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (%s)',
                 p_tbl || '_write_insert', p_tbl, p_write_check);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING (%s) WITH CHECK (%s)',
                 p_tbl || '_write_update', p_tbl, p_write_check, p_write_check);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING (%s)',
                 p_tbl || '_write_delete', p_tbl, p_write_check);
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_tbl);
END $$;

SELECT _p162_scope('shifts',            $q$caller_has_permission(venue_id, 'edit_rota')$q$,        false);
SELECT _p162_scope('shift_swaps',       $q$caller_has_permission(venue_id, 'edit_rota')$q$,        false);
SELECT _p162_scope('food_items',        $q$caller_has_permission(venue_id, 'manage_allergens')$q$, true);
SELECT _p162_scope('food_allergens',    $q$caller_has_permission(venue_id, 'manage_allergens')$q$, true);
SELECT _p162_scope('departments',       $q$is_venue_hr_manager(venue_id)$q$,                       false);
SELECT _p162_scope('staff_departments', $q$is_venue_hr_manager(venue_id)$q$,                       false);

DROP FUNCTION _p162_scope(text, text, boolean);


-- ── 3. Dish edits: job-title permissions and linked venues ──────────────────
CREATE OR REPLACE FUNCTION replace_food_item_allergens(
  p_session_token uuid,
  p_food_item_id  uuid,
  p_venue_id      uuid,
  p_name          text,
  p_description   text,
  p_allergens     text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed boolean;
BEGIN
  -- The session must be for this venue. The staff row's home venue no longer
  -- has to match, so a manager working in a linked venue can edit its dishes.
  SELECT EXISTS (
    SELECT 1
    FROM staff_sessions ss
    JOIN staff s ON s.id = ss.staff_id
    WHERE ss.token      = p_session_token
      AND ss.venue_id   = p_venue_id
      AND ss.expires_at > now()
      AND s.is_active   = true
      AND (
        s.role IN ('manager', 'owner')
        OR (s.permission_title_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM permission_titles t
              WHERE t.id = s.permission_title_id AND 'manage_allergens' = ANY (t.permissions)))
        OR (s.permission_title_id IS NULL AND EXISTS (
              SELECT 1 FROM staff_permissions sp
              WHERE sp.staff_id = s.id AND sp.venue_id = p_venue_id AND sp.permission = 'manage_allergens'))
      )
  ) INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE food_items
     SET name        = p_name,
         description = NULLIF(p_description, ''),
         updated_at  = now()
   WHERE id       = p_food_item_id
     AND venue_id = p_venue_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Food item not found';
  END IF;

  DELETE FROM food_allergens
   WHERE food_item_id = p_food_item_id
     AND venue_id     = p_venue_id;

  IF p_allergens IS NOT NULL AND array_length(p_allergens, 1) > 0 THEN
    INSERT INTO food_allergens (food_item_id, allergen, venue_id)
    SELECT p_food_item_id, allergen, p_venue_id
    FROM unnest(p_allergens) AS allergen;
  END IF;
END;
$$;
