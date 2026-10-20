-- ============================================================================
-- 157: clock in only at the venue — GPS fence and/or one clock-in tablet
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  APPLY MANUALLY IN SUPABASE SQL EDITOR. Never `supabase db push`.         ║
-- ║  Safe in either order with the client change in the same PR: until this  ║
-- ║  runs the Attendance toggles show as unavailable and clocking is        ║
-- ║  unchanged. ROLLBACK: 157_rollback.sql (same folder).                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- ── What this adds ──────────────────────────────────────────────────────────
-- Two opt-in rules per venue, both off by default:
--
--   • Location: a clock-in / clock-out only counts when the phone reports a
--     position within radius_m of the venue's saved point. The point is set
--     by a manager standing in the venue (so the car park falls outside).
--   • Device: a clock-in / clock-out only counts when it comes from the one
--     registered tablet. The tablet holds a random secret (stored on the
--     device); only its SHA-256 is kept here.
--
-- With both on, the tablet is the place: the device check alone applies and
-- GPS is not asked for (a wall-mounted tablet should not need a fix).
--
-- Breaks are not gated — people step outside on one. Only clock_in and
-- clock_out are. A manager recording a punch for someone else is not gated
-- (they are fixing a missed punch, not clocking in themselves).
--
-- ── Where the rules live ────────────────────────────────────────────────────
-- venue_clock_rules is closed to every client role (RLS on, no policies, no
-- grants). It holds the tablet's secret hash, which app_settings' row-level
-- security would hand to every employee. Everything goes through the
-- SECURITY DEFINER functions below, which never return the hash.
--
-- ── Enforcement ─────────────────────────────────────────────────────────────
-- record_clock_event takes the position (p_latitude, p_longitude,
-- p_accuracy_m) and the tablet secret (p_device_token) and checks them
-- itself, so editing the app cannot skip the rule. The position is captured
-- at the tap and travels in the offline queue with the punch.
-- Honest limit: a phone's reported position can be faked by someone who goes
-- to the trouble. The device rule is the strong one.
--
-- The 4-argument record_clock_event (144) is dropped, not overloaded, so
-- PostgREST has one function to choose. Caller checks are 139's, unchanged.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ── 1. The rules ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS venue_clock_rules (
  venue_id              uuid PRIMARY KEY REFERENCES venues(id) ON DELETE CASCADE,
  require_location      boolean          NOT NULL DEFAULT false,
  latitude              double precision,
  longitude             double precision,
  radius_m              integer          NOT NULL DEFAULT 50 CHECK (radius_m BETWEEN 10 AND 500),
  require_device        boolean          NOT NULL DEFAULT false,
  device_id             uuid,
  device_name           text,
  device_token_hash     text,
  device_registered_at  timestamptz,
  updated_at            timestamptz      NOT NULL DEFAULT now(),
  CONSTRAINT venue_clock_rules_lat_lng CHECK (
    (latitude  IS NULL OR latitude  BETWEEN -90  AND 90) AND
    (longitude IS NULL OR longitude BETWEEN -180 AND 180)
  )
);

ALTER TABLE venue_clock_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE venue_clock_rules FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE venue_clock_rules IS
  'Per-venue clock-in rules (157): GPS fence and one registered tablet. No '
  'client access — read and written only through the SECURITY DEFINER functions.';


-- ── 2. Read (venue members) ─────────────────────────────────────────────────
-- Everyone at the venue needs the rules to know what to ask their phone for.
-- Never includes the secret hash.
CREATE OR REPLACE FUNCTION get_clock_rules(p_venue_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r venue_clock_rules%ROWTYPE;
BEGIN
  IF NOT COALESCE(has_venue_access(p_venue_id), false) THEN
    RAISE EXCEPTION 'Not signed in to this venue' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO r FROM venue_clock_rules WHERE venue_id = p_venue_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'require_location', false, 'latitude', NULL, 'longitude', NULL, 'radius_m', 50,
      'require_device', false, 'device_id', NULL, 'device_name', NULL,
      'device_registered_at', NULL
    );
  END IF;

  RETURN jsonb_build_object(
    'require_location',     r.require_location,
    'latitude',             r.latitude,
    'longitude',            r.longitude,
    'radius_m',             r.radius_m,
    'require_device',       r.require_device,
    'device_id',            r.device_id,
    'device_name',          r.device_name,
    'device_registered_at', r.device_registered_at
  );
END;
$$;


