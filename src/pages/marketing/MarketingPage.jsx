import React, { useState } from 'react'
import { Link } from 'react-router-dom'

/* ── Icons ─────────────────────────────────────────────────────────────────── */
function IconThermometer() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>
    </svg>
  )
}
function IconClipboard() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  )
}
function IconLeaf() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
    </svg>
  )
}
function IconTruck() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="1"/>
      <path d="M16 8h4l3 3v5h-7V8z"/>
      <circle cx="5.5" cy="18.5" r="2.5"/>
      <circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  )
}
function IconCalendar() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
    </svg>
  )
}
function IconShield() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  )
}
function IconUsers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}
function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}
function IconChevronDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  )
}
function IconPhone() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2"/>
      <line x1="12" y1="18" x2="12" y2="18.01"/>
    </svg>
  )
}
function IconShare() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/>
      <circle cx="6" cy="12" r="3"/>
      <circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  )
}
function IconDownload() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  )
}

/* ── Feature data ───────────────────────────────────────────────────────────── */
const COMPLIANCE_FEATURES = [
  { icon: <IconThermometer />, title: 'Temperature Logs', desc: 'Fridge, freezer, cooking, reheating, hot holding & cooling — digital records replace paper log sheets.' },
  { icon: <IconClipboard />, title: 'Cleaning Schedules', desc: 'Daily, weekly and ad-hoc cleaning tasks. Staff check off tasks; managers see live completion status.' },
  { icon: <IconLeaf />, title: 'Allergen Registry', desc: 'Track the 14 major allergens across every dish. EHO-ready with full ingredient audit trail.' },
  { icon: <IconTruck />, title: 'Delivery Checks', desc: 'Log supplier deliveries with temp checks, condition notes and photo evidence in seconds.' },
  { icon: <IconShield />, title: 'Probe Calibration', desc: 'Scheduled probe checks with pass/fail records. Never fail an EHO inspection for missing calibration logs.' },
  { icon: <IconClipboard />, title: 'Opening & Closing', desc: 'Customisable checklists for start-of-day and end-of-day — signed off digitally every shift.' },
  { icon: <IconShield />, title: 'EHO Audit Reports', desc: 'Generate a full compliance PDF in one click — structured exactly how an EHO expects to see it.' },
]

const PRO_FEATURES = [
  { icon: <IconCalendar />, title: 'Rota & Shift Management', desc: 'Build weekly rotas, publish to staff, track actual hours against scheduled.' },
  { icon: <IconShield />, title: 'Staff Cost Tracking', desc: 'See projected wage costs per rota week. Spot overspend before payroll.' },
  { icon: <IconUsers />, title: 'Unlimited Staff', desc: 'No cap on team size. Add as many staff as you need across any number of venues.' },
  { icon: <IconClipboard />, title: 'Multi-Venue Management', desc: 'Manage multiple venues from a single account. Each venue billed at just £15/month extra.' },
]

/* ── FAQ data ───────────────────────────────────────────────────────────────── */
const FAQS = [
  {
    q: 'Is this on the App Store?',
    a: 'SafeServ is a Progressive Web App (PWA) — no App Store needed. You install it directly from your browser, and it works offline too. We cover how to install it below.',
  },
  {
    q: 'Does it work on iPad and Android?',
    a: 'Yes. SafeServ works on any modern browser — iPhone, iPad, Android, or desktop. Install it to your home screen for the full app experience without visiting a browser each time.',
  },
  {
    q: 'What counts as "multi-venue"?',
    a: "Each venue is managed separately and billed individually. The first venue on Pro is £35/month; each additional venue you add is £15/month. There's no separate multi-venue tier — you just add venues as you grow.",
  },
  {
    q: 'Is my data secure?',
    a: "All data is stored in a UK-based Supabase database with row-level security — staff can only see their own venue's data. We're registered with the ICO under UK GDPR.",
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. No contracts, no cancellation fees. Cancel from your account settings and your subscription ends at the billing period.',
  },
]

