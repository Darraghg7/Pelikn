# Pelikn — Technical & Product Audit (July 2026)

**Scope:** Full codebase (244 source files, ~55k lines), Supabase backend (92 migrations, 64 tables, 9 edge functions), marketing page, UI/UX, and built-vs-intended comparison.
**Method:** Three deep exploration passes (frontend quality, backend/security, marketing/product), followed by hands-on verification — every headline claim below was checked against source, and the build/typecheck/test suites were actually run. Two agent claims were refuted during verification and are excluded/corrected below.

---

## 1. Scorecard

| Dimension | Grade | One-line verdict |
|---|---|---|
| **Security (architecture)** | A− | Genuinely well-engineered: bcrypt PINs, lockouts, JWT venue claims, service-role isolation, SECURITY DEFINER RPCs, encrypted backups, strong headers |
| **Security (deployed state)** | **A− (venue isolation live 16 Jul 2026)** | Migration 091 v3 applied + verified: every venue-scoped table denies the anon key; cross-venue reads/writes blocked. See Launch Blocker #1 (closed) |
| **Scalability** | B− | Multi-venue architecture is sound; risk is maintenance scaling (50 pages fetch data independently), not load scaling |
| **Reliability** | B− | Error boundaries, offline queue, session restore all present — but ~50 silent `.catch(() => {})`, offline sync never E2E-tested |
| **Reusability** | C+ | Good UI primitive layer (Button/Modal/Toast/EmptyState), but ~15% duplication: 3 export modals share jsPDF boilerplate, 14 form pages with no shared builder |
| **Performance** | B | Verified: all 45+ routes lazy-loaded, initial payload ~160 kB gzip, PDF/OCR libs in on-demand chunks. Gaps: no list virtualization, low memoization (19% of files) |
| **Type safety** | C− | `npm run typecheck` **fails with 29 errors** in 15 files (mostly null-safety in hooks). Strict tsconfig, but 80% of code is untyped .jsx |
| **Test coverage** | D+ | 162 unit tests pass; Playwright covers auth/onboarding/~10 features. ~40 features untested. `npm run test:unit` is also misconfigured (picks up Playwright specs → 22 spurious failures) |
| **Accessibility** | B− | Better than initially reported: global `:focus-visible` outline and `prefers-reduced-motion` both exist (index.css:780–795). Gaps: sparse ARIA landmarks, some icon buttons lack labels |
| **SEO / social** | D | No Open Graph tags, no Twitter card, no canonical URL, no JSON-LD. Title is just "Pelikn" |

**Overall: B− today; A− within reach.** The architecture decisions are consistently good. What's missing is the last mile: one critical database migration, web-standards hygiene, and test depth.

---

## 2. Launch blockers (must fix before public go-live)

### ✅ #1 — Venue data isolation — CLOSED 16 July 2026
Migration 091 was rewritten (v3) and applied to production. It failed twice before succeeding, and the failures were instructive:
- **v1** dropped old policies by *guessed name*, so prod's real open policies survived and OR'd with the new scoped ones — ~35 tables stayed open. It also scoped the public QR allergen-menu tables, breaking that page. Rolled back.
- **v2** (generic name-agnostic policy drops + a public-read carve-out for the allergen menu) locked down the bulk correctly, but an anon-key sweep found 8 tables with a `venue_id` that the *original* 091 list never included.
- **v3** added those 8 (`clock_edit_requests`, `haccp_plans`, `ppds_items`, `recall_logs`, `recall_procedures`, `staff_permissions`, `training_sign_offs`, `venue_closures`). 65 tables scoped.

**Verified live via anon-key REST probes:** every venue-scoped table returns 0 rows to the public key; staff/owner see only their venue; cross-venue writes are blocked; the public allergen menu (`food_items`/`food_allergens`/`app_settings` kept public-read) still works; login tables (`venues`/`staff`) still readable. Each version was tested on local Postgres 16 before apply.

**Remaining follow-up (not a blocker):** `duty_template_items` has no `venue_id` column so it can't be scoped yet — it stays open and is listed in the migration's drift report. Closing it needs a small migration to add + backfill `venue_id` from its parent `duty_templates`.

---

