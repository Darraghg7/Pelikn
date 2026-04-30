# Pelikn

Food safety and operations management PWA for hospitality venues. Built with React + Vite, styled with Tailwind CSS, and powered by Supabase.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v6, Tailwind CSS v3 |
| Build tool | Vite 5 |
| Backend / DB | Supabase (PostgreSQL + Auth + RLS) |
| Deployment | Vercel (auto-deploys from `main`) |
| PWA | vite-plugin-pwa + Workbox |
| PDF generation | jsPDF + jspdf-autotable |
| OCR | Tesseract.js |

---

## Local Setup

### 1. Clone and install

```bash
git clone https://github.com/<org>/pelikn.git
cd pelikn
npm install
```

### 2. Environment variables

```bash
cp .env.example .env
```

Fill in `.env` with values from the Supabase dashboard → **Project Settings → API**:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> The anon key is safe to expose in the client — access control is enforced via Row Level Security policies on the database.

### 3. Run dev server

```bash
npm run dev
```

App runs at `http://localhost:5173`.

### 4. Build for production

```bash
npm run build   # outputs to /dist
npm run preview # serve the built output locally
```

---

## Deployment

Deployment is **fully automatic**. Pushing to `main` triggers a Vercel build and deploy with no manual steps required.

- Vercel is configured in `vercel.json` to rewrite all routes to `index.html` (required for client-side routing)
- Environment variables are set in the Vercel project dashboard (not `.env` — that's local only)

To update production env vars: Vercel dashboard → Project → Settings → Environment Variables.

---

## Project Structure

```
src/
  App.jsx              # Route definitions
  main.jsx             # Entry point
  contexts/            # React context providers
    AuthContext.jsx    # Supabase auth session
    VenueContext.jsx   # Active venue (slug → venue data)
    ThemeContext.jsx   # Dark/light mode (follows OS, overridable)
    SessionContext.jsx # Active staff PIN session
  hooks/               # Data-fetching hooks (one per domain)
  pages/               # One folder per feature area
  components/
    layout/
      AppShell.jsx     # Sidebar + mobile nav wrapper
    ui/                # Reusable UI primitives
  lib/
    supabase.js        # Supabase client singleton
supabase/
  migrations/          # SQL migration files (run manually — see below)
```

---

## Database Migrations

There is **no auto-migration runner**. Migrations must be applied manually via the Supabase SQL editor.

**To apply a migration:**
1. Open the [Supabase dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**
2. Open the relevant file from `supabase/migrations/`
3. Paste and run it

Migrations are numbered sequentially (`001_`, `002_`, …). Always apply them in order. Never skip one.

### Migration history

| File | Description |
|---|---|
| `001_initial_schema.sql` | Core tables: venues, staff, sessions |
| `002_feature_expansion.sql` | Fridge logs, deliveries, cleaning |
| `003_unified_auth.sql` | Unified PIN-based auth model |
| `004_roles.sql` | Staff roles (owner / manager / staff) |
| `005_training.sql` | Training records |
| `006_fix_rls_policies.sql` | RLS policy corrections |
| `007_opening_closing.sql` | Opening/closing checklists |
| `008_waste_orders_photos_push.sql` | Waste logs, orders, photo uploads, push notifications |
| `009_fix_all_rls.sql` | RLS policy sweep |
| `010_delivery_probe_corrective.sql` | Delivery probe temps, corrective actions |
| `011_dashboard_widgets.sql` | Dashboard widget config |
| `012_supplier_items.sql` | Supplier and item catalogue |
| `013_time_off.sql` | Staff time-off requests |
| `014_staff_availability.sql` | Staff availability |
| `015_skills_break_cover.sql` | Staff skills and break cover |
| `016_fridge_ampm.sql` | AM/PM fridge check periods |
| `017_multi_tenancy.sql` | Multi-venue / tenancy isolation |
| `018_cooking_and_hot_holding.sql` | Cooking temps, reheating temps, hot holding checks |
| `019_cooling_and_pest_control.sql` | Food cooling logs (≤8°C target), pest control log |

---

## Authentication Model

Pelikn uses a **two-tier auth model**:

### Tier 1 — Venue owner (Supabase Auth)
- Used only at signup (`/signup`) to create a Supabase Auth account and provision the venue
- After venue creation the owner is immediately signed out of Supabase Auth
- Not used day-to-day

### Tier 2 — Staff PIN sessions (app-layer auth)
- All staff (including managers and owners) log in at `/v/:venueSlug` using a 4–6 digit PIN
- Active session stored in React context (`SessionContext`)
- No individual Supabase Auth accounts for staff — they are records in the `staff` table

**Adding new staff:** Managers add staff inside the app (Settings → Staff). No Supabase dashboard access needed.

**If a venue owner forgets their password:** Supabase dashboard → Authentication → Users → find their email → Send password reset.

---

## Access You'll Need

To work on this project a developer needs access to:

| Service | How to grant access |
|---|---|
| **GitHub repo** | Repo → Settings → Collaborators → Add |
| **Supabase project** | Supabase dashboard → Project → Settings → Team → Invite |
| **Vercel project** | Vercel dashboard → Settings → Members → Invite |

---

## Feature Areas

| Route | Page | Access |
|---|---|---|
| `/signup` | New venue signup | Public |
| `/v/:slug` | PIN login for venue | Public |
| `/v/:slug/dashboard` | Dashboard | All staff |
| `/v/:slug/fridge` | Fridge temperature logs | All staff |
| `/v/:slug/fridge-history` | Fridge temp history | All staff |
| `/v/:slug/cooking-temps` | Cooking & reheating temps | Manager |
| `/v/:slug/hot-holding` | Hot holding twice-daily checks | Manager |
| `/v/:slug/cooling-logs` | Food cooling temperature logs | Manager |
| `/v/:slug/pest-control` | Pest control inspections, sightings, treatments | Manager |
| `/v/:slug/deliveries` | Delivery checks | All staff |
| `/v/:slug/cleaning` | Cleaning schedules | All staff |
| `/v/:slug/opening` | Opening/closing checklists | All staff |
| `/v/:slug/waste` | Waste logs | All staff |
| `/v/:slug/rota` | Staff rota builder | Manager |
| `/v/:slug/training` | Training records | Manager |
| `/v/:slug/time-off` | Time-off requests | All staff |
| `/v/:slug/settings` | Venue & staff settings | Manager |

---

## Coding Conventions

- **One hook per domain** — data fetching lives in `src/hooks/use*.js`, never inline in pages
- **Tailwind dark mode** — uses `darkMode: 'class'` strategy; `dark:` variants are controlled by `html.dark` set in `ThemeContext`
- **Rules of Hooks** — all hooks must be called unconditionally at the top of a component, before any early `return` statements
- **RLS policies** — all tables have RLS enabled; the anon role is granted broad access (`USING (true) WITH CHECK (true)`) and access control is enforced at the application layer via venue scoping
- **Venue scoping** — every database query must include a `venue_id` filter; never query across venues
