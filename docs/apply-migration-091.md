# Applying migration 091 — venue-scoped RLS

**What it does:** locks every venue's data to that venue. Today the database policies say "anyone with the app's public key may read/write" (`USING (true)`); after 091, ~123 policies check `venue_id = current_venue_id()`, where the venue ID comes from the signed login token. Data is never modified by this migration — only *access rules* change (plus a `venue_id` column added and backfilled on 7 child tables).

**Cost:** nothing. RLS is a core Postgres feature, free on every Supabase plan.

**Time:** ~10 minutes including checks. Do it at a quiet time (e.g. after close) — if anything misbehaves, the rollback takes under a minute.

---

## Step 1 — Pre-checks (2 min)

These should already be true (the app has been venue-aware since the pin-login update), but confirm:

1. Open the live app and log in to a real venue (e.g. NOMAD) as staff via PIN. Pages load? Good.
2. Log in as owner (email/password). Dashboard loads? Good.

If either fails **stop** — that's a pre-existing issue to fix first.

## Step 2 — Apply (3 min)

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**.
2. On your Mac, open `supabase/migrations/091_venue_scoped_rls.sql`, select **all** of it, copy.
3. Paste into the SQL Editor and press **Run**.
4. It should finish with "Success. No rows returned." Warnings about "policy does not exist, skipping" are fine (that's the `DROP POLICY IF EXISTS` lines).

## Step 3 — Verify (5 min)

**In the SQL Editor**, run this:

```sql
SELECT count(*) AS venue_scoped_policies
FROM pg_policies
WHERE qual ILIKE '%current_venue_id%';
```

Expect a number around **120**. If it returns 0, the migration didn't apply — re-run Step 2.

**In the app** (the checks that actually matter):

1. Log in to venue A (e.g. NOMAD) as staff — dashboard, fridge temps, rota, cleaning all load and show NOMAD's data.
2. Log a fridge temperature — it saves.
3. Clock in and out — works.
4. Log in as the owner — settings, HR, timesheets load.
5. If you have a second venue (e.g. sandbox), log in there too and confirm you see *its* data, not NOMAD's.
6. Log out completely, then open the app fresh — the login page still lists the venue's staff (that's intentional: `venues` and `staff` stay readable pre-login so the PIN screen works).

## If anything breaks — rollback (1 min)

1. SQL Editor → paste the entire contents of `supabase/migrations/091_rollback.sql` → **Run**.
2. Everything returns to exactly how it was. No data is touched.
3. Tell Claude what broke (which page, which action, any error message) so the policy can be fixed before retrying.

## Afterwards

Once verified, tell Claude it's applied — the audit's Launch Blocker #1 is then closed, and the "anon key is safe because RLS" statement in the README becomes fully true.
