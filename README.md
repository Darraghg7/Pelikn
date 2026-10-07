# Pelikn

Compliance and team-management app for independent hospitality venues: food-safety checks and logs, cleaning, allergens, rota, clock-in, time off, HR and training, in one place. Runs as a PWA at https://get-pelikn.com and as iOS/Android apps via Capacitor.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router 6, Tailwind CSS 3, TanStack Query 5 |
| Language | JavaScript and TypeScript side by side (`allowJs`; new code is usually `.ts`) |
| Build | Vite 5, vite-plugin-pwa (custom service worker in `src/sw.js`) |
| Backend | Supabase: Postgres + RLS, Auth, Storage, Realtime, Edge Functions (Deno) |
| Native | Capacitor 8 (`ios/`, `android/`) |
| Hosting | Vercel, auto-deploys from `main` |
| Errors | Sentry (`@sentry/react`) |
| Billing | Stripe, via the `billing` and `stripe-webhook` edge functions |
| Other | jsPDF (PDF exports), Tesseract.js (OCR), dnd-kit (drag and drop) |

---

## Local setup

```bash
git clone https://github.com/Darraghg7/Pelikn.git
cd Pelikn
npm install
cp .env.example .env
npm run dev          # http://localhost:5173
```

There is no local Supabase stack. The dev server talks to the **production** Supabase project, so anything you do locally writes real data. Use a test venue.

### Environment variables

| Variable | Needed? | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | Optional | Falls back to the production project URL in `src/lib/supabase.js`. |
| `VITE_SUPABASE_ANON_KEY` | Not read | Listed in `.env.example`, but the anon key is hardcoded in `src/lib/supabase.js` (a Vercel env var once held the wrong key). It is a public key by design. |
| `VITE_SENTRY_DSN` | Optional | Sentry only starts when this is set (`src/main.jsx`). Set in Vercel for production. |
| `VITE_DEV_PREVIEW`, `VITE_DEV_VENUE` | Dev only | `VITE_DEV_PREVIEW=true` with `npm run dev` injects a fake session so you can look at screens without logging in (`SessionContext.jsx`). |

