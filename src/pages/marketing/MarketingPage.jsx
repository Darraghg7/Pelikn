import React, { useState, useEffect, useRef } from 'react'
import Logo from '../../components/ui/Logo'
import { Link } from 'react-router-dom'
import {
  STARTER_PRICE, PRO_PRICE, EXTRA_VENUE_PRICE,
  PRO_PRICE_NUM, EXTRA_VENUE_PRICE_NUM,
  STARTER_ANNUAL, PRO_ANNUAL, EXTRA_VENUE_ANNUAL,
  PRO_ANNUAL_NUM, EXTRA_VENUE_ANNUAL_NUM,
} from '../../lib/pricing'
import { STARTER_FEATURES, PRO_FEATURES, PLAN_ORDER, PLAN_DETAILS, STARTER_STAFF_LIMIT } from '../../lib/plans'
import { PLANS } from '../../lib/constants'
import DesktopDashboardMock, { BrowserFrame, ScaledCanvas } from './DesktopDashboardMock'
import useForceLight from '../../hooks/useForceLight'
import { colors, alpha, white, black, radius } from '../../lib/tokens'

/* ─── Type ──────────────────────────────────────────────────────────────────
   Big, light, tightly-tracked headlines carry the whole page (the scale is
   deliberately outside the app's type scale: this is the one public page).
   Sizes are fluid so the same line works on a phone and a 27" screen.      */
const HUGE = { fontSize: 'clamp(54px, 11vw, 176px)', lineHeight: 0.9, letterSpacing: '-0.055em', fontWeight: 500 }
const BIG  = { fontSize: 'clamp(40px, 7vw, 112px)',  lineHeight: 0.95, letterSpacing: '-0.05em',  fontWeight: 500 }
const MID  = { fontSize: 'clamp(32px, 4.6vw, 72px)', lineHeight: 1,    letterSpacing: '-0.045em', fontWeight: 500 }

const PILL = 'inline-flex items-center justify-center rounded-full font-medium transition-all duration-200 active:scale-[0.97] cursor-pointer whitespace-nowrap'
const PILL_LG = `${PILL} text-body-lg px-8 py-4`

/* ─── Keyframes ─────────────────────────────────────────────────────────── */
function GlobalCSS() {
  return (
    <style>{`
      @keyframes pkIn {
        from { opacity:0; transform:translateY(24px); }
        to   { opacity:1; transform:translateY(0); }
      }
      @keyframes pkRise {
        from { opacity:0; transform:translateY(120px); }
        to   { opacity:1; transform:translateY(0); }
      }
      @keyframes pkFloat {
        0%,100% { transform:translateY(0); }
        50%     { transform:translateY(-10px); }
      }
      @keyframes pkMarquee {
        from { transform:translateX(0); }
        to   { transform:translateX(-50%); }
      }
      .pk-marquee-track { animation: pkMarquee 40s linear infinite; }
      .pk-float   { animation: pkFloat 6s ease-in-out infinite; }
      .pk-float-b { animation: pkFloat 7.5s ease-in-out -2s infinite; }
      .pk-float-c { animation: pkFloat 6.8s ease-in-out -4s infinite; }
      @media (prefers-reduced-motion: reduce) {
        .pk-marquee-track { animation: none; white-space: normal; flex-wrap: wrap; }
        .pk-marquee-dup { display: none; }
        .pk-float, .pk-float-b, .pk-float-c { animation: none; }
        .pk-rise { animation: none !important; }
      }
    `}</style>
  )
}

/* ─── Scroll-reveal ─────────────────────────────────────────────────────── */
function FadeUp({ children, delay = 0, className = '' }) {
  const ref = useRef(null)
  const [v, setV] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const ob = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setV(true); ob.disconnect() } },
      { threshold: 0.08, rootMargin: '0px 0px -24px 0px' }
    )
    ob.observe(el); return () => ob.disconnect()
  }, [])
  return (
    <div ref={ref} className={className} style={{ opacity: v ? 1 : 0, transform: v ? 'none' : 'translateY(28px)', transition: `opacity 0.8s cubic-bezier(.16,1,.3,1) ${delay}ms, transform 0.8s cubic-bezier(.16,1,.3,1) ${delay}ms` }}>
      {children}
    </div>
  )
}

/* A sentence that lights up word by word as you scroll through it. */
function ScrollWords({ text, className = '', style }) {
  const ref = useRef(null)
  const [p, setP] = useState(0)
  const words = text.split(' ')
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setP(1); return }
    let raf = 0
    const tick = () => {
      raf = 0
      const el = ref.current; if (!el) return
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      // 0 when the block's top sits at 85% of the screen, 1 once its bottom reaches 35%
      setP(Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (vh * 0.5 + r.height))))
    }
    const on = () => { if (!raf) raf = requestAnimationFrame(tick) }
    tick()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); if (raf) cancelAnimationFrame(raf) }
  }, [])
  return (
    <p ref={ref} className={className} style={style}>
      {words.map((w, i) => {
        const a = Math.min(1, Math.max(0, p * (words.length + 4) - i))
        return <span key={i} style={{ opacity: 0.16 + a * 0.84, transition: 'opacity 0.25s linear' }}>{w}{' '}</span>
      })}
    </p>
  )
}

/* ─── iPhone frame ──────────────────────────────────────────────────────── */
// The phone mock-ups are pictures: hidden from screen readers, nothing focusable.
function IPhoneFrame({ children }) {
  return (
    <div
      aria-hidden="true"
      className="relative shrink-0"
      style={{ width:300, background:colors.charcoal, borderRadius:52, padding:14, boxShadow:`0 50px 100px ${black(0.35)}, inset 0 0 0 1.5px ${white(0.13)}` }}
    >
      <div style={{ position:'absolute', right:-3, top:100, width:3, height:34, background:colors.ink2, borderRadius:'0 3px 3px 0' }}/>
      <div style={{ position:'absolute', left:-3, top:88,  width:3, height:26, background:colors.ink2, borderRadius:'3px 0 0 3px' }}/>
      <div style={{ position:'absolute', left:-3, top:122, width:3, height:26, background:colors.ink2, borderRadius:'3px 0 0 3px' }}/>
      <div style={{ position:'absolute', left:-3, top:156, width:3, height:52, background:colors.ink2, borderRadius:'3px 0 0 3px' }}/>
      <div style={{ borderRadius:40, overflow:'hidden', background:colors.surface, position:'relative', height:572 }}>
        <div style={{ position:'absolute', top:12, left:'50%', transform:'translateX(-50%)', width:100, height:28, background:colors.charcoal, borderRadius:radius.card, zIndex:10 }}/>
        {children}
      </div>
    </div>
  )
}

/* A phone drawn at any width (the frame is drawn at 300×600 and scaled). */
function Phone({ children, className = '', label = 'The Pelikn app on a phone' }) {
  return (
    <ScaledCanvas width={300} height={600} clip={false} label={label} className={className}>
      <IPhoneFrame>{children}</IPhoneFrame>
    </ScaledCanvas>
  )
}

