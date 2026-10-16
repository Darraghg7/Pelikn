# Pelikn docs

Anything outside `archive/` is meant to be still true. "Verified" is the date it was last checked against the code or workflows.

## Operations
| Doc | What it is | Verified |
|---|---|---|
| [backups.md](backups.md) | Manual one-venue export (`npm run backup:venue`) | 14 Oct 2026 |
| [restore-procedure.md](restore-procedure.md) | Daily encrypted database backup and nightly uploaded-files backup to Cloudflare R2, how to restore both, drill checklist. Last restore test: none on record. File backup written 16 Oct 2026, not yet run against the real project | DB part 14 Oct 2026; files part 16 Oct 2026 (untested) |
| [stripe-billing-setup.md](stripe-billing-setup.md) | How billing works and the one-time Stripe setup | Written 3 Oct 2026, not re-checked |
| [feature-usage-query.sql](feature-usage-query.sql) | Read-only query for the Supabase SQL editor: which venues use which side features | Written 8 Oct 2026, not re-checked |

## Security
Nothing current. The security work is recorded in the migrations; see `supabase/migrations/README.md`.

## Design / Accessibility
| Doc | What it is | Verified |
|---|---|---|
| [accessibility-contrast.md](accessibility-contrast.md) | Measured colour-contrast failures and what a fix would look like (needs a design decision) | 13 Oct 2026 |

## Archive (historical, not maintained)
| Doc | What it was |
|---|---|
| [archive/apply-migration-091.md](archive/apply-migration-091.md) | Guide for venue-isolation migration 091 (applied Jul 2026) |
| [archive/apply-private-training-files.md](archive/apply-private-training-files.md) | Guide for migration 086 private training files |
| [archive/clock-event-duplicates.md](archive/clock-event-duplicates.md) | Duplicate clock punches incident (Sep 2026) |
| [archive/technical-audit-2026-07.md](archive/technical-audit-2026-07.md) | July 2026 launch-readiness audit |
| [archive/ui-polish-followups.md](archive/ui-polish-followups.md) | June 2026 UI polish to-do list |
