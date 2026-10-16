# Database Restore Procedure

_Database section last checked against `.github/workflows/db-backup.yml`: 14 Oct 2026. Files section written 16 Oct 2026 against `.github/workflows/storage-backup.yml` and `scripts/backup-storage.mjs`; **the file backup has not yet been run against the real project**, see the drill checklist._

**Last restore test: none on record.** The July 2026 audit said the restore had never been rehearsed end to end, and nothing since has been logged. Until a drill is done and added to the log at the bottom, treat this procedure as untested.

## What the backup is

- Runs every day at 02:00 UTC (`.github/workflows/db-backup.yml`; can also be started by hand from the GitHub Actions tab).
- It is a `pg_dump` (plain SQL) of two schemas: `public` (all venue and app data) and `auth` (manager login accounts). Supabase's own internal schemas are left out.
- It does **not** include uploaded files (HR documents, training certificates, venue documents, photos). A separate job backs those up; see "Uploaded files" below.
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

## Uploaded files (Supabase Storage)

The database only stores the *paths* of uploaded files, so a restored database without the files points at nothing. A second job covers the files.

### What it does

- Runs every day at 03:00 UTC (`.github/workflows/storage-backup.yml`, script `scripts/backup-storage.mjs`). Can be started by hand from the Actions tab.
- Covers **every** bucket in Supabase Storage, found automatically, so new buckets are included without a code change. Today that is: `hr-documents`, `venue-documents`, `training-files` (also holds delivery-check photos), `staff-photos` and `app-assets` (logos).
- Each night it lists all files, compares with the previous manifest and copies only new or changed files. Each file is encrypted on its own (AES-256, same method as the database backup) **before** it is uploaded to the same R2 bucket (`pelikn-backups`) under `storage/files/<bucket>/<original path>.enc`. R2 never holds a readable file.
- A **manifest** is written each night: a list of every file with its bucket, path, size, SHA-256 fingerprint and (for deleted files) the date it was deleted. It is encrypted too. Today's is `storage/manifests/manifest-latest.json.enc`; dated copies (`manifest-YYYY-MM-DD.json.enc`) are kept 90 days and serve as snapshots, so you can see what existed on any recent night.
- **Deleted files:** if a file is deleted in the app, its backup copy is kept for **30 days** (so a mistaken delete can be recovered), then removed by the job. The privacy policy needs to say this.
- **Changed files:** if a file is replaced under the same name (photos and logos can be), only the newest version is kept. HR, training and venue documents are never overwritten by the app.
- **Safety checks:** the run fails (red) if Supabase lists zero files, if the file count drops by more than 20% overnight (and by 3 or more), if a download does not match its listed size, if any step errors, or if afterwards R2 does not contain every file in the manifest at exactly the expected encrypted size. If a legitimate mass-delete ever trips the 20% check, check it is expected, then ask for the guard to be loosened for that run.
- Logs show **counts only**, never file names (names can contain people's names).
- **Failure alerts:** a failed run shows red in the Actions tab and GitHub emails whoever last edited the workflow's schedule. Nothing else alerts, same as the database backup, so glance at the Actions tab now and then.
- **R2 lifecycle rule warning:** if the `pelikn-backups` bucket has an "expire after N days" rule covering the whole bucket, it would silently delete `storage/`. Scope any such rule to the prefix `pelikn-backup-` (the database files) only. Retention for `storage/` is handled by the job itself.
- Secrets (names only, set in GitHub → Settings → Secrets and variables → Actions): `SUPABASE_S3_ENDPOINT`, `SUPABASE_S3_REGION`, `SUPABASE_S3_ACCESS_KEY_ID`, `SUPABASE_S3_SECRET_ACCESS_KEY`, `STORAGE_BACKUP_PASSPHRASE`, plus the existing `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`. Save `STORAGE_BACKUP_PASSPHRASE` somewhere safe outside GitHub (e.g. a 1Password entry "Pelikn Storage Backup Passphrase"); if it is lost, every file backup is unreadable.

### Setup (one time)

1. **Supabase S3 keys:** Supabase dashboard → Project Settings → Storage → **S3 Connection**. Copy the *Endpoint* and *Region* shown there. Under *S3 access keys* choose **New access key**, give it a name like "github-backup", and copy the Access key ID and Secret access key straight into GitHub secrets (do not paste them anywhere else). These keys can read every file, so treat them like the service role key.
2. **GitHub secrets:** GitHub repository → Settings → Secrets and variables → Actions → **New repository secret**, one for each name above. Make `STORAGE_BACKUP_PASSPHRASE` a long random string (a password manager's generator is ideal).
3. **First dry run:** GitHub → Actions → **Daily Storage Backup** → **Run workflow** → leave "Dry run" ticked → Run. Open the run. Expect lines like `Supabase: 5 buckets, N files` and `DRY RUN: nothing was uploaded`. N should match the file count you see in the Supabase Storage screen.
4. **First real run:** Run workflow again, this time **untick** "Dry run". Expect `Verify: 0 missing, 0 wrong size` and `OK: N live files`. In Cloudflare → R2 → `pelikn-backups` you should now see a `storage/` folder with `files/` and `manifests/`.
5. Run it a **second** time: it should say `To copy: 0 | unchanged: N`.

### Restore one file (for example an HR document)

You need: the R2 access details (same as database restore), the `STORAGE_BACKUP_PASSPHRASE`, and the AWS CLI and Node installed.

```bash
# 1. Set your details (use your own secure way of filling these in; do not paste them into chat)
export AWS_ACCESS_KEY_ID=...  AWS_SECRET_ACCESS_KEY=...  AWS_DEFAULT_REGION=auto
export R2="https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com"
export STORAGE_BACKUP_PASSPHRASE=...

# 2. Get and decrypt the manifest (list of everything backed up)
aws s3 cp s3://pelikn-backups/storage/manifests/manifest-latest.json.enc manifest.enc --endpoint-url "$R2"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -in manifest.enc -out manifest.json -pass env:STORAGE_BACKUP_PASSPHRASE

# 3. Find the file (change the search text; shows bucket, path, deleted date if any)
node -e 'const m=require("./manifest.json");for(const e of m.entries)if(e.key.includes(process.argv[1]))console.log(e.bucket+"/"+e.key,e.deletedAt||"")' "search-text"

# 4. Download and decrypt it (bucket and path from step 3)
aws s3 cp "s3://pelikn-backups/storage/files/<bucket>/<path>.enc" file.enc --endpoint-url "$R2"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -in file.enc -out restored-file -pass env:STORAGE_BACKUP_PASSPHRASE

# 5. Check it is intact: this must equal the sha256 shown for that file in manifest.json
shasum -a 256 restored-file
```

Then upload it back to the **same bucket and the same path** (Supabase dashboard → Storage → the bucket → navigate to the folder → Upload; or the S3 `aws s3 cp` with the Supabase endpoint and keys), because the database refers to it by that path. Delete the local decrypted copies afterwards; they are readable personal data.

### Restore a whole bucket

Do this into a fresh or staging Supabase project first. Restore the database first so the paths line up.

```bash
# After steps 1-2 above:
mkdir restore && cd restore
aws s3 sync "s3://pelikn-backups/storage/files/<bucket>/" ./enc --endpoint-url "$R2"
node -e '
const {execFileSync}=require("child_process"),fs=require("fs"),path=require("path");
const m=require("../manifest.json");
for(const e of m.entries){
  if(e.bucket!==process.argv[1]||e.deletedAt)continue;   // remove the deletedAt test to include files deleted in the last 30 days
  const out=path.join("files",e.key);fs.mkdirSync(path.dirname(out),{recursive:true});
  execFileSync("openssl",["enc","-d","-aes-256-cbc","-pbkdf2","-iter","100000","-in",path.join("enc",e.key+".enc"),"-out",out,"-pass","env:STORAGE_BACKUP_PASSPHRASE"]);
  const h=require("crypto").createHash("sha256").update(fs.readFileSync(out)).digest("hex");
  if(h!==e.sha256)console.error("CHECKSUM MISMATCH for one file:",e.size,"bytes");
}' "<bucket>"
# Upload ./files/ to the same bucket in the target Supabase project, keeping the folder structure
aws s3 sync ./files "s3://<bucket>/" --endpoint-url "<SUPABASE_S3_ENDPOINT>"   # with the target project's S3 keys exported first
```

Buckets are created with the right public/private setting by the migrations (`hr-documents`, `venue-documents`, `training-files` are private); `staff-photos` and `app-assets` are public and were created in the dashboard, so create them as public buckets by hand in a new project. Delete the local `restore/` folder when done.

### File restore drill checklist (Darragh)

Do this once now, then quarterly. Use a test file, not a real HR document, for the first run.

1. In the app upload a harmless test document (for example a note called "backup test" under venue documents).
2. Next morning, check Actions → Daily Storage Backup shows a green run for last night.
3. Follow "Restore one file" above for that test document. Confirm the restored file opens and its fingerprint matches the manifest.
4. Delete the test document in the app. After the next run, confirm the manifest shows it with a deleted date (and is still downloadable). Thirty days later, confirm it is gone from `storage/files/`.
5. Confirm in Cloudflare that a file under `storage/files/hr-documents/` cannot be opened as a PDF directly (it is encrypted).
6. Log the drill in the table below.

| Date | Backup used | Tester | Notes |
|------|-------------|--------|-------|
|      |             |        |       |

---

## Restore drill log

Run a full restore drill at least once per quarter. Log it here (no drill has been recorded yet):

| Date | Backup used | Tester | Notes |
|------|-------------|--------|-------|
|      |             |        |       |
