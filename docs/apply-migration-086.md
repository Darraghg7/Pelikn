# Applying migration 086 (private training-files bucket)

**Symptom that sends you here:** a manager cannot log a delivery check and sees
*"Could not find the 'photo_path' column of 'delivery_checks' in the schema cache"*.

**What it means:** `086_private_training_files.sql` has to be run by hand in the
Supabase SQL editor, and it hasn't been. The client shipped on 2026-07-31 writes
the storage key the migration adds; PostgREST rejects a row that names a column
its schema cache does not have, so the whole delivery check fails.

The client no longer depends on the column — `photo_path` is only named when a
photo was attached, and a database without it falls back to the legacy public
`photo_url`. Deliveries log either way. Applying 086 is still the fix: until it
runs, the `training-files` bucket stays public, which is the hole 086 closes.

---

## Step 0 — Take a fresh backup

GitHub → Actions → Daily Database Backup → Run workflow. Confirm it goes green
with a real size before continuing.

## Step 1 — Run the migration

Supabase Dashboard → **SQL Editor**. Paste the entire contents of
`supabase/migrations/086_private_training_files.sql` and run it.

It adds `staff_training.file_path` and `delivery_checks.photo_path`, backfills
both from the existing public URLs, closes the bucket and replaces 049's
open storage policies with venue-scoped ones. Every statement is `IF NOT EXISTS`
or idempotent, so running it twice is harmless.

If it stops with *"N staff_training row(s) have a file_url that could not be
converted to a storage key"*, that is the deliberate sanity check — inspect
those rows before continuing rather than forcing past it.

## Step 2 — Verify on the live app

Signed in to NOMAD:

1. Log a delivery check **without** a photo — saves.
2. Log one **with** a photo — saves, and the photo uploads.
3. Open a staff training certificate — it opens (via a short-lived signed URL now,
   not a public link).
4. Paste an old public `…/object/public/training-files/…` URL into a logged-out
   browser — it should now be refused. That refusal is the point of the migration.

If step 3 fails, the client half is not deployed; ship `main` and retry. The
rollback block at the foot of the migration restores 049's behaviour, openness
included.
