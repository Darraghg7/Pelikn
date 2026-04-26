-- Migration 061: APNs device token storage for native iOS push notifications
-- Stores the device token issued by Apple for each staff member's device.
-- Multiple tokens per staff member are allowed (one per device).

CREATE TABLE IF NOT EXISTS apns_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    UUID        NOT NULL REFERENCES staff(id)  ON DELETE CASCADE,
  venue_id    UUID        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  token       TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_id, token)
);

ALTER TABLE apns_tokens ENABLE ROW LEVEL SECURITY;

-- Staff can insert/delete their own tokens; service role can read all.
CREATE POLICY "staff can manage own apns tokens"
  ON apns_tokens FOR ALL
  USING (
    staff_id IN (
      SELECT s.id FROM staff s
      JOIN sessions sess ON sess.staff_id = s.id
      WHERE sess.token = current_setting('request.jwt.claims', true)::json->>'session_token'
    )
  );

-- Index for fast lookup by venue + role (used in send-apns function)
CREATE INDEX apns_tokens_staff_id_idx ON apns_tokens (staff_id);
CREATE INDEX apns_tokens_venue_id_idx ON apns_tokens (venue_id);
