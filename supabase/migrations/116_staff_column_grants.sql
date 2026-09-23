-- 116 — stop the client being able to read staff PIN hashes.
--
-- 113/114 scoped WHICH staff rows a venue can see. They could not scope which
-- COLUMNS, because RLS is row-level: once a row is visible, every column of it
-- is readable. So any employee who can log in can run
--
--   GET /rest/v1/staff?select=pin_hash
--
-- and read the bcrypt PIN hash of every colleague, including their manager's.
--
-- Why that is a privilege escalation, not just an information leak: PINs are
-- exactly 4 digits (StaffMembersSection enforces maxLength={4}) and are hashed
-- with gen_salt('bf', 8). A 10,000-value keyspace against cost-8 bcrypt is an
-- offline sweep measured in minutes. Recovering a manager's PIN gives full
-- manager access — including, since 115, the ability to edit and delete staff.
--
-- Nothing in the client reads pin_hash. Verified: no reference anywhere in
-- src/ or tests/, and no `select('*')` against staff that would pick it up
-- implicitly. PIN verification happens inside SECURITY DEFINER functions
-- (verify_staff_pin and friends), which run as the definer and are unaffected
-- by the column grants below.
--
-- NOTE ON MECHANISM: Postgres table-level SELECT overrides column-level
-- grants, so `REVOKE SELECT (pin_hash)` alone does nothing while the role
-- still holds table-level SELECT. The table grant has to be dropped and the
-- permitted columns granted back explicitly. That means this list must name
-- every readable column — a column added later will be unreadable until it is
-- added here. That is the safe direction to fail (new column invisible, not
-- new secret exposed), but it is a real maintenance obligation.

REVOKE SELECT ON staff FROM anon, authenticated;

-- Every column except pin_hash. Enumerated rather than generated so the set
-- is reviewable in the diff.
GRANT SELECT (
  id,
  venue_id,
  name,
  email,
  role,
  job_role,
  hourly_rate,
  skills,
  colour,
  photo_url,
  is_active,
  is_restricted,
  is_under_18,
  show_temp_logs,
  show_allergens,
  sort_order,
  working_days,
  contracted_hours,
  employment_type,
  start_date,
  emergency_contact_name,
  emergency_contact_phone,
  holiday_pay_eligible,
  permission_title_id,
  linked_from_staff_id,
  pin_failed_attempts,
  pin_locked_until,
  created_at
) ON staff TO anon, authenticated;

-- pin_failed_attempts / pin_locked_until stay readable on purpose: the staff
-- settings list renders a "locked" badge from them and they reveal nothing
-- secret. Only the hash itself is withheld.

-- Defence in depth: every write to `staff` already goes through a SECURITY
-- DEFINER RPC (091 established this; 115 converted the last five direct
-- writes), and RLS grants no write policy, so direct writes are already
-- denied. Dropping the table-level write grants as well means a future policy
-- added without thinking cannot silently re-expose the hash for writing.
REVOKE INSERT, UPDATE, DELETE ON staff FROM anon, authenticated;
