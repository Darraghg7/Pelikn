import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  STARTER_PRICE, PRO_PRICE, EXTRA_VENUE_PRICE,
  PRO_PRICE_NUM, EXTRA_VENUE_PRICE_NUM,
  STARTER_ANNUAL, PRO_ANNUAL, EXTRA_VENUE_ANNUAL,
  PRO_ANNUAL_NUM, EXTRA_VENUE_ANNUAL_NUM,
} from '../../lib/pricing'

/* ─── Scroll-reveal ─────────────────────────────────────────────────────── */
function FadeUp({ children, delay = 0, className = '' }) {
  const ref = useRef(null)
  const [v, setV] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const ob = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setV(true); ob.disconnect() } }, { threshold: 0.08, rootMargin: '0px 0px -32px 0px' })
    ob.observe(el); return () => ob.disconnect()
  }, [])
  return (
    <div ref={ref} className={className} style={{ opacity: v ? 1 : 0, transform: v ? 'none' : 'translateY(24px)', transition: `opacity 0.6s cubic-bezier(.16,1,.3,1) ${delay}ms, transform 0.6s cubic-bezier(.16,1,.3,1) ${delay}ms` }}>
      {children}
    </div>
  )
}

/* ─── Logo ──────────────────────────────────────────────────────────────── */
function PeliknLogo({ size = 'sm', light = false }) {
  const ic = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9'
  const tx = size === 'sm' ? 'text-sm' : 'text-base'
  return (
    <div className="flex items-center gap-2.5">
      <img src="/icons/icon.svg" className={`${ic} rounded-xl`} alt="" />
      <span className={`${tx} font-semibold tracking-[0.18em] uppercase ${light ? 'text-cream' : 'text-brand'}`}>Pelikn</span>
    </div>
  )
}

