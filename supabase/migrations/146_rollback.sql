-- 146 rollback — current_venue_id() goes back to 091's definition: the JWT's
-- venue_id claim, trusted on signature and expiry alone. Revoked and
-- signed-out devices can read the venue again until their JWT expires.

CREATE OR REPLACE FUNCTION current_venue_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NULLIF(auth.jwt() ->> 'venue_id', '')::uuid
$$;
GRANT EXECUTE ON FUNCTION current_venue_id() TO anon, authenticated;

COMMENT ON FUNCTION current_venue_id() IS NULL;
