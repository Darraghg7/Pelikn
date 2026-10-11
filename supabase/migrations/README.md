# Database migrations

Each file here is one change to the database, numbered in the order it was made.

## How they are applied

By hand. Open the Supabase dashboard → SQL Editor, paste the file, run it, in number order.

- Never run `supabase db push` against this project.
- Code that depends on a new migration should be merged only once the migration has been run, or written so it still works before then.
- On busy tables, start with `SET lock_timeout` and prefer `ALTER POLICY` to dropping and recreating a policy.
- Some migrations have a runbook in `docs/` (for example `apply-migration-091.md`, `apply-private-training-files.md`).

## Naming

- Migration: `NNN_short_description.sql`, three digits, lowercase with underscores. Use the next number after the highest one in this folder.
- Rollback: `NNN_rollback.sql` reverses migration `NNN`. Write one for every new migration. A migration and its rollback share a number on purpose.
- A unit test (`supabase/__tests__/migrationNumbers.test.js`) fails CI if a file breaks these rules or two migrations share a number.

## Known quirks

These are all already applied and harmless. Go by the full filename, not the number.

- **085 and 086 each have two unrelated migrations:** `085_hr_rls_and_private_documents` and `085_manager_session_revocation`; `086_private_training_files` and `086_venue_group_code`. Both files of each pair have been run. They were left with their names because docs and later migrations refer to them by name. The test above allows exactly these two pairs.
- **023b, 031b, 059b** were earlier clashes, fixed in May 2026 by adding a letter.
- **Gaps** (e.g. 043–046, 051, 060, 099) are numbers whose files were moved out or never used. Don't fill them; always take the next number after the highest.
- **`supabase_migrations.schema_migrations`** exists in the live database but only lists 001–059. It was filled by an early setup step and has not been updated since, because migrations are pasted in by hand. Don't use it to tell what has been applied.

## Other SQL

`supabase/seed/demo_seed_function.sql` is a reference copy of the demo-account rebuild function. Read its header before using it; it must not be run as-is.
