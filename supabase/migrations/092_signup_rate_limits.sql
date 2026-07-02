-- 092: Signup rate limiting table
-- Tracks signup attempts by hashed IP. Checked by the signup-guard edge function.
-- Old rows are pruned on insert so the table stays small.

create table if not exists signup_rate_limits (
  id         uuid primary key default gen_random_uuid(),
  ip_hash    text        not null,
  created_at timestamptz not null default now()
);

create index if not exists signup_rate_limits_ip_hash_created_at
  on signup_rate_limits (ip_hash, created_at desc);

-- No RLS needed — only accessible via service role in the edge function.
-- Anon/authenticated roles have no direct access.
revoke all on signup_rate_limits from anon, authenticated;
