-- Add leave type to time off requests and create leave entitlements table

-- Leave type on requests (annual, sick, unpaid, other)
ALTER TABLE time_off_requests
  ADD COLUMN IF NOT EXISTS leave_type text NOT NULL DEFAULT 'annual'
    CHECK (leave_type IN ('annual', 'unpaid', 'other'));

-- Leave entitlements: stores manager overrides for annual entitlement per staff per year.
-- Calculated entitlement is derived in-app from employment_type + working_days.
-- This table only stores manual overrides (e.g. contractual entitlement > statutory).
CREATE TABLE IF NOT EXISTS leave_entitlements (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id      uuid        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  staff_id      uuid        NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  leave_year    smallint    NOT NULL,
  override_days numeric(5,1),        -- NULL = use auto-calculated statutory entitlement
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, leave_year)
);
