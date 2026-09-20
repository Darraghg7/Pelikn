# Pelikn — Launch Readiness Notes

Originally compiled 2 July 2026 as a pre-launch technical review; updated
20 September 2026 to reflect current status. Treat the "status" line on each
item as the source of truth — re-verify anything marked open before relying
on it, since the codebase moves fast.

## Launch blockers

1. **Venue data isolation (RLS).** Status: **closed**, 16 July 2026. Migration
   091 v3 is applied to production — every venue-scoped table denies the anon
   key, staff/owner sessions see only their own venue, cross-venue writes are
   blocked. `duty_template_items` has no `venue_id` column yet and stays open
   by design (tracked separately, not customer data).
2. **TypeScript build check.** Status: **closed**. `npm run typecheck` passes
   with 0 errors (re-verified 20 Sept 2026).
3. **Social/SEO metadata.** Status: **closed**. `index.html` has OG tags,
   Twitter card, canonical URL and JSON-LD (re-verified 20 Sept 2026).
4. **CSP allows `unsafe-inline` and `unsafe-eval`.** Status: **open**.
   `vercel.json`'s `script-src` still includes both; worth checking whether
   `unsafe-eval` is still needed (tesseract.js moved to a worker) before
   tightening.
5. **Regulatory claim on the marketing page.** Status: **closed** — the
   marketing hero no longer makes an "ICO registered" claim; current copy
   says "UK-based data hosting" instead.

## Security review (backend)

**Foundations verified as solid:**
- PIN auth: bcrypt (`crypt(p_pin, gen_salt('bf'))`), 5 failed attempts → 15-min
  lockout, session tokens are 128-bit UUIDs with 30-day expiry, per-device and
  manager-revocable.
- Edge functions keep the service-role key server-side only; push/email
  functions validate the session token against the venue before acting; CORS
  is whitelisted.
- Signup abuse protection: 3 attempts per IP per 24h, IPs stored as SHA-256
  hashes.
- Backups: AES-256 encrypted, off-site (Cloudflare R2), documented restore
  procedure.

**Open items:**
- The restore procedure has not been rehearsed end-to-end — worth a quarterly
  drill, first one before relying on it in an incident.
- No per-venue rate limits on push/email edge functions.
- Edge-function errors go to Supabase logs with no alerting; Sentry currently
  covers the frontend only.

## Known code-quality notes

- Several pages call `supabase.from()` directly with inline error handling
  rather than going through a `lib/api` + React Query hook — migration to the
  hook pattern is in progress, page by page (started PR #60 onward).
- A handful of pages are large (`RotaPage.jsx`, `StaffMembersSection.jsx`,
  `AppShell.jsx`) and would benefit from splitting.
- Style tokens: some hardcoded hex values and `!important` usages remain,
  tracked separately in `docs/ui-polish-followups.md`.
- Test coverage: unit tests pass; Playwright covers auth/onboarding and a
  meaningful slice of core flows, but not all features have E2E coverage
  (offline queue sync is a notable gap).

## Built vs. intended

All major feature areas described in the product docs are genuinely built —
no stub pages found. One accuracy gap: the rota "auto-fill" is a client-side
rule-based algorithm (`fillRotaRequirements` in `RotaAIModal.jsx`), not an
LLM call — pricing/marketing copy should describe it as "smart auto-fill"
rather than implying it's AI-generated, to stay accurate.

## Marketing page & UX

Reviewed in a live browser at desktop and mobile widths. Hero copy is
specific and benefit-led; pricing on the page matches `src/lib/pricing.ts`
(source of truth: £25 Pro + £15/extra venue, £10 Starter, annual = 2 months
free); mobile rendering is clean at 375px. Accessibility follow-up: add
`<main>`/`<nav>` landmarks and `aria-label` on icon-only buttons (motion and
focus-visible handling are already in place globally, see `index.css`).

## Fix menu (unordered, pick up as capacity allows)

- Tighten CSP (`unsafe-eval` removal, plan a nonce migration for
  `unsafe-inline`).
- Replace silent `.catch(() => {})` error swallowing with a toast + Sentry
  capture, starting with the highest-traffic call sites.
- Run and log the first backup restore drill.
- Add an E2E test for offline queue sync.
- Continue migrating raw `supabase.from()` page calls to `lib/api` + React
  Query hooks.
- Split the largest page components (`RotaPage`, `StaffMembersSection`).
- Add per-venue rate limits on push/email edge functions; wire up
  alerting for edge-function errors.
- ARIA landmarks + icon-button labels on the marketing page.
- Hex-value → design-token migration; unwind remaining `!important`s.
- Grow Playwright coverage toward the highest-traffic features.