/* A small floating status pill that sits on top of a phone. */
function Chip({ tone = 'paper', className = '', children }) {
  const tones = {
    paper: 'bg-paper text-charcoal',
    good:  'bg-goodBg text-good',
    dark:  'bg-charcoal text-cream',
    accent:'bg-accent text-cream',
  }
  return (
    <div aria-hidden="true" className={`absolute inline-flex items-center gap-2.5 whitespace-nowrap rounded-full px-4 py-2.5 text-body font-medium shadow-[0_18px_40px_theme(colors.black/18%)] ${tones[tone]} ${className}`}>
      {children}
    </div>
  )
}
const Tick = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
)

/* ─── SVG icon ──────────────────────────────────────────────────────────── */
const Ico = ({ d, size = 24, cls = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
    {typeof d === 'string' ? <path d={d} /> : d}
  </svg>
)

/* ══════════════════════════════════════════════════════════════════════════
   MOCK SCREENS — faithful to real screenshots, names anonymised
   ══════════════════════════════════════════════════════════════════════════ */

/* Mobile app chrome shared by the phone mocks */
function MockAppHeader() {
  return (
    <div className="bg-brand px-4 pt-14 pb-3 shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-micro font-bold text-cream tracking-widest">DEPOT</span>
          <div className="relative">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cream/60"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
            <div className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-accent rounded-full flex items-center justify-center">
              <span className="text-[7px] font-bold text-white">6</span>
            </div>
          </div>
        </div>
        <span className="text-[9px] text-cream/40 border border-cream/20 px-2 py-0.5 rounded-tag">Sign Out</span>
      </div>
    </div>
  )
}

const MOCK_NAV = [
  { label:'Home',     d:'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10' },
  { label:'Checks',   d:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2 M9 3h6v4H9z' },
  { label:'Team',     d:'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 7a4 4 0 100 8 4 4 0 000-8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75' },
  { label:'Tasks',    d:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2 M9 3h6v4H9z M9 12h6 M9 16h4' },
  { label:'Settings', d:'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z' },
]

function MockBottomNav({ active }) {
  return (
    <div className="bg-white border-t border-charcoal/8 flex justify-around px-1 pt-2 pb-3 shrink-0">
      {MOCK_NAV.map(({ label, d }) => {
        const on = label === active
        return (
          <div key={label} className="flex flex-col items-center gap-0.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={on?2.25:1.75} strokeLinecap="round" strokeLinejoin="round" className={on?'text-brand':'text-charcoal/30'}><path d={d}/></svg>
            <span className={`text-[7px] font-medium ${on?'text-brand':'text-charcoal/30'}`}>{label}</span>
          </div>
        )
      })}
    </div>
  )
}

/* Mobile checks hub — mirrors src/pages/compliance/ChecksHubPage.jsx (tiles sorted overdue → due → done) */
const MOCK_CHECK_TONE = {
  overdue: { icon:'bg-danger/10 text-danger',   text:'text-danger',       dot:'bg-danger' },
  due:     { icon:'bg-warning/10 text-warning', text:'text-warning',      dot:'bg-warning' },
  done:    { icon:'bg-success/10 text-success', text:'text-success',      dot:'bg-success' },
  na:      { icon:'bg-surface text-charcoal/55', text:'text-charcoal/55', dot:null },
}

function MockChecksHub() {
  const tiles = [
    { label:'Cleaning',       status:'overdue', sub:'2 overdue',      count:2, d:'M19.4 5 11 13.4M14 6l4 4M9.5 11.5 4 17v3h3l5.5-5.5' },
    { label:'Opening Checks', status:'due',     sub:'5/8 done',       count:3, d:'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10' },
    { label:'Fridge Temps',   status:'due',     sub:'1 unchecked',    count:1, d:'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z M5 10h14 M9 5v2 M9 13v3' },
    { label:'Deliveries',     status:'done',    sub:'2 logged',             d:'M1 3h15v13H1z M16 8h4l3 3v5h-7z M5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z' },
    { label:'Cooking Temps',  status:'done',    sub:'3 logged',             d:'M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z' },
    { label:'Allergens',      status:'na',      sub:'Up to date',           d:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 8v4 M12 16h.01' },
  ]
  return (
    <div className="bg-bg flex flex-col" style={{ width:272, height:572, overflow:'hidden' }}>
      <MockAppHeader />

      <div className="flex-1 overflow-hidden px-3 pt-3">
        {/* Title */}
        <div className="flex items-center justify-between">
          <span className="font-mono text-[8px] tracking-[0.08em] uppercase text-charcoal/50">Checks</span>
          <span className="font-mono text-[8px] font-semibold text-charcoal/50">Edit</span>
        </div>
        <p className="text-title-sm font-semibold tracking-[-0.028em] text-charcoal leading-tight mt-0.5 mb-2">Today's checks</p>

        {/* Today banner */}
        <div className="bg-brand rounded-control px-3 py-2.5 mb-2.5 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[7px] tracking-[0.1em] uppercase text-white/55 font-semibold">Today</p>
            <p className="text-caption font-semibold text-white tracking-[-0.015em] mt-0.5">6 checks need doing</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 font-mono text-[7px] font-semibold text-badDark"><span className="w-1 h-1 rounded-full bg-current"/>2 overdue</span>
              <span className="inline-flex items-center gap-1 font-mono text-[7px] font-semibold text-warnDark"><span className="w-1 h-1 rounded-full bg-current"/>4 due now</span>
            </div>
          </div>
          <span className="font-mono text-[7px] tracking-[0.06em] uppercase font-semibold text-white/85">View all ›</span>
        </div>

        {/* Tile grid */}
        <div className="grid grid-cols-2 gap-1.5">
          {tiles.map(({ label, status, sub, count, d }) => {
            const t = MOCK_CHECK_TONE[status]
            return (
              <div key={label} className={`bg-paper border rounded-control p-2 flex flex-col gap-1.5 min-h-[60px] ${status==='overdue'?'border-danger/30':'border-charcoal/10'}`}>
                <div className="flex items-start justify-between">
                  <span className={`w-[22px] h-[22px] rounded-tag flex items-center justify-center ${t.icon}`}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>
                  </span>
                  {count ? (
                    <span className={`min-w-[15px] h-[15px] px-1 rounded-full flex items-center justify-center font-mono text-[8px] font-semibold text-white ${t.dot}`}>{count}</span>
                  ) : status === 'done' ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className={t.text}><polyline points="20 6 9 17 4 12"/></svg>
                  ) : null}
                </div>
                <div className="mt-auto">
                  <p className="text-[10px] font-semibold tracking-[-0.01em] text-charcoal leading-tight">{label}</p>
                  <p className={`font-mono text-[7px] font-semibold uppercase tracking-[0.02em] mt-0.5 ${t.text}`}>{sub}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* EHO audit */}
        <div className="mt-2 bg-paper border border-charcoal/10 rounded-control px-2.5 py-2 flex items-center gap-2">
          <span className="w-[22px] h-[22px] rounded-tag bg-surface text-charcoal/75 flex items-center justify-center shrink-0">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/></svg>
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-charcoal">EHO Audit</p>
            <p className="text-[8px] text-charcoal/50">Compliance summary &amp; export</p>
          </div>
          <span className="text-charcoal/30 text-[10px]">›</span>
        </div>
      </div>

      <MockBottomNav active="Checks" />
    </div>
  )
}

/* Mobile staff home */
function MockMobileHome() {
  return (
    <div className="bg-surface flex flex-col" style={{ width:272, height:572, overflow:'hidden' }}>
      <MockAppHeader />

      {/* Scrollable content */}
      <div className="flex-1 overflow-hidden">
        {/* Greeting */}
        <div className="px-4 pt-3 pb-2">
          <p className="text-[9px] tracking-widest uppercase text-charcoal/35 mb-0.5">SATURDAY, 28 JUNE · 09:14</p>
          <p className="text-title-sm font-bold text-charcoal leading-tight">Good morning, James.</p>
          <p className="text-[9px] text-charcoal/40 mt-0.5">DEPOT <span className="inline-flex items-center gap-0.5 bg-accent/15 text-accent px-1 py-px rounded-tag text-[8px] font-semibold">PRO</span> · 9 of 22 daily checks complete</p>
        </div>

        {/* Needs You */}
        <div className="mx-3 mb-3 bg-white border border-charcoal/8 rounded-card overflow-hidden">
          <div className="px-3 py-2 border-b border-charcoal/6 flex items-center justify-between">
            <span className="text-[9px] font-bold tracking-widest text-charcoal/50 uppercase">NEEDS YOU</span>
            <span className="bg-accent text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">3</span>
          </div>
          <div className="flex items-center gap-0">
            <div className="w-0.5 self-stretch bg-accent shrink-0" />
            <div className="flex-1 px-3 py-2.5 flex items-center justify-between border-b border-charcoal/6">
              <span className="text-[10px] font-semibold text-accent">4 cleaning tasks overdue</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="stroke-charcoal/45"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </div>
          <div className="flex items-center gap-0">
            <div className="w-0.5 self-stretch bg-info shrink-0" />
            <div className="flex-1 px-3 py-2.5 flex items-center justify-between border-b border-charcoal/6">
              <span className="text-[10px] font-semibold text-info">2 leave requests pending</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="stroke-charcoal/45"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </div>
          <div className="flex items-center gap-0">
            <div className="w-0.5 self-stretch bg-brand shrink-0" />
            <div className="flex-1 px-3 py-2.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-brand">Fridge B temp not logged</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="stroke-charcoal/45"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </div>
        </div>

        {/* Today at a glance */}
        <div className="px-3 mb-3">
          <p className="text-[9px] tracking-widest uppercase text-charcoal/35 mb-2">TODAY AT A GLANCE</p>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label:'ON SHIFT',      val:'7',  sub:'on shift',   col:'text-charcoal' },
              { label:'CHECKS DONE',   val:'9',  sub:'complete',   col:'text-charcoal' },
              { label:'FRIDGES DUE',   val:'1',  sub:'due now',    col:'text-accent' },
              { label:'OVERDUE CLEANS',val:'4',  sub:'overdue',    col:'text-accent' },
              { label:'CRITICAL',      val:'0',  sub:'all clear',  col:'text-charcoal' },
              { label:'LEAVE',         val:'2',  sub:'pending',    col:'text-charcoal' },
            ].map(({ label, val, sub, col }) => (
              <div key={label} className="bg-white border border-charcoal/8 rounded-control p-2">
                <p className="text-[7px] tracking-wide uppercase text-charcoal/35 leading-tight mb-1">{label}</p>
                <p className={`text-title-sm font-bold leading-none ${col}`}>{val}</p>
                <p className="text-[7px] text-charcoal/40 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* My Clock */}
        <div className="mx-3 mb-3 bg-brand rounded-card p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] tracking-widest uppercase text-cream/40">MY CLOCK</span>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-goodDark" style={{ boxShadow:`0 0 5px ${colors.goodDark}` }}/>
              <span className="text-[8px] text-cream/60 font-medium">CLOCKED IN</span>
            </div>
          </div>
          <p className="text-display font-bold text-cream leading-none tracking-tight mb-2">09:14</p>
          <div className="flex items-center gap-4">
            {[['THIS WEEK','3h 12m'],['BREAK','–'],['LAST IN','Fri 14:00']].map(([k,v])=>(
              <div key={k}>
                <p className="text-[7px] text-cream/35 uppercase tracking-wide">{k}</p>
                <p className="text-[9px] font-semibold text-cream/80">{v}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <MockBottomNav active="Home" />
    </div>
  )
}

/* Mobile team hub */
function MockTeamHub() {
  const tiles = [
    { iBg:colors.accentBg, iCol:colors.accent, icon:'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',      label:'My Shifts',     sub:'3 SWAPS PENDING',        sCol:colors.accent,              badge:'3', bCol:colors.accent, check:false },
    { iBg:colors.accentBg, iCol:colors.accent, icon:'M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14',                label:'Time Off',      sub:'1 PENDING',              sCol:colors.accent,              badge:'1', bCol:colors.accent, check:false },
    { iBg:colors.accentBg, iCol:colors.accent, icon:'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',      label:'Rota',          sub:'DRAFT · READY TO PUBLISH',sCol:colors.accent,             badge:null,bCol:null,    check:false },
    { iBg:colors.goodBg, iCol:colors.good, icon:'M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z', label:'Training', sub:'ALL UP TO DATE', sCol:colors.good, badge:null, bCol:null, check:true },
    { iBg:colors.surface, iCol:colors.ink4, icon:'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',                                                   label:'Hours',         sub:'VIEW TIMESHEETS',        sCol:alpha(colors.charcoal, 0.35),  badge:null,bCol:null,    check:false },
    { iBg:colors.surface, iCol:colors.ink4, icon:'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', label:'Staff Members', sub:'11 ACTIVE', sCol:alpha(colors.charcoal, 0.35), badge:null, bCol:null, check:false },
    { iBg:colors.surface, iCol:colors.ink4, icon:'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',      label:'My Calendar',   sub:'NO UPCOMING EVENTS',     sCol:alpha(colors.charcoal, 0.35),  badge:null,bCol:null,    check:false },
  ]
  return (
    <div className="bg-surface flex flex-col" style={{ width:272, height:572, overflow:'hidden' }}>
      <MockAppHeader />

      {/* Scrollable content */}
      <div className="flex-1 overflow-hidden px-3 pt-3">
        {/* Title */}
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <p className="text-[9px] tracking-widest uppercase text-charcoal/35">TEAM</p>
            <p className="text-title-sm font-bold text-charcoal leading-tight">Your team</p>
          </div>
          <span className="text-[10px] text-brand/50 font-medium">Edit</span>
        </div>

        {/* On shift banner */}
        <div className="bg-brand rounded-card px-3.5 py-3 mb-3 flex items-center justify-between">
          <div>
            <p className="text-[8px] tracking-widest uppercase text-cream/40 mb-0.5">ON SHIFT NOW</p>
            <p className="text-caption font-bold text-cream">5 staff clocked in</p>
          </div>
          <div className="flex items-center gap-1 text-cream/50">
            <span className="text-[9px] font-semibold tracking-wide">ATTENDANCE</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>

        {/* Tile grid */}
        <div className="grid grid-cols-2 gap-2">
          {tiles.map(({ iBg, iCol, icon, label, sub, sCol, badge, bCol, check }) => (
            <div key={label} className="bg-white border border-charcoal/8 rounded-card p-3 relative">
              {badge && (
                <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: bCol }}>{badge}</span>
              )}
              {check && !badge && (
                <svg className="absolute top-3 right-3" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={colors.good} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              )}
              <div className="w-8 h-8 rounded-control flex items-center justify-center mb-2" style={{ background: iBg }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={iCol} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d={icon}/></svg>
              </div>
              <p className="text-caption font-bold text-charcoal leading-tight">{label}</p>
              <p className="text-[8px] font-semibold mt-0.5 uppercase tracking-wide" style={{ color: sCol }}>{sub}</p>
            </div>
          ))}
        </div>
      </div>

      <MockBottomNav active="Team" />
    </div>
  )
}

/* Desktop rota */
function MockRota() {
  const days = [
    { d:'MON', dt:'22 Jun', closed:true },
    { d:'TUE', dt:'23 Jun' },
    { d:'WED', dt:'24 Jun', today:true },
    { d:'THU', dt:'25 Jun' },
    { d:'FRI', dt:'26 Jun' },
    { d:'SAT', dt:'27 Jun' },
    { d:'SUN', dt:'28 Jun' },
  ]
  const staff = [
    { n:'Amy',    r:'KITCHEN', cost:'£397.50', shifts:[null, { t:'08:00–14:00', l:'Kitchen', c:colors.brand[500] }, null, { t:'06:00–14:00', l:'Kitchen', c:colors.brand[500] }, { t:'06:30–14:00', l:'Kitchen', c:colors.brand[500] }, { t:'07:30–14:00', l:'Kitchen', c:colors.brand[500] }, null] },
    { n:'Beth',   r:'FOH',     cost:'£262.67', shifts:[null, null, null, { t:'06:55–15:00', l:'Barista', c:colors.accent }, { t:'06:55–15:00', l:'Barista', c:colors.accent }, { t:'TIME OFF', c:'off' }, { t:'08:30–14:00', l:'Barista', c:colors.accent }] },
    { n:'Claire', r:'FOH',     cost:'£126.58', shifts:[null, null, null, null, null, { t:'07:55–15:00', l:'FOH', c:colors.good }, { t:'08:55–14:00', l:'Barista', c:colors.accent }] },
    { n:'Diana',  r:'FOH',     cost:'£326.00', shifts:[null, null, null, { t:'06:55–15:00', l:'Barista', c:colors.accent }, { t:'06:55–15:00', l:'FOH', c:colors.good }, { t:'07:00–14:00', l:'FOH', c:colors.good }, { t:'08:30–14:00', l:'FOH', c:colors.good }] },
    { n:'Dan',    r:'FOH',     cost:'—',        shifts:[null, null, null, { t:'TIME OFF', c:'off' }, { t:'TIME OFF', c:'off' }, { t:'TIME OFF', c:'off' }, null] },
  ]
  return (
    <div aria-hidden="true" className="bg-white rounded-card overflow-hidden shadow-[0_32px_80px_theme(colors.black/22%)] ring-1 ring-charcoal/8">
      {/* Header */}
      <div className="bg-surface border-b border-charcoal/8 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <span className="text-[8px] text-charcoal/35 tracking-widest uppercase">TEAM / </span>
            <span className="text-body font-bold text-charcoal">Rota Manager</span>
          </div>
          <span className="text-[8px] font-semibold bg-accent/10 text-accent px-2 py-0.5 rounded-full">3 shift swap requests pending</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-center text-[8px] font-semibold text-charcoal/45 border border-charcoal/15 px-2 py-1 rounded-tag">AUTO-FILL</span>
          <span className="text-center text-[8px] font-semibold bg-brand text-cream px-2.5 py-1 rounded-tag">Send notification</span>
        </div>
      </div>
      {/* Legend */}
      <div className="px-4 py-2 flex items-center gap-4 border-b border-charcoal/6">
        {[['AVAILABLE',colors.good],['UNAVAILABLE',colors.ink4],['TIME OFF',colors.warn],['CLOSED',colors.line]].map(([l,c])=>(
          <div key={l} className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ backgroundColor:c }}/><span className="text-[7px] text-charcoal/40 font-medium">{l}</span></div>
        ))}
      </div>
      {/* Grid */}
      <div className="p-3 overflow-hidden">
        {/* Day headers */}
        <div className="grid mb-1.5" style={{ gridTemplateColumns:'72px repeat(7,1fr) 72px' }}>
          <div className="text-[6px] tracking-widest uppercase text-charcoal/25 flex items-end pb-1">STAFF</div>
          {days.map(({ d, dt, today, closed }) => (
            <div key={d} className={`text-center py-1.5 rounded-tag ${today?'bg-brand/8':''}`}>
              <p className={`text-[7px] font-bold tracking-wide ${today?'text-brand':closed?'text-charcoal/20':'text-charcoal/40'}`}>{d}</p>
              <p className={`text-[7px] ${today?'text-brand font-semibold':closed?'text-charcoal/20':'text-charcoal/30'}`}>{dt}</p>
              {closed && <p className="text-[6px] text-charcoal/25">CLOSED</p>}
            </div>
          ))}
          <div className="text-[6px] tracking-widest uppercase text-charcoal/25 flex items-end justify-end pb-1">EST. COST</div>
        </div>
        {/* Staff rows */}
        {staff.map(({ n, r, cost, shifts }) => (
          <div key={n} className="grid mb-1" style={{ gridTemplateColumns:'72px repeat(7,1fr) 72px' }}>
            <div className="flex flex-col justify-center pr-2">
              <p className="text-[9px] font-semibold text-charcoal">{n}</p>
              <p className="text-[7px] text-charcoal/35">{r}</p>
            </div>
            {shifts.map((s, i) => (
              <div
                key={i}
                className="rounded-tag mx-0.5 flex flex-col items-center justify-center py-1.5 min-h-[34px]"
                style={{
                  backgroundColor: s ? (s.c==='off' ? alpha(colors.warn, 0.12) : s.c+'20') : 'transparent',
                  border: s ? `1px solid ${s.c==='off'?alpha(colors.warn, 0.3):s.c+'44'}` : `1px dashed ${alpha(colors.charcoal, 0.06)}`,
                }}
              >
                {s && s.c !== 'off' && <>
                  <p className="text-[6px] font-bold leading-tight text-center" style={{ color:s.c }}>{s.t}</p>
                  <p className="text-[6px] leading-tight text-center" style={{ color:s.c+'aa' }}>{s.l}</p>
                </>}
                {s && s.c === 'off' && <p className="text-[6px] font-semibold text-warn">TIME OFF</p>}
              </div>
            ))}
            <div className="text-right pr-1 flex flex-col justify-center">
              <p className="text-[8px] font-semibold text-charcoal">{cost}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Shared bits ───────────────────────────────────────────────────────── */
const Arrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
)

const WRAP = 'max-w-[1400px] mx-auto px-6 sm:px-10'

/* ─── "Replaces" marquee ────────────────────────────────────────────────── */
const REPLACED_TOOLS = ['Rota spreadsheets','WhatsApp groups','Paper temp logs','Training folders','Tip calculators','Compliance binders','Shift-swap texts','Clocking-in sheets']

// Things Pelikn replaces, not features: struck through, never ticked. The
// second pass only exists for the seamless loop, so screen readers skip it.
function Replaces() {
  return (
    <section className="bg-accent text-cream overflow-hidden py-20 sm:py-28 select-none">
      <p className={`${WRAP} font-mono text-micro tracking-[0.12em] uppercase text-cream/80 mb-8`}>What Pelikn replaces</p>
      <div className="flex whitespace-nowrap pk-marquee-track">
        {[0, 1].map(pass => (
          <ul
            key={pass}
            className={`flex items-center shrink-0 ${pass === 1 ? 'pk-marquee-dup' : ''}`}
            aria-label={pass === 0 ? 'What Pelikn replaces' : undefined}
            aria-hidden={pass === 1 ? 'true' : undefined}
          >
            {REPLACED_TOOLS.map(item => (
              <li key={item} className="flex items-center" style={{ ...BIG, fontSize: 'clamp(48px, 8vw, 128px)' }}>
                <span className="line-through decoration-[0.06em]">{item}</span>
                <span className="mx-[0.45em] opacity-60" aria-hidden="true">·</span>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </section>
  )
}

/* ─── FAQ ───────────────────────────────────────────────────────────────── */
function Faq({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-charcoal/12">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="w-full flex items-center justify-between py-7 text-left gap-6 cursor-pointer">
        <span className="text-title sm:text-display font-medium tracking-[-0.025em] text-charcoal">{q}</span>
        <span className="shrink-0 w-10 h-10 rounded-full border border-charcoal/20 flex items-center justify-center text-charcoal transition-transform duration-300" style={{ transform: open ? 'rotate(45deg)' : 'none' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </span>
      </button>
      {open && <p className="text-body-lg sm:text-title-sm text-charcoal/70 pb-8 leading-[1.6] max-w-2xl">{a}</p>}
    </div>
  )
}

/* ─── Pricing ───────────────────────────────────────────────────────────── */
function Pricing() {
  const [annual, setAnnual] = useState(false)
  const sp  = annual ? STARTER_ANNUAL : STARTER_PRICE
  const pp  = annual ? PRO_ANNUAL     : PRO_PRICE
  const ep  = annual ? EXTRA_VENUE_ANNUAL : EXTRA_VENUE_PRICE
  const ppn = annual ? PRO_ANNUAL_NUM : PRO_PRICE_NUM
  const epn = annual ? EXTRA_VENUE_ANNUAL_NUM : EXTRA_VENUE_PRICE_NUM
  const sfx = annual ? '/yr' : '/mo'

  return (
    <section id="pricing" className="bg-surface">
      <div className={`${WRAP} py-28 sm:py-36`}>
        <FadeUp>
          <h2 className="text-charcoal" style={BIG}>One price.<br />No surprises.</h2>
          <p className="text-charcoal/70 text-title-sm sm:text-title mt-8 max-w-md leading-[1.45]">Priced per venue, not per head. No hidden charges. Cancel any time.</p>
        </FadeUp>
        <FadeUp delay={60}>
          <div className="inline-flex items-center bg-paper rounded-full p-1.5 gap-1 mt-12 mb-12">
            {[['Monthly',false],['Annual',true]].map(([label,val])=>(
              <button key={label} onClick={()=>setAnnual(val)} className={`text-body-lg font-medium px-6 py-3 rounded-full transition-all cursor-pointer flex items-center gap-2 ${annual===val?'bg-charcoal text-cream':'text-charcoal/65 hover:text-charcoal'}`}>
                {label}
                {label==='Annual' && <span className={`text-micro font-semibold px-2 py-0.5 rounded-full ${annual?'bg-cream/20 text-cream':'bg-accentBg text-accent'}`}>2 months free</span>}
              </button>
            ))}
          </div>
        </FadeUp>
        <div className="grid lg:grid-cols-2 gap-5">
          {PLAN_ORDER.map((id, idx) => (
            <FadeUp key={id} delay={80 + idx * 70} className="h-full">
              {id === PLANS.PRO ? (
                <div className="bg-brand text-cream rounded-sheet p-8 sm:p-12 flex flex-col h-full">
                  <p className="font-mono text-micro tracking-[0.12em] uppercase text-cream/80 mb-8">{PLAN_DETAILS.pro.name}</p>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span style={{ fontSize: 'clamp(64px, 8vw, 112px)', lineHeight: 0.9, letterSpacing: '-0.055em', fontWeight: 500 }}>{pp}</span>
                    <span className="text-cream/75 text-title-sm">{sfx}</span>
                  </div>
                  <p className="text-body-lg text-cream/75">{PLAN_DETAILS.pro.venueNote} · {ep}{sfx} each extra</p>
                  {annual && <p className="text-body-lg font-medium text-goodDark mt-1">Save £50 vs monthly</p>}
                  <div className="border-y border-cream/20 py-5 my-8">
                    <p className="font-mono text-micro tracking-[0.12em] uppercase text-cream/70 mb-3">As you grow</p>
                    {[1,2,3,5].map(n=>(
                      <div key={n} className="flex justify-between py-1.5">
                        <span className="text-body-lg text-cream/75">{n} venue{n>1?'s':''}</span>
                        <span className="text-body-lg font-medium">£{ppn+(n-1)*epn}{sfx}</span>
                      </div>
                    ))}
                  </div>
                  <ul className="flex flex-col gap-3 mb-10 flex-1">
                    {PRO_FEATURES.map((f,i)=>(
                      <li key={f} className="flex items-start gap-3 text-body-lg text-cream/85">
                        <span className="mt-1 shrink-0 text-goodDark"><Tick /></span>
                        {i===0?<strong className="font-semibold text-cream">{f}</strong>:f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/signup?plan=pro" className={`${PILL_LG} bg-cream text-charcoal hover:bg-paper`}>Start free trial</Link>
                </div>
              ) : (
                <div className="bg-paper text-charcoal rounded-sheet p-8 sm:p-12 flex flex-col h-full">
                  <p className="font-mono text-micro tracking-[0.12em] uppercase text-charcoal/70 mb-8">{PLAN_DETAILS.starter.name}</p>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span style={{ fontSize: 'clamp(64px, 8vw, 112px)', lineHeight: 0.9, letterSpacing: '-0.055em', fontWeight: 500 }}>{sp}</span>
                    <span className="text-charcoal/65 text-title-sm">{sfx}</span>
                  </div>
                  <p className="text-body-lg text-charcoal/70">{PLAN_DETAILS.starter.venueNote}</p>
                  {annual && <p className="text-body-lg font-medium text-good mt-1">Save £20 vs monthly</p>}
                  <p className="text-body-lg text-charcoal/70 leading-[1.5] border-y border-charcoal/12 py-5 my-8">Everything you need to stay compliant and get off paper.</p>
                  <ul className="flex flex-col gap-3 mb-10 flex-1">
                    {STARTER_FEATURES.map(f=>(
                      <li key={f} className="flex items-start gap-3 text-body-lg text-charcoal/80">
                        <span className="mt-1 shrink-0 text-good"><Tick /></span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/signup?plan=starter" className={`${PILL_LG} border border-charcoal/25 text-charcoal hover:bg-charcoal hover:text-cream`}>Start free trial</Link>
                </div>
              )}
            </FadeUp>
          ))}
        </div>
        <p className="text-body-lg text-charcoal/65 mt-8">7-day free trial · No card required to start</p>
      </div>
    </section>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   PAGE
   ══════════════════════════════════════════════════════════════════════════ */
export default function MarketingPage() {
  useForceLight()
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 24)
    h()
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  const navLink = scrolled ? 'text-charcoal/75 hover:text-charcoal' : 'text-cream/85 hover:text-cream'

  return (
    <div className="min-h-dvh font-sans text-charcoal bg-paper overflow-x-hidden">
      <GlobalCSS />

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-50 transition-colors duration-300" style={{ background: scrolled ? white(0.92) : 'transparent', backdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none' }}>
        <div className={`${WRAP} h-[72px] flex items-center justify-between`}>
          <Link to="/" aria-label="Pelikn home"><Logo variant="full" size="md" tone={scrolled ? 'auto' : 'onBrand'} /></Link>
          <nav className="hidden md:flex items-center gap-1" aria-label="Sections">
            {[['Food safety','#compliance'],['Team','#team'],['Pricing','#pricing']].map(([l,h])=>(
              <a key={l} href={h} className={`text-body-lg font-medium px-4 py-2 rounded-full transition-colors duration-200 ${navLink}`}>{l}</a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className={`${PILL} text-body px-5 py-2.5 ${scrolled ? 'bg-charcoal text-cream hover:bg-ink2' : 'bg-charcoal text-cream hover:bg-ink'}`}>Log in</Link>
            <Link to="/signup" className={`${PILL} text-body px-5 py-2.5 ${scrolled ? 'bg-brand/10 text-brand hover:bg-brand/15' : 'bg-cream text-charcoal hover:bg-paper'}`}>Free trial</Link>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="bg-brand text-cream relative overflow-hidden" style={{ minHeight: 'max(100svh, 780px)' }}>
        {/* Logomark watermark, big enough to show around the phone. Drawn by the
            shared Logo so it is always the current brand artwork. */}
        <div className="absolute pointer-events-none select-none" aria-hidden="true" style={{ right:'-10%', top:'55%', transform:'translateY(-50%)', width:'min(900px, 110vw)', opacity:0.07 }}>
          <Logo variant="mark" tone="onBrand" className="w-full h-auto" />
        </div>
        <div className={`${WRAP} relative z-10 pt-32 sm:pt-40`}>
          <h1 style={{ ...HUGE, fontSize: 'clamp(56px, 9.6vw, 156px)', animation: 'pkIn 0.9s cubic-bezier(.16,1,.3,1) both' }}>
            Inspection-ready.<br />Always.
          </h1>
          <div className="mt-10 sm:mt-14 max-w-[460px]" style={{ animation: 'pkIn 0.9s 120ms cubic-bezier(.16,1,.3,1) both' }}>
            <p className="text-title-sm sm:text-title text-cream/85 leading-[1.4] tracking-[-0.01em]">
              Every temp, clean and allergen check on record as it happens, plus rotas and timesheets in the same app. So there's nothing to dig out when the EHO knocks.
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4 mt-9">
              <Link to="/signup" className={`${PILL_LG} bg-cream text-charcoal hover:bg-paper`}>Start free for 7 days</Link>
              <a href="#compliance" className="inline-flex items-center gap-2 text-body-lg font-medium text-cream/85 hover:text-cream transition-colors">See how it works <Arrow /></a>
            </div>
            <p className="text-body text-cream/70 mt-6">No card required · Cancel any time · EU data hosting</p>
          </div>
        </div>

        {/* Phone rising from the bottom edge, cropped by the section */}
        <div className="pk-rise relative lg:absolute lg:right-[3%] xl:right-[5%] lg:bottom-[-30%] mx-auto lg:mx-0 mt-14 lg:mt-0 w-[300px] sm:w-[360px] lg:w-[380px] xl:w-[420px] -mb-48 sm:-mb-56 lg:mb-0" style={{ animation: 'pkRise 1.2s 200ms cubic-bezier(.16,1,.3,1) both' }}>
          <Phone><MockMobileHome /></Phone>
          <Chip tone="good" className="pk-float hidden sm:inline-flex -left-10 lg:left-auto lg:right-[88%] top-[30%]"><Tick />Fridge A · 3.4°C · logged</Chip>
          <Chip tone="paper" className="pk-float-b hidden sm:inline-flex -right-6 lg:right-[96%] top-[44%]"><span className="w-2 h-2 rounded-full bg-accent" />3 shift swaps to approve</Chip>
          <Chip tone="dark" className="pk-float-c hidden sm:inline-flex -left-6 lg:left-auto lg:right-[90%] top-[58%]"><Tick />Allergens up to date</Chip>
        </div>
      </section>

      {/* ── Statement + desktop ─────────────────────────────────────────── */}
      <section className="bg-cream">
        <div className={`${WRAP} pt-32 sm:pt-52 pb-20 sm:pb-32`}>
          <ScrollWords
            className="text-charcoal max-w-[1180px]"
            style={MID}
            text="Temp logs. Cleaning. Allergens. Rotas. Timesheets. Everything a venue has to keep on top of, in one app your whole team already knows how to use."
          />
        </div>
        <div className={`${WRAP} pb-28 sm:pb-44`}>
          <FadeUp>
            <div className="relative lg:pl-24">
              <BrowserFrame>
                <ScaledCanvas width={1280} height={800} label="The Pelikn manager dashboard on a computer: today's checks, overdue cleans, fridge temps and who is on shift">
                  <DesktopDashboardMock />
                </ScaledCanvas>
              </BrowserFrame>
              <div className="hidden lg:block absolute left-0 bottom-[-6%] w-[190px] xl:w-[230px]">
                <Phone><MockChecksHub /></Phone>
              </div>
            </div>
            <p className="text-body-lg text-charcoal/70 mt-8 lg:pl-[17rem] max-w-md">The manager dashboard in any browser. Staff use the same app on their own phones.</p>
          </FadeUp>
        </div>
      </section>

      {/* ── Food safety ──────────────────────────────────────────────────── */}
      <section id="compliance" className="bg-paper">
        <div className={`${WRAP} py-28 sm:py-36`}>
          <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-20 lg:gap-12 items-center">
            <FadeUp>
              <p className="font-mono text-micro tracking-[0.12em] uppercase text-brand mb-8">Food safety</p>
              <h2 className="text-charcoal" style={BIG}>If the EHO walked in today, would you be ready?</h2>
              <p className="text-charcoal/70 text-title-sm sm:text-title leading-[1.45] mt-10 max-w-lg">
                Every temp log, cleaning record, allergen check and delivery sign-off captured and stored. One tap exports the audit trail, just how an inspector expects it.
              </p>
              <Link to="/signup" className={`${PILL_LG} bg-brand text-cream hover:bg-ink2 mt-10 gap-2`}>Start free trial <Arrow /></Link>
            </FadeUp>
            <FadeUp delay={100} className="flex justify-center lg:justify-end">
              <div className="relative w-[300px] sm:w-[360px] lg:w-[380px]">
                <Phone label="The Pelikn checks screen"><MockChecksHub /></Phone>
                <Chip tone="good" className="pk-float -left-6 sm:-left-20 top-[18%]"><Tick />Cooking temps logged</Chip>
                <Chip tone="paper" className="pk-float-b -right-4 sm:-right-14 top-[58%] border border-charcoal/10"><span className="w-2 h-2 rounded-full bg-accent" />2 cleans overdue</Chip>
              </div>
            </FadeUp>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 mt-28 sm:mt-40 border-t border-charcoal/15">
            {[
              { title:'Temperature logs', desc:'Fridge, cooking, reheating and hot holding. Pass or fail against your own thresholds.' },
              { title:'Cleaning & opening', desc:'Cleaning rotas plus opening and closing checklists, assigned to staff, with live status.' },
              { title:'Allergen registry', desc:"All 14 allergens across every dish on your menu. Natasha's Law compliant by design." },
              { title:'Audit-ready exports', desc:'One tap to a full compliance PDF. Timestamped, signed, formatted for inspection.' },
            ].map(({ title, desc }, i) => (
              <FadeUp key={title} delay={i * 60}>
                <div className="pt-8 pb-10 sm:pr-8 h-full">
                  <p className="font-mono text-micro tracking-[0.12em] uppercase text-charcoal/65 mb-5">0{i + 1}</p>
                  <p className="text-title font-medium tracking-[-0.025em] mb-3">{title}</p>
                  <p className="text-body-lg text-charcoal/70 leading-[1.6]">{desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── Team ─────────────────────────────────────────────────────────── */}
      <section id="team" className="bg-charcoal text-cream">
        <div className={`${WRAP} py-28 sm:py-36`}>
          <FadeUp>
            <p className="font-mono text-micro tracking-[0.12em] uppercase text-cream/75 mb-8">Team &amp; scheduling · Pro</p>
            <h2 style={BIG}>Stop running your<br />team on WhatsApp.</h2>
            <p className="text-cream/80 text-title-sm sm:text-title leading-[1.45] mt-10 max-w-xl">
              Build the rota in minutes, publish it, done. Timesheets write themselves. Swaps and time off come through the app, so you stop being the middleman.
            </p>
          </FadeUp>
          <FadeUp delay={80} className="mt-16 sm:mt-24">
            <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0 sm:overflow-visible">
              <div className="min-w-[640px]"><MockRota /></div>
            </div>
          </FadeUp>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 mt-24 sm:mt-32 border-t border-cream/20">
            {[
              { n:'Rota builder',  d:'Drag and drop, or auto-fill from your patterns.' },
              { n:'Timesheets',    d:'Staff clock in and out on the app. Exports to payroll.' },
              { n:'Time off',      d:'Requests, approvals and shift swaps, all in the app.' },
              { n:'Training',      d:'Certificate records with 30-day expiry alerts.' },
              { n:'Tips',          d:'Enter the pot, set the split. Full audit trail.' },
              { n:'Multi-venue',   d:'One login for every site you run.' },
            ].map(({ n, d }, i) => (
              <FadeUp key={n} delay={(i % 3) * 60}>
                <div className="py-8 sm:pr-10 border-b border-cream/20 h-full">
                  <p className="text-title font-medium tracking-[-0.025em] mb-2">{n}</p>
                  <p className="text-body-lg text-cream/75 leading-[1.6]">{d}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bento: more inside ───────────────────────────────────────────── */}
      <section className="bg-surface">
        <div className={`${WRAP} py-28 sm:py-36`}>
          <FadeUp>
            <h2 className="text-charcoal" style={BIG}>And a lot more<br />inside.</h2>
          </FadeUp>
          <div className="grid md:grid-cols-6 gap-4 sm:gap-5 mt-16 sm:mt-24">
            {[
              { span:'md:col-span-4', bg:'bg-brand text-cream',     sub:'text-cream/80',    icon:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2 M9 3h6v4H9z M9 12h6 M9 16h4', title:'HACCP plan builder', desc:'Work through your plan step by step and finish with a HACCP summary PDF.' },
              { span:'md:col-span-2', bg:'bg-paper text-charcoal',  sub:'text-charcoal/70', icon:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4', title:'Mock EHO inspection', desc:"Answer the questions an inspector asks and see where you'd lose marks." },
              { span:'md:col-span-2', bg:'bg-accent text-cream',    sub:'text-cream/85',    icon:'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01', title:'Incident log', desc:'Record anything that happens. Timestamped, signed, searchable.' },
              { span:'md:col-span-4', bg:'bg-paper text-charcoal',  sub:'text-charcoal/70', icon:'M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 014-4h4a4 4 0 014 4v3c0 3.3-2.7 6-6 6z M12 20v-9 M9 7.13v-1a3 3 0 016 0v1 M6 13H2 M22 13h-4 M6.53 9C4.6 8.8 3 7.1 3 5 M21 5c0 2.1-1.6 3.8-3.5 4', title:'Pest control log', desc:"Inspections, sightings and treatments, each issue tracked until it's closed." },
              { span:'md:col-span-3', bg:'bg-charcoal text-cream',  sub:'text-cream/80',    icon:'M1 3h15v13H1z M16 8h4l3 3v5h-7z M5.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5z M18.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5z', title:'Deliveries & probes', desc:'Goods-in temperature and condition checks, plus probe calibration.' },
              { span:'md:col-span-3', bg:'bg-brand-soft text-brand',sub:'text-brand/80',    icon:'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z', title:'Document vault', desc:'Certificates, policies and insurance in one organised place.' },
            ].map(({ span, bg, sub, icon, title, desc }, i) => (
              <FadeUp key={title} delay={(i % 3) * 60} className={span}>
                <div className={`${bg} rounded-sheet p-8 sm:p-10 min-h-[320px] sm:min-h-[400px] h-full flex flex-col justify-between`}>
                  <span className="w-14 h-14 rounded-full border border-current flex items-center justify-center opacity-70"><Ico d={icon} size={26} /></span>
                  <div>
                    <p className="font-medium" style={{ fontSize: 'clamp(28px, 3.2vw, 44px)', lineHeight: 1, letterSpacing: '-0.04em' }}>{title}</p>
                    <p className={`text-body-lg sm:text-title-sm leading-[1.45] mt-4 max-w-sm ${sub}`}>{desc}</p>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      <Replaces />

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="bg-cream">
        <div className={`${WRAP} py-28 sm:py-36`}>
          <FadeUp>
            <h2 className="text-charcoal" style={BIG}>Live this<br />afternoon.</h2>
            <p className="text-charcoal/70 text-title-sm sm:text-title leading-[1.45] mt-10 max-w-lg">
              No IT department needed. Open Pelikn in your browser, add it to your home screen and it works like any other app. Offline included.
            </p>
          </FadeUp>
          <div className="grid lg:grid-cols-3 gap-12 lg:gap-10 mt-20 sm:mt-28">
            {[
              { n:'1', title:'Sign up', desc:'Create your account and set up your venue. Name, location, your first team members. About five minutes.' },
              { n:'2', title:'Install on any device', desc:"Open get-pelikn.com in Safari or Chrome and tap 'Add to Home Screen'. It lands there like any other app." },
              { n:'3', title:'Invite your team', desc:"Send invite links. Staff install the app and they're ready to log checks, see their rota and clock in." },
            ].map(({ n, title, desc }, i) => (
              <FadeUp key={n} delay={i * 80}>
                <div className="border-t border-charcoal/20 pt-8">
                  <p className="text-accent" style={{ fontSize: 'clamp(88px, 11vw, 168px)', lineHeight: 0.85, letterSpacing: '-0.06em', fontWeight: 500 }}>{n}</p>
                  <p className="text-title sm:text-display font-medium tracking-[-0.03em] mt-8 mb-3">{title}</p>
                  <p className="text-body-lg text-charcoal/70 leading-[1.6] max-w-sm">{desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
          <FadeUp delay={120}>
            <Link to="/signup" className={`${PILL_LG} bg-brand text-cream hover:bg-ink2 mt-20 gap-2`}>Get started free <Arrow /></Link>
          </FadeUp>
        </div>
      </section>

      <Pricing />

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="bg-paper">
        <div className={`${WRAP} py-28 sm:py-36 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-12 lg:gap-24`}>
          <FadeUp>
            <h2 className="text-charcoal" style={BIG}>Common<br />questions.</h2>
          </FadeUp>
          <FadeUp delay={60}>
            <div className="border-t border-charcoal/12">
              {[
                { q:'Is this on the App Store?', a:"Not yet. Today Pelikn runs in your browser. Add it to your home screen in about 30 seconds and it opens like any other app, even when the signal drops. iPhone and Android apps are on the way." },
                { q:'Does it work on iPhone, iPad and Android?', a:"Yes, all of them. Install from Safari on iOS/iPadOS, or Chrome on Android. The manager dashboard works in any desktop browser with no install needed." },
                { q:"What's the difference between Starter and Pro?", a:`Starter covers everything on the compliance side: temperature logs, cleaning records, allergens, checklists and exports, for one venue and up to ${STARTER_STAFF_LIMIT} staff. Pro adds the whole team layer: rotas, timesheets, clock in/out, training records, tips and time off, with unlimited staff and multiple venues.` },
                { q:'What counts as a venue?', a:"Each physical location is a venue. Starter covers one venue. On Pro, your first venue is £25/mo and each extra one is £15/mo. Add a venue whenever you like and your bill updates automatically." },
                { q:'Is my data secure?', a:"Your data is stored in a secure EU database, a region UK law recognises as giving the same protection as the UK. Row-level security means staff only ever see their own venue's data, and we handle personal data in line with UK GDPR." },
                { q:'Can I cancel?', a:"Whenever you like. No contracts, no cancellation fees. Cancel from Plan & Billing in Settings and you keep access until the end of the period you've paid for." },
              ].map(({ q, a }) => <Faq key={q} q={q} a={a} />)}
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── Trusted by ───────────────────────────────────────────────────── */}
      <section aria-label="Venues using Pelikn" className="bg-paper border-t border-charcoal/12">
        <div className={`${WRAP} py-14 flex flex-col items-center gap-5`}>
          <p className="font-mono text-micro tracking-[0.14em] uppercase text-charcoal/70">Trusted by</p>
          <span
            role="img"
            aria-label="Nomad"
            className="block bg-charcoal/80"
            style={{
              width: 180, height: 50,
              WebkitMaskImage: 'url(/marketing/nomad-wordmark.png)', maskImage: 'url(/marketing/nomad-wordmark.png)',
              WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
              WebkitMaskSize: 'contain', maskSize: 'contain',
              WebkitMaskPosition: 'center', maskPosition: 'center',
            }}
          />
        </div>
      </section>

      {/* ── Final CTA + footer ───────────────────────────────────────────── */}
      <section className="bg-brand text-cream relative overflow-hidden">
        <div className={`${WRAP} pt-32 sm:pt-52 pb-16 sm:pb-24 relative`}>
          <FadeUp>
            <h2 style={{ ...HUGE, fontSize: 'clamp(52px, 10vw, 160px)' }}>Ditch the clipboard.<br />Keep the compliance.</h2>
            <p className="text-title-sm sm:text-title text-cream/80 mt-10">7 days free. No card. Set up in an afternoon.</p>
            <div className="flex flex-col sm:flex-row items-start gap-4 mt-10">
              <Link to="/signup" className={`${PILL_LG} bg-cream text-charcoal hover:bg-paper`}>Start free trial</Link>
              <a href="mailto:hello@get-pelikn.com" className={`${PILL_LG} border border-cream/30 text-cream hover:bg-cream/10`}>Get in touch</a>
            </div>
          </FadeUp>

          <footer className="mt-32 sm:mt-48 pt-8 border-t border-cream/20 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <Logo variant="full" size="md" tone="onBrand" />
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-body-lg text-cream/80">
              <a href="mailto:hello@get-pelikn.com" className="hover:text-cream transition-colors">hello@get-pelikn.com</a>
              {[['Privacy','/privacy'],['Terms','/terms'],['Sign in','/login']].map(([l,h])=>(
                <Link key={l} to={h} className="hover:text-cream transition-colors">{l}</Link>
              ))}
            </div>
          </footer>
          <p className="text-body text-cream/70 mt-8">© {new Date().getFullYear()} Pelikn · EU data hosting</p>
        </div>
      </section>
    </div>
  )
}