/* ─── Inline SVG icon helper ────────────────────────────────────────────── */
const Ico = ({ d, size = 20, cls = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={cls}>
    {typeof d === 'string' ? <path d={d} /> : d}
  </svg>
)

/* ─── App mock screens ──────────────────────────────────────────────────── */
function MockDashboard() {
  return (
    <div className="rounded-2xl overflow-hidden bg-surface shadow-[0_32px_80px_rgba(0,0,0,0.28)] ring-1 ring-white/10">
      <div className="flex" style={{ minHeight: 460 }}>
        {/* Sidebar */}
        <div className="w-44 shrink-0 bg-brand flex flex-col">
          <div className="px-4 pt-4 pb-3.5 border-b border-cream/10">
            <div className="flex items-center gap-2">
              <img src="/icons/icon.svg" className="w-5 h-5 rounded-lg" alt="" />
              <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-cream">Pelikn</span>
            </div>
            <p className="text-[10px] text-cream/30 mt-1.5 truncate">The Canteen</p>
          </div>
          <nav className="py-3 flex flex-col gap-0.5">
            {[
              { label: 'Dashboard', active: true,  icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10' },
              { label: 'Checks',   active: false, icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2 M9 3h6v4H9z m0 9l2 2 4-4' },
              { label: 'Rota',     active: false, icon: 'M3 4h18v18H3z M16 2v4 M8 2v4 M3 10h18 M8 14h.01 M12 14h.01 M16 14h.01' },
              { label: 'Team',     active: false, icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 7a4 4 0 100 8 4 4 0 000-8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75' },
            ].map(({ label, active, icon }) => (
              <div key={label} className={`mx-2 flex items-center gap-2.5 px-2.5 py-2 rounded-xl ${active ? 'bg-cream/12' : ''}`}>
                <Ico d={icon} size={16} cls={active ? 'text-cream' : 'text-cream/35'} />
                <span className={`text-[11px] font-medium ${active ? 'text-cream' : 'text-cream/40'}`}>{label}</span>
              </div>
            ))}
          </nav>
        </div>
        {/* Main */}
        <div className="flex-1 p-5 overflow-hidden">
          <div className="mb-4">
            <p className="text-[10px] tracking-widest uppercase text-charcoal/35">Mon 28 Apr</p>
            <h3 className="text-lg font-bold text-charcoal leading-tight">Good morning, James</h3>
          </div>
          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-2.5 mb-4">
            {[{ n: '92%', label: 'Compliance', color: 'text-[#16a34a]' }, { n: '4', label: 'On shift', color: 'text-charcoal' }, { n: '1', label: 'Overdue', color: 'text-[#ea580c]' }].map(({ n, label, color }) => (
              <div key={label} className="bg-white rounded-xl border border-charcoal/8 py-3 text-center">
                <p className={`text-xl font-bold ${color}`}>{n}</p>
                <p className="text-[10px] text-charcoal/40 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          {/* Fridge temps */}
          <div className="bg-white rounded-xl border border-charcoal/8 p-3.5 mb-2.5">
            <p className="text-[10px] tracking-widest uppercase text-charcoal/30 mb-2.5">Fridge Temperatures</p>
            {[['Walk-in', '2°C'], ['Sandwich', '4°C'], ['Display', '3°C']].map(([n, t]) => (
              <div key={n} className="flex items-center justify-between py-1.5 border-b border-charcoal/5 last:border-0">
                <p className="text-[11px] text-charcoal/55">{n}</p>
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-bold text-brand font-mono">{t}</p>
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#dcfce7] text-[#16a34a]">✓</span>
                </div>
              </div>
            ))}
          </div>
          {/* Tasks */}
          <div className="bg-white rounded-xl border border-charcoal/8 overflow-hidden">
            <p className="text-[10px] tracking-widest uppercase text-charcoal/30 px-3.5 pt-3 pb-2">Today's tasks</p>
            {[
              { l: 'Opening checks', s: 'Complete · Sarah', ok: true },
              { l: 'Kitchen deep clean', s: 'Overdue · Tom', ok: false },
              { l: 'Delivery check', s: 'Complete · Sarah', ok: true },
            ].map(({ l, s, ok }) => (
              <div key={l} className={`flex items-center border-l-[3px] pl-3.5 pr-4 py-2.5 ${ok ? 'border-l-[#16a34a]' : 'border-l-[#ea580c] bg-[#ea580c]/[0.02]'}`}>
                <div>
                  <p className="text-[11px] font-medium text-charcoal">{l}</p>
                  <p className="text-[10px] text-charcoal/40">{s}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function MockTempLog() {
  return (
    <div className="rounded-2xl overflow-hidden bg-white shadow-[0_24px_56px_rgba(0,0,0,0.16)] ring-1 ring-charcoal/8 w-full max-w-[260px]">
      <div className="bg-brand px-4 py-3.5">
        <p className="text-[10px] tracking-widest uppercase text-cream/40">Temperature Log</p>
        <p className="text-sm font-semibold text-cream mt-0.5">Walk-in Fridge</p>
      </div>
      <div className="p-4">
        <div className="text-center py-5 border-2 border-brand/20 rounded-xl mb-4 bg-brand/[0.03]">
          <p className="text-5xl font-bold text-brand font-mono tracking-tight">2<span className="text-2xl">°C</span></p>
          <p className="text-xs text-[#16a34a] font-medium mt-1.5">Within range (1–8°C)</p>
        </div>
        <div className="space-y-2 mb-4">
          {[{ l: 'Fridge', v: 'Walk-in' }, { l: 'Logged by', v: 'Sarah' }, { l: 'Time', v: '08:14' }].map(({ l, v }) => (
            <div key={l} className="flex justify-between">
              <p className="text-[11px] text-charcoal/40">{l}</p>
              <p className="text-[11px] font-medium text-charcoal">{v}</p>
            </div>
          ))}
        </div>
        <button className="w-full bg-brand text-cream py-2.5 rounded-xl text-xs font-semibold">Save record →</button>
      </div>
    </div>
  )
}

function MockRota() {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const staff = [
    { name: 'Sarah', colour: '#4f7c5a', shifts: [1,1,0,1,0,1,0] },
    { name: 'Tom',   colour: '#7c5a4f', shifts: [0,1,1,0,1,1,0] },
    { name: 'Priya', colour: '#5a4f7c', shifts: [1,0,1,1,0,0,1] },
    { name: 'Jamie', colour: '#4f6b7c', shifts: [0,1,0,1,1,0,1] },
  ]
  return (
    <div className="rounded-2xl overflow-hidden bg-white shadow-[0_24px_56px_rgba(0,0,0,0.14)] ring-1 ring-charcoal/8 w-full">
      <div className="bg-brand px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] tracking-widest uppercase text-cream/35">Week 28 Apr – 4 May</p>
          <p className="text-sm font-semibold text-cream mt-0.5">Rota</p>
        </div>
        <button className="bg-cream/15 text-cream text-[10px] font-semibold px-3 py-1.5 rounded-lg border border-cream/20">Publish</button>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-8 gap-1 mb-3">
          <div />
          {days.map((d, i) => (
            <div key={i} className={`text-center text-[9px] font-bold tracking-wide py-1.5 rounded-lg ${i === 0 ? 'bg-brand/10 text-brand' : 'text-charcoal/35'}`}>{d}</div>
          ))}
        </div>
        {staff.map(({ name, colour, shifts }) => (
          <div key={name} className="grid grid-cols-8 gap-1 mb-2 items-center">
            <p className="text-[10px] font-medium text-charcoal/55 truncate pr-1">{name}</p>
            {shifts.map((on, i) => (
              <div key={i} className="rounded-md py-2.5" style={{ backgroundColor: on ? colour + '22' : 'transparent', border: on ? `1px solid ${colour}33` : '1px solid transparent' }}>
                {on === 1 && <div className="w-1.5 h-1.5 rounded-full mx-auto" style={{ backgroundColor: colour }} />}
              </div>
            ))}
          </div>
        ))}
        <div className="mt-4 pt-3.5 border-t border-charcoal/8 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-charcoal/35">This week</p>
            <p className="text-sm font-bold text-charcoal">12 shifts · 94 hrs</p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#16a34a]" />
            <p className="text-[11px] text-charcoal/50">All staff notified</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── FAQ ───────────────────────────────────────────────────────────────── */
function Faq({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-charcoal/8 last:border-0">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between py-5 text-left gap-4 cursor-pointer">
        <span className="text-sm font-medium text-charcoal">{q}</span>
        <span className="shrink-0 text-charcoal/30 transition-transform duration-300" style={{ transform: open ? 'rotate(180deg)' : 'none' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </span>
      </button>
      {open && <p className="text-sm text-charcoal/50 pb-5 leading-relaxed">{a}</p>}
    </div>
  )
}

/* ─── Pricing ───────────────────────────────────────────────────────────── */
function Pricing() {
  const [annual, setAnnual] = useState(false)
  const sp = annual ? STARTER_ANNUAL : STARTER_PRICE
  const pp = annual ? PRO_ANNUAL : PRO_PRICE
  const ep = annual ? EXTRA_VENUE_ANNUAL : EXTRA_VENUE_PRICE
  const ppn = annual ? PRO_ANNUAL_NUM : PRO_PRICE_NUM
  const epn = annual ? EXTRA_VENUE_ANNUAL_NUM : EXTRA_VENUE_PRICE_NUM
  const sfx = annual ? '/yr' : '/mo'
  const check = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>

  return (
    <section id="pricing" className="bg-[#f5f4f1]">
      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-24 sm:py-32">
        <FadeUp>
          <h2 className="text-4xl sm:text-5xl font-bold text-charcoal tracking-tight leading-tight mb-3">
            One price.<br className="sm:hidden" /> No surprises.
          </h2>
          <p className="text-charcoal/45 text-base mb-10 max-w-sm leading-relaxed">
            No per-user fees. No extra charges. Cancel whenever.
          </p>
        </FadeUp>
        <FadeUp delay={60}>
          <div className="inline-flex items-center bg-white rounded-xl p-1 gap-1 mb-10 shadow-sm border border-charcoal/8">
            {[['Monthly', false], ['Annual', true]].map(([label, val]) => (
              <button key={label} onClick={() => setAnnual(val)} className={`text-sm font-medium px-5 py-2.5 rounded-lg transition-all cursor-pointer flex items-center gap-2 ${annual === val ? 'bg-brand text-cream shadow-sm' : 'text-charcoal/45 hover:text-charcoal'}`}>
                {label}
                {label === 'Annual' && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${annual ? 'bg-white/20 text-cream' : 'bg-accent/10 text-accent'}`}>2 mo. free</span>}
              </button>
            ))}
          </div>
        </FadeUp>
        <div className="grid sm:grid-cols-2 gap-5 max-w-2xl">
          <FadeUp delay={80}>
            <div className="bg-white rounded-2xl border-2 border-accent/30 p-7 flex flex-col h-full relative">
              <span className="absolute -top-3.5 left-6 bg-accent text-cream text-[10px] tracking-widest uppercase font-semibold px-3 py-1 rounded-full">Most popular</span>
              <p className="text-[10px] tracking-widest uppercase text-accent font-semibold mb-4 mt-1">Pro</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-bold text-charcoal">{pp}</span>
                <span className="text-charcoal/35 text-sm">{sfx}</span>
              </div>
              <p className="text-xs text-charcoal/35 mb-1">first venue · {ep}{sfx} each extra</p>
              {annual && <p className="text-xs font-medium text-accent mb-1">Save £50 vs monthly</p>}
              <div className="bg-[#f8f8f6] rounded-xl p-4 my-5">
                <p className="text-[10px] tracking-widest uppercase text-charcoal/30 mb-3">As you grow</p>
                {[1, 2, 3, 5].map(n => (
                  <div key={n} className="flex justify-between py-1">
                    <span className="text-xs text-charcoal/45">{n} venue{n > 1 ? 's' : ''}</span>
                    <span className="text-xs font-semibold text-charcoal">£{ppn + (n - 1) * epn}{sfx}</span>
                  </div>
                ))}
              </div>
              <ul className="flex flex-col gap-2.5 mb-7 flex-1">
                {['Everything in Starter', 'Rota builder + AI auto-fill', 'Timesheets & payroll export', 'Clock in/out & break tracking', 'Training records & expiry alerts', 'Staff time off & shift swaps', 'Tip distribution', 'Multi-venue, unlimited staff'].map((f, i) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-charcoal/60">
                    <span className="text-accent mt-0.5 shrink-0">{check()}</span>
                    {i === 0 ? <strong className="text-charcoal/75">{f}</strong> : f}
                  </li>
                ))}
              </ul>
              <Link to="/signup?plan=pro" className="block text-center bg-accent text-cream py-3.5 rounded-xl text-sm font-semibold hover:bg-accent/90 active:scale-[0.98] transition-all cursor-pointer">
                Start free trial
              </Link>
            </div>
          </FadeUp>
          <FadeUp delay={140}>
            <div className="bg-white rounded-2xl border border-charcoal/10 p-7 flex flex-col h-full">
              <p className="text-[10px] tracking-widest uppercase text-brand font-semibold mb-4">Starter</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-bold text-charcoal">{sp}</span>
                <span className="text-charcoal/35 text-sm">{sfx}</span>
              </div>
              <p className="text-xs text-charcoal/35 mb-1">per venue</p>
              {annual && <p className="text-xs font-medium text-accent mb-1">Save £20 vs monthly</p>}
              <p className="text-xs text-charcoal/50 leading-relaxed my-5">Everything you need to stay compliant and get off paper.</p>
              <ul className="flex flex-col gap-2.5 mb-7 flex-1">
                {['Temperature logs (fridge, cooking, hot-holding)', 'Cleaning schedules & records', "Allergen registry (Natasha's Law)", 'Delivery checks', 'Opening & closing checklists', 'Document vault', 'Compliance PDF exports'].map(f => (
                  <li key={f} className="flex items-start gap-2 text-xs text-charcoal/60">
                    <span className="text-[#16a34a] mt-0.5 shrink-0">{check()}</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/signup?plan=starter" className="block text-center border border-brand/25 text-brand py-3.5 rounded-xl text-sm font-semibold hover:bg-brand/4 transition-colors cursor-pointer">
                Start free trial
              </Link>
            </div>
          </FadeUp>
        </div>
        <p className="text-xs text-charcoal/30 mt-6">7-day free trial · No card required to start</p>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════════════════════════════════ */
export default function MarketingPage() {
  return (
    <div className="min-h-dvh font-sans text-charcoal bg-white overflow-x-hidden">

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-charcoal/6">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 h-14 flex items-center justify-between">
          <PeliknLogo />
          <div className="flex items-center gap-1">
            <Link to="/login" className="text-sm font-medium text-charcoal/45 hover:text-charcoal transition-colors px-4 py-2 rounded-lg cursor-pointer">Sign in</Link>
            <Link to="/signup" className="text-sm font-semibold text-cream bg-brand hover:bg-brand/85 transition-colors px-4 py-2 rounded-xl cursor-pointer">Free trial</Link>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="bg-brand relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 60%)' }} />
        </div>

        <div className="max-w-5xl mx-auto px-6 sm:px-10 pt-20 sm:pt-28 pb-0 relative">
          <div className="max-w-2xl mb-8" style={{ animation: 'pelikn-figma-brand 0.55s ease-out both' }}>
            <h1 className="text-5xl sm:text-6xl lg:text-[68px] font-bold text-cream leading-[1.02] tracking-tight mb-5">
              Run your venue.<br />
              <span className="text-cream/35">Not paperwork.</span>
            </h1>
            <p className="text-cream/55 text-base sm:text-lg max-w-md leading-relaxed">
              Compliance logs, rotas, timesheets, training — all in one app your whole team actually uses.
            </p>
          </div>

          <div className="flex items-center gap-5 mb-16" style={{ animation: 'pelikn-figma-brand 0.55s 100ms ease-out both' }}>
            <Link to="/signup" className="bg-accent text-cream px-7 py-3.5 rounded-xl text-sm font-semibold hover:bg-accent/90 active:scale-[0.98] transition-all cursor-pointer">
              Start free — 7 days
            </Link>
            <a href="#how-it-works" className="text-cream/45 text-sm font-medium hover:text-cream/70 transition-colors cursor-pointer flex items-center gap-1.5">
              See how it works
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
            </a>
          </div>

          <div style={{ animation: 'pelikn-figma-form 0.65s 120ms ease-out both' }}>
            <MockDashboard />
          </div>
        </div>
      </section>

      {/* ── "Replaces" strip ─────────────────────────────────────────────────── */}
      <div className="bg-[#f5f4f1] border-b border-charcoal/6">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-5">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <span className="text-xs font-medium text-charcoal/30 tracking-wide">Replaces your</span>
            {['Rota spreadsheet', 'WhatsApp group', 'Paper temperature logs', 'Training folder', 'Tip calculator'].map(item => (
              <div key={item} className="flex items-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#16a34a] shrink-0"><polyline points="20 6 9 17 4 12" /></svg>
                <span className="text-sm text-charcoal/55 font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Compliance deep dive ─────────────────────────────────────────────── */}
      <section id="how-it-works" className="bg-white">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-24 sm:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <FadeUp>
                <span className="inline-block text-[10px] tracking-widest uppercase text-brand font-semibold bg-brand/8 px-3 py-1.5 rounded-full mb-6">Food safety</span>
                <h2 className="text-4xl sm:text-5xl font-bold text-charcoal tracking-tight leading-tight mb-5">
                  If the EHO walked<br />in today — would<br />you be ready?
                </h2>
                <p className="text-charcoal/45 text-base leading-relaxed mb-8 max-w-sm">
                  Every fridge temp, cleaning record, allergen check and delivery sign-off is captured on-device and stored as a proper audit trail. One tap exports a PDF formatted exactly how an inspector expects it.
                </p>
              </FadeUp>
              <div className="flex flex-col gap-5">
                {[
                  { title: 'Temperature logs', desc: 'Fridge, cooking, reheating and hot holding — with automatic pass/fail detection.' },
                  { title: 'Cleaning schedules', desc: 'Daily, weekly and ad-hoc tasks. Live completion status, no asking around.' },
                  { title: "Allergen registry", desc: "All 14 allergens across every dish on your menu. Natasha's Law compliant." },
                  { title: 'Audit-ready exports', desc: 'One tap to a full compliance PDF. Everything formatted, timestamped and signed.' },
                ].map(({ title, desc }, i) => (
                  <FadeUp key={title} delay={i * 50}>
                    <div className="flex gap-4 group">
                      <div className="w-1 rounded-full bg-brand/15 group-hover:bg-brand/40 transition-colors shrink-0 mt-1" style={{ minHeight: 40 }} />
                      <div>
                        <p className="text-sm font-semibold text-charcoal mb-0.5">{title}</p>
                        <p className="text-sm text-charcoal/45 leading-relaxed">{desc}</p>
                      </div>
                    </div>
                  </FadeUp>
                ))}
              </div>
              <FadeUp delay={220}>
                <Link to="/signup" className="inline-flex items-center gap-2 bg-brand text-cream px-6 py-3 rounded-xl text-sm font-semibold hover:bg-brand/85 transition-colors mt-8 cursor-pointer">
                  Start free trial
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </Link>
              </FadeUp>
            </div>
            <FadeUp delay={100} className="flex justify-center lg:justify-end">
              <MockTempLog />
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ── Team management — dark section ──────────────────────────────────── */}
      <section className="bg-charcoal">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-24 sm:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <FadeUp className="order-2 lg:order-1">
              <MockRota />
            </FadeUp>
            <div className="order-1 lg:order-2">
              <FadeUp>
                <span className="inline-block text-[10px] tracking-widest uppercase text-accent font-semibold bg-accent/12 px-3 py-1.5 rounded-full mb-6">Team &amp; scheduling · Pro</span>
                <h2 className="text-4xl sm:text-5xl font-bold text-cream tracking-tight leading-tight mb-5">
                  Stop managing<br />your team over<br />WhatsApp.
                </h2>
                <p className="text-cream/40 text-base leading-relaxed mb-8 max-w-sm">
                  Build the rota in minutes, publish it, done. Staff get a notification. Requests come through the app. Timesheets write themselves. You stop being the middleman.
                </p>
              </FadeUp>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { n: 'Rota builder',  d: 'Drag or let AI auto-fill from your patterns' },
                  { n: 'Timesheets',    d: 'Staff clock in/out on the app, exports to payroll' },
                  { n: 'Time off',      d: 'Requests, approvals and shift swaps in-app' },
                  { n: 'Training',      d: 'Certs and expiry dates — 30-day alerts before lapses' },
                  { n: 'Tips',          d: 'Enter the pot, set the split, done. Full audit trail' },
                  { n: 'Multi-venue',   d: 'One login for every site you run' },
                ].map(({ n, d }, i) => (
                  <FadeUp key={n} delay={i * 45}>
                    <div className="border border-cream/8 rounded-xl p-4 hover:border-cream/18 transition-colors">
                      <p className="text-sm font-semibold text-cream mb-1">{n}</p>
                      <p className="text-xs text-cream/35 leading-relaxed">{d}</p>
                    </div>
                  </FadeUp>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stat moment ─────────────────────────────────────────────────────── */}
      <section className="bg-brand">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-24">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-0 sm:divide-x sm:divide-cream/15">
            {[
              { n: '15 min', label: 'Average setup time',  sub: 'From sign-up to first check logged' },
              { n: '5 apps', label: 'Replaced by one',     sub: 'Rota, compliance, timesheets, training, tips' },
              { n: '100%',   label: 'On your phone',       sub: 'No app store. Install from your browser in seconds' },
            ].map(({ n, label, sub }, i) => (
              <FadeUp key={n} delay={i * 60} className="sm:px-12 first:pl-0 last:pr-0">
                <p className="text-4xl font-bold text-cream mb-2">{n}</p>
                <p className="text-sm font-semibold text-cream/70 mb-1">{label}</p>
                <p className="text-xs text-cream/35 leading-relaxed">{sub}</p>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature teaser grid ─────────────────────────────────────────────── */}
      <section className="bg-[#f5f4f1]">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-24 sm:py-32">
          <FadeUp>
            <h2 className="text-4xl sm:text-5xl font-bold text-charcoal tracking-tight leading-tight mb-3">
              There's a lot<br />more inside.
            </h2>
            <p className="text-charcoal/40 text-base leading-relaxed mb-12 max-w-sm">
              A glimpse at what's waiting once you're in.
            </p>
          </FadeUp>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {[
              { icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', title: 'Document vault',      desc: 'Store certificates, policies and records in one place.' },
              { icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 7a4 4 0 100 8 4 4 0 000-8z',   title: 'Staff profiles',     desc: 'Contact details, roles, certifications and notes.' },
              { icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2 M9 3h6v4H9z', title: 'Incident log',       desc: 'Record anything that happens — timestamped and signed.' },
              { icon: 'M22 12h-4l-3 9L9 3l-3 9H2',                                                title: 'Probe calibration',  desc: 'Scheduled records with pass/fail. Inspection-proof.' },
              { icon: 'M5 12h14 M12 5l7 7-7 7',                                                    title: 'Delivery checks',    desc: 'Temp reading, condition notes, signed on arrival.' },
              { icon: 'M3 4h18v18H3z M16 2v4 M8 2v4 M3 10h18',                                    title: 'Opening checklists', desc: 'Start every shift the same way. Nothing skipped.' },
            ].map(({ icon, title, desc }, i) => (
              <FadeUp key={title} delay={i * 35}>
                <div className="bg-white rounded-2xl border border-charcoal/8 p-5 sm:p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.07)] hover:-translate-y-0.5 transition-all duration-200 h-full">
                  <div className="w-9 h-9 rounded-xl bg-brand/8 text-brand flex items-center justify-center mb-4">
                    <Ico d={icon} size={18} />
                  </div>
                  <p className="text-sm font-semibold text-charcoal mb-1.5">{title}</p>
                  <p className="text-xs text-charcoal/45 leading-relaxed">{desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>

          <FadeUp delay={200}>
            <p className="text-xs text-charcoal/30 mt-8 text-center">And more — sign up to explore everything at your own pace.</p>
          </FadeUp>
        </div>
      </section>

      {/* ── Install ─────────────────────────────────────────────────────────── */}
      <section className="bg-white">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-24 sm:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <FadeUp>
              <h2 className="text-4xl sm:text-5xl font-bold text-charcoal tracking-tight leading-tight mb-5">
                Live in<br />15 minutes.
              </h2>
              <p className="text-charcoal/45 text-base leading-relaxed mb-8 max-w-sm">
                No app store. No IT department. Open it in your browser, install it to your home screen, and it works exactly like a native app — offline included.
              </p>
              <Link to="/signup" className="inline-flex items-center gap-2 bg-brand text-cream px-6 py-3 rounded-xl text-sm font-semibold hover:bg-brand/85 transition-colors cursor-pointer">
                Get started free
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </Link>
            </FadeUp>
            <div className="flex flex-col gap-4">
              {[
                { n: '01', title: 'Sign up',               desc: 'Create your account and set up your venue — takes about five minutes.' },
                { n: '02', title: 'Install on any device',  desc: "Open app.pelikn.app in Safari or Chrome. Tap 'Add to Home Screen'. Done." },
                { n: '03', title: 'Invite your team',       desc: "Send invite links. Staff install the app and they're ready to go." },
              ].map(({ n, title, desc }, i) => (
                <FadeUp key={n} delay={i * 60}>
                  <div className="flex gap-5 items-start">
                    <div className="text-2xl font-black text-charcoal/8 tabular-nums shrink-0 w-10">{n}</div>
                    <div className="border-t border-charcoal/10 pt-4 flex-1">
                      <p className="text-sm font-semibold text-charcoal mb-1">{title}</p>
                      <p className="text-sm text-charcoal/45 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────────── */}
      <Pricing />

      {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
      <section className="bg-white">
        <div className="max-w-2xl mx-auto px-6 sm:px-10 py-24 sm:py-28">
          <FadeUp>
            <h2 className="text-3xl font-bold text-charcoal tracking-tight mb-10">Common questions</h2>
          </FadeUp>
          <FadeUp delay={60}>
            <div className="border-t border-charcoal/8">
              {[
                { q: 'Is this on the App Store?', a: "No — intentionally. Pelikn is a Progressive Web App. Install it from Safari or Chrome in about 30 seconds. It lives on your home screen, works offline, and behaves like any native app. No app store approval, no mandatory updates." },
                { q: 'Does it work on iPhone, iPad and Android?', a: "Yes, all of them. Install from Safari on iOS/iPadOS, or Chrome on Android. Desktop works in any browser — no install needed." },
                { q: "What's the difference between Starter and Pro?", a: "Starter covers everything on the compliance side — temperature logs, cleaning records, allergens, checklists, exports. Pro adds the whole team layer: rotas, timesheets, clock in/out, training records, tips, and time off management." },
                { q: 'What counts as a venue?', a: "Each physical location is a venue. The first venue on Pro is £25/mo, each additional is £15/mo. Starter is £10/venue. You can add and remove venues at any time." },
                { q: 'Is my data secure?', a: "All data is stored in a UK-based database with row-level security — staff only ever see their own venue's data. We're ICO registered under UK GDPR." },
                { q: 'Can I cancel?', a: "Whenever you like. No contracts, no cancellation fees. Cancel in settings and you keep access until the end of the billing period." },
              ].map(({ q, a }) => <Faq key={q} q={q} a={a} />)}
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────────── */}
      <section className="bg-brand">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-24 sm:py-32">
          <FadeUp>
            <h2 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-cream tracking-tight leading-[1.02] mb-5 max-w-2xl">
              Your whole venue<br />in one app.
            </h2>
            <p className="text-cream/40 text-base leading-relaxed mb-10 max-w-sm">
              7 days free. No card. Takes 15 minutes to set up.
            </p>
            <div className="flex flex-col sm:flex-row items-start gap-3">
              <Link to="/signup" className="bg-accent text-cream px-8 py-4 rounded-xl text-sm font-semibold hover:bg-accent/90 active:scale-[0.98] transition-all text-center cursor-pointer">
                Start free trial
              </Link>
              <a href="mailto:hello@pelikn.app" className="border border-cream/18 text-cream/45 hover:text-cream/65 hover:border-cream/30 px-8 py-4 rounded-xl text-sm font-medium transition-colors text-center cursor-pointer">
                Get in touch
              </a>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-charcoal/8">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <PeliknLogo />
          <a href="mailto:hello@pelikn.app" className="text-xs text-charcoal/35 hover:text-charcoal transition-colors">hello@pelikn.app</a>
          <div className="flex items-center gap-6">
            {[['Privacy', '/privacy'], ['Terms', '/terms'], ['Sign in', '/login']].map(([l, h]) => (
              <Link key={l} to={h} className="text-xs text-charcoal/35 hover:text-charcoal transition-colors cursor-pointer">{l}</Link>
            ))}
          </div>
        </div>
        <div className="border-t border-charcoal/5 py-3 text-center">
          <p className="text-[11px] text-charcoal/18">© {new Date().getFullYear()} <span className="font-semibold tracking-[0.18em] uppercase">Pelikn</span> · ICO registered · UK GDPR compliant</p>
        </div>
      </footer>

    </div>
  )
}
