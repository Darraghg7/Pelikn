-- ============================================================================
-- 052: Fix validate_staff_session + add venue join_code
--
-- Changes:
--   1. Backfill NULL venue_id in staff_sessions (sessions from before multi-
--      tenancy migration could have venue_id = NULL, causing validate to return
--      NULL which the client treats as "invalid session" and clears localStorage)
--   2. Replace validate_staff_session to return boolean instead of venue_id::text
--      (eliminates the NULL false-positive that was logging staff out)
--   3. Add join_code column to venues — a short public code staff enter once
--      to find their venue's PIN login screen (no email/password needed)
--   4. Add get_venue_by_code(text) — public function, no auth required
--   5. Add regenerate_venue_join_code(uuid) — manager/owner only
-- ============================================================================

-- 1. Backfill NULL venue_id in staff_sessions from the staff table
UPDATE staff_sessions ss
   SET venue_id = s.venue_id
  FROM staff s
 WHERE ss.staff_id = s.id
   AND ss.venue_id IS NULL;

-- 2. Replace validate_staff_session — returns boolean instead of venue_id::text
--    Must drop first because the return type is changing (text → boolean).
DROP FUNCTION IF EXISTS validate_staff_session(uuid);
--    The client already has venue_id in localStorage; it only needs to know if
--    the token is still valid. Returning venue_id as a boolean proxy caused
--    logouts whenever venue_id was NULL on old session rows.
CREATE OR REPLACE FUNCTION validate_staff_session(p_token uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff_sessions
     WHERE token = p_token AND expires_at > now()
  );
$$;

-- 3. Add join_code to venues (6 uppercase hex chars, unique)
ALTER TABLE venues ADD COLUMN IF NOT EXISTS join_code text;

-- Backfill: generate a unique code for each venue that doesn't have one
DO $$
DECLARE
  v_id   uuid;
  v_code text;
BEGIN
  FOR v_id IN SELECT id FROM venues WHERE join_code IS NULL LOOP
    LOOP
      v_code := upper(substring(encode(gen_random_bytes(3), 'hex'), 1, 6));
      UPDATE venues SET join_code = v_code WHERE id = v_id AND join_code IS NULL;
      -- If no rows updated, another concurrent process beat us — retry
      EXIT WHEN FOUND;
    END LOOP;
  END LOOP;
END;
$$;

ALTER TABLE venues ALTER COLUMN join_code SET NOT NULL;
ALTER TABLE venues DROP CONSTRAINT IF EXISTS venues_join_code_unique;
ALTER TABLE venues ADD CONSTRAINT venues_join_code_unique UNIQUE (join_code);

-- 4. Public function: look up a venue by its join code (no auth required)
--    Staff use this to find their venue's slug before PIN login.
CREATE OR REPLACE FUNCTION get_venue_by_code(p_code text)
RETURNS TABLE (id uuid, name text, slug text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id, name, slug
    FROM venues
   WHERE join_code = upper(trim(p_code))
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_venue_by_code(text) TO anon, authenticated;

-- 5. Manager-only function: regenerate the venue join code
--    Returns the new code so the client can display it immediately.
CREATE OR REPLACE FUNCTION regenerate_venue_join_code(p_session_token uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_venue_id uuid;
  v_code     text;
BEGIN
  SELECT s.venue_id INTO v_venue_id
    FROM staff_sessions ss
    JOIN staff s ON s.id = ss.staff_id
   WHERE ss.token = p_session_token
     AND ss.expires_at > now()
     AND s.role IN ('manager', 'owner')
     AND s.is_active = true;

  IF v_venue_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  LOOP
    v_code := upper(substring(encode(gen_random_bytes(3), 'hex'), 1, 6));
    BEGIN
      UPDATE venues SET join_code = v_code WHERE id = v_venue_id;
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      -- retry on collision
    END;
  END LOOP;
END;
$$;