/* ── FAQ accordion item ─────────────────────────────────────────────────────── */
function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-charcoal/10 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-4 text-left gap-4"
      >
        <span className="text-sm font-medium text-charcoal">{q}</span>
        <span
          className="text-charcoal/40 shrink-0 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <IconChevronDown />
        </span>
      </button>
      {open && (
        <p className="text-sm text-charcoal/60 pb-4 leading-relaxed">{a}</p>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════
   MARKETING LANDING PAGE
   ═══════════════════════════════════════════════════════════════════════════════ */

export default function MarketingPage() {
  return (
    <div className="min-h-dvh bg-cream font-sans text-charcoal overflow-x-hidden">

      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-cream/90 backdrop-blur-sm border-b border-charcoal/8">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
          <span className="font-serif text-xl tracking-tight text-brand">SafeServ</span>
          <Link
            to="/login"
            className="text-sm font-medium text-charcoal/60 hover:text-charcoal transition-colors"
          >
            Sign In →
          </Link>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="bg-brand text-cream">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-20 sm:py-28 text-center">
          <p className="text-[11px] tracking-[0.3em] uppercase text-cream/50 mb-5">
            Food Safety &amp; Operations
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-cream leading-tight mb-6">
            Food Safety,<br />Simplified.
          </h1>
          <p className="text-cream/65 text-base sm:text-lg max-w-xl mx-auto leading-relaxed mb-10">
            Digital compliance records for UK hospitality. Replace paper log sheets with a clean, fast app your whole team will actually use.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/login"
              className="w-full sm:w-auto bg-accent text-cream px-7 py-3.5 rounded-xl text-sm font-semibold hover:bg-accent/90 transition-colors text-center"
            >
              Start Free Trial
            </Link>
            <a
              href="#pricing"
              className="w-full sm:w-auto border border-cream/25 text-cream/75 hover:text-cream hover:border-cream/50 px-7 py-3.5 rounded-xl text-sm font-medium transition-colors text-center"
            >
              See Pricing
            </a>
          </div>
          <p className="text-cream/35 text-xs mt-5 tracking-wide">
            7-day free trial · No card required
          </p>
        </div>
      </section>

      {/* ── Compliance strip ───────────────────────────────────────────────── */}
      <div className="bg-white border-b border-charcoal/8">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-4">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-[11px] tracking-widest uppercase text-charcoal/35 font-medium">
            <span>UK Food Safety Act 1990</span>
            <span className="hidden sm:block text-charcoal/15">·</span>
            <span>FSA Guidelines</span>
            <span className="hidden sm:block text-charcoal/15">·</span>
            <span>EHO-Ready Records</span>
            <span className="hidden sm:block text-charcoal/15">·</span>
            <span>UK GDPR Compliant</span>
          </div>
        </div>
      </div>

      {/* ── Who it's for ───────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 py-16">
        <p className="text-[11px] tracking-widest uppercase text-charcoal/35 text-center mb-3">Built for</p>
        <h2 className="font-serif text-3xl sm:text-4xl text-charcoal text-center mb-4">
          Any kitchen that needs to be compliant
        </h2>
        <p className="text-charcoal/50 text-center max-w-lg mx-auto text-sm leading-relaxed mb-12">
          Whether you're a single café or a growing group of pubs, SafeServ keeps your food safety records clean, your team aligned, and your EHO inspector happy.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { emoji: '☕', label: 'Cafés & Coffee Shops' },
            { emoji: '🍽️', label: 'Restaurants' },
            { emoji: '🍺', label: 'Pubs & Bars' },
            { emoji: '🏨', label: 'Hotels & Hospitality' },
          ].map(({ emoji, label }) => (
            <div key={label} className="bg-white rounded-2xl border border-charcoal/8 p-5 text-center">
              <div className="text-3xl mb-3">{emoji}</div>
              <p className="text-sm font-medium text-charcoal/70 leading-snug">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Compliance Features ─────────────────────────────────────────────── */}
      <section className="bg-white border-y border-charcoal/8">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-16">
          <p className="text-[11px] tracking-widest uppercase text-charcoal/35 text-center mb-3">Compliance tools</p>
          <h2 className="font-serif text-3xl sm:text-4xl text-charcoal text-center mb-4">
            Everything the EHO expects to see
          </h2>
          <p className="text-charcoal/50 text-center max-w-lg mx-auto text-sm leading-relaxed mb-12">
            All the logs, checklists and records you legally need — captured on-device, stored securely, accessible in seconds.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {COMPLIANCE_FEATURES.map(({ icon, title, desc }) => (
              <div key={title} className="rounded-2xl border border-charcoal/8 p-5 hover:border-charcoal/15 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-3">
                  {icon}
                </div>
                <p className="text-sm font-semibold text-charcoal mb-1">{title}</p>
                <p className="text-xs text-charcoal/45 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pro Features ────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 py-16">
        <div className="flex items-center gap-3 justify-center mb-3">
          <p className="text-[11px] tracking-widest uppercase text-charcoal/35">Pro plan</p>
          <span className="text-[10px] tracking-widest uppercase font-semibold px-2 py-0.5 rounded border bg-accent/10 text-accent border-accent/25">Pro</span>
        </div>
        <h2 className="font-serif text-3xl sm:text-4xl text-charcoal text-center mb-4">
          Plus rota &amp; team management
        </h2>
        <p className="text-charcoal/50 text-center max-w-lg mx-auto text-sm leading-relaxed mb-12">
          Take compliance further with full rota management, UK break law enforcement, and one-click EHO audit reports.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PRO_FEATURES.map(({ icon, title, desc }) => (
            <div key={title} className="rounded-2xl border border-accent/20 bg-accent/[0.03] p-5">
              <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-3">
                {icon}
              </div>
              <p className="text-sm font-semibold text-charcoal mb-1">{title}</p>
              <p className="text-xs text-charcoal/45 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────────── */}
      <section id="pricing" className="bg-white border-y border-charcoal/8">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-16">
          <p className="text-[11px] tracking-widest uppercase text-charcoal/35 text-center mb-3">Pricing</p>
          <h2 className="font-serif text-3xl sm:text-4xl text-charcoal text-center mb-4">
            Simple, honest pricing
          </h2>
          <p className="text-charcoal/50 text-center max-w-md mx-auto text-sm leading-relaxed mb-12">
            No hidden fees, no per-user charges. Just a flat monthly rate per venue.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">

            {/* Starter */}
            <div className="rounded-2xl border border-charcoal/10 p-7 flex flex-col">
              <div className="mb-5">
                <p className="text-[11px] tracking-widest uppercase text-teal-600 font-semibold mb-1">Starter</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-serif text-4xl text-charcoal">£15</span>
                  <span className="text-charcoal/40 text-sm">/month</span>
                </div>
                <p className="text-xs text-charcoal/40 mt-1">per venue</p>
              </div>
              <p className="text-xs text-charcoal/50 mb-6 leading-relaxed">
                Perfect for small cafés and independent coffee shops that need their compliance records in order.
              </p>
              <ul className="flex flex-col gap-2.5 mb-8 flex-1">
                {[
                  'Temperature logs (fridge, freezer, cooking)',
                  'Cleaning schedules',
                  'Allergen registry',
                  'Delivery checks',
                  'Probe calibration',
                  'Opening & closing checklists',
                  'EHO audit-ready reports',
                  'Up to 5 staff · 1 venue',
                ].map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-xs text-charcoal/60">
                    <span className="text-teal-500 mt-0.5 shrink-0"><IconCheck /></span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/login"
                className="block text-center border border-charcoal/20 text-charcoal py-3 rounded-xl text-sm font-medium hover:bg-charcoal/4 transition-colors"
              >
                Start Free Trial
              </Link>
            </div>

            {/* Pro */}
            <div className="rounded-2xl border-2 border-accent/30 bg-accent/[0.025] p-7 flex flex-col relative">
              <div className="absolute -top-3.5 left-0 right-0 flex justify-center">
                <span className="bg-accent text-cream text-[10px] tracking-widest uppercase font-semibold px-3 py-1 rounded-full">
                  Most Popular
                </span>
              </div>
              <div className="mb-5">
                <p className="text-[11px] tracking-widest uppercase text-accent font-semibold mb-1">Pro</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-serif text-4xl text-charcoal">£35</span>
                  <span className="text-charcoal/40 text-sm">/month</span>
                </div>
                <p className="text-xs text-charcoal/40 mt-1">first venue · £15/month each additional</p>
              </div>
              <p className="text-xs text-charcoal/50 mb-5 leading-relaxed">
                For restaurants, pubs and growing operations that need full rota management alongside compliance.
              </p>

              {/* Price ladder */}
              <div className="bg-white rounded-xl border border-charcoal/8 p-4 mb-6">
                <p className="text-[10px] tracking-widest uppercase text-charcoal/30 mb-3">Price as you grow</p>
                <div className="flex flex-col gap-1.5">
                  {[
                    ['1 venue', '£35/mo'],
                    ['2 venues', '£50/mo'],
                    ['3 venues', '£65/mo'],
                    ['5 venues', '£95/mo'],
                    ['10 venues', '£170/mo'],
                  ].map(([venues, price]) => (
                    <div key={venues} className="flex items-center justify-between">
                      <span className="text-xs text-charcoal/50">{venues}</span>
                      <span className="text-xs font-semibold text-charcoal">{price}</span>
                    </div>
                  ))}
                </div>
              </div>

              <ul className="flex flex-col gap-2.5 mb-8 flex-1">
                {[
                  'Everything in Starter',
                  'Unlimited staff',
                  'Rota & shift management',
                  'Staff cost tracking',
                  'Multi-venue support',
                ].map((f, i) => (
                  <li key={f} className="flex items-start gap-2.5 text-xs text-charcoal/60">
                    <span className="text-accent mt-0.5 shrink-0"><IconCheck /></span>
                    {i === 0 ? <strong className="text-charcoal/70">{f}</strong> : f}
                  </li>
                ))}
              </ul>
              <Link
                to="/login"
                className="block text-center bg-accent text-cream py-3 rounded-xl text-sm font-semibold hover:bg-accent/90 transition-colors"
              >
                Start Free Trial
              </Link>
            </div>
          </div>

          <p className="text-center text-xs text-charcoal/35 mt-6">
            All plans include 7-day free trial. No card required.
          </p>
        </div>
      </section>

      {/* ── How to Install ──────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 py-16">
        <p className="text-[11px] tracking-widest uppercase text-charcoal/35 text-center mb-3">No App Store needed</p>
        <h2 className="font-serif text-3xl sm:text-4xl text-charcoal text-center mb-4">
          Up and running in 3 steps
        </h2>
        <p className="text-charcoal/50 text-center max-w-lg mx-auto text-sm leading-relaxed mb-12">
          SafeServ is a Progressive Web App. No download required — it installs directly from your browser and works just like a native app, even offline.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
          {[
            {
              step: '1',
              icon: <IconPhone />,
              title: 'Open the link',
              desc: 'Open app.safeserv.co.uk in Safari (iPhone/iPad) or Chrome (Android/desktop).',
            },
            {
              step: '2',
              icon: <IconShare />,
              title: 'Add to home screen',
              desc: 'Tap the Share icon then "Add to Home Screen" on iOS, or the menu then "Install App" on Chrome.',
            },
            {
              step: '3',
              icon: <IconDownload />,
              title: 'Open like any app',
              desc: 'SafeServ appears on your home screen. Tap it to open — no browser bar, no App Store.',
            },
          ].map(({ step, icon, title, desc }) => (
            <div key={step} className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-charcoal text-cream flex items-center justify-center mx-auto mb-4">
                {icon}
              </div>
              <p className="text-[10px] tracking-widest uppercase text-charcoal/30 mb-1">Step {step}</p>
              <p className="text-sm font-semibold text-charcoal mb-2">{title}</p>
              <p className="text-xs text-charcoal/45 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
      <section className="bg-white border-y border-charcoal/8">
        <div className="max-w-2xl mx-auto px-5 sm:px-8 py-16">
          <p className="text-[11px] tracking-widest uppercase text-charcoal/35 text-center mb-3">Questions</p>
          <h2 className="font-serif text-3xl sm:text-4xl text-charcoal text-center mb-10">
            Frequently asked
          </h2>
          <div className="bg-white rounded-2xl border border-charcoal/8 px-6">
            {FAQS.map(({ q, a }) => <FaqItem key={q} q={q} a={a} />)}
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────────── */}
      <section className="bg-brand text-cream">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-20 text-center">
          <h2 className="font-serif text-3xl sm:text-4xl text-cream mb-4">
            Ready to ditch the paper logs?
          </h2>
          <p className="text-cream/50 max-w-md mx-auto text-sm leading-relaxed mb-8">
            Start your free 7-day trial today. No credit card, no commitment — just better food safety records from day one.
          </p>
          <Link
            to="/login"
            className="inline-block bg-accent text-cream px-8 py-4 rounded-xl text-sm font-semibold hover:bg-accent/90 transition-colors"
          >
            Start Free Trial — No Card Required
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-charcoal/8 bg-cream">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <span className="font-serif text-lg text-brand">SafeServ</span>
            <span className="text-charcoal/20 hidden sm:block">·</span>
            <a href="mailto:hello@safeserv.co.uk" className="text-xs text-charcoal/40 hover:text-charcoal transition-colors">
              hello@safeserv.co.uk
            </a>
          </div>
          <div className="flex items-center gap-5">
            <Link to="/privacy" className="text-xs text-charcoal/35 hover:text-charcoal transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="text-xs text-charcoal/35 hover:text-charcoal transition-colors">
              Terms of Service
            </Link>
            <Link to="/login" className="text-xs text-charcoal/35 hover:text-charcoal transition-colors">
              Sign In
            </Link>
          </div>
        </div>
        <div className="border-t border-charcoal/5 py-3 text-center">
          <p className="text-[11px] text-charcoal/25">
            © {new Date().getFullYear()} SafeServ · Registered with ICO · UK GDPR compliant
          </p>
        </div>
      </footer>

    </div>
  )
}
