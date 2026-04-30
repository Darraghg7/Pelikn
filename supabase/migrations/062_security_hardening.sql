-- ============================================================================
-- 062: Security hardening for server-side auth and atomic allergen edits
--
-- Adds helper RPCs that validate PIN sessions server-side, fixes APNs token
-- RLS to use staff_sessions, and moves allergen replacement into one
-- SECURITY DEFINER transaction.
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_manager_session_for_venue(
  p_session_token uuid,
  p_venue_id      uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM staff_sessions ss
    JOIN staff s ON s.id = ss.staff_id
    WHERE ss.token      = p_session_token
      AND ss.venue_id   = p_venue_id
      AND ss.expires_at > now()
      AND s.venue_id    = p_venue_id
      AND s.is_active   = true
      AND s.role        IN ('manager', 'owner')
  );
$$;

CREATE OR REPLACE FUNCTION validate_staff_session_for_venue(
  p_session_token uuid,
  p_venue_id      uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM staff_sessions ss
    JOIN staff s ON s.id = ss.staff_id
    WHERE ss.token      = p_session_token
      AND ss.venue_id   = p_venue_id
      AND ss.expires_at > now()
      AND s.venue_id    = p_venue_id
      AND s.is_active   = true
  );
$$;

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

GRANT EXECUTE ON FUNCTION validate_manager_session_for_venue(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION validate_staff_session_for_venue(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION replace_food_item_allergens(uuid, uuid, uuid, text, text, text[]) TO anon, authenticated;

-- Some deployed databases may not have 061_apns_tokens.sql applied yet.
-- Make this migration self-contained so applying 062 never depends on that
-- optional mobile-push table already existing.
CREATE TABLE IF NOT EXISTS apns_tokens (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    uuid        NOT NULL REFERENCES staff(id)  ON DELETE CASCADE,
  venue_id    uuid        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  token       text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, token)
);

ALTER TABLE apns_tokens ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS apns_tokens_staff_id_idx ON apns_tokens (staff_id);
CREATE INDEX IF NOT EXISTS apns_tokens_venue_id_idx ON apns_tokens (venue_id);

CREATE OR REPLACE FUNCTION register_apns_token(
  p_session_token uuid,
  p_staff_id      uuid,
  p_venue_id      uuid,
  p_token         text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM staff_sessions ss
    WHERE ss.token      = p_session_token
      AND ss.staff_id   = p_staff_id
      AND ss.venue_id   = p_venue_id
      AND ss.expires_at > now()
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO apns_tokens (staff_id, venue_id, token)
  VALUES (p_staff_id, p_venue_id, p_token)
  ON CONFLICT (staff_id, token)
  DO UPDATE SET venue_id = EXCLUDED.venue_id, created_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION unregister_apns_tokens(
  p_session_token uuid,
  p_staff_id      uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM staff_sessions ss
    WHERE ss.token      = p_session_token
      AND ss.staff_id   = p_staff_id
      AND ss.expires_at > now()
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM apns_tokens WHERE staff_id = p_staff_id;
END;
$$;

GRANT EXECUTE ON FUNCTION register_apns_token(uuid, uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION unregister_apns_tokens(uuid, uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "staff can manage own apns tokens" ON apns_tokens;

CREATE POLICY "staff can manage own apns tokens"
  ON apns_tokens FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM staff_sessions ss
      WHERE ss.staff_id   = apns_tokens.staff_id
        AND ss.venue_id   = apns_tokens.venue_id
        AND ss.expires_at > now()
        AND ss.token::text = current_setting('request.jwt.claims', true)::json->>'session_token'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM staff_sessions ss
      WHERE ss.staff_id   = apns_tokens.staff_id
        AND ss.venue_id   = apns_tokens.venue_id
        AND ss.expires_at > now()
        AND ss.token::text = current_setting('request.jwt.claims', true)::json->>'session_token'
    )
  );