### 🔴 (historical) #1 — Venue data isolation is a half-built feature, NOT a migration to apply (CORRECTED 3 July 2026)
`supabase/migrations/091_venue_scoped_rls.sql` replaces the permissive `USING (true)` policies with `venue_id = current_venue_id()`, where `current_venue_id()` reads a `venue_id` claim from the request's JWT. Until venue-scoping is live, anyone with the (public) anon key can read/write any venue's data — that gap is real and must be closed before public launch.

**But 091 CANNOT simply be applied — doing so would black out the entire app for every user.** Investigation on 3 July 2026 established that no request currently carries a `venue_id` JWT:
- `src/lib/supabase.js` has `setSessionJwt`/`_sessionJwt`, but `_sessionJwt` is **dead code — never read, never injected into any request header**.
- Git history shows why: commit `634d2d5` added JWT injection; commit `1e3682b` ("Emergency fix: remove JWT injection — EC key mismatch was breaking all PostgREST queries") ripped it back out. The setters were left as orphans.
- So staff requests go out with the anon key; owner requests (email/password → Supabase Auth) go out with a standard auth token. **Neither carries `venue_id`.** Under 091, `current_venue_id()` returns NULL for everyone → every venue-scoped policy denies all rows → total blackout.
- This is the same failure that killed the *first* attempt: migration 076 used a `pre_request` hook (paid-plan only) that always returned NULL, and was reverted by 078.
- Owners are a second, independent gap: even with staff JWT injection fixed, email/password owners still have no `venue_id` claim.

**Real path to close this blocker (a feature, ~1–2 days, not a paste):**
1. Confirm the pin-login JWT (HS256 with `SUPABASE_JWT_SECRET`) is actually *accepted* by PostgREST — the "EC key mismatch" suggests the project's JWT signing keys and the edge function's secret must be aligned.
2. Re-wire client injection: the `makeRetryFetch` wrapper (or a global header) must send the venue-scoped JWT as `Authorization: Bearer <jwt>` for logged-in staff, anon key otherwise.
3. Give owners a `venue_id` JWT too — issue one via pin-login's `issue_jwt` path when an owner selects a venue.
4. Fix schema drift so 091 can apply (see below).
5. Test on a real staging DB with **both** a staff PIN login and an owner email login — confirm each sees only their venue and nothing breaks — *then* apply.

**Migration 091 itself is now drift-proof and re-runnable** (rewritten & tested July 2026 — every statement guarded, ends with a `skipped_missing_tables` report). Its guard checks table existence but NOT column existence — the 3 July run on production surfaced tables that exist without a `venue_id` column (e.g. `duty_template_items`), which still abort a `CREATE POLICY`. Add column-existence guards + `venue_id` backfills for those tables as part of step 4. Production remains untouched: the Supabase SQL editor runs the script in one transaction, so every failed attempt rolled back cleanly (verified: `current_venue_id()` absent, `app_settings` still open, NOMAD logs in).

