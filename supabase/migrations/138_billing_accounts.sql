-- ============================================================================
-- 138: Real billing — trial, Stripe subscription state, Starter staff limit
--
-- Until now signup promised "7-day free trial, charged after" but nothing
-- tracked a trial, nothing charged, and the plan picked at signup was never
-- saved (venues has had no UPDATE policy since 091, so SignupFlowPage's
-- `venues.update({ plan })` matched zero rows and every venue stayed Starter).
--
-- Billing is per OWNER (one Supabase Auth account), not per venue: one Stripe
-- subscription covers the owner's first venue plus extra venues as a quantity.
--
--  1. billing_accounts — one row per owner. Service-role writes only (the
--     stripe-webhook / billing edge functions). Clients read it through
--     get_venue_billing() below, never directly.
--  2. A row (with a 7-day trial) is created when an owner's FIRST venue is
--     inserted. Owners who already exist get NO row: "no row" means
--     "grandfathered / invoiced by hand", which is never locked and never
--     staff-limited. To move an existing customer onto Stripe billing, insert
--     a row for them by hand (see docs/stripe-billing-setup.md).
--  3. set_trial_plan() — the owner picks Starter/Pro (+ QR add-on, extra venue
--     count) during the trial, before any card is on file. Replaces the
--     silently-failing direct update in signup.
--  4. get_venue_billing() — what the app needs to show trial countdowns, lock
--     an expired venue, and show "4 of 5 staff". Venue members only.
--  5. Starter staff limit — 5 active staff (the owner doesn't count), enforced
--     by trigger so every path (Settings, onboarding, reactivate) is covered.
--
-- Independent of the never-merged wip/stripe-billing 099 (venues.trial_ends_at
-- + venue_billing). If 099 was ever applied by hand those objects are simply
-- unused by this.
--
-- Idempotent. Rollback: 138_rollback.sql
-- ============================================================================

SET lock_timeout = '5s';

-- ── 1. billing_accounts ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing_accounts (
  owner_id               uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  trial_ends_at          timestamptz,
  stripe_customer_id     text UNIQUE,
  stripe_subscription_id text,
  -- Stripe's own subscription.status: trialing | active | past_due | unpaid |
  -- canceled | incomplete | incomplete_expired | paused. NULL = never subscribed.
  subscription_status    text,
  billing_interval       text CHECK (billing_interval IN ('month', 'year')),
  current_period_end     timestamptz,
  cancel_at_period_end   boolean NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE billing_accounts ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only the service role (edge functions) touches it.
REVOKE ALL ON billing_accounts FROM anon, authenticated;

-- ── 2. Start a trial when an owner creates their first venue ───────────────
CREATE OR REPLACE FUNCTION start_owner_trial()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- Additional venues (create_additional_venue) belong to an owner who already
  -- has a venue: they join that owner's existing billing, or stay
  -- grandfathered if the owner predates billing.
  IF EXISTS (SELECT 1 FROM venues WHERE owner_id = NEW.owner_id AND id <> NEW.id) THEN
    RETURN NEW;
  END IF;
  INSERT INTO billing_accounts (owner_id, trial_ends_at)
  VALUES (NEW.owner_id, now() + interval '7 days')
  ON CONFLICT (owner_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_venues_start_owner_trial ON venues;
CREATE TRIGGER trg_venues_start_owner_trial
  AFTER INSERT ON venues
  FOR EACH ROW EXECUTE FUNCTION start_owner_trial();

-- ── 3. set_trial_plan — owner chooses plan before paying ────────────────────
-- Only while the owner has a billing account with no Stripe subscription yet.
-- Once they have subscribed, the plan only changes through Stripe (webhook).
-- Grandfathered owners (no row) can't use it to give themselves Pro.
CREATE OR REPLACE FUNCTION set_trial_plan(
  p_venue_id          uuid,
  p_plan              text,
  p_qr_addon          boolean  DEFAULT NULL,
  p_additional_venues integer  DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_plan NOT IN ('starter', 'pro') THEN
    RAISE EXCEPTION 'Unknown plan';
  END IF;

  SELECT owner_id INTO v_owner FROM venues WHERE id = p_venue_id;
  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Only the venue owner can change the plan';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM billing_accounts
    WHERE owner_id = v_owner AND stripe_subscription_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Change your plan from Plan & Billing';
  END IF;

  -- Plan applies to every venue the owner has; add-ons to this venue only.
  UPDATE venues SET plan = p_plan WHERE owner_id = v_owner;
  UPDATE venues
     SET qr_addon          = COALESCE(p_qr_addon, qr_addon),
         additional_venues = COALESCE(p_additional_venues::smallint, additional_venues)
   WHERE id = p_venue_id;
END;
$$;

REVOKE ALL ON FUNCTION set_trial_plan(uuid, text, boolean, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION set_trial_plan(uuid, text, boolean, integer) TO authenticated;

-- ── 4. get_venue_billing — read model for the app ───────────────────────────
-- Returns NULL to anyone without access to the venue. `managed = false` means
-- grandfathered (no billing row): the client never locks those venues.
CREATE OR REPLACE FUNCTION get_venue_billing(p_venue_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'managed',              ba.owner_id IS NOT NULL,
    'plan',                 v.plan,
    'trial_ends_at',        ba.trial_ends_at,
    'subscription_status',  ba.subscription_status,
    'billing_interval',     ba.billing_interval,
    'current_period_end',   ba.current_period_end,
    'cancel_at_period_end', COALESCE(ba.cancel_at_period_end, false),
    'has_subscription',     ba.stripe_subscription_id IS NOT NULL,
    'venue_count',          (SELECT count(*) FROM venues o WHERE o.owner_id = v.owner_id),
    'active_staff',         (SELECT count(*) FROM staff s
                              WHERE s.venue_id = v.id AND s.is_active AND s.role <> 'owner')
  )
  FROM venues v
  LEFT JOIN billing_accounts ba ON ba.owner_id = v.owner_id
  WHERE v.id = p_venue_id
    AND has_venue_access(p_venue_id)
$$;

REVOKE ALL ON FUNCTION get_venue_billing(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_venue_billing(uuid) TO anon, authenticated;

-- ── 5. Starter staff limit ──────────────────────────────────────────────────
-- Keep STARTER_STAFF_LIMIT in src/lib/billing.ts in step with the 5 here.
-- Grandfathered venues are exempt. Staff already over the limit (e.g. after a
-- downgrade) are kept; only adding or reactivating someone is refused.
CREATE OR REPLACE FUNCTION enforce_starter_staff_limit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan    text;
  v_managed boolean;
  v_count   integer;
BEGIN
  IF NOT NEW.is_active OR NEW.role = 'owner' THEN
    RETURN NEW;
  END IF;
  -- Already counted before this update: nothing changes.
  IF TG_OP = 'UPDATE' AND OLD.is_active AND OLD.role <> 'owner' AND OLD.venue_id = NEW.venue_id THEN
    RETURN NEW;
  END IF;

  SELECT v.plan, ba.owner_id IS NOT NULL
    INTO v_plan, v_managed
    FROM venues v
    LEFT JOIN billing_accounts ba ON ba.owner_id = v.owner_id
   WHERE v.id = NEW.venue_id;

  IF v_plan IS DISTINCT FROM 'starter' OR NOT COALESCE(v_managed, false) THEN
    RETURN NEW;
  END IF;

  -- Two managers adding the 5th and 6th person at the same moment.
  PERFORM pg_advisory_xact_lock(hashtext('starter_staff_limit:' || NEW.venue_id::text));

  SELECT count(*) INTO v_count
    FROM staff
   WHERE venue_id = NEW.venue_id AND is_active AND role <> 'owner' AND id <> NEW.id;

  IF v_count >= 5 THEN
    RAISE EXCEPTION 'Starter includes up to 5 staff. Upgrade to Pro in Plan & Billing to add more.'
      USING HINT = 'staff_limit';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_staff_starter_limit ON staff;
CREATE TRIGGER trg_staff_starter_limit
  BEFORE INSERT OR UPDATE OF is_active, role, venue_id ON staff
  FOR EACH ROW EXECUTE FUNCTION enforce_starter_staff_limit();

RESET lock_timeout;
