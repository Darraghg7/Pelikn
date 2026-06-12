# Database Restore Procedure

Backups are stored encrypted in Cloudflare R2 (`pelikn-backups` bucket) as `.sql.gz.enc` files, named `pelikn-backup-YYYY-MM-DD.sql.gz.enc`.

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

Set `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION=auto` from the R2 API token. Credentials are stored in 1Password under **Pelikn R2 Backup**.

## Step 2 — Decrypt

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
  -in pelikn-backup-YYYY-MM-DD.sql.gz.enc \
  -out pelikn-backup-YYYY-MM-DD.sql.gz \
  -pass pass:YOUR_PASSPHRASE
```

Passphrase is stored in 1Password under **Pelikn Backup Encryption Passphrase**.

## Step 3 — Decompress

```bash
gunzip pelikn-backup-YYYY-MM-DD.sql.gz
```

## Step 4 — Restore to staging

Create a temporary Supabase project or use an existing staging project.

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

Only proceed after staging verification. Schedule a maintenance window, notify any active users, then:

```bash
psql $PROD_DB_URL < pelikn-backup-YYYY-MM-DD.sql
```

---

## Restore drill log

Run a full restore drill at least once per quarter. Log it here:

| Date | Backup used | Tester | Notes |
|------|-------------|--------|-------|
|      |             |        |       |