### 🔴 #2 — TypeScript build check fails (29 errors)
`npm run typecheck` fails across 15 hook files (null-safety: passing possibly-null `venueId`/`date` into functions typed as non-null, plus a Uint8Array/push-subscription type clash). The Vite build still succeeds (it doesn't typecheck), so these are latent-bug indicators, not compile stoppers — but a failing check means the safety net is off. Fix the 29 errors, then make typecheck part of every deploy.

### 🟠 #3 — No social/SEO metadata
`index.html` has no `og:*` tags, no Twitter card, no canonical, no structured data; title is "Pelikn". Every share of pelikn.app on WhatsApp/LinkedIn/X renders as a bare link. ~15 lines of HTML to fix.

### 🟠 #4 — CSP allows `unsafe-inline` and `unsafe-eval`
`vercel.json` ships strong headers overall (HSTS+preload, frame-ancestors none, nosniff) but `script-src 'self' 'unsafe-inline' 'unsafe-eval'` largely neutralises XSS protection. Investigate what actually needs eval (likely nothing after tesseract moved to a worker) and tighten.

### 🟠 #5 — "ICO registered · UK GDPR" claim on the marketing hero
Verify the ICO registration is real and current before public launch. An untrue regulatory claim on the homepage is a legal exposure, not a design nit.

---

## 3. Security review (backend)

**Strong, verified foundations:**
- **PIN auth:** bcrypt via `crypt(p_pin, gen_salt('bf'))`; 5 failed attempts → 15-min lockout (migration 057); sessions are 128-bit UUID tokens, 30-day expiry, per-device, manager-revocable (migration 085).
- **Edge functions:** service-role key confined to server side; push/email functions validate `sessionToken` against the venue before acting; CORS whitelisted.
- **Signup abuse:** 3 attempts per IP per 24h, IPs stored as SHA-256 hashes, fail-open design.
- **Secrets:** nothing sensitive in git. The hardcoded anon key in `src/lib/supabase.js` is public by design and safe *once RLS is applied*.
- **Backups:** AES-256 encrypted, off-site (Cloudflare R2), documented restore procedure.

**Gaps:**
- Restore procedure has **never been rehearsed** (the drill log in docs/restore-procedure.md is empty). Schedule a quarterly drill; run the first one before launch.
- No per-venue rate limits on push/email edge functions (an authenticated user could spam notifications).
- `061_apns_tokens.sql` has uncommitted local fixes — commit them.
- Sentry monitors the frontend only; edge-function errors go to Supabase logs with no alerting.

---

## 4. Vibe-code verdict

**Honest answer: this does not read like a typical vibe-coded app.** Signals of care are everywhere: zero TODO/FIXME/HACK comments, zero commented-out code blocks, only 11 console statements (all in error paths), consistent naming, a real design-token system, migration files with professional-grade documentation headers, and a documented backup/restore procedure. The 091 migration header alone (staged rollout plan + rollback file) is something many funded startups don't do.

**But there are tells — the fingerprints of fast AI-assisted iteration:**

| Tell | Evidence | Risk |
|---|---|---|
| Duplicate hook pairs, both alive in the tree | `useDeliverySuppliers.js` + `.ts`, `useSupplierOrders.js` + `.ts` — different implementations. Vite resolves `.js` first, so the `.ts` versions are silently dead code | A future import or bundler change flips which implementation runs |
| Dev artefact still routed | `IconPreviewPage.jsx` live at `/icon-preview`, comment says "remove before shipping" (App.jsx:159, 468) | Cosmetic, but visible to anyone who finds the URL |
| Broken quality gates nobody noticed | typecheck fails (29 errors); `test:unit` reports 22 failed files (vitest config missing an `exclude` for Playwright specs) | The checks exist but stopped being trusted — classic drift |
| Mixed data-fetching idioms | Hooks use TanStack Query properly; ~50 pages call `supabase.from()` raw with inline error handling | Every schema change touches 50 files; no caching/retry on page data |
| Style-token drift | 377 hardcoded hex values, ~39 `!important` (already tracked in docs/ui-polish-followups.md) | Maintenance cost, not user-facing |
| Silent error swallowing | ~50 `.catch(() => {})` instances (e.g. RotaPage.jsx:1251, 1279, 1304) | Failures vanish — no toast, no Sentry breadcrumb |
| Giant files | RotaPage.jsx 1,675 lines; StaffMembersSection.jsx 1,032 lines; AppShell.jsx 688 lines | Change risk concentrates in files no one can hold in their head |

**Claims I checked and rejected** (for fairness): `navConfig.js` is *not* dead code — it's a deliberate proxy re-exporting the .jsx with an explanatory comment. jsPDF is *not* bloating the initial bundle — it's a separate 177 kB-gzip chunk fetched only when an export feature is opened. `prefers-reduced-motion` and focus outlines *are* handled globally.

---

## 5. Built vs. intended

**All ~45 feature areas described in README/old materials are genuinely built — no stubs, no "coming soon" pages found.** Compliance suite (fridge/cooking/cooling/hot-holding temps, cleaning, allergens + Natasha's Law PPDS, HACCP wizard, EHO audit + gap closure, deliveries, probe calibration, pest control, recall, waste, incidents, complaints, corrective actions, fitness-to-work, training/SC6, suppliers, documents) plus team suite (rota builder + templates + AI modal, clock-in/timesheets, time-off, shift swaps, tips, HR records + formal actions, noticeboard, team hub) plus platform (multi-venue, PIN staff auth, push (web+APNS), PDF exports, offline queue, PWA + Capacitor iOS/Android).

Discrepancies to note:
- **AI rota (verified):** `RotaAIModal.jsx` runs the client-side **rule-based** `fillRotaRequirements` algorithm — not AI. Meanwhile a genuine Claude-powered edge function (`supabase/functions/generate-rota`, claude-haiku-4-5) exists but **no frontend code calls it** — it's orphaned. The pricing page's "Rota builder + AI auto-fill" claim is currently overstated. Either wire the edge function into the modal, or reword the pricing bullet to "smart auto-fill" until it ships.
- **SafeServ rename:** fully clean — zero references anywhere including iOS/Android projects.
- **Venue-agnostic audit (June):** holding — no hardcoded food-service roles found in defaults.

---

## 6. Marketing page & UX review

Verified in a live browser at desktop and mobile widths.

**What's strong:** hero copy ("Ditch the clipboard, keep the compliance.") is specific and benefit-led; trust markers under the CTA; real product screenshots inside phone frames; pricing exactly matches the source of truth (`src/lib/pricing.ts`: £25 Pro + £15/extra, £10 Starter, annual = 2 months free) with a smart "as you grow" cost table that directly weaponises the per-site pricing wedge against Trail; login screen is genuinely polished; zero console errors; mobile rendering clean at 375px.

**Findings (in CRO priority order):**
1. No OG/social meta (Blocker #3) — shares look broken.
2. "ICO registered" claim needs verification (Blocker #5).
3. Single CTA path is good, but the page never names the competitor pain ("switching from paper or per-site-priced tools") — the Trail wedge lives only in the pricing table. A short comparison row ("5 sites: £85 vs £190–375 elsewhere") would make it explicit.
4. Mock screenshots: fine for now (user decision); swap for real captures before paid acquisition starts.
5. Accessibility: add `<main>/<nav>` landmarks and `aria-label` on icon-only buttons; motion/focus already handled.

---

## 7. Prioritised fix menu (Phase C candidates)

**Critical — before any public launch**
1. Commit + apply migration 091 (venue isolation) with verification queries; commit 061 fix. *(DB apply is Darragh's action — exact steps in §2.)*
2. Fix the 29 typecheck errors; add typecheck to the deploy path.
3. Add OG/Twitter/canonical/JSON-LD meta to index.html.
4. Verify or remove the "ICO registered" claim.

**High — launch week**
5. Fix vitest config (exclude Playwright specs) so `test:unit` is trustworthy.
6. Delete IconPreviewPage + route; delete the dead `.ts` hook duplicates.
7. Replace silent `.catch(() => {})` with toast + Sentry capture (top ~20 call sites).
8. CSP: remove `unsafe-eval` (verify tesseract worker), plan nonce migration for `unsafe-inline`.
9. Run the first backup restore drill; log it.
10. E2E test for offline queue sync (it's a headline capability and has zero tests).

**Medium — first month after launch**
11. Consolidate the 3 export modals into one ExportBuilder; extract shared temperature-log form.
12. Split RotaPage (1,675 lines) and StaffMembersSection (1,032 lines).
13. Migrate page-level raw supabase calls to React Query hooks (start with the 5 highest-traffic pages).
14. Per-venue rate limits on push/email edge functions; Sentry (or log-drain alerting) for edge functions.
15. Persist signup-flow step state to sessionStorage.
16. ARIA landmarks + icon-button labels.

**Low — ongoing hygiene**
17. Hex-value → token migration (377 instances, already tracked); unwind `!important`s.
18. List virtualization on RotaMobileGrid/StaffMembersSection if venues exceed ~50 staff.
19. Generate Supabase types (`supabase gen types`) and adopt in hooks; type the four contexts.
20. Grow Playwright coverage toward the top-10 revenue-critical features.

---

*Report compiled 2 July 2026. Build verified: `vite build` ✓ 8.1s, initial JS ~160 kB gzip, PWA precache 2.8 MB / 141 entries. Unit tests: 162/162 pass. Typecheck: ✗ 29 errors. Authenticated in-app walkthrough was not performed (no test credentials in this session); in-app UX findings derive from source review and E2E test coverage.*
