import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  STARTER_PRICE, PRO_PRICE, EXTRA_VENUE_PRICE,
  PRO_PRICE_NUM, EXTRA_VENUE_PRICE_NUM,
} from '../../lib/pricing'

/* ── Logo ───────────────────────────────────────────────────────────────────── */
function PeliknLogo({ iconSize = 'w-9 h-9', textSize = 'text-base', textClass = 'text-brand', iconClass = '' }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/icons/icon.svg" className={`${iconSize} ${iconClass} rounded-xl`} alt="" />
      <span className={`${textSize} font-semibold tracking-[0.18em] uppercase ${textClass}`}>Pelikn</span>
    </div>
  )
}

/* ── Icons ──────────────────────────────────────────────────────────────────── */
const Icon = ({ children, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
)

const icons = {
  thermometer: <Icon><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></Icon>,
  clipboard:   <Icon><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="m9 12 2 2 4-4"/></Icon>,
  allergen:    <Icon><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></Icon>,
  truck:       <Icon><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></Icon>,
  probe:       <Icon><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></Icon>,
  shield:      <Icon><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></Icon>,
  pdf:         <Icon><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15h6M9 11h3"/></Icon>,
  calendar:    <Icon><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></Icon>,
  timesheet:   <Icon><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Icon>,
  training:    <Icon><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></Icon>,
  clockin:     <Icon><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></Icon>,
  chart:       <Icon><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></Icon>,
  multisite:   <Icon><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></Icon>,
  check:       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  chevron:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  phone:       <Icon><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18.01"/></Icon>,
  share:       <Icon><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></Icon>,
  download:    <Icon><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></Icon>,
  bell:        <Icon><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></Icon>,
  rota:        <Icon><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01"/></Icon>,
  back:        <Icon><polyline points="15 18 9 12 15 6"/></Icon>,
}

/* ── Data ───────────────────────────────────────────────────────────────────── */
const COMPLIANCE_FEATURES = [
  { icon: icons.thermometer, title: 'Temperature Logs',         desc: 'Fridge, cooking, reheating, hot holding & cooling. Pass/fail auto-detected with corrective action prompts.' },
  { icon: icons.clipboard,   title: 'Opening & Closing Checks', desc: 'Customisable digital checklists signed off every shift. Full history, no paper.' },
  { icon: icons.clipboard,   title: 'Cleaning Schedules',       desc: 'Daily, weekly and ad-hoc tasks. Staff tick off; managers see live completion at a glance.' },
  { icon: icons.allergen,    title: 'Allergen Registry',        desc: 'Track all 14 major allergens across every dish. EHO-ready with a full ingredient audit trail.' },
  { icon: icons.truck,       title: 'Delivery Checks',          desc: 'Log deliveries with temp readings, condition notes and photo evidence in seconds.' },
  { icon: icons.probe,       title: 'Probe Calibration',        desc: 'Scheduled calibration records with pass/fail results. Never fail an EHO visit for missing probe logs.' },
  { icon: icons.pdf,         title: 'Compliance Reports',       desc: 'Export a full audit-ready PDF in one tap — structured exactly how an EHO expects.' },
]

const PRO_FEATURES = [
  { icon: icons.rota,      title: 'Rota & Shift Builder',   desc: 'Build rotas with an AI auto-fill tool. Staff get push notifications when the rota changes.' },
  { icon: icons.timesheet, title: 'Timesheets & Hours',     desc: 'Clock in/out on-device. Automatic timesheets generated from real clock data. CSV export for payroll.' },
  { icon: icons.training,  title: 'Staff Training Tracker', desc: 'Food hygiene certs, allergen training, expiry dates. Alerts 30 days before anything lapses.' },
  { icon: icons.clockin,   title: 'Time Off & Shift Swaps', desc: 'Staff request time off from the app. Managers approve with one tap. Swap requests handled in-app.' },
  { icon: icons.chart,     title: 'Labour Cost Dashboard',  desc: 'Real-time labour cost vs. scheduled hours. Spot overruns before they hit your payroll.' },
  { icon: icons.multisite, title: 'Multi-Venue Management', desc: 'One account, multiple sites. Each venue has its own settings, staff and compliance records.' },
]

const FAQS = [
  { q: 'Is this on the App Store?', a: 'Pelikn is a Progressive Web App — no App Store needed. Install it directly from your browser in seconds. It works offline too and sits on your home screen just like a native app.' },
  { q: 'Does it work on iPhone, iPad and Android?', a: 'Yes. Pelikn works on any modern browser. Install to your home screen on iOS via Safari, or on Android via Chrome, for the full app experience without the browser bar.' },
  { q: 'What counts as a "venue"?', a: "Each venue is managed separately and billed individually. The first venue on Pro is £25/month; each additional one is £15/month. Starter is £5/month per venue. There's no separate multi-venue tier — just add venues as you grow." },
  { q: 'Is my data secure?', a: "All data is stored in a UK-based Supabase database with row-level security. Staff can only see their own venue's data. We're registered with the ICO under UK GDPR." },
  { q: 'Can I cancel anytime?', a: 'Yes — no contracts, no cancellation fees. Cancel from your account settings and your subscription ends at the end of the current billing period.' },
  { q: 'How long does setup take?', a: "Most venues are up and running in under 15 minutes. The setup wizard walks you through your venue type, features and first staff invites. No training required." },
]

/* ── FAQ item ───────────────────────────────────────────────────────────────── */
function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-charcoal/8 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-4 text-left gap-4"
      >
        <span className="text-sm font-medium text-charcoal/80">{q}</span>
        <span
          className="text-charcoal/30 shrink-0 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          {icons.chevron}
        </span>
      </button>
      {open && (
        <p className="text-sm text-charcoal/55 pb-4 leading-relaxed">{a}</p>
      )}
    </div>
  )
}