Production env vars live in Vercel → Project → Settings → Environment Variables. Edge-function secrets (service role key, JWT signing secret, Resend, Stripe, APNs) live in Supabase → Edge Functions → Secrets and never go in the repo.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` / `npm run preview` | Production build to `dist/` / serve it locally |
| `npm run lint` | ESLint over `src/` (rules-of-hooks is an error) |
| `npm run typecheck` | Both type checks: `typecheck:ts` (strict, `.ts` files) and `typecheck:js` (`.js`/`.jsx` against a baseline; see Conventions) |
| `npm run test:unit` | Vitest unit tests (`test:unit:watch`, `test:unit:coverage` also exist) |
| `npm test` | Playwright end-to-end tests (`test:ui`, `test:headed`, `test:report`) |
| `npm run cap:sync` | Build and copy into the native projects |
| `npm run cap:ios` / `npm run cap:android` | Sync, then open Xcode / Android Studio |
| `npm run backup:venue` | Export one venue's payroll/rota data to `backups/` (needs a service role key; see `docs/backups.md`) |

### npm version and the lockfile

Regenerate `package-lock.json` with **npm 10** (`npx npm@10 install`), never npm 11. CI uses Node 22, which ships npm 10, and a lockfile written by npm 11 makes `npm ci` fail there.

---

## Testing

- **Unit tests** (`npm run test:unit`): Vitest + Testing Library in jsdom. Tests live in `__tests__/` folders next to the code (`src/lib`, `src/hooks`, `supabase/functions/_shared`). These are safe to run anywhere.
- **End-to-end tests** (`npm test`): Playwright specs in `tests/`. They start the dev server and do **real PIN logins against the production Supabase project**, using the `brew-and-bloom` test venue. They create and delete real rows there. `tests/helpers/cleanup.ts` removes what each test creates. Never point them at a customer venue (`TEST_VENUE_SLUG` overrides the default). They are not run in CI.

---

## CI and deployment

- **CI** (`.github/workflows/ci.yml`) runs on every PR and every push to `main`: `npm ci`, lint, typecheck, unit tests. Fix a failing check; don't skip it.
- **Backups** (`.github/workflows/db-backup.yml`) run daily at 02:00 UTC: `pg_dump` of the `public` and `auth` schemas, encrypted with AES-256, uploaded to Cloudflare R2, with a 30-day encrypted copy kept as a GitHub artifact. See `docs/restore-procedure.md` to restore.
- **Deploy**: merging to `main` deploys to Vercel. Branches get Vercel preview URLs. `vercel.json` handles the SPA rewrite and security headers, including the Content-Security-Policy. A new external service (API, font or script host) must be added to the CSP or the browser will block it. That includes requests made by the service worker.
- **Database migrations and edge functions are not deployed by CI.** See below.

---

## Database & migrations

Migrations live in `supabase/migrations/` as `NNN_description.sql`, numbered in order (the latest is the highest number in the folder).

- **They are applied by hand** in the Supabase dashboard → SQL Editor, in order. Never run `supabase db push` against this project. Code that depends on a new migration should be merged only once the migration has been run, or written so it still works before then.
- **Rollbacks**: newer migrations come with an `NNN_rollback.sql` that reverses them. Write one for every new migration.
- **Numbering quirks**: `085` and `086` each have two unrelated files. Go by the filename, not the number. A few early files have letter suffixes (`023b`, `031b`, `059b`). Renumbering is a separate cleanup.
- **Busy tables**: start migrations that alter policies on busy tables with `SET lock_timeout`. Prefer `ALTER POLICY` to drop-and-recreate.
- **Per-migration runbooks** are in `docs/` (for example `apply-migration-091.md`, `apply-private-training-files.md`, `clock-event-duplicates.md`).

`supabase/seed/` and `seed_demo.sql` hold demo-data scripts. `supabase/config.toml` holds edge-function settings only.

### Edge functions (`supabase/functions/`)

Deployed with `supabase functions deploy <name>`. CI does not deploy them.

| Function | Purpose |
|---|---|
| `pin-login` | Checks a staff PIN and issues a venue-scoped JWT (`login`), or re-issues one for an existing session (`issue_jwt`) |
| `signup-guard` | IP rate limit on new account signups (stores hashed IPs) |
| `send-push` | Web Push notifications |
| `send-apns` | Native iOS push via APNs |
| `send-weekly-report` | Weekly compliance report email (Resend) |
| `seed-demo` | Resets data for the demo account |
| `billing` | Owner-only Stripe actions: checkout, plan changes, billing portal |
| `stripe-webhook` | Keeps `billing_accounts` and `venues.plan` in sync with Stripe. JWT check is off; it verifies the Stripe signature instead |

`_shared/` holds code used by more than one function. Billing setup is in `docs/stripe-billing-setup.md`.

---

## Security model

The anon key ships in the client bundle and anyone can read it. **Row Level Security is the only thing standing between it and customer data.** Every new table, column, view, RPC or bucket needs to be written with that in mind.

- **RLS is venue-scoped** (091 and later). The PIN-login JWT carries a `venue_id` claim. Policies use `current_venue_id()` / `has_venue_access()`, so a session can only see its own venue and any venues linked to it.
- **The anon role gets almost nothing.** Pre-login screens use narrow `SECURITY DEFINER` RPCs instead. For example, `list_venue_staff_for_login` returns only id, name, role and photo for the PIN screen. Anon requests to tables like `staff` and `time_off_requests` are refused.
- **RLS works on rows, not columns.** Sensitive `staff` columns (PIN hash, pay, private details) are protected by column grants and dedicated RPCs (113–118). A policy that lets a user see a row exposes every column of it unless the columns are restricted too.
- **Security-sensitive RPCs check who is calling.** For example, the clock-in/out RPCs (139) verify the caller's session instead of trusting the parameters sent.
- **Private files**: HR documents, venue documents and training files are in private buckets. Objects are stored under `<venue_id>/...`, rows store the storage key (`file_path`), and the app creates a short-lived signed URL when someone opens a file (`src/lib/attachments.js`). Never store or hand out public URLs for these.
- Never use `USING (true)` on tables holding venue data. Never rely only on the app adding a `venue_id` filter. Do both: filter by `venue_id` in queries **and** enforce it in RLS.

---

## Auth model

There are two layers. `SessionContext` is the one that decides access in the app.

1. **Owner/manager account (Supabase Auth, `AuthContext.jsx`).** Email and password at `/login`, plus signup at `/signup`, email verification at `/auth/callback` and `/reset-password`. One account can own several venues (`get_owner_venues()`); owners with more than one get a venue picker. This account is used for venue setup and onboarding. It is the only identity allowed to manage billing.
2. **Staff session (PIN, `SessionContext.jsx`).** Everyone who uses the venue day to day picks their name at `/v/:venueSlug` and enters a PIN, managers and owners included. A device can find a venue with **"Join with venue code"** (a venue code or group code). It does not need an email login. On success, `pin-login` returns a session token (a `staff_sessions` row, 30 days, refreshed while the app is open) and a short-lived JWT. `src/lib/supabase.js` attaches the JWT to REST and Realtime calls and re-issues it before it expires.
   - Several devices can be signed in at once.
   - **Multi-venue staff** switch venue with `switch_staff_venue` + `issue_jwt`. No second login is needed.
   - **Offline**: a hash of the PIN is cached after a successful online login, so a known device can sign in offline. Writes are queued (`src/lib/offlineQueue.js`).
   - Roles are `owner` / `manager` / `staff`. Staff permissions are granular and are refreshed while the session is active. Managers can restrict a staff account to "My Shifts" only.

Route guards in `src/App.jsx`: `RequireAuth` (a PIN session exists), `RequireManager`, `RequireNotRestricted`, plus Pro-plan gating driven by `src/lib/plans.ts`.

---

## Feature areas

About 97 routes, almost all under `/v/:venueSlug/...` (see `src/App.jsx`):

- **Food safety checks**: fridge/freezer temps, probe calibration, cooking & reheating, hot holding, cooling, deliveries, date labelling, pest control, opening/closing checks, cleaning schedules, corrective actions, HACCP, allergens (with a public QR allergen menu at `/allergens/:venueSlug`), recall, complaints, incidents, equipment maintenance, waste.
- **Compliance**: dashboard and overview, compliance score, audit trail, EHO mock inspection, exportable PDF reports.
- **Team**: rota builder and shift swaps, clock-in/out and timesheets, time off and leave balances, HR records and documents, training records, fitness-to-work, tasks, noticeboard, tips, team attendance.
- **Settings**: venue, staff and departments, notifications, integrations, billing, analytics, help.
- **Public**: marketing homepage (web only; the native app opens straight to login), signup, privacy, terms.

---

## Project structure

```
src/
  App.jsx               Routes, route guards, QueryClient
  main.jsx              Entry point, Sentry init
  sw.js                 Service worker (Workbox)
  contexts/             AuthContext, SessionContext, VenueContext, ThemeContext
  lib/
    supabase.js         Supabase client + venue-JWT handling
    api/                Typed data-access functions, one file per domain (target pattern)
    plans.ts            Plan definitions: pricing copy and Pro gating
    ...                 Domain helpers (compliance, rota, offline queue, PDF, etc.)
  hooks/                React hooks, mostly React Query wrappers over lib/api
  types/                Shared TypeScript types
  pages/                One folder per feature area
  components/           layout/ (AppShell, MobileNav), ui/ primitives, widgets/, …
