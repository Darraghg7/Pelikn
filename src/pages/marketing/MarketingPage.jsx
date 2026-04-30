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
  pdf:         <Icon><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15h6M9 11h3"/></Icon>,
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
  rota:        <Icon><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01"/></Icon>,
  home:        <Icon><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></Icon>,
  team:        <Icon><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></Icon>,
  clock:       <Icon><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Icon>,
}

/* ── Data ───────────────────────────────────────────────────────────────────── */
const COMPLIANCE_FEATURES = [
  { icon: icons.thermometer, title: 'Temperature Logs',         desc: 'Fridge, cooking, reheating, hot holding & cooling. Pass/fail auto-detected with corrective action prompts.' },
  { icon: icons.clipboard,   title: 'Opening & Closing Checks', desc: 'Customisable digital checklists signed off every shift. Full history, no paper.' },
  { icon: icons.clipboard,   title: 'Cleaning Schedules',       desc: 'Daily, weekly and ad-hoc tasks. Staff tick off; managers see live completion at a glance.' },
  { icon: icons.allergen,    title: 'Allergen Registry',        desc: 'Track all 14 major allergens across every dish. EHO-ready with a full ingredient audit trail.' },
  { icon: icons.truck,       title: 'Delivery Checks',          desc: 'Log deliveries with temp readings, condition notes and photo evidence in seconds.' },
  { icon: icons.probe,       title: 'Probe Calibration',        desc: 'Scheduled calibration records with pass/fail results. Never fail an EHO visit for missing probe logs.' },
  { icon: icons.pdf,         title: 'Compliance Reports',       desc: 'Export a full audit-ready PDF in one tap, structured exactly how an EHO expects.' },
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
  { q: 'Is this on the App Store?', a: 'Pelikn is a Progressive Web App, no App Store needed. Install it directly from your browser in seconds. It works offline too and sits on your home screen just like a native app.' },
  { q: 'Does it work on iPhone, iPad and Android?', a: 'Yes. Pelikn works on any modern browser. Install to your home screen on iOS via Safari, or on Android via Chrome, for the full app experience without the browser bar.' },
  { q: 'What counts as a "venue"?', a: "Each venue is managed separately and billed individually. The first venue on Pro is £25/month; each additional one is £15/month. Starter is £5/month per venue. There's no separate multi-venue tier, just add venues as you grow." },
  { q: 'Is my data secure?', a: "All data is stored in a UK-based Supabase database with row-level security. Staff can only see their own venue's data. We're registered with the ICO under UK GDPR." },
  { q: 'Can I cancel anytime?', a: 'Yes, no contracts, no cancellation fees. Cancel from your account settings and your subscription ends at the end of the current billing period.' },
  { q: 'How long does setup take?', a: "Most venues are up and running in under 15 minutes. The setup wizard walks you through your venue type, features and first staff invites. No training required." },
]

/* ── Shared components ──────────────────────────────────────────────────────── */
function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-charcoal/8 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-4 text-left gap-4"
      >
        <span className="text-sm font-medium text-charcoal/80">{q}</span>
        <span className="text-charcoal/30 shrink-0 transition-transform duration-200" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          {icons.chevron}
        </span>
      </button>
      {open && <p className="text-sm text-charcoal/55 pb-4 leading-relaxed">{a}</p>}
    </div>
  )
}

