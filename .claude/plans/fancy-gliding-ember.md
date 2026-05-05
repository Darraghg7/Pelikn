# Fix: Rota Builder, Staff Colour, Logging, and Certificate Uploads

## Context

The test cafe is hitting 4 bugs. Root causes identified through code exploration below.

---

## Bug 1: Rota Builder — "edge function returned a non-2xX status code"

**Root cause:** In `supabase/functions/generate-rota/index.ts`, the `weekDates` array is **used on line 137 before it's declared on line 151**. The working_days loop at lines 134-142 iterates over `weekDates`, but `weekDates` isn't constructed until lines 151-157. This causes a `ReferenceError` at runtime, which the catch block on line 320 turns into a 500 response.

**Fix:** Move the `weekDates` construction block (lines 150-157) above the working_days loop (lines 133-142). Both blocks only depend on `weekStart` and `closedDates`, which are ready by that point.

**File:** `supabase/functions/generate-rota/index.ts`

---

## Bug 2: Staff Colour Assignment — Error on Save

**Root cause:** Two overloaded `update_staff_member` Postgres functions exist:
- **Migration 017** signature: has `p_new_pin` but no `p_colour`
- **Migration 041** signature: has `p_colour` but no `p_new_pin`

The client call in `StaffMembersSection.jsx:191-204` passes **both** `p_new_pin` AND `p_colour`, which matches **neither** overload. Postgres can't resolve the call and throws an error.

Additionally, `create_staff_member` (migration 017) has no `p_colour` parameter, and the post-create `.update()` call (lines 240-243) doesn't include `colour` either.

**Fix — new migration `049_fix_staff_rpcs.sql`:**
1. Drop both overloaded `update_staff_member` functions
2. Create a single unified version with ALL parameters: `p_new_pin`, `p_colour`, `p_contracted_hours`, `p_is_under_18`, `p_working_days`, `p_sort_order`
3. Update `create_staff_member` to accept and save `p_colour`

**Fix — client side `StaffMembersSection.jsx`:**
- Pass `p_colour` in the `create_staff_member` RPC call (line 207-216)
- Ensure the post-create `.update()` includes `colour` as a fallback (lines 240-243)

**Files:** `supabase/migrations/049_fix_staff_rpcs.sql` (new), `src/pages/settings/StaffMembersSection.jsx`

---

## Bug 3: Cooking/Reheating Logs Not Logging (and general logging failures)

**Root cause:** The client-side code and RLS policies (`USING (true) WITH CHECK (true)`) look correct. The tables (`cooking_temp_logs`, `hot_holding_logs`, `cooling_logs`) are created in migrations 018/019.

Most likely cause: **migrations 018 and 019 haven't been applied to the deployed Supabase instance.** The tables simply don't exist in the live database. This would cause "relation does not exist" errors on every insert, explaining why "generally nothing is logging."

**Fix:**
1. Verify and apply all pending migrations to the deployed database: `supabase db push` or manual application
2. Provide a diagnostic migration/script that checks table existence
3. No code changes needed — the client-side insert logic is correct

**Action:** Run `supabase db push` to apply all pending migrations (018-048). This is an operational step, not a code fix.

---

## Bug 4: Certificate Upload Fails

**Root cause:** No migration creates the `training-files` Supabase Storage bucket. The code in `TrainingPage.jsx:565` calls `supabase.storage.from('training-files').upload(...)`, but the bucket doesn't exist in the deployed database. The bucket was likely created manually in the local dev environment but never codified.

**Fix — new migration `049_fix_staff_rpcs.sql` (same migration):** Add storage bucket creation and RLS policy:
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('training-files', 'training-files', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "venue_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'training-files');
CREATE POLICY "venue_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'training-files');
```

**File:** `supabase/migrations/049_fix_staff_rpcs.sql`

---

## Implementation Plan

### Step 1: New migration `supabase/migrations/049_fix_staff_rpcs.sql`

Contains:
- Drop + recreate unified `update_staff_member` with all params including `p_new_pin` and `p_colour`
- Drop + recreate `create_staff_member` with `p_colour` param
- Create `training-files` storage bucket + policies

### Step 2: Fix edge function `supabase/functions/generate-rota/index.ts`

- Move `weekDates` construction (lines 150-157) to before the working_days loop (before line 133)

### Step 3: Fix client `src/pages/settings/StaffMembersSection.jsx`

- Add `p_colour` to `create_staff_member` RPC call
- Add `colour` to the post-create `.update()` fallback

### Step 4: Verify

- `npx vite build` — clean build
- Edge function: check that `weekDates` is defined before use
- Staff form: verify both create and update paths include colour
- Instruct user to run `supabase db push` to apply migrations 018-049

---

## Files Modified

| File | Change |
|------|--------|
| `supabase/functions/generate-rota/index.ts` | Move weekDates declaration above working_days loop |
| `supabase/migrations/049_fix_staff_rpcs.sql` | **New** — unified RPCs + storage bucket |
| `src/pages/settings/StaffMembersSection.jsx` | Add p_colour to create RPC call |