supabase/
  migrations/           Numbered SQL migrations + rollbacks (applied manually)
  functions/            Deno edge functions
  seed/                 Demo seed scripts
tests/                  Playwright e2e specs + helpers (cleanup, auth)
scripts/                Node scripts: venue backup, OG image / iOS splash rendering
docs/                   Runbooks: backups, restore, migration guides, Stripe setup, audits
ios/  android/          Capacitor native projects
```

---

## Conventions

- **Data fetching**: the target pattern is a query function in `src/lib/api/<domain>.ts`, wrapped in a React Query hook in `src/hooks/`, keyed by `venueId`, with `invalidateQueries` after writes. `useSuppliers.ts` is a small example. **Many older pages and components (about 55 files) still call `supabase.from` / `.rpc` directly.** They are being migrated a few at a time. Use the target pattern in new code, and move code over when you substantially change an older page.
- **Select real columns**: PostgREST returns a 400 for an unknown column, and a page that ignores the error shows a misleading empty state. Handle `error` and check column names against the migrations.
- **Type checking**: `.ts` files are checked strictly (`tsconfig.json`). The `.js`/`.jsx` files, which is most of the UI, are checked leniently by `npm run typecheck:js` (`tsconfig.checkjs.json` + `scripts/typecheck-js.mjs`) against `typecheck-js-baseline.json`, a per-file count of known errors. CI fails if a file gets *more* errors than its baseline, or if a file not in the baseline gets any. To fix a file: run `npx tsc --noEmit -p tsconfig.checkjs.json`, fix that file's errors (fix real bugs; for noise, a small JSDoc type or a type in `src/lib/api` or `src/types` is usually enough), then run `npm run typecheck:js -- --update` and commit the lowered baseline. The check also fails when counts drop until you do this, so the baseline only goes down. Never raise a count to get a PR through.
- **Rules of Hooks**: call every hook unconditionally, before any early `return`. ESLint enforces `react-hooks/rules-of-hooks` as an error in CI (this crash reached production three times before it was gated). `exhaustive-deps` is a warning.
- **Design**: follow `.impeccable.md`. Use the colour tokens in `tailwind.config.js`, never hardcoded hex. Type floor: 11px for mono uppercase micro-labels, 12px (`text-xs`) for body text. Dense grids (dashboard stat tiles, rota week grid) are an intentional exception.
- **Dark mode**: Tailwind `darkMode: 'class'`, toggled by `ThemeContext`.
- **Modals and sheets** use `z-[60]` or above. `MobileNav` is portaled at `z-50`, so a `z-50` sheet can lose taps to it.
- **Mobile vs desktop**: some screens have separate mobile and desktop components (for example the rota and the manager dashboard). Check both when changing behaviour.