function FeatureCard({ icon, title, desc, accent = false }) {
  return (
    <div className={[
      'rounded-2xl border p-5 flex flex-col gap-3',
      accent ? 'border-accent/20 bg-accent/[0.025]' : 'bg-white border-charcoal/8 hover:border-brand/20 transition-colors',
    ].join(' ')}>
      <div className={['w-9 h-9 rounded-xl flex items-center justify-center', accent ? 'bg-accent/10 text-accent' : 'bg-brand/8 text-brand'].join(' ')}>
        {icon}
      </div>
      <div>
        <p className={`text-sm font-semibold mb-1 ${accent ? 'text-accent/80' : 'text-brand/80'}`}>{title}</p>
        <p className="text-xs text-charcoal/50 leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

function SectionLabel({ children, center = true, light = false }) {
  return (
    <p className={`text-[11px] tracking-widest uppercase font-medium mb-3 ${center ? 'text-center' : ''} ${light ? 'text-cream/40' : 'text-charcoal/35'}`}>
      {children}
    </p>
  )
}

/* ── App screenshot components ──────────────────────────────────────────────── */
const NavI = ({ d }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
)

function ScreenNav({ active = 'home' }) {
  const tabs = [
    { key: 'home',   label: 'Home',   d: <><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></> },
    { key: 'checks', label: 'Checks', d: <><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="m9 12 2 2 4-4"/></> },
    { key: 'rota',   label: 'Rota',   d: <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01"/></> },
    { key: 'team',   label: 'Team',   d: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></> },
    { key: 'clock',  label: 'Clock',  d: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></> },
  ]
  return (
    <div className="flex items-center border-t border-charcoal/8 bg-white">
      {tabs.map(({ key, label, d }) => {
        const on = key === active
        return (
          <div key={key} className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5">
            <div className={`flex items-center justify-center rounded-xl px-2 py-1 ${on ? 'bg-[#E4EFE9]' : ''}`}>
              <span className={on ? 'text-brand' : 'text-charcoal/35'}><NavI d={d} /></span>
            </div>
            <span className={`text-[9px] leading-none tracking-wide ${on ? 'font-semibold text-brand' : 'font-medium text-charcoal/40'}`}>{label}</span>
          </div>
        )
      })}
    </div>
  )
}

function AppScreen({ children, maxH = 420 }) {
  return (
    <div className="rounded-2xl overflow-hidden shadow-[0_16px_48px_rgba(0,0,0,0.14)] ring-1 ring-charcoal/8" style={{ maxHeight: maxH }}>
      {children}
    </div>
  )
}

/* Staff mobile screen — simplified personal view */
function StaffMobileScreen() {
  return (
    <div className="rounded-2xl overflow-hidden shadow-[0_16px_48px_rgba(0,0,0,0.14)] ring-1 ring-charcoal/8" style={{ height: 420 }}>
      <div className="bg-[#F0F0EF] h-full flex flex-col">
        <div className="bg-brand px-4 py-3.5 shrink-0">
          <p className="text-[10px] tracking-widest uppercase text-cream/45 mb-0.5">The Canteen</p>
          <p className="text-sm font-semibold text-cream">Good morning, Sarah</p>
        </div>
        <div className="flex-1 overflow-hidden p-3">
          <p className="text-[10px] tracking-widest uppercase text-charcoal/40 mb-2">Quick actions</p>
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {[
              { icon: icons.clock,       label: 'Clock In'   },
              { icon: icons.thermometer, label: 'Fridge Temp' },
              { icon: icons.clipboard,   label: 'Cleaning'   },
            ].map(({ icon, label }) => (
              <div key={label} className="bg-white rounded-xl border border-charcoal/8 p-2.5 flex flex-col items-center gap-1">
                <span className="text-brand">{icon}</span>
                <p className="text-[9px] text-charcoal/55 text-center leading-tight">{label}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-charcoal/8 px-3 py-2.5 mb-2">
            <p className="text-[10px] tracking-widest uppercase text-charcoal/35 mb-1">Today's shift</p>
            <p className="text-sm font-semibold text-charcoal">08:00 – 16:00</p>
            <p className="text-[11px] text-charcoal/45">Kitchen · 8 hours</p>
          </div>
          <div className="bg-white rounded-xl border border-charcoal/8 overflow-hidden divide-y divide-charcoal/6">
            <div className="flex items-center border-l-[3px] border-l-success pl-3 pr-3 py-2">
              <p className="text-[11px] text-charcoal/65">Opening checks complete</p>
            </div>
            <div className="flex items-center border-l-[3px] border-l-warning bg-warning/[0.025] pl-3 pr-3 py-2">
              <p className="text-[11px] text-charcoal/65">Kitchen deep clean due</p>
            </div>
          </div>
        </div>
        <div className="shrink-0"><ScreenNav active="home" /></div>
      </div>
    </div>
  )
}

/* Fridge check mobile screen */
function FridgeScreen() {
  const logs = [
    { fridge: 'Walk-in Fridge',  temp: '2°C', time: '09:15', staff: 'S. Murphy' },
    { fridge: 'Sandwich Fridge', temp: '4°C', time: '09:18', staff: 'S. Murphy' },
    { fridge: 'Display Fridge',  temp: '3°C', time: '13:02', staff: 'T. Walsh'  },
  ]
  return (
    <AppScreen maxH={310}>
      <div className="bg-[#F0F0EF]">
        <div className="bg-brand px-4 py-3.5 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cream/50"><polyline points="15 18 9 12 15 6"/></svg>
          <p className="text-sm font-semibold text-cream">Fridge Checks</p>
        </div>
        <div className="p-3">
          <p className="text-[10px] tracking-widest uppercase text-charcoal/40 mb-2.5">Today · 28 Apr</p>
          <div className="flex flex-col gap-2 mb-3">
            {logs.map(({ fridge, temp, time, staff }) => (
              <div key={fridge} className="bg-white rounded-xl border border-charcoal/8 px-3 py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-charcoal mb-0.5">{fridge}</p>
                  <p className="text-[10px] text-charcoal/40">{time} · {staff}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-base font-bold text-brand font-mono">{temp}</p>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#dcfce7] text-[#16a34a]">PASS</span>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full bg-brand text-cream py-2.5 rounded-xl text-xs font-semibold">+ Log Temperature</button>
        </div>
        <ScreenNav active="checks" />
      </div>
    </AppScreen>
  )
}

/* Desktop manager dashboard — sidebar + content */
function DesktopScreen() {
  const SideItem = ({ label, icon, active = false }) => (
    <div className={`flex items-center gap-2 px-3 py-1.5 mx-1.5 rounded-xl ${active ? 'bg-cream/10' : ''}`}>
      <span className={active ? 'text-cream' : 'text-cream/40'}><NavI d={icon} /></span>
      <span className={`text-[11px] font-medium ${active ? 'text-cream' : 'text-cream/45'}`}>{label}</span>
    </div>
  )
  return (
    <AppScreen maxH={560}>
      <div className="flex h-full">
        {/* Sidebar */}
        <div className="w-40 shrink-0 bg-brand flex flex-col">
          <div className="px-3 pt-3 pb-2.5 border-b border-cream/10">
            <PeliknLogo iconSize="w-5 h-5" textSize="text-[11px]" textClass="text-cream" />
            <p className="text-[10px] text-cream/35 mt-1.5 pl-0.5 truncate">The Canteen</p>
          </div>
          <div className="py-2 flex flex-col gap-0.5">
            <SideItem label="Dashboard" active icon={<><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>} />
            <SideItem label="Checks"    icon={<><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="m9 12 2 2 4-4"/></>} />
            <SideItem label="Rota"      icon={<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01"/></>} />
            <SideItem label="Team"      icon={<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></>} />
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 bg-[#F0F0EF] overflow-hidden p-4">
          {/* Header */}
          <div className="mb-3">
            <p className="text-[10px] tracking-widest uppercase text-charcoal/35">Mon 28 Apr 2026</p>
            <p className="text-lg font-bold text-charcoal leading-tight">Good morning, James</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[11px] text-charcoal/40">The Canteen</p>
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">PRO</span>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { n: '92%', label: 'Compliance', cls: 'text-success' },
              { n: '4',   label: 'On shift',   cls: 'text-charcoal' },
              { n: '1',   label: 'Overdue',    cls: 'text-warning' },
            ].map(({ n, label, cls }) => (
              <div key={label} className="bg-white rounded-xl border border-charcoal/8 py-2.5 text-center">
                <p className={`text-xl font-bold leading-none ${cls}`}>{n}</p>
                <p className="text-[10px] text-charcoal/40 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Widgets */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="bg-white rounded-xl border border-charcoal/8 p-3">
              <p className="text-[10px] tracking-widest uppercase text-charcoal/35 mb-2">Fridge Temps</p>
              {[
                { name: 'Walk-in',   temp: '2°C' },
                { name: 'Sandwich',  temp: '4°C' },
                { name: 'Display',   temp: '3°C' },
              ].map(({ name, temp }) => (
                <div key={name} className="flex items-center justify-between py-1 border-b border-charcoal/5 last:border-0">
                  <p className="text-[11px] text-charcoal/55">{name}</p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[11px] font-bold text-brand font-mono">{temp}</p>
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#dcfce7] text-[#16a34a]">✓</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-charcoal/8 p-3">
              <p className="text-[10px] tracking-widest uppercase text-charcoal/35 mb-2">On Shift Today</p>
              {[
                { name: 'Sarah M.',  hours: '8–4'  },
                { name: 'Tom W.',    hours: '11–7' },
                { name: 'Priya K.', hours: '10–6' },
              ].map(({ name, hours }) => (
                <div key={name} className="flex items-center justify-between py-1 border-b border-charcoal/5 last:border-0">
                  <p className="text-[11px] text-charcoal/55">{name}</p>
                  <p className="text-[11px] text-charcoal/35 font-mono">{hours}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Action items */}
          <div className="bg-white rounded-xl border border-charcoal/8 overflow-hidden divide-y divide-charcoal/5">
            <p className="text-[10px] tracking-widest uppercase text-charcoal/35 px-3 pt-2.5 pb-1.5">Today's tasks</p>
            {[
              { label: 'Kitchen deep clean',  sub: 'Overdue · Tom W.',        type: 'warning' },
              { label: 'Opening checks',      sub: 'Complete · 09:07 · Sarah', type: 'success' },
              { label: 'Delivery check',      sub: 'Complete · 08:45 · Sarah', type: 'success' },
              { label: 'Cooking temp log',    sub: 'Complete · 12:30 · Priya', type: 'success' },
            ].map(({ label, sub, type }) => (
              <div key={label} className={`flex items-center border-l-[3px] pl-3 pr-4 py-2 ${type === 'warning' ? 'border-l-warning bg-warning/[0.02]' : 'border-l-success'}`}>
                <div>
                  <p className="text-[11px] font-medium text-charcoal">{label}</p>
                  <p className="text-[10px] text-charcoal/40">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppScreen>
  )
}

const ScreenCaption = ({ children }) => (
  <p className="text-[10px] tracking-widest uppercase text-charcoal/35 text-center font-medium mt-2">{children}</p>
)

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
            <Link to="/login" className="text-sm font-medium text-charcoal/55 hover:text-charcoal transition-colors px-3.5 py-2 rounded-lg">Sign In</Link>
            <Link to="/signup" className="text-sm font-semibold text-cream bg-brand hover:bg-brand/90 transition-colors px-4 py-2 rounded-xl">Start Free Trial</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="bg-brand text-cream">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 pt-20 pb-16 sm:pt-28 sm:pb-20 text-center">
          <div className="inline-flex items-center gap-2 bg-cream/10 border border-cream/15 rounded-full px-3.5 py-1.5 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
            <span className="text-[11px] tracking-widest uppercase text-cream/70 font-medium">Food Safety &amp; Team Operations</span>
          </div>
          <h1 className="text-4xl font-bold sm:text-5xl lg:text-7xl text-cream leading-[1.05] tracking-tight mb-5">
            Let nothing slip.
          </h1>
          <p className="text-cream/60 text-sm sm:text-base max-w-xl mx-auto leading-relaxed mb-8">
            Every compliance record, rota and timesheet, captured automatically, stored securely, ready when you need it. Your next EHO visit? Already handled.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-5">
            <Link to="/signup" className="w-full sm:w-auto bg-accent text-cream px-7 py-3.5 rounded-xl text-sm font-semibold hover:bg-accent/90 active:scale-[0.98] transition-all text-center">
              Start Free Trial
            </Link>
            <a href="#pricing" className="w-full sm:w-auto border border-cream/20 text-cream/70 hover:text-cream hover:border-cream/40 px-7 py-3.5 rounded-xl text-sm font-medium transition-colors text-center">
              See Pricing
            </a>
          </div>
          <p className="text-cream/30 text-xs tracking-wide">7-day free trial · No card required</p>
        </div>
      </section>

      {/* ── App screenshots ───────────────────────────────────────────────────── */}
      <section className="bg-[#F5F4F1] border-b border-charcoal/8">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-14">
          <SectionLabel>See it in action</SectionLabel>
          <h2 className="text-2xl font-bold sm:text-3xl text-brand text-center mb-3 tracking-tight">
            Built for every screen your team uses
          </h2>
          <p className="text-charcoal/45 text-center max-w-lg mx-auto text-sm leading-relaxed mb-10">
            Manager dashboard, staff view and compliance records, all on one platform, any device.
          </p>
          <div className="flex flex-col sm:flex-row gap-5 items-end">
            <div className="sm:w-[195px] shrink-0">
              <StaffMobileScreen />
              <ScreenCaption>Staff view</ScreenCaption>
            </div>
            <div className="flex-1 min-w-0">
              <DesktopScreen />
              <ScreenCaption>Manager dashboard</ScreenCaption>
            </div>
            <div className="sm:w-[195px] shrink-0">
              <FridgeScreen />
              <ScreenCaption>Fridge checks</ScreenCaption>
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

      {/* ── Compliance features ───────────────────────────────────────────────── */}
      <section className="bg-white border-b border-charcoal/8">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-14">
          <SectionLabel>Compliance tools</SectionLabel>
          <h2 className="text-2xl font-bold sm:text-4xl text-brand text-center mb-4 tracking-tight">
            Everything the EHO expects to see
          </h2>
          <p className="text-charcoal/50 text-center max-w-lg mx-auto text-sm leading-relaxed mb-10">
            All the logs, checklists and records you legally need, captured on-device, stored securely, exportable in seconds.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {COMPLIANCE_FEATURES.map(f => <FeatureCard key={f.title} {...f} />)}
          </div>
        </div>
      </section>

      {/* ── Pro features ─────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 py-14">
        <div className="flex items-center gap-2.5 justify-center mb-3">
          <SectionLabel center={false}>Pro plan</SectionLabel>
          <span className="text-[10px] tracking-widest uppercase font-semibold px-2 py-0.5 rounded-full border bg-accent/10 text-accent border-accent/25 -mt-3">Pro</span>
        </div>
        <h2 className="text-2xl font-bold sm:text-4xl text-brand text-center mb-4 tracking-tight">
          Run your team. Stay compliant.
        </h2>
        <p className="text-charcoal/50 text-center max-w-lg mx-auto text-sm leading-relaxed mb-10">
          Managing even a small team? Pro replaces your rota tool, timesheet app and training tracker for less than £1 a day per venue.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PRO_FEATURES.map(f => <FeatureCard key={f.title} accent {...f} />)}
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────────── */}
      <section id="pricing" className="bg-white border-y border-charcoal/8">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-14">
          <SectionLabel>Pricing</SectionLabel>
          <h2 className="text-2xl font-bold sm:text-4xl text-brand text-center mb-4 tracking-tight">
            Simple, honest pricing
          </h2>
          <p className="text-charcoal/50 text-center max-w-md mx-auto text-sm leading-relaxed mb-10">
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
              <Link to="/signup?plan=starter" className="block text-center border border-brand/25 text-brand py-3 rounded-xl text-sm font-semibold hover:bg-brand/5 transition-colors">
                Start Free Trial
              </Link>
              <p className="text-[11px] text-charcoal/30 text-center mt-3">
                Need rotas? <Link to="/signup?plan=pro" className="text-accent font-medium hover:underline">Upgrade to Pro →</Link>
              </p>
            </div>

            {/* Pro */}
            <div className="rounded-2xl border-2 border-accent/30 bg-accent/[0.02] p-6 flex flex-col relative">
              <div className="absolute -top-3.5 inset-x-0 flex justify-center">
                <span className="bg-accent text-cream text-[10px] tracking-widest uppercase font-semibold px-3 py-1 rounded-full">Most Popular</span>
              </div>
              <p className="text-[11px] tracking-widest uppercase text-accent font-semibold mb-4">Pro</p>
              <div className="flex items-baseline gap-1.5 mb-1">
                <span className="text-3xl font-bold text-accent">{PRO_PRICE}</span>
                <span className="text-charcoal/40 text-sm">/month</span>
              </div>
              <p className="text-xs text-charcoal/35 mb-5">first venue · {EXTRA_VENUE_PRICE}/month each additional</p>
              <p className="text-xs text-charcoal/50 leading-relaxed mb-4">
                For any business that manages a team, it replaces your rota tool, timesheet app and training tracker - all in one place.
              </p>
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
                  ['Multi-venue, unlimited staff', false],
                ].map(([f, bold]) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-charcoal/60">
                    <span className="text-accent mt-0.5 shrink-0">{icons.check}</span>
                    {bold ? <strong className="text-charcoal/70">{f}</strong> : f}
                  </li>
                ))}
              </ul>
              <Link to="/signup?plan=pro" className="block text-center bg-accent text-cream py-3 rounded-xl text-sm font-semibold hover:bg-accent/90 active:scale-[0.98] transition-all">
                Start Free Trial
              </Link>
            </div>
          </div>
          <p className="text-center text-xs text-charcoal/30 mt-6">All plans include a 7-day free trial. No card required.</p>
        </div>
      </section>

      {/* ── How to install ────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 py-14">
        <SectionLabel>No App Store needed</SectionLabel>
        <h2 className="text-2xl font-bold sm:text-4xl text-brand text-center mb-4 tracking-tight">
          Up and running in 3 steps
        </h2>
        <p className="text-charcoal/50 text-center max-w-lg mx-auto text-sm leading-relaxed mb-10">
          Pelikn is a Progressive Web App. Install it directly from your browser, works just like a native app - even offline.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-3xl mx-auto">
          {[
            { step: '1', icon: icons.phone,    title: 'Open the link',      desc: 'Visit app.pelikn.app in Safari (iPhone/iPad) or Chrome (Android / desktop).' },
            { step: '2', icon: icons.share,    title: 'Add to home screen', desc: "Tap Share then 'Add to Home Screen' on iOS, or the menu then 'Install App' on Chrome." },
            { step: '3', icon: icons.download, title: 'Open like any app',  desc: "Pelikn appears on your home screen. Tap to open, no browser bar, no App Store." },
          ].map(({ step, icon, title, desc }) => (
            <div key={step} className="bg-white rounded-2xl border border-charcoal/8 p-6 text-center">
              <div className="w-11 h-11 rounded-2xl bg-brand text-cream flex items-center justify-center mx-auto mb-4">{icon}</div>
              <p className="text-[10px] tracking-widest uppercase text-charcoal/30 mb-1.5">Step {step}</p>
              <p className="text-sm font-semibold text-charcoal mb-2">{title}</p>
              <p className="text-xs text-charcoal/45 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────────── */}
      <section className="bg-white border-y border-charcoal/8">
        <div className="max-w-2xl mx-auto px-5 sm:px-8 py-14">
          <SectionLabel>Questions</SectionLabel>
          <h2 className="text-2xl font-bold sm:text-4xl text-brand text-center mb-8 tracking-tight">Frequently asked</h2>
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
          <h2 className="text-2xl font-bold sm:text-4xl text-cream mb-4 tracking-tight">Let nothing slip.</h2>
          <p className="text-cream/50 max-w-md mx-auto text-sm leading-relaxed mb-8">
            Start your free 7-day trial today. No credit card, no commitment. Better food safety records from day one.
          </p>
          <Link to="/signup" className="inline-block bg-accent text-cream px-8 py-4 rounded-xl text-sm font-semibold hover:bg-accent/90 active:scale-[0.98] transition-all">
            Start Free Trial - No Card Required
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-charcoal/8 bg-surface">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <PeliknLogo iconSize="w-6 h-6" textSize="text-xs" />
          <a href="mailto:hello@pelikn.app" className="text-xs text-charcoal/40 hover:text-charcoal transition-colors hidden sm:block">hello@pelikn.app</a>
          <div className="flex items-center gap-5">
            <Link to="/privacy" className="text-xs text-charcoal/35 hover:text-charcoal transition-colors">Privacy</Link>
            <Link to="/terms"   className="text-xs text-charcoal/35 hover:text-charcoal transition-colors">Terms</Link>
            <Link to="/login"   className="text-xs text-charcoal/35 hover:text-charcoal transition-colors">Sign In</Link>
          </div>
        </div>
        <div className="border-t border-charcoal/5 py-3 text-center">
          <p className="text-[11px] text-charcoal/20">© {new Date().getFullYear()} Pelikn · Registered with ICO · UK GDPR compliant</p>
        </div>
      </footer>

    </div>
  )
}
