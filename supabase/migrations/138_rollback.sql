-- Rollback for 138_billing_accounts.sql.
-- The client fails open while get_venue_billing is missing (no lock, no staff
-- counter), and signup falls back to leaving the plan unset, so this is safe
-- to run with the new client live.
--
-- ⚠ Drops billing_accounts, i.e. every trial end date and Stripe customer /
-- subscription id. Stripe itself keeps charging; export the table first if
-- any customer has subscribed:
--   COPY (SELECT * FROM billing_accounts) TO STDOUT WITH CSV HEADER;

SET lock_timeout = '5s';

DROP TRIGGER IF EXISTS trg_staff_starter_limit ON staff;
DROP FUNCTION IF EXISTS enforce_starter_staff_limit();

DROP TRIGGER IF EXISTS trg_venues_start_owner_trial ON venues;
DROP FUNCTION IF EXISTS start_owner_trial();

DROP FUNCTION IF EXISTS get_venue_billing(uuid);
DROP FUNCTION IF EXISTS set_trial_plan(uuid, text, boolean, integer);

DROP TABLE IF EXISTS billing_accounts;

RESET lock_timeout;