-- ── 3. Location rule (managers) ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_clock_location_rule(
  p_venue_id  uuid,
  p_enabled   boolean,
  p_latitude  double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_radius_m  integer          DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r venue_clock_rules%ROWTYPE;
BEGIN
  IF NOT is_venue_hr_manager(p_venue_id) THEN
    RAISE EXCEPTION 'Only a manager can change this' USING ERRCODE = '42501';
  END IF;

  INSERT INTO venue_clock_rules (venue_id) VALUES (p_venue_id) ON CONFLICT (venue_id) DO NOTHING;
  SELECT * INTO r FROM venue_clock_rules WHERE venue_id = p_venue_id FOR UPDATE;

  IF p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN
    r.latitude  := p_latitude;
    r.longitude := p_longitude;
  END IF;
  IF p_radius_m IS NOT NULL THEN
    r.radius_m := p_radius_m;
  END IF;

  IF p_enabled AND (r.latitude IS NULL OR r.longitude IS NULL) THEN
    RAISE EXCEPTION 'Set the venue location first' USING ERRCODE = '22023';
  END IF;

  UPDATE venue_clock_rules
  SET require_location = p_enabled,
      latitude         = r.latitude,
      longitude        = r.longitude,
      radius_m         = r.radius_m,
      updated_at       = now()
  WHERE venue_id = p_venue_id;
END;
$$;


-- ── 4. Device rule (managers) ───────────────────────────────────────────────
-- Registering returns the secret ONCE; the caller keeps it on the tablet.
-- Registering again replaces the tablet (the old secret stops working).
CREATE OR REPLACE FUNCTION register_clock_device(p_venue_id uuid, p_name text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_token     text;
  v_device_id uuid := gen_random_uuid();
BEGIN
  IF NOT is_venue_hr_manager(p_venue_id) THEN
    RAISE EXCEPTION 'Only a manager can change this' USING ERRCODE = '42501';
  END IF;

  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  INSERT INTO venue_clock_rules (venue_id, device_id, device_name, device_token_hash, device_registered_at)
  VALUES (
    p_venue_id, v_device_id, COALESCE(NULLIF(btrim(p_name), ''), 'Venue tablet'),
    encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), now()
  )
  ON CONFLICT (venue_id) DO UPDATE
  SET device_id            = EXCLUDED.device_id,
      device_name          = EXCLUDED.device_name,
      device_token_hash    = EXCLUDED.device_token_hash,
      device_registered_at = EXCLUDED.device_registered_at,
      updated_at           = now();

  RETURN jsonb_build_object('device_id', v_device_id, 'token', v_token);
END;
$$;

CREATE OR REPLACE FUNCTION set_clock_device_rule(p_venue_id uuid, p_enabled boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_venue_hr_manager(p_venue_id) THEN
    RAISE EXCEPTION 'Only a manager can change this' USING ERRCODE = '42501';
  END IF;

  IF p_enabled AND NOT EXISTS (
    SELECT 1 FROM venue_clock_rules WHERE venue_id = p_venue_id AND device_token_hash IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Register the tablet first' USING ERRCODE = '22023';
  END IF;

  INSERT INTO venue_clock_rules (venue_id, require_device) VALUES (p_venue_id, p_enabled)
  ON CONFLICT (venue_id) DO UPDATE SET require_device = p_enabled, updated_at = now();
END;
$$;

-- Forgets the tablet and turns the rule off — so a lost tablet can't lock
-- everyone out of clocking in.
CREATE OR REPLACE FUNCTION clear_clock_device(p_venue_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_venue_hr_manager(p_venue_id) THEN
    RAISE EXCEPTION 'Only a manager can change this' USING ERRCODE = '42501';
  END IF;

  UPDATE venue_clock_rules
  SET require_device = false, device_id = NULL, device_name = NULL,
      device_token_hash = NULL, device_registered_at = NULL, updated_at = now()
  WHERE venue_id = p_venue_id;
END;
$$;


-- ── 5. The check itself ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION assert_clock_rules(
  p_staff_id     uuid,
  p_venue_id     uuid,
  p_event_type   text,
  p_latitude     double precision,
  p_longitude    double precision,
  p_accuracy_m   double precision,
  p_device_token text
)
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  MAX_ACCURACY_M CONSTANT double precision := 100;
  r          venue_clock_rules%ROWTYPE;
  v_distance double precision;
BEGIN
  IF p_event_type NOT IN ('clock_in', 'clock_out') THEN RETURN; END IF;
  -- A manager recording someone else's punch is fixing a record, not clocking in.
  IF auth.uid() IS DISTINCT FROM p_staff_id THEN RETURN; END IF;

  SELECT * INTO r FROM venue_clock_rules WHERE venue_id = p_venue_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF r.require_device AND r.device_token_hash IS NOT NULL THEN
    IF p_device_token IS NULL
       OR encode(sha256(convert_to(p_device_token, 'UTF8')), 'hex') <> r.device_token_hash THEN
      RAISE EXCEPTION 'Clock in on %', COALESCE(r.device_name, 'the venue tablet')
        USING ERRCODE = '42501';
    END IF;
    RETURN;   -- the tablet is the place; GPS is not asked of it
  END IF;

  IF r.require_location AND r.latitude IS NOT NULL AND r.longitude IS NOT NULL THEN
    IF p_latitude IS NULL OR p_longitude IS NULL THEN
      RAISE EXCEPTION 'Turn on location to clock in' USING ERRCODE = '42501';
    END IF;
    IF p_accuracy_m IS NOT NULL AND p_accuracy_m > MAX_ACCURACY_M THEN
      RAISE EXCEPTION 'Your location is not precise enough yet. Try again in a moment'
        USING ERRCODE = '42501';
    END IF;

    -- Haversine, metres.
    v_distance := 2 * 6371000 * asin(sqrt(
      power(sin(radians(p_latitude  - r.latitude)  / 2), 2) +
      cos(radians(r.latitude)) * cos(radians(p_latitude)) *
      power(sin(radians(p_longitude - r.longitude) / 2), 2)
    ));

    IF v_distance > r.radius_m THEN
      RAISE EXCEPTION 'You need to be at the venue to clock in' USING ERRCODE = '42501';
    END IF;
  END IF;
END;
$$;


-- ── 6. record_clock_event: 144's body plus the rule check ───────────────────
DROP FUNCTION IF EXISTS record_clock_event(uuid, text, uuid, timestamptz);

CREATE FUNCTION record_clock_event(
  p_staff_id     uuid,
  p_event_type   text,
  p_venue_id     uuid             DEFAULT NULL,
  p_occurred_at  timestamptz      DEFAULT NULL,
  p_latitude     double precision DEFAULT NULL,
  p_longitude    double precision DEFAULT NULL,
  p_accuracy_m   double precision DEFAULT NULL,
  p_device_token text             DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  DEDUPE_WINDOW CONSTANT interval := interval '120 seconds';
  MAX_AGE       CONSTANT interval := interval '7 days';
  v_venue_id    uuid;
  v_at          timestamptz;
  v_existing_id uuid;
  v_new_id      uuid;
BEGIN
  IF p_venue_id IS NOT NULL THEN
    v_venue_id := p_venue_id;
  ELSE
    SELECT venue_id INTO v_venue_id FROM staff WHERE id = p_staff_id;
  END IF;

  -- Before anything else, so a refused caller learns nothing (139).
  PERFORM assert_clock_access(p_staff_id, v_venue_id, true);

  v_at := LEAST(COALESCE(p_occurred_at, now()), now());
  IF v_at < now() - MAX_AGE THEN
    RAISE EXCEPTION 'Clock event is more than 7 days old'
      USING ERRCODE = '22023';
  END IF;

  -- Already recorded this exact event around this tap — a retry of a request
  -- that succeeded. Hand back the row we already have. Checked before the
  -- venue rules so a retry of an accepted punch is never refused.
  SELECT id INTO v_existing_id
  FROM clock_events
  WHERE staff_id    = p_staff_id
    AND event_type  = p_event_type
    AND occurred_at BETWEEN v_at - DEDUPE_WINDOW AND v_at + DEDUPE_WINDOW
    AND (v_venue_id IS NULL OR venue_id = v_venue_id)
  ORDER BY occurred_at DESC
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  PERFORM assert_clock_rules(
    p_staff_id, v_venue_id, p_event_type, p_latitude, p_longitude, p_accuracy_m, p_device_token
  );

  INSERT INTO clock_events (staff_id, event_type, venue_id, occurred_at, recorded_at)
  VALUES (p_staff_id, p_event_type, v_venue_id, v_at, now())
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

COMMENT ON FUNCTION record_clock_event(uuid, text, uuid, timestamptz, double precision, double precision, double precision, text) IS
  'Records a clock event at the tap time (144), ignoring a repeat within 120 s '
  '(106). clock_in / clock_out must pass the venue''s location or tablet rule '
  'when one is on (157). Refuses callers without a venue JWT with 42501 (139).';


-- ── 7. Who may call what ────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION record_clock_event(uuid, text, uuid, timestamptz, double precision, double precision, double precision, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION record_clock_event(uuid, text, uuid, timestamptz, double precision, double precision, double precision, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION assert_clock_rules(uuid, uuid, text, double precision, double precision, double precision, text) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION get_clock_rules(uuid)                                   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION set_clock_location_rule(uuid, boolean, double precision, double precision, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION register_clock_device(uuid, text)                       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION set_clock_device_rule(uuid, boolean)                    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION clear_clock_device(uuid)                                FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION get_clock_rules(uuid)                                    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION set_clock_location_rule(uuid, boolean, double precision, double precision, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION register_clock_device(uuid, text)                        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION set_clock_device_rule(uuid, boolean)                     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION clear_clock_device(uuid)                                 TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
