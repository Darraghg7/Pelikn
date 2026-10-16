-- Signup: derive the venue URL, and let the owner choose their own PIN after
-- the account exists instead of on the details form.
--
--   1. suggest_venue_slug(base)       first free URL: base, base-2, base-3 …
--   2. create_venue_with_owner(...)   p_owner_pin may now be empty. The owner
--                                     row then gets a hash nobody knows (so PIN
--                                     login cannot succeed) and the venue is
--                                     flagged owner_pin_pending until the owner
--                                     sets one.
--   3. owner_pin_pending(venue)       does the signed-in owner still owe a PIN?
--   4. set_owner_pin(venue, pin)      first-time PIN for the signed-in owner,
--                                     only while the venue is flagged pending.
--
-- No table changes: staff.pin_hash stays NOT NULL. Rollback: 155_rollback.sql.

SET lock_timeout = '5s';

BEGIN;

-- ── 1. First free slug ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION suggest_venue_slug(p_base text)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base text;
  v_slug text;
  n      int := 1;
BEGIN
  -- Same shape the app produces: lowercase letters, digits and single dashes.
  v_base := trim(both '-' from regexp_replace(lower(coalesce(p_base, '')), '[^a-z0-9]+', '-', 'g'));
  IF v_base = '' THEN v_base := 'venue'; END IF;
  v_base := left(v_base, 48);

  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM venues WHERE lower(slug) = v_slug) LOOP
    n := n + 1;
    v_slug := v_base || '-' || n;
    EXIT WHEN n > 500;
  END LOOP;
  RETURN v_slug;
END;
$$;

GRANT EXECUTE ON FUNCTION suggest_venue_slug(text) TO anon, authenticated;

-- ── 2. Venue creation without a PIN ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_venue_with_owner(
  p_venue_name   text,
  p_slug         text,
  p_owner_name   text,
  p_owner_pin    text,
  p_owner_email  text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_venue_id uuid;
  v_email    text;
  v_pending  boolean := coalesce(p_owner_pin, '') = '';
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_email := COALESCE(NULLIF(p_owner_email, ''), auth.email());

  IF EXISTS (SELECT 1 FROM venues WHERE lower(slug) = lower(p_slug)) THEN
    RAISE EXCEPTION 'Venue slug already taken';
  END IF;

  INSERT INTO venues (name, slug, owner_id)
  VALUES (p_venue_name, p_slug, auth.uid())
  RETURNING id INTO v_venue_id;

  -- With no PIN yet the owner gets a random hash nobody knows, so PIN login
  -- cannot succeed until set_owner_pin() replaces it.
  INSERT INTO staff (name, pin_hash, role, job_role, venue_id, is_active)
  VALUES (
    p_owner_name,
    crypt(CASE WHEN v_pending THEN gen_random_uuid()::text ELSE p_owner_pin END, gen_salt('bf')),
    'owner', 'foh', v_venue_id, true
  );

  INSERT INTO app_settings (venue_id, key, value) VALUES
    (v_venue_id, 'venue_name', p_venue_name),
    (v_venue_id, 'manager_email', COALESCE(v_email, ''))
  ON CONFLICT (venue_id, key) DO UPDATE SET value = EXCLUDED.value;

  IF v_pending THEN
    INSERT INTO app_settings (venue_id, key, value)
    VALUES (v_venue_id, 'owner_pin_pending', 'true')
    ON CONFLICT (venue_id, key) DO UPDATE SET value = EXCLUDED.value;
  END IF;

  RETURN v_venue_id;
END;
$$;

-- ── 3. Does the signed-in owner still owe a PIN? ────────────────────────────
CREATE OR REPLACE FUNCTION owner_pin_pending(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM venues v
    JOIN app_settings s ON s.venue_id = v.id AND s.key = 'owner_pin_pending' AND s.value = 'true'
    WHERE v.id = p_venue_id AND v.owner_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION owner_pin_pending(uuid) TO authenticated;

-- ── 4. First-time owner PIN ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_owner_pin(p_venue_id uuid, p_pin text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_updated int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{4,6}$' THEN
    RAISE EXCEPTION 'PIN must be 4 to 6 digits';
  END IF;
  IF NOT owner_pin_pending(p_venue_id) THEN
    RAISE EXCEPTION 'PIN already set';
  END IF;

  UPDATE staff
  SET pin_hash = crypt(p_pin, gen_salt('bf'))
  WHERE venue_id = p_venue_id AND role = 'owner';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Owner not found';
  END IF;

  DELETE FROM app_settings WHERE venue_id = p_venue_id AND key = 'owner_pin_pending';
END;
$$;

GRANT EXECUTE ON FUNCTION set_owner_pin(uuid, text) TO authenticated;

COMMIT;