/* ── Feature card ───────────────────────────────────────────────────────────── */
function FeatureCard({ icon, title, desc, accent = false }) {
  return (
    <div className={[
      'rounded-2xl border p-5 flex flex-col gap-3',
      accent
        ? 'border-accent/20 bg-accent/[0.025]'
        : 'bg-white border-charcoal/8 hover:border-brand/20 transition-colors',
    ].join(' ')}>
      <div className={[
        'w-9 h-9 rounded-xl flex items-center justify-center',
        accent ? 'bg-accent/10 text-accent' : 'bg-brand/8 text-brand',
      ].join(' ')}>
        {icon}
      </div>
      <div>
        <p className={`text-sm font-semibold mb-1 ${accent ? 'text-accent/80' : 'text-brand/80'}`}>{title}</p>
        <p className="text-xs text-charcoal/50 leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

/* ── Section label ──────────────────────────────────────────────────────────── */
function SectionLabel({ children, center = true, light = false }) {
  return (
    <p className={`text-[11px] tracking-widest uppercase font-medium mb-3 ${center ? 'text-center' : ''} ${light ? 'text-cream/40' : 'text-charcoal/35'}`}>
      {children}
    </p>
  )
}

/* ── iPhone mockup ──────────────────────────────────────────────────────────── */
function PhoneFrame({ children, tilt = 0, label }) {
  return (
    <div className="flex flex-col items-center gap-4" style={{ transform: `rotate(${tilt}deg)` }}>
      <div className="relative" style={{ width: 168 }}>
        {/* Frame */}
        <div className="bg-[#18181b] rounded-[38px] p-[3.5px] shadow-[0_32px_64px_rgba(0,0,0,0.35)]">
          {/* Screen */}
          <div className="bg-[#F0F0EF] rounded-[35px] overflow-hidden" style={{ minHeight: 364 }}>
            {/* Status bar */}
            <div className="flex items-center justify-between px-5 pt-3 pb-0">
              <span className="text-[10px] font-bold text-[#1a1a18]">9:41</span>
              <div className="w-[72px] h-[18px] bg-[#18181b] rounded-full" />
              <div className="flex items-center gap-[3px]">
                <div className="flex gap-[2px] items-end">
                  {[3,5,7,9].map(h => <div key={h} className="w-[2px] bg-[#1a1a18] rounded-sm" style={{ height: h }} />)}
                </div>
                <svg width="13" height="10" viewBox="0 0 13 10" fill="#1a1a18"><path d="M6.5 2C8.5 2 10.3 2.7 11.6 3.9L13 2.4C11.3.9 9 0 6.5 0S1.7.9 0 2.4L1.4 3.9C2.7 2.7 4.5 2 6.5 2z"/><path d="M6.5 5c1.2 0 2.3.4 3.1 1.1l1.4-1.5C9.7 3.6 8.2 3 6.5 3S3.3 3.6 2 4.6l1.4 1.5C4.2 5.4 5.3 5 6.5 5z"/><circle cx="6.5" cy="8.5" r="1.5"/></svg>
                <svg width="22" height="10" viewBox="0 0 22 10" fill="none"><rect x=".5" y=".5" width="18" height="9" rx="2.5" stroke="#1a1a18" strokeOpacity=".35"/><rect x="19" y="3" width="2.5" height="4" rx="1" fill="#1a1a18" fillOpacity=".4"/><rect x="1.5" y="1.5" width="14" height="7" rx="1.5" fill="#1a1a18"/></svg>
              </div>
            </div>
            {/* Content */}
            <div className="pb-3">
              {children}
            </div>
            {/* Home indicator */}
            <div className="flex justify-center py-2">
              <div className="w-20 h-[4px] bg-[#1a1a18]/15 rounded-full" />
            </div>
          </div>
        </div>
      </div>
      {label && (
        <p className="text-[11px] tracking-widest uppercase text-charcoal/40 font-medium">{label}</p>
      )}
    </div>
  )
}

/* ── Phone screens ──────────────────────────────────────────────────────────── */
function TodayScreen() {
  const items = [
    { label: 'Opening checks', value: 'Complete', time: '09:07', ok: true },
    { label: 'Fridge temps', value: 'All clear', time: '3/3', ok: true },
    { label: 'Cleaning', value: '2 tasks due', time: 'Today', ok: false },
    { label: 'Staff on shift', value: '4 clocked in', time: 'Now', ok: true },
  ]
  return (
    <div className="px-3 pt-2">
      <div className="bg-[#1a3c2e] rounded-2xl p-3 mb-3 flex items-center gap-2">
        <img src="/icons/icon.svg" className="w-7 h-7 rounded-lg" alt="" />
        <div>
          <p className="text-[9px] text-white/50 leading-none mb-0.5 tracking-wide uppercase">The Canteen</p>
          <p className="text-[10px] text-white font-semibold leading-none">Mon 28 Apr</p>
        </div>
      </div>
      <p className="text-[9px] tracking-widest uppercase text-[#1a1a18]/35 mb-2 font-medium">Today's checks</p>
      <div className="flex flex-col gap-1.5">
        {items.map(({ label, value, time, ok }) => (
          <div key={label} className="bg-white rounded-xl border border-[#1a1a18]/8 px-2.5 py-2 flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${ok ? 'bg-[#16a34a]' : 'bg-[#d97706]'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-[8.5px] uppercase tracking-wider text-[#1a1a18]/40 leading-none mb-0.5">{label}</p>
              <p className="text-[10px] font-semibold text-[#1a1a18] leading-none">{value}</p>
            </div>
            <span className="text-[8.5px] text-[#1a1a18]/30">{time}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TempScreen() {
  const logs = [
    { fridge: 'Walk-in Fridge', temp: '2°C', time: '09:15', staff: 'S. Murphy', ok: true },
    { fridge: 'Sandwich Fridge', temp: '4°C', time: '09:18', staff: 'S. Murphy', ok: true },
    { fridge: 'Display Fridge', temp: '3°C', time: '13:02', staff: 'T. Walsh', ok: true },
  ]
  return (
    <div className="px-3 pt-2">
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-[#1a1a18]/35">{icons.back}</span>
        <p className="text-[11px] font-semibold text-[#1a1a18]">Fridge Checks</p>
      </div>
      <p className="text-[9px] tracking-widest uppercase text-[#1a1a18]/35 mb-2 font-medium">Today · 28 Apr</p>
      <div className="flex flex-col gap-2 mb-3">
        {logs.map(({ fridge, temp, time, staff, ok }) => (
          <div key={fridge} className="bg-white rounded-xl border border-[#1a1a18]/8 p-2.5">
            <div className="flex items-start justify-between mb-1">
              <p className="text-[9.5px] font-semibold text-[#1a1a18] leading-tight">{fridge}</p>
              <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full ${ok ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-[#fef3c7] text-[#d97706]'}`}>
                {ok ? 'PASS' : 'FAIL'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[#1a3c2e]">{temp}</span>
              <span className="text-[8px] text-[#1a1a18]/35">{time} · {staff}</span>
            </div>
          </div>
        ))}
      </div>
      <button className="w-full bg-[#1a3c2e] text-white rounded-xl py-2 text-[9.5px] font-semibold tracking-wide">
        + Log Temperature
      </button>
    </div>
  )
}

function RotaScreen() {
  const days = [
    { day: 'Mon', date: '28', shifts: ['Sarah  8–4', 'Tom  11–7'] },
    { day: 'Tue', date: '29', shifts: ['Sarah  8–4', 'Priya  10–6'] },
    { day: 'Wed', date: '30', shifts: ['Tom  8–4', 'Jamie  12–8'] },
    { day: 'Thu', date: '1',  shifts: ['Sarah  8–4', 'Tom  11–7'] },
    { day: 'Fri', date: '2',  shifts: ['Jamie  8–2', 'Priya  12–8'] },
  ]
  return (
    <div className="px-3 pt-2">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[#1a1a18]/35">{icons.back}</span>
        <p className="text-[11px] font-semibold text-[#1a1a18]">Rota</p>
      </div>
      <p className="text-[9px] tracking-widest uppercase text-[#1a1a18]/35 mb-2.5 font-medium">28 Apr – 4 May</p>
      <div className="flex flex-col gap-1.5">
        {days.map(({ day, date, shifts }) => (
          <div key={day} className="bg-white rounded-xl border border-[#1a1a18]/8 px-2.5 py-2 flex gap-2.5 items-start">
            <div className="shrink-0 text-center w-7">
              <p className="text-[7.5px] uppercase tracking-widest text-[#1a1a18]/35 leading-none">{day}</p>
              <p className="text-[13px] font-bold text-[#1a3c2e] leading-tight">{date}</p>
            </div>
            <div className="flex flex-col gap-0.5 flex-1 min-w-0 pt-0.5">
              {shifts.map(s => (
                <p key={s} className="text-[9px] text-[#1a1a18]/60 font-mono leading-none">{s}</p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════
   MARKETING PAGE
   ═══════════════════════════════════════════════════════════════════════════════ */
export default function MarketingPage() {
  return (
    <div className="min-h-dvh bg-surface font-sans text-charcoal">

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-cream/95 backdrop-blur-sm border-b border-charcoal/8">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
          <PeliknLogo iconSize="w-7 h-7" textSize="text-sm" />
          <div className="flex items-center gap-1.5">
            <Link
              to="/login"
              className="text-sm font-medium text-charcoal/55 hover:text-charcoal transition-colors px-3.5 py-2 rounded-lg"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="text-sm font-semibold text-cream bg-brand hover:bg-brand/90 transition-colors px-4 py-2 rounded-xl"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="bg-brand text-cream relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 pt-20 pb-12 sm:pt-28 sm:pb-16 text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-cream/10 border border-cream/15 rounded-full px-3.5 py-1.5 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
            <span className="text-[11px] tracking-widest uppercase text-cream/70 font-medium">Food Safety &amp; Team Operations</span>
          </div>
          <h1 className="text-4xl font-bold sm:text-5xl lg:text-7xl text-cream leading-[1.05] tracking-tight mb-5">
            Let nothing slip.
          </h1>
          <p className="text-cream/60 text-sm sm:text-base max-w-xl mx-auto leading-relaxed mb-8">
            Pelikn scoops up your compliance records, rota, timesheets and team comms — so nothing gets missed, and every EHO visit is a formality.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-5">
            <Link
              to="/signup"
              className="w-full sm:w-auto bg-accent text-cream px-7 py-3.5 rounded-xl text-sm font-semibold hover:bg-accent/90 active:scale-[0.98] transition-all text-center"
            >
              Start Free Trial
            </Link>
            <a
              href="#pricing"
              className="w-full sm:w-auto border border-cream/20 text-cream/70 hover:text-cream hover:border-cream/40 px-7 py-3.5 rounded-xl text-sm font-medium transition-colors text-center"
            >
              See Pricing
            </a>
          </div>
          <p className="text-cream/30 text-xs tracking-wide">7-day free trial · No card required</p>
        </div>
      </section>

      {/* ── Phone mockups ────────────────────────────────────────────────────── */}
      <section className="bg-brand border-t border-cream/8 overflow-hidden">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 pb-0 pt-4">
          <div className="flex items-end justify-center gap-6 sm:gap-10">
            {/* Left phone — slightly behind */}
            <div className="hidden sm:block opacity-90" style={{ marginBottom: -32 }}>
              <PhoneFrame tilt={-4} label="Fridge temps">
                <TempScreen />
              </PhoneFrame>
            </div>
            {/* Centre phone — prominent */}
            <div style={{ marginBottom: 0 }}>
              <PhoneFrame label="Today dashboard">
                <TodayScreen />
              </PhoneFrame>
            </div>
            {/* Right phone — slightly behind */}
            <div className="hidden sm:block opacity-90" style={{ marginBottom: -32 }}>
              <PhoneFrame tilt={4} label="Weekly rota">
                <RotaScreen />
              </PhoneFrame>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust strip ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-charcoal/8">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-3.5">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-1.5 text-[11px] tracking-widest uppercase text-charcoal/35 font-medium">
            <span>UK Food Safety Act 1990</span>
            <span className="hidden sm:block text-charcoal/12">·</span>
            <span>FSA Guidelines</span>
            <span className="hidden sm:block text-charcoal/12">·</span>
            <span>EHO-Ready Records</span>
            <span className="hidden sm:block text-charcoal/12">·</span>
            <span>UK GDPR · ICO Registered</span>
          </div>
        </div>
      </div>

      {/* ── Who it's for ─────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 py-16">
        <SectionLabel>Built for</SectionLabel>
        <h2 className="text-2xl font-bold sm:text-4xl text-brand text-center mb-4 tracking-tight">
          Every independent hospitality business
        </h2>
        <p className="text-charcoal/50 text-center max-w-lg mx-auto text-sm leading-relaxed mb-12">
          Most compliance tools are built for big chains with big budgets. Pelikn is built for independent operators — quick to set up, simple for every member of staff.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>, label: 'Cafés & Coffee Shops' },
            { icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>, label: 'Restaurants & Takeaways' },
            { icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 11h1a3 3 0 010 6h-1"/><path d="M3 11h14v8a1 1 0 01-1 1H4a1 1 0 01-1-1z"/><path d="M7 11V7"/><path d="M11 11V7"/><path d="M5 7h10l-1-4H6z"/></svg>, label: 'Pubs & Bars' },
            { icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>, label: 'Hotels & Catering' },
          ].map(({ icon, label }) => (
            <div key={label} className="bg-white rounded-2xl border border-charcoal/8 p-5 flex flex-col items-center gap-3 text-center hover:border-brand/20 transition-colors">
              <div className="text-brand/40">{icon}</div>
              <p className="text-xs font-medium text-charcoal/60 leading-snug">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Compliance features ───────────────────────────────────────────────── */}
      <section className="bg-white border-y border-charcoal/8">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-16">
          <SectionLabel>Compliance tools</SectionLabel>
          <h2 className="text-2xl font-bold sm:text-4xl text-brand text-center mb-4 tracking-tight">
            Everything the EHO expects to see
          </h2>
          <p className="text-charcoal/50 text-center max-w-lg mx-auto text-sm leading-relaxed mb-12">
            All the logs, checklists and records you legally need — captured on-device, stored securely, exportable in seconds.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {COMPLIANCE_FEATURES.map(f => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Pro features ─────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 py-16">
        <div className="flex items-center gap-2.5 justify-center mb-3">
          <SectionLabel center={false}>Pro plan</SectionLabel>
          <span className="text-[10px] tracking-widest uppercase font-semibold px-2 py-0.5 rounded-full border bg-accent/10 text-accent border-accent/25 -mt-3">Pro</span>
        </div>
        <h2 className="text-2xl font-bold sm:text-4xl text-brand text-center mb-4 tracking-tight">
          Run your team. Stay compliant.
        </h2>
        <p className="text-charcoal/50 text-center max-w-lg mx-auto text-sm leading-relaxed mb-12">
          Managing even a small team? Pro replaces your rota tool, timesheet app and training tracker for less than £1 a day per venue.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PRO_FEATURES.map(f => (
            <FeatureCard key={f.title} accent {...f} />
          ))}
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────────── */}
      <section id="pricing" className="bg-white border-y border-charcoal/8">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-16">
          <SectionLabel>Pricing</SectionLabel>
          <h2 className="text-2xl font-bold sm:text-4xl text-brand text-center mb-4 tracking-tight">
            Simple, honest pricing
          </h2>
          <p className="text-charcoal/50 text-center max-w-md mx-auto text-sm leading-relaxed mb-12">
            No hidden fees. No per-user charges. Just a flat monthly rate per venue.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl mx-auto">

            {/* Starter */}
            <div className="rounded-2xl border border-charcoal/10 bg-white p-6 flex flex-col">
              <p className="text-[11px] tracking-widest uppercase text-brand font-semibold mb-4">Starter</p>
              <div className="flex items-baseline gap-1.5 mb-1">
                <span className="text-3xl font-bold text-charcoal">{STARTER_PRICE}</span>
                <span className="text-charcoal/40 text-sm">/month</span>
              </div>
              <p className="text-xs text-charcoal/35 mb-5">per venue</p>
              <p className="text-xs text-charcoal/50 leading-relaxed mb-6">
                Everything you need to pass an EHO inspection and replace paper records.
              </p>
              <ul className="flex flex-col gap-2.5 mb-7 flex-1">
                {[
                  'Temperature logs (fridge, cooking, hot holding)',
                  'Cleaning schedules & records',
                  "Allergen registry (Natasha's Law)",
                  'Delivery checks with condition notes',
                  'Probe calibration records',
                  'Opening & closing checklists',
                  'Corrective actions log',
                  'Audit-ready compliance PDF reports',
                ].map(f => (
                  <li key={f} className="flex items-start gap-2 text-xs text-charcoal/60">
                    <span className="text-success mt-0.5 shrink-0">{icons.check}</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/signup?plan=starter"
                className="block text-center border border-brand/25 text-brand py-3 rounded-xl text-sm font-semibold hover:bg-brand/5 transition-colors"
              >
                Start Free Trial
              </Link>
              <p className="text-[11px] text-charcoal/30 text-center mt-3">
                Need rotas?{' '}
                <Link to="/signup?plan=pro" className="text-accent font-medium hover:underline">Upgrade to Pro →</Link>
              </p>
            </div>

            {/* Pro */}
            <div className="rounded-2xl border-2 border-accent/30 bg-accent/[0.02] p-6 flex flex-col relative">
              <div className="absolute -top-3.5 inset-x-0 flex justify-center">
                <span className="bg-accent text-cream text-[10px] tracking-widest uppercase font-semibold px-3 py-1 rounded-full">
                  Most Popular
                </span>
              </div>
              <p className="text-[11px] tracking-widest uppercase text-accent font-semibold mb-4">Pro</p>
              <div className="flex items-baseline gap-1.5 mb-1">
                <span className="text-3xl font-bold text-accent">{PRO_PRICE}</span>
                <span className="text-charcoal/40 text-sm">/month</span>
              </div>
              <p className="text-xs text-charcoal/35 mb-5">first venue · {EXTRA_VENUE_PRICE}/month each additional</p>
              <p className="text-xs text-charcoal/50 leading-relaxed mb-4">
                For any business that manages a team — replaces your rota tool, timesheet app and training tracker in one place.
              </p>

              {/* Price ladder */}
              <div className="bg-white rounded-xl border border-charcoal/8 p-4 mb-6">
                <p className="text-[10px] tracking-widest uppercase text-charcoal/30 mb-3">Price as you grow</p>
                <div className="flex flex-col gap-1.5">
                  {[1, 2, 3, 5, 10].map(n => {
                    const price = PRO_PRICE_NUM + (n - 1) * EXTRA_VENUE_PRICE_NUM
                    return (
                      <div key={n} className="flex items-center justify-between">
                        <span className="text-xs text-charcoal/50">{n} venue{n > 1 ? 's' : ''}</span>
                        <span className="text-xs font-semibold text-accent">£{price}/mo</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <ul className="flex flex-col gap-2.5 mb-7 flex-1">
                {[
                  ['Everything in Starter', true],
                  ['Rota builder with AI auto-fill', false],
                  ['Timesheets & payroll CSV export', false],
                  ['Staff training records & expiry alerts', false],
                  ['Clock in / out & break tracking', false],
                  ['Time off requests & shift swaps', false],
                  ['Labour cost tracking', false],
                  ['Multi-venue — unlimited staff', false],
                ].map(([f, bold]) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-charcoal/60">
                    <span className="text-accent mt-0.5 shrink-0">{icons.check}</span>
                    {bold ? <strong className="text-charcoal/70">{f}</strong> : f}
                  </li>
                ))}
              </ul>
              <Link
                to="/signup?plan=pro"
                className="block text-center bg-accent text-cream py-3 rounded-xl text-sm font-semibold hover:bg-accent/90 active:scale-[0.98] transition-all"
              >
                Start Free Trial
              </Link>
            </div>
          </div>

          <p className="text-center text-xs text-charcoal/30 mt-6">
            All plans include a 7-day free trial. No card required.
          </p>
        </div>
      </section>

      {/* ── How to install ────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 py-16">
        <SectionLabel>No App Store needed</SectionLabel>
        <h2 className="text-2xl font-bold sm:text-4xl text-brand text-center mb-4 tracking-tight">
          Up and running in 3 steps
        </h2>
        <p className="text-charcoal/50 text-center max-w-lg mx-auto text-sm leading-relaxed mb-12">
          Pelikn is a Progressive Web App. Install it directly from your browser — works just like a native app, even offline.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-3xl mx-auto">
          {[
            { step: '1', icon: icons.phone,    title: 'Open the link',       desc: 'Visit app.pelikn.app in Safari (iPhone/iPad) or Chrome (Android / desktop).' },
            { step: '2', icon: icons.share,    title: 'Add to home screen',  desc: "Tap Share then 'Add to Home Screen' on iOS, or the menu then 'Install App' on Chrome." },
            { step: '3', icon: icons.download, title: 'Open like any app',   desc: "Pelikn appears on your home screen. Tap to open — no browser bar, no App Store." },
          ].map(({ step, icon, title, desc }) => (
            <div key={step} className="bg-white rounded-2xl border border-charcoal/8 p-6 text-center">
              <div className="w-11 h-11 rounded-2xl bg-brand text-cream flex items-center justify-center mx-auto mb-4">
                {icon}
              </div>
              <p className="text-[10px] tracking-widest uppercase text-charcoal/30 mb-1.5">Step {step}</p>
              <p className="text-sm font-semibold text-charcoal mb-2">{title}</p>
              <p className="text-xs text-charcoal/45 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────────── */}
      <section className="bg-white border-y border-charcoal/8">
        <div className="max-w-2xl mx-auto px-5 sm:px-8 py-16">
          <SectionLabel>Questions</SectionLabel>
          <h2 className="text-2xl font-bold sm:text-4xl text-brand text-center mb-10 tracking-tight">
            Frequently asked
          </h2>
          <div className="rounded-2xl border border-charcoal/8 px-5 sm:px-6 bg-white">
            {FAQS.map(({ q, a }) => <FaqItem key={q} q={q} a={a} />)}
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────────────── */}
      <section className="bg-brand">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-20 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-cream/15 shadow-lg">
              <img src="/icons/icon.svg" className="w-16 h-16" alt="Pelikn" />
            </div>
          </div>
          <h2 className="text-2xl font-bold sm:text-4xl text-cream mb-4 tracking-tight">
            Let nothing slip.
          </h2>
          <p className="text-cream/50 max-w-md mx-auto text-sm leading-relaxed mb-8">
            Start your free 7-day trial today. No credit card, no commitment — better food safety records from day one.
          </p>
          <Link
            to="/signup"
            className="inline-block bg-accent text-cream px-8 py-4 rounded-xl text-sm font-semibold hover:bg-accent/90 active:scale-[0.98] transition-all"
          >
            Start Free Trial — No Card Required
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-charcoal/8 bg-surface">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <PeliknLogo iconSize="w-6 h-6" textSize="text-xs" />
          <a href="mailto:hello@pelikn.app" className="text-xs text-charcoal/40 hover:text-charcoal transition-colors hidden sm:block">
            hello@pelikn.app
          </a>
          <div className="flex items-center gap-5">
            <Link to="/privacy" className="text-xs text-charcoal/35 hover:text-charcoal transition-colors">Privacy</Link>
            <Link to="/terms"   className="text-xs text-charcoal/35 hover:text-charcoal transition-colors">Terms</Link>
            <Link to="/login"   className="text-xs text-charcoal/35 hover:text-charcoal transition-colors">Sign In</Link>
          </div>
        </div>
        <div className="border-t border-charcoal/5 py-3 text-center">
          <p className="text-[11px] text-charcoal/20">
            © {new Date().getFullYear()} Pelikn · Registered with ICO · UK GDPR compliant
          </p>
        </div>
      </footer>

    </div>
  )
}
