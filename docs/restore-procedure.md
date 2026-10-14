# Database Restore Procedure

_Last verified against `.github/workflows/db-backup.yml`: 14 Oct 2026._

**Last restore test: none on record.** The July 2026 audit said the restore had never been rehearsed end to end, and nothing since has been logged. Until a drill is done and added to the log at the bottom, treat this procedure as untested.

## What the backup is

- Runs every day at 02:00 UTC (`.github/workflows/db-backup.yml`; can also be started by hand from the GitHub Actions tab).
- It is a `pg_dump` (plain SQL) of two schemas: `public` (all venue and app data) and `auth` (manager login accounts). Supabase's own internal schemas are left out.
- It does **not** include uploaded files (Supabase Storage: HR documents, training certificates, venue documents, photos). Those are not backed up by this job.
- The file is gzipped, then encrypted with AES-256, then uploaded to Cloudflare R2 (`pelikn-backups` bucket) as `pelikn-backup-YYYY-MM-DD.sql.gz.enc`. A second encrypted copy is kept as a GitHub Actions artifact for 30 days.
- Retention in R2: the workflow never deletes old files, so they build up unless a lifecycle rule is set in Cloudflare. Check the bucket settings in Cloudflare; this repo cannot tell us.
- The job fails (and GitHub marks the run red) if the dump is under 50 KB or has fewer than 10 tables. Nothing else alerts you, so glance at the Actions tab now and then.
- The secrets it uses are GitHub repository secrets: `SUPABASE_DB_URL`, `BACKUP_ENCRYPTION_PASSPHRASE`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`. The values are not written anywhere in this repo.

**Always restore to staging first. Never restore directly to production without verifying the data.**

---

## Step 1 — Download the backup from R2

Via the Cloudflare dashboard, or with the AWS CLI:

```bash
aws s3 cp \
  "s3://pelikn-backups/pelikn-backup-YYYY-MM-DD.sql.gz.enc" \
  ./pelikn-backup-YYYY-MM-DD.sql.gz.enc \
  --endpoint-url "https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com"
```

Set `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION=auto` from the R2 API token (the same values as the `R2_*` GitHub secrets). This doc says they are kept in 1Password under **Pelikn R2 Backup**; check that entry exists, as it cannot be verified from the repo.

## Step 2 — Decrypt

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
  -in pelikn-backup-YYYY-MM-DD.sql.gz.enc \
  -out pelikn-backup-YYYY-MM-DD.sql.gz \
  -pass env:BACKUP_ENCRYPTION_PASSPHRASE
```

Put the passphrase in the `BACKUP_ENCRYPTION_PASSPHRASE` environment variable first (using `env:` keeps it out of your shell history). It is the same value as the GitHub secret of that name. This doc says a copy is in 1Password under **Pelikn Backup Encryption Passphrase**; check that entry exists. If the passphrase is lost, every backup is unreadable.

## Step 3 — Decompress

```bash
gunzip pelikn-backup-YYYY-MM-DD.sql.gz
```

## Step 4 — Restore to staging

Create a temporary Supabase project or use an existing staging project. Use a fresh, empty one: the dump contains `CREATE TABLE` statements for `public` and `auth` with no "drop first" step, so loading it into a project that already has those tables will throw "already exists" errors. Supabase projects start with an `auth` schema, so expect some of those errors for `auth` even on a fresh one; the data rows are what matter.

```bash
psql $STAGING_DB_URL < pelikn-backup-YYYY-MM-DD.sql
```

## Step 5 — Verify

Check row counts on critical tables match expectations:

```sql
SELECT 'venues' AS tbl, COUNT(*) FROM venues
UNION ALL SELECT 'staff', COUNT(*) FROM staff
UNION ALL SELECT 'shifts', COUNT(*) FROM shifts
UNION ALL SELECT 'clock_events', COUNT(*) FROM clock_events;
```

Compare against Supabase dashboard counts on production.

## Step 6 — Restore to production (if needed)

Only proceed after staging verification. Because the dump does not clear existing tables, a production restore means restoring into a new empty project and pointing the app at it, or copying only the missing rows across (see `docs/backups.md`). Do not run it over live data. Schedule a maintenance window, notify any active users, then:

```bash
psql $PROD_DB_URL < pelikn-backup-YYYY-MM-DD.sql
```

---

## Restore drill log

Run a full restore drill at least once per quarter. Log it here (no drill has been recorded yet):

| Date | Backup used | Tester | Notes |
|------|-------------|--------|-------|
|      |             |        |       |
