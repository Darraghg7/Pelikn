-- Rollback for 162_permission_scoped_writes.sql.
-- Puts back venue-wide writes (091 / 134) and the 062 dish-edit function.

CREATE OR REPLACE FUNCTION _r162_restore(p_tbl text, p_keep_read boolean)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF to_regclass('public.' || p_tbl) IS NULL THEN RETURN; END IF;
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p_tbl || '_venue_read',   p_tbl);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p_tbl || '_write_insert', p_tbl);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p_tbl || '_write_update', p_tbl);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p_tbl || '_write_delete', p_tbl);
  IF p_keep_read THEN
    -- 091's public-read tables: keep the read, restore the venue writes.
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (has_venue_access(venue_id))', p_tbl || '_venue_insert', p_tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING (has_venue_access(venue_id)) WITH CHECK (has_venue_access(venue_id))', p_tbl || '_venue_update', p_tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING (has_venue_access(venue_id))', p_tbl || '_venue_delete', p_tbl);
  ELSE
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (has_venue_access(venue_id)) WITH CHECK (has_venue_access(venue_id))', p_tbl || '_venue_access', p_tbl);
  END IF;
END $$;

SELECT _r162_restore('shifts',            false);
SELECT _r162_restore('shift_swaps',       false);
SELECT _r162_restore('food_items',        true);
SELECT _r162_restore('food_allergens',    true);
SELECT _r162_restore('departments',       false);
SELECT _r162_restore('staff_departments', false);
DROP FUNCTION _r162_restore(text, boolean);

DROP FUNCTION IF EXISTS caller_has_permission(uuid, text);

-- replace_food_item_allergens as in 062.
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
  SELECT EXISTS (
    SELECT 1
    FROM staff_sessions ss
    JOIN staff s ON s.id = ss.staff_id
    WHERE ss.token      = p_session_token
      AND ss.venue_id   = p_venue_id
      AND ss.expires_at > now()
      AND s.venue_id    = p_venue_id
      AND s.is_active   = true
      AND (
        s.role IN ('manager', 'owner')
        OR EXISTS (
          SELECT 1
          FROM staff_permissions sp
          WHERE sp.staff_id = s.id
            AND sp.venue_id = p_venue_id
            AND sp.permission = 'manage_allergens'
        )
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
