-- Add plan tier to venues table
-- Each venue is either on Starter (compliance only) or Pro (compliance + rota).
-- Multi-venue operators just have multiple venues, each billed at their plan rate
-- with volume discounts applied externally at the account/billing level.
ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'starter'
    CHECK (plan IN ('starter', 'pro'));
