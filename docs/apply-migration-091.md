# Enabling venue isolation (migration 091 + client)

**What this does:** locks every venue's data to that venue. Today the database says "anyone with the app's public key may read/write any venue" (`USING (true)`); afterwards, every venue-scoped policy checks `has_venue_access(venue_id)` — true only if the row belongs to **your** venue (staff, via the venue stamp in their login token) **or you own that venue** (owners, via their email login). No venue's data is ever modified — only the *access rules* change (plus a `venue_id` column added and backfilled on 7 child tables).

**Cost:** nothing. RLS is core Postgres, free on every Supabase plan. No edge-function deploy needed (the pin-login function is unchanged).

**Two parts, and the order matters:**
- **Client** (`feature/venue-isolation` branch): makes staff requests carry the venue stamp. Deploy this **first**. While the DB policies are still open, it changes nothing users can see — but it must be live before the DB half, or staff would carry no stamp and see nothing.
- **Database** (migration 091): flips scoping on. Do this **second**, after confirming the client is deployed and the app still works.

> **Why this order:** owners are recognised by their email login and work the moment 091 lands. Staff are recognised by the stamp the client injects — so if 091 goes first, staff get locked out until the client ships. Client first = safe and invisible; DB second = the actual switch-on.

---

## Step 0 — Take a fresh backup first (non-negotiable)

Trigger the backup workflow manually (GitHub → Actions → Daily Database Backup → Run workflow) and confirm it goes green with a real size (~300 KB+). Do not proceed until you have a verified backup from today.

## Step 1 — Deploy the client (staff stamping)

1. Merge `feature/venue-isolation` to `main` (Vercel auto-deploys).
2. Once deployed, on the **live** site: log into NOMAD as staff (PIN) and as owner (email). Everything should work exactly as before — because the DB is still open, the stamp is invisible for now.
3. If anything is off, stop and tell Claude — do not proceed to the DB step.

## Step 2 — Apply migration 091 (the switch-on)

The migration is **drift-proof, owner-aware, and re-runnable** (tested on Postgres 16: staff/owner/anon scoping, cross-venue blocking, apply/rollback all verified). Running it twice is harmless.

1. Pick a quiet window (after close).
2. Supabase Dashboard → **SQL Editor**. Paste the entire contents of `supabase/migrations/091_venue_scoped_rls.sql`. Run.
3. Read the **drift report** in the Results panel — one row, `skipped_missing_tables`:
   - `none` → everything scoped. 
   - a list → those tables lack a `venue_id` column (or don't exist); they were safely left open, not broken. **Send Claude the list** — each is a follow-up to add the column + backfill so it can be scoped too.

## Step 3 — Verify on the live app (the important bit)

Right after applying, on NOMAD:
1. **Staff PIN login** → dashboard, fridge temps, rota, cleaning all show NOMAD's data (not empty).
2. **Log a fridge temperature** → saves.
3. **Clock in / out** → works.
4. **Owner email login** → settings, HR, timesheets all load.
5. If you have a second venue, log into it and confirm you see *its* data, not NOMAD's.
6. Log out fully, reopen → the login page still lists the venue's staff (venues/staff stay readable pre-login by design).

If any of those show **empty** where there should be data, that's the signal to roll back.

## Rollback (under a minute, no data touched)

SQL Editor → paste all of `supabase/migrations/091_rollback.sql` → Run. All policies return to open exactly as before; both helper functions are dropped. Tell Claude which step showed empty data so the policy can be fixed before retrying.

## After it's verified

Tell Claude it's live. The audit's #1 launch blocker is then closed, and the "anon key is safe because RLS" line in the README becomes fully true.
