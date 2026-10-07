import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  STARTER_PRICE, PRO_PRICE, EXTRA_VENUE_PRICE,
  PRO_PRICE_NUM, EXTRA_VENUE_PRICE_NUM,
  STARTER_ANNUAL, PRO_ANNUAL, EXTRA_VENUE_ANNUAL,
  PRO_ANNUAL_NUM, EXTRA_VENUE_ANNUAL_NUM,
} from '../../lib/pricing'
import { STARTER_FEATURES, PRO_FEATURES, PLAN_ORDER, PLAN_DETAILS, STARTER_STAFF_LIMIT } from '../../lib/plans'
import { PLANS } from '../../lib/constants'

/* ─── Keyframes ─────────────────────────────────────────────────────────── */
function GlobalCSS() {
  return (
    <style>{`
      @keyframes pkIn {
        from { opacity:0; transform:translateY(16px) scale(0.98); }
        to   { opacity:1; transform:translateY(0) scale(1); }
      }
      @keyframes pkRise {
        from { opacity:0; transform:translateY(56px) scale(0.96); }
        to   { opacity:1; transform:translateY(0) scale(1); }
      }
      @keyframes pkPulse {
        0%,100% { opacity:1; box-shadow:0 0 0 0 rgba(26,122,76,0.5); }
        60%      { opacity:0.55; box-shadow:0 0 0 5px rgba(26,122,76,0); }
      }
      /* Scrolling ticker — seamless loop */
      @keyframes pkTicker {
        from { transform:translateX(0); }
        to   { transform:translateX(-50%); }
      }
      .pk-ticker-track { animation: pkTicker 28s linear infinite; }
      .pk-ticker-track:hover { animation-play-state: paused; }
      /* Reduced motion: no scrolling — show one wrapped, static list instead */
      @media (prefers-reduced-motion: reduce) {
        .pk-ticker-track { animation: none; white-space: normal; }
        .pk-ticker-pass { flex-shrink: 1; flex-wrap: wrap; gap: 4px 20px; padding-right: 24px; }
        .pk-ticker-pass > li { margin: 0; }
        .pk-ticker-dup { display: none; }
        .pk-ticker-label { box-shadow: none; }
      }
    `}</style>
  )
}

/* ─── "Replaces" strip ──────────────────────────────────────────────────── */
const REPLACED_TOOLS = ['Rota spreadsheets','WhatsApp groups','Paper temp logs','Training folders','Tip calculators','Compliance binders','Shift-swap texts','Clocking-in sheets']

// Things Pelikn replaces, not features: a "Replaces" label and struck-through
// items, never ticks. The second pass only exists for the seamless loop, so it
// is hidden from screen readers.
function ReplacesStrip() {
  return (
    <div className="bg-[#f0efec] border-y border-charcoal/8 py-4 select-none flex items-center">
      <span aria-hidden="true" className="pk-ticker-label relative z-10 shrink-0 pl-6 sm:pl-10 pr-4 sm:pr-6 font-mono text-[11px] tracking-[0.12em] uppercase font-semibold text-charcoal/55 bg-[#f0efec] shadow-[12px_0_12px_#f0efec]">Replaces</span>
      <div className="overflow-hidden flex-1">
        <div className="flex pk-ticker-track whitespace-nowrap">
          {[0, 1].map(pass => (
            <ul
              key={pass}
              className={`pk-ticker-pass flex items-center shrink-0 ${pass === 1 ? 'pk-ticker-dup' : ''}`}
              aria-label={pass === 0 ? 'What Pelikn replaces' : undefined}
              aria-hidden={pass === 1 ? 'true' : undefined}
            >
              {REPLACED_TOOLS.map(item => (
                <li key={item} className="mx-7 text-[14px] font-medium text-charcoal/45 line-through decoration-charcoal/30">{item}</li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── iPhone frame ──────────────────────────────────────────────────────── */
function IPhoneFrame({ children }) {
  return (
    <div
      className="relative shrink-0 transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-2"
      style={{ width:300, background:'#141414', borderRadius:52, padding:14, boxShadow:'0 40px 80px rgba(0,0,0,0.4), inset 0 0 0 1.5px rgba(255,255,255,0.13)' }}
    >
      {/* Side buttons */}
      <div style={{ position:'absolute', right:-3, top:100, width:3, height:34, background:'#2a2a2a', borderRadius:'0 3px 3px 0' }}/>
      <div style={{ position:'absolute', left:-3, top:88,  width:3, height:26, background:'#2a2a2a', borderRadius:'3px 0 0 3px' }}/>
      <div style={{ position:'absolute', left:-3, top:122, width:3, height:26, background:'#2a2a2a', borderRadius:'3px 0 0 3px' }}/>
      <div style={{ position:'absolute', left:-3, top:156, width:3, height:52, background:'#2a2a2a', borderRadius:'3px 0 0 3px' }}/>
      {/* Screen — fixed height for realistic iPhone 15 proportions */}
      <div style={{ borderRadius:40, overflow:'hidden', background:'#f3f3ef', position:'relative', height:572 }}>
        {/* Dynamic island */}
        <div style={{ position:'absolute', top:12, left:'50%', transform:'translateX(-50%)', width:100, height:28, background:'#141414', borderRadius:14, zIndex:10 }}/>
        {children}
      </div>
    </div>
  )
}

/* ─── Scroll-reveal ─────────────────────────────────────────────────────── */
function FadeUp({ children, delay = 0, className = '', dir = 'up' }) {
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
  const t = {
    up:    'translateY(20px) scale(0.99)',
    down:  'translateY(-14px)',
    left:  'translateX(-22px)',
    right: 'translateX(22px)',
  }
  return (
    <div ref={ref} className={className} style={{ opacity:v?1:0, transform:v?'none':(t[dir]??t.up), transition:`opacity 0.65s cubic-bezier(.16,1,.3,1) ${delay}ms, transform 0.65s cubic-bezier(.16,1,.3,1) ${delay}ms` }}>
      {children}
    </div>
  )
}

/* ─── Logo ──────────────────────────────────────────────────────────────── */
function PeliknLogo({ light = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={light ? 'ring-2 ring-white/30 rounded-xl shadow-lg' : ''}>
        <img src="/icons/icon.svg" className="w-7 h-7 rounded-xl" alt="" />
      </div>
      <span className={`text-sm tracking-[0.18em] uppercase ${light ? 'text-white font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]' : 'text-charcoal font-bold'}`}>Pelikn</span>
    </div>
  )
}

/* ─── SVG icon ──────────────────────────────────────────────────────────── */
const Ico = ({ d, size = 18, cls = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={cls}>
    {typeof d === 'string' ? <path d={d} /> : d}
  </svg>
)

/* ══════════════════════════════════════════════════════════════════════════
   MOCK SCREENS — faithful to real screenshots, names anonymised
   ══════════════════════════════════════════════════════════════════════════ */

/* Desktop dashboard */
function MockDashboard() {
  return (
    <div className="flex bg-[#f3f3ef]" style={{ minHeight: 360, fontSize: 10 }}>
      {/* Icon rail */}
      <div className="bg-brand flex flex-col items-center pt-3 pb-3 gap-3.5 shrink-0" style={{ width: 50 }}>
        <div className="w-7 h-7 rounded-lg bg-cream/15 flex items-center justify-center mb-1">
          <span className="text-[9px] font-bold text-cream">C</span>
        </div>
        {[
          { d:'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z', a:true,  badge:null },
          { d:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2 M9 3h6v4H9z', a:false, badge:13 },
          { d:'M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5', a:false, badge:null },
          { d:'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 7a4 4 0 100 8 4 4 0 000-8z', a:false, badge:3 },
          { d:'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09', a:false, badge:null },
        ].map(({ d, a, badge }, i) => (
          <div key={i} className="relative">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${a ? 'bg-cream/15' : ''}`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={a ? 'text-cream' : 'text-cream/28'}><path d={d}/></svg>
            </div>
            {badge && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-accent rounded-full text-[6px] font-bold text-white flex items-center justify-center">{badge > 9 ? '9+' : badge}</span>}
          </div>
        ))}
      </div>
      {/* Sub-nav */}
      <div className="flex flex-col pt-3 shrink-0" style={{ width: 145, background: 'rgba(19,54,42,0.96)' }}>
        <div className="px-3 mb-3">
          <p className="text-[7px] tracking-widest uppercase text-cream/25">THE FORGE</p>
          <p className="text-[8px] text-cream/50 mt-0.5">Today · 4 items</p>
        </div>
        {[
          { l:'Dashboard', s:"Today's checks & open issues", a:true },
          { l:'Open / Close', s:'Daily routines', a:false },
          { l:'Tasks', s:'All open tasks', a:false },
          { l:'Fitness to Work', s:'Staff readiness checks', a:false },
        ].map(({ l, s, a }) => (
          <div key={l} className={`px-3 py-2 ${a ? 'bg-cream/10' : ''}`}>
            <p className={`text-[9px] font-semibold ${a ? 'text-cream' : 'text-cream/40'}`}>{l}</p>
            <p className={`text-[7px] mt-0.5 ${a ? 'text-cream/38' : 'text-cream/18'}`}>{s}</p>
          </div>
        ))}
      </div>
      {/* Main */}
      <div className="flex-1 p-3.5 overflow-hidden">
        <div className="flex items-start justify-between mb-2.5">
          <div>
            <p className="text-[7px] tracking-widest uppercase text-charcoal/30">WEDNESDAY, 24 JUNE</p>
            <h3 className="text-[15px] font-bold text-charcoal mt-0.5">Good afternoon, Sarah</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[7px] text-charcoal/45">THE FORGE</span>
              <span className="text-[7px] font-bold bg-brand text-cream px-1.5 py-0.5 rounded tracking-wide">PRO</span>
              <span className="text-[7px] text-charcoal/30">· 0 of 14 daily checks complete</span>
            </div>
          </div>
          <button className="text-[7px] font-medium text-charcoal/40 border border-charcoal/15 px-2 py-1 rounded">Export</button>
        </div>
        {/* Alert */}
        <div className="flex items-center gap-1.5 bg-[#fff3ee] border border-accent/20 rounded-lg px-2.5 py-1.5 mb-2.5">
          <div className="w-1.5 h-1.5 rounded-full bg-accent" style={{ animation:'pkPulse 2s infinite' }} />
          <span className="text-[8px] font-semibold text-accent">13 overdue cleans</span>
        </div>
        {/* Top stats */}
        <div className="grid grid-cols-4 gap-1.5 mb-1.5">
          {[
            { l:'ON SHIFT', v:'1', c:'text-charcoal' },
            { l:'CHECKS DONE', v:'0/14', c:'text-charcoal' },
            { l:'FRIDGES DUE', v:'—', c:'text-charcoal/30' },
            { l:'MY CLOCK', v:null },
          ].map(({ l, v, c }) => (
            <div key={l} className="bg-white border border-charcoal/8 rounded-lg p-2">
              <p className="text-[6px] tracking-widest uppercase text-charcoal/28 mb-1">{l}</p>
              {v !== null
                ? <p className={`text-lg font-bold ${c} tabular-nums leading-none`}>{v}</p>
                : <div><p className="text-[7px] text-charcoal/35 mb-1">Not Clocked In</p><button className="w-full bg-charcoal text-cream text-[7px] font-semibold py-0.5 rounded">Clock In</button></div>
              }
            </div>
          ))}
        </div>
        {/* Bottom stats */}
        <div className="grid grid-cols-3 gap-1.5 mb-1.5">
          {[
            { l:'OVERDUE CLEANS', v:'13', c:'text-accent', dot:'bg-accent' },
            { l:'CRITICAL', v:'0', c:'text-charcoal', dot:'bg-charcoal/20' },
            { l:'TIME OFF', v:'1', c:'text-[#a85d12]', dot:'bg-[#a85d12]' },
          ].map(({ l, v, c, dot }) => (
            <div key={l} className="bg-white border border-charcoal/8 rounded-lg p-2">
              <div className="flex items-center gap-1 mb-1"><div className={`w-1 h-1 rounded-full ${dot}`}/><p className="text-[6px] tracking-widest uppercase text-charcoal/28">{l}</p></div>
              <p className={`text-lg font-bold ${c} tabular-nums leading-none`}>{v}</p>
            </div>
          ))}
        </div>
        {/* Widgets */}
        <div className="grid grid-cols-3 gap-1.5">
          <div className="bg-white border border-charcoal/8 rounded-lg p-2">
            <div className="flex items-center justify-between mb-1"><div className="flex items-center gap-1"><div className="w-1 h-1 rounded-full bg-[#1a7a4c]"/><p className="text-[6px] tracking-widest uppercase text-charcoal/28">COMPLIANCE SCORE</p></div><span className="text-[6px] text-brand/40">VIEW ›</span></div>
            <p className="text-2xl font-bold text-[#1a7a4c] tabular-nums">100%</p>
            <div className="flex items-center gap-1 mt-0.5"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#1a7a4c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span className="text-[7px] text-[#1a7a4c] font-semibold">All checks on track</span></div>
            <p className="text-[6px] text-charcoal/22 mt-1">30-DAY AVERAGE</p>
          </div>
          <div className="bg-white border border-charcoal/8 rounded-lg p-2">
            <div className="flex items-center justify-between mb-1.5"><div className="flex items-center gap-1"><div className="w-1 h-1 rounded-full bg-[#a85d12]"/><p className="text-[6px] tracking-widest uppercase text-charcoal/28">FRIDGE STATUS</p></div><span className="text-[6px] text-brand/40">VIEW ›</span></div>
            {[['Readings today','4'],['Out of range','0'],['Not yet checked','0']].map(([l,v])=>(
              <div key={l} className="flex justify-between py-0.5"><span className="text-[7px] text-charcoal/45">{l}</span><span className="text-[7px] font-semibold text-charcoal">{v}</span></div>
            ))}
          </div>
          <div className="bg-white border border-charcoal/8 rounded-lg p-2">
            <div className="flex items-center gap-1 mb-1.5"><div className="w-1 h-1 rounded-full bg-accent"/><p className="text-[6px] tracking-widest uppercase text-charcoal/28">STAFF NOTIFICATIONS</p></div>
            {[
              ['Claire: Leave Request','23 Jul – 24 Jul 2026'],
              ['Swap: Amy → Beth','Shift swap pending approval'],
              ['Swap: Dan → Jenna','Shift swap pending approval'],
              ['8 training records unsigned','Awaiting employee signature'],
            ].map(([t,s])=>(
              <div key={t} className="flex items-start gap-1 mb-1 last:mb-0">
                <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0 mt-0.5"/>
                <div><p className="text-[7px] font-semibold text-charcoal leading-tight">{t}</p><p className="text-[6px] text-charcoal/30">{s}</p></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* Mobile app chrome shared by the phone mocks */
function MockAppHeader() {
  return (
    <div className="bg-brand px-4 pt-14 pb-3 shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-cream tracking-widest">DEPOT</span>
          <div className="relative">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cream/60"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
            <div className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-accent rounded-full flex items-center justify-center">
              <span className="text-[7px] font-bold text-white">6</span>
            </div>
          </div>
        </div>
        <span className="text-[9px] text-cream/40 border border-cream/20 px-2 py-0.5 rounded">Sign Out</span>
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
        <p className="text-[19px] font-semibold tracking-[-0.028em] text-charcoal leading-tight mt-0.5 mb-2">Today's checks</p>

        {/* Today banner */}
        <div className="bg-brand rounded-xl px-3 py-2.5 mb-2.5 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[7px] tracking-[0.1em] uppercase text-white/55 font-semibold">Today</p>
            <p className="text-[12px] font-semibold text-white tracking-[-0.015em] mt-0.5">6 checks need doing</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 font-mono text-[7px] font-semibold text-[#ffb4a6]"><span className="w-1 h-1 rounded-full bg-current"/>2 overdue</span>
              <span className="inline-flex items-center gap-1 font-mono text-[7px] font-semibold text-[#f2c48f]"><span className="w-1 h-1 rounded-full bg-current"/>4 due now</span>
            </div>
          </div>
          <span className="font-mono text-[7px] tracking-[0.06em] uppercase font-semibold text-white/85">View all ›</span>
        </div>

        {/* Tile grid */}
        <div className="grid grid-cols-2 gap-1.5">
          {tiles.map(({ label, status, sub, count, d }) => {
            const t = MOCK_CHECK_TONE[status]
            return (
              <div key={label} className={`bg-paper border rounded-lg p-2 flex flex-col gap-1.5 min-h-[60px] ${status==='overdue'?'border-danger/30':'border-charcoal/10'}`}>
                <div className="flex items-start justify-between">
                  <span className={`w-[22px] h-[22px] rounded-md flex items-center justify-center ${t.icon}`}>
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
        <div className="mt-2 bg-paper border border-charcoal/10 rounded-lg px-2.5 py-2 flex items-center gap-2">
          <span className="w-[22px] h-[22px] rounded-md bg-surface text-charcoal/75 flex items-center justify-center shrink-0">
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
    <div className="bg-[#f0efec] flex flex-col" style={{ width:272, height:572, overflow:'hidden' }}>
      <MockAppHeader />

      {/* Scrollable content */}
      <div className="flex-1 overflow-hidden">
        {/* Greeting */}
        <div className="px-4 pt-3 pb-2">
          <p className="text-[9px] tracking-widest uppercase text-charcoal/35 mb-0.5">SATURDAY, 28 JUNE · 09:14</p>
          <p className="text-[18px] font-bold text-charcoal leading-tight">Good morning, James.</p>
          <p className="text-[9px] text-charcoal/40 mt-0.5">DEPOT <span className="inline-flex items-center gap-0.5 bg-accent/15 text-accent px-1 py-px rounded text-[8px] font-semibold">PRO</span> · 9 of 22 daily checks complete</p>
        </div>

        {/* Needs You */}
        <div className="mx-3 mb-3 bg-white border border-charcoal/8 rounded-2xl overflow-hidden">
          <div className="px-3 py-2 border-b border-charcoal/6 flex items-center justify-between">
            <span className="text-[9px] font-bold tracking-widest text-charcoal/50 uppercase">NEEDS YOU</span>
            <span className="bg-accent text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">3</span>
          </div>
          <div className="flex items-center gap-0">
            <div className="w-0.5 self-stretch bg-accent shrink-0" />
            <div className="flex-1 px-3 py-2.5 flex items-center justify-between border-b border-charcoal/6">
              <span className="text-[10px] font-semibold text-accent">4 cleaning tasks overdue</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-charcoal/25"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </div>
          <div className="flex items-center gap-0">
            <div className="w-0.5 self-stretch bg-[#3b82f6] shrink-0" />
            <div className="flex-1 px-3 py-2.5 flex items-center justify-between border-b border-charcoal/6">
              <span className="text-[10px] font-semibold text-[#3b82f6]">2 leave requests pending</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-charcoal/25"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </div>
          <div className="flex items-center gap-0">
            <div className="w-0.5 self-stretch bg-brand shrink-0" />
            <div className="flex-1 px-3 py-2.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-brand">Fridge B temp not logged</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-charcoal/25"><polyline points="9 18 15 12 9 6"/></svg>
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
              <div key={label} className="bg-white border border-charcoal/8 rounded-xl p-2">
                <p className="text-[7px] tracking-wide uppercase text-charcoal/35 leading-tight mb-1">{label}</p>
                <p className={`text-[16px] font-bold leading-none ${col}`}>{val}</p>
                <p className="text-[7px] text-charcoal/40 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* My Clock */}
        <div className="mx-3 mb-3 bg-brand rounded-2xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] tracking-widest uppercase text-cream/40">MY CLOCK</span>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" style={{ boxShadow:'0 0 5px #4ade80' }}/>
              <span className="text-[8px] text-cream/60 font-medium">CLOCKED IN</span>
            </div>
          </div>
          <p className="text-[26px] font-bold text-cream leading-none tracking-tight mb-2">09:14</p>
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
    { iBg:'#fef0e8', iCol:'#c94f2a', icon:'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',      label:'My Shifts',     sub:'3 SWAPS PENDING',        sCol:'#c94f2a',              badge:'3', bCol:'#c94f2a', check:false },
    { iBg:'#fef0e8', iCol:'#c94f2a', icon:'M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14',                label:'Time Off',      sub:'1 PENDING',              sCol:'#c94f2a',              badge:'1', bCol:'#c94f2a', check:false },
    { iBg:'#fef0e8', iCol:'#c94f2a', icon:'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',      label:'Rota',          sub:'DRAFT · READY TO PUBLISH',sCol:'#c94f2a',             badge:null,bCol:null,    check:false },
    { iBg:'#e8f5ee', iCol:'#1a7a4c', icon:'M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z', label:'Training', sub:'ALL UP TO DATE', sCol:'#1a7a4c', badge:null, bCol:null, check:true },
    { iBg:'#f0efec', iCol:'#9ca3af', icon:'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',                                                   label:'Hours',         sub:'VIEW TIMESHEETS',        sCol:'rgba(26,26,24,0.35)',  badge:null,bCol:null,    check:false },
    { iBg:'#f0efec', iCol:'#9ca3af', icon:'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', label:'Staff Members', sub:'11 ACTIVE', sCol:'rgba(26,26,24,0.35)', badge:null, bCol:null, check:false },
    { iBg:'#f0efec', iCol:'#9ca3af', icon:'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',      label:'My Calendar',   sub:'NO UPCOMING EVENTS',     sCol:'rgba(26,26,24,0.35)',  badge:null,bCol:null,    check:false },
  ]
  return (
    <div className="bg-[#f0efec] flex flex-col" style={{ width:272, height:572, overflow:'hidden' }}>
      <MockAppHeader />

      {/* Scrollable content */}
      <div className="flex-1 overflow-hidden px-3 pt-3">
        {/* Title */}
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <p className="text-[9px] tracking-widest uppercase text-charcoal/35">TEAM</p>
            <p className="text-[17px] font-bold text-charcoal leading-tight">Your team</p>
          </div>
          <span className="text-[10px] text-brand/50 font-medium">Edit</span>
        </div>

        {/* On shift banner */}
        <div className="bg-brand rounded-2xl px-3.5 py-3 mb-3 flex items-center justify-between">
          <div>
            <p className="text-[8px] tracking-widest uppercase text-cream/40 mb-0.5">ON SHIFT NOW</p>
            <p className="text-[12px] font-bold text-cream">5 staff clocked in</p>
          </div>
          <div className="flex items-center gap-1 text-cream/50">
            <span className="text-[9px] font-semibold tracking-wide">ATTENDANCE</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>

        {/* Tile grid */}
        <div className="grid grid-cols-2 gap-2">
          {tiles.map(({ iBg, iCol, icon, label, sub, sCol, badge, bCol, check }) => (
            <div key={label} className="bg-white border border-charcoal/8 rounded-2xl p-3 relative">
              {badge && (
                <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: bCol }}>{badge}</span>
              )}
              {check && !badge && (
                <svg className="absolute top-3 right-3" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1a7a4c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              )}
              <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2" style={{ background: iBg }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={iCol} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d={icon}/></svg>
              </div>
              <p className="text-[11px] font-bold text-charcoal leading-tight">{label}</p>
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
    { n:'Amy',    r:'KITCHEN', cost:'£397.50', shifts:[null, { t:'08:00–14:00', l:'Kitchen', c:'#2a7c56' }, null, { t:'06:00–14:00', l:'Kitchen', c:'#2a7c56' }, { t:'06:30–14:00', l:'Kitchen', c:'#2a7c56' }, { t:'07:30–14:00', l:'Kitchen', c:'#2a7c56' }, null] },
    { n:'Beth',   r:'FOH',     cost:'£262.67', shifts:[null, null, null, { t:'06:55–15:00', l:'Barista', c:'#c94f2a' }, { t:'06:55–15:00', l:'Barista', c:'#c94f2a' }, { t:'TIME OFF', c:'off' }, { t:'08:30–14:00', l:'Barista', c:'#c94f2a' }] },
    { n:'Claire', r:'FOH',     cost:'£126.58', shifts:[null, null, null, null, null, { t:'07:55–15:00', l:'FOH', c:'#1a7a4c' }, { t:'08:55–14:00', l:'Barista', c:'#c94f2a' }] },
    { n:'Diana',  r:'FOH',     cost:'£326.00', shifts:[null, null, null, { t:'06:55–15:00', l:'Barista', c:'#c94f2a' }, { t:'06:55–15:00', l:'FOH', c:'#1a7a4c' }, { t:'07:00–14:00', l:'FOH', c:'#1a7a4c' }, { t:'08:30–14:00', l:'FOH', c:'#1a7a4c' }] },
    { n:'Dan',    r:'FOH',     cost:'—',        shifts:[null, null, null, { t:'TIME OFF', c:'off' }, { t:'TIME OFF', c:'off' }, { t:'TIME OFF', c:'off' }, null] },
  ]
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.22)] ring-1 ring-charcoal/8">
      {/* Header */}
      <div className="bg-[#f8f8f6] border-b border-charcoal/8 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <span className="text-[8px] text-charcoal/35 tracking-widest uppercase">TEAM / </span>
            <span className="text-[14px] font-bold text-charcoal">Rota Manager</span>
          </div>
          <span className="text-[8px] font-semibold bg-accent/10 text-accent px-2 py-0.5 rounded-full">3 shift swap requests pending</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button className="text-[8px] font-semibold text-charcoal/45 border border-charcoal/15 px-2 py-1 rounded">✦ AUTO-FILL</button>
          <button className="text-[8px] font-semibold bg-brand text-cream px-2.5 py-1 rounded">Send notification</button>
        </div>
      </div>
      {/* Legend */}
      <div className="px-4 py-2 flex items-center gap-4 border-b border-charcoal/6">
        {[['AVAILABLE','#1a7a4c'],['UNAVAILABLE','#9ca3af'],['TIME OFF','#a85d12'],['CLOSED','#d1d5db']].map(([l,c])=>(
          <div key={l} className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ backgroundColor:c }}/><span className="text-[7px] text-charcoal/40 font-medium">{l}</span></div>
        ))}
      </div>
      {/* Grid */}
      <div className="p-3 overflow-hidden">
        {/* Day headers */}
        <div className="grid mb-1.5" style={{ gridTemplateColumns:'72px repeat(7,1fr) 72px' }}>
          <div className="text-[6px] tracking-widest uppercase text-charcoal/25 flex items-end pb-1">STAFF</div>
          {days.map(({ d, dt, today, closed }) => (
            <div key={d} className={`text-center py-1.5 rounded-md ${today?'bg-brand/8':''}`}>
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
                className="rounded-md mx-0.5 flex flex-col items-center justify-center py-1.5 min-h-[34px]"
                style={{
                  backgroundColor: s ? (s.c==='off' ? 'rgba(168,93,18,0.12)' : s.c+'20') : 'transparent',
                  border: s ? `1px solid ${s.c==='off'?'rgba(168,93,18,0.3)':s.c+'44'}` : '1px dashed rgba(26,26,24,0.06)',
                }}
              >
                {s && s.c !== 'off' && <>
                  <p className="text-[6px] font-bold leading-tight text-center" style={{ color:s.c }}>{s.t}</p>
                  <p className="text-[6px] leading-tight text-center" style={{ color:s.c+'aa' }}>{s.l}</p>
                </>}
                {s && s.c === 'off' && <p className="text-[6px] font-semibold text-[#a85d12]">TIME OFF</p>}
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

/* ─── FAQ ───────────────────────────────────────────────────────────────── */
function Faq({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-charcoal/8 last:border-0">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between py-4 text-left gap-4 cursor-pointer">
        <span className="text-sm font-medium text-charcoal">{q}</span>
        <span className="shrink-0 text-charcoal/30 transition-transform duration-300" style={{ transform: open ? 'rotate(180deg)' : 'none' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </button>
      {open && <p className="text-sm text-charcoal/50 pb-4 leading-relaxed">{a}</p>}
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
  const Chk = ({ green }) => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={green ? 'text-[#1a7a4c]' : 'text-brand/60'}>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )

  return (
    <section id="pricing" className="bg-[#f3f3ef]">
      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
        <FadeUp>
          <h2 className="text-4xl sm:text-5xl font-bold text-charcoal tracking-tight leading-tight mb-2">One price. No surprises.</h2>
          <p className="text-charcoal/45 text-base mb-8 max-w-xs leading-relaxed">Priced per venue, not per head. No hidden charges. Cancel any time.</p>
        </FadeUp>
        <FadeUp delay={50}>
          <div className="inline-flex items-center bg-white rounded-xl p-1 gap-1 mb-8 shadow-sm border border-charcoal/8">
            {[['Monthly',false],['Annual',true]].map(([label,val])=>(
              <button key={label} onClick={()=>setAnnual(val)} className={`text-sm font-medium px-5 py-2.5 rounded-lg transition-all cursor-pointer flex items-center gap-2 ${annual===val?'bg-brand text-cream shadow-sm':'text-charcoal/45 hover:text-charcoal'}`}>
                {label}
                {label==='Annual' && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${annual?'bg-white/20 text-cream':'bg-accent/10 text-accent'}`}>2 mo. free</span>}
              </button>
            ))}
          </div>
        </FadeUp>
        <div className="grid sm:grid-cols-2 gap-5 max-w-2xl">
          {PLAN_ORDER.map((id, idx) => (
            <FadeUp key={id} delay={70 + idx * 60}>
              {id === PLANS.PRO ? (
                <div className="bg-white rounded-xl border-2 border-brand shadow-[0_8px_24px_rgba(19,54,42,0.10)] p-7 flex flex-col h-full">
                  <p className="text-[10px] tracking-widest uppercase text-brand font-semibold mb-4">{PLAN_DETAILS.pro.name}</p>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-4xl font-bold text-charcoal">{pp}</span>
                    <span className="text-charcoal/35 text-sm">{sfx}</span>
                  </div>
                  <p className="text-xs text-charcoal/35 mb-1">{PLAN_DETAILS.pro.venueNote} · {ep}{sfx} each extra</p>
                  {annual && <p className="text-xs font-medium text-brand mb-1">Save £50 vs monthly</p>}
                  <div className="bg-[#f5f4f1] rounded-xl p-4 my-5">
                    <p className="text-[10px] tracking-widest uppercase text-charcoal/30 mb-3">As you grow</p>
                    {[1,2,3,5].map(n=>(
                      <div key={n} className="flex justify-between py-1">
                        <span className="text-xs text-charcoal/45">{n} venue{n>1?'s':''}</span>
                        <span className="text-xs font-semibold text-charcoal">£{ppn+(n-1)*epn}{sfx}</span>
                      </div>
                    ))}
                  </div>
                  <ul className="flex flex-col gap-2.5 mb-7 flex-1">
                    {PRO_FEATURES.map((f,i)=>(
                      <li key={f} className="flex items-start gap-2 text-xs text-charcoal/60">
                        <span className="mt-0.5 shrink-0"><Chk green={false}/></span>
                        {i===0?<strong className="text-charcoal/75">{f}</strong>:f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/signup?plan=pro" className="block text-center bg-accent text-cream py-3.5 rounded-xl text-sm font-semibold hover:bg-accent/90 active:scale-[0.98] transition-all cursor-pointer">
                    Start free trial
                  </Link>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-charcoal/12 shadow-[0_4px_12px_rgba(0,0,0,0.04)] p-7 flex flex-col h-full">
                  <p className="text-[10px] tracking-widest uppercase text-brand font-semibold mb-4">{PLAN_DETAILS.starter.name}</p>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-4xl font-bold text-charcoal">{sp}</span>
                    <span className="text-charcoal/35 text-sm">{sfx}</span>
                  </div>
                  <p className="text-xs text-charcoal/35 mb-1">{PLAN_DETAILS.starter.venueNote}</p>
                  {annual && <p className="text-xs font-medium text-brand mb-1">Save £20 vs monthly</p>}
                  <p className="text-xs text-charcoal/50 leading-relaxed my-5">Everything you need to stay compliant and get off paper.</p>
                  <ul className="flex flex-col gap-2.5 mb-7 flex-1">
                    {STARTER_FEATURES.map(f=>(
                      <li key={f} className="flex items-start gap-2 text-xs text-charcoal/60">
                        <span className="mt-0.5 shrink-0"><Chk green={true}/></span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/signup?plan=starter" className="block text-center border-2 border-brand/25 text-brand py-3.5 rounded-xl text-sm font-semibold hover:bg-brand hover:text-cream transition-all cursor-pointer">
                    Start free trial
                  </Link>
                </div>
              )}
            </FadeUp>
          ))}
        </div>
        <p className="text-xs text-charcoal/30 mt-5">7-day free trial · No card required to start</p>
      </div>
    </section>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   PAGE
   ══════════════════════════════════════════════════════════════════════════ */
export default function MarketingPage() {
  const [navScrolled, setNavScrolled] = useState(false)
  useEffect(() => {
    const h = () => setNavScrolled(window.scrollY > 20)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  return (
    <div className="min-h-dvh font-sans text-charcoal bg-white overflow-x-hidden">
      <GlobalCSS />

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 transition-all duration-500" style={{ background: navScrolled ? 'rgba(255,255,255,0.95)' : 'rgba(19,54,42,0.76)', backdropFilter: 'blur(24px) saturate(200%)', borderBottom: navScrolled ? '1px solid rgba(26,26,24,0.07)' : '1px solid rgba(255,255,255,0.07)' }}>
        <div className="max-w-5xl mx-auto px-6 sm:px-10 h-14 flex items-center justify-between">
          <PeliknLogo light={!navScrolled} />
          <nav className="hidden sm:flex items-center gap-1">
            {[['Compliance','#compliance'],['Team','#team'],['Pricing','#pricing']].map(([l,h])=>(
              <a key={l} href={h} className={`text-sm px-3 py-2 rounded-lg transition-colors duration-200 cursor-pointer ${navScrolled?'text-charcoal/40 hover:text-charcoal':'text-cream/45 hover:text-cream/80'}`}>{l}</a>
            ))}
          </nav>
          <div className="flex items-center gap-1.5">
            <Link to="/login" className={`text-sm font-medium transition-colors duration-200 px-4 py-2 rounded-lg cursor-pointer ${navScrolled?'text-charcoal/40 hover:text-charcoal':'text-cream/45 hover:text-cream/80'}`}>Sign in</Link>
            <Link to="/signup" className="relative overflow-hidden text-sm font-semibold text-cream bg-accent hover:bg-[#b8431f] transition-colors duration-200 px-4 py-2 rounded-xl cursor-pointer shadow-[0_2px_8px_rgba(201,79,42,0.35)] hover:shadow-[0_4px_14px_rgba(201,79,42,0.45)]">
              Free trial
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="bg-brand relative overflow-hidden">
        {/* Dot grid */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden style={{ backgroundImage:'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize:'28px 28px' }} />
        {/* Glow */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] pointer-events-none" aria-hidden style={{ background:'radial-gradient(ellipse at top right, rgba(201,79,42,0.12) 0%, transparent 60%)' }} />
        {/* Logomark watermark */}
        <div className="absolute pointer-events-none select-none" aria-hidden style={{ right:'-6%', top:'50%', transform:'translateY(-50%)', width:600, opacity:0.06 }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="35 45 159 130" width="600" height="491">
            <defs>
              <mask id="bowlCutHero">
                <rect x="35" y="45" width="159" height="130" fill="#fff"/>
                <path d="M115.885 112.528L117.692 112.43L117.82 113.122C108.293 130.003 99.3165 168.774 72.1173 158.689C69.2664 157.636 66.767 155.524 64.4598 153.57C56.1221 143.529 55.4785 134.779 55.0114 122.257C74.4165 118.926 96.4877 114.885 115.885 112.528Z" fill="#000"/>
              </mask>
            </defs>
            <g mask="url(#bowlCutHero)" fill="#ffffff">
              <path d="M111.581 104.182C96.2532 104.543 80.9327 105.088 65.6202 105.829C60.5271 106.056 45.127 107.88 41.575 105.113C40.7355 102.743 40.8666 103.955 41.3785 101.335C43.6299 98.8182 47.2266 98.3284 50.4259 98.659C63.5708 100.006 131.793 91.8746 139.38 94.6178C143.225 99.2529 133.006 106.588 129.368 111.762C114.802 132.477 110.197 170.39 77.5307 168.731C49.3708 165.694 45.8813 136.75 46.7483 115.308C70.6601 112.405 93.878 108.474 117.612 105.315C116.161 104.28 113.504 104.335 111.581 104.182Z"/>
              <path d="M148.644 51.1993C183.239 49.7481 187.978 90.0071 164.264 109.344C142.392 127.174 130.764 152.291 163.008 168.658L160.027 168.645C139.961 168.474 133.495 157.422 134.31 138.44C137.83 118.498 152.458 110.25 164.662 95.8485C177.496 80.4735 167.956 55.9997 146.305 60.1389C135.522 62.1963 128.977 74.4423 123.111 82.935C119.461 82.935 115.959 83.1248 112.322 83.3085C122.658 68.6928 129.24 54.0955 148.644 51.1993Z"/>
            </g>
          </svg>
        </div>

        {/* Bottom gradient fade into next section */}
        <div className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none" aria-hidden style={{ background:'linear-gradient(to bottom, transparent, rgba(19,54,42,0.6))' }} />

        <div className="max-w-4xl mx-auto px-6 sm:px-10 pt-20 sm:pt-32 pb-0 relative text-center">
          {/* Pill badge */}
          <div style={{ animation:'pkIn 0.55s cubic-bezier(.16,1,.3,1) both' }}>
            <div className="inline-flex items-center gap-2.5 bg-cream/6 border border-cream/10 rounded-full px-4 py-2 mb-10">
              <div className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" style={{ animation:'pkPulse 2.4s ease-in-out infinite' }} />
              <span className="text-[12px] font-semibold text-cream/70 tracking-[0.12em] uppercase">Always inspection-ready</span>
            </div>
          </div>
          {/* Headline */}
          <h1 className="text-[56px] sm:text-[80px] lg:text-[104px] font-bold text-cream leading-[0.96] tracking-[-0.04em] mb-8" style={{ animation:'pkIn 0.75s 60ms cubic-bezier(.16,1,.3,1) both' }}>
            Ditch the<br />clipboard,<br />
            <span style={{ backgroundImage:'linear-gradient(180deg,rgba(245,244,241,0.92) 0%,rgba(245,244,241,0.4) 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>keep the compliance.</span>
          </h1>
          {/* Subtitle */}
          <p className="text-cream/60 text-[17px] sm:text-[18px] max-w-[480px] mx-auto leading-[1.7] mb-10" style={{ animation:'pkIn 0.75s 140ms cubic-bezier(.16,1,.3,1) both' }}>
            One app for food safety records, rotas, timesheets and team management. EHO-ready from day one, on any device, for the whole team.
          </p>
          {/* CTAs */}
          <div className="flex flex-wrap justify-center items-center gap-4 mb-7" style={{ animation:'pkIn 0.65s 210ms cubic-bezier(.16,1,.3,1) both' }}>
            <Link to="/signup" className="bg-accent text-cream px-8 py-4 rounded-xl text-[15px] font-semibold hover:bg-[#b8431f] hover:shadow-[0_10px_32px_rgba(201,79,42,0.55)] active:scale-[0.97] transition-all duration-200 cursor-pointer shadow-[0_4px_20px_rgba(201,79,42,0.45)]">
              Start free for 7 days
            </Link>
            <a href="#compliance" className="flex items-center gap-2 text-cream/45 text-[15px] hover:text-cream/70 transition-colors duration-200 cursor-pointer">
              See how it works
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </a>
          </div>
          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-20" style={{ animation:'pkIn 0.6s 280ms cubic-bezier(.16,1,.3,1) both' }}>
            {['No card required','Cancel any time','UK-based data hosting'].map(t=>(
              <div key={t} className="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-cream/35"><polyline points="20 6 9 17 4 12"/></svg>
                <span className="text-[13px] text-cream/40">{t}</span>
              </div>
            ))}
          </div>
          {/* Hero phones — staggered rise */}
          <div className="flex justify-center gap-5 sm:gap-10 items-end">
            <div className="hidden sm:block" style={{ transform:'translateY(48px)', animation:'pkRise 1s 350ms cubic-bezier(.16,1,.3,1) both' }}>
              <IPhoneFrame><MockMobileHome /></IPhoneFrame>
            </div>
            <div style={{ animation:'pkRise 1s 420ms cubic-bezier(.16,1,.3,1) both' }}>
              <IPhoneFrame><MockTeamHub /></IPhoneFrame>
            </div>
          </div>
        </div>
        <div className="h-24 sm:h-32" />
      </section>

      <ReplacesStrip />

      {/* ── Compliance ───────────────────────────────────────────────────── */}
      <section id="compliance" className="bg-white">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-24 sm:py-36">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20 items-center">
            <div>
              <FadeUp>
                <span className="inline-block text-[11px] tracking-[0.12em] uppercase text-brand font-semibold bg-brand/8 px-3.5 py-1.5 rounded-full mb-6">Food safety</span>
                <h2 className="text-[40px] sm:text-[52px] lg:text-[56px] font-bold text-charcoal tracking-[-0.025em] leading-[1.05] mb-6">
                  If the EHO walked<br />in today, would<br />you be ready?
                </h2>
                <p className="text-charcoal/55 text-[17px] leading-[1.75] mb-10 max-w-md">
                  Every temp log, cleaning record, allergen check and delivery sign-off captured and stored. Export a full audit trail PDF in one tap, exactly how an inspector expects it.
                </p>
              </FadeUp>
              <div className="flex flex-col gap-7">
                {[
                  { title:'Temperature logs',   desc:'Fridge, cooking, reheating and hot holding. Automatic pass/fail detection against your thresholds.' },
                  { title:'Cleaning schedules',  desc:'Daily, weekly and ad-hoc tasks assigned to staff. Live completion status at a glance.' },
                  { title:'Allergen registry',   desc:"All 14 allergens across every dish on your menu. Natasha's Law compliant by design." },
                  { title:'Audit-ready exports', desc:'One tap to a full compliance PDF. Timestamped, signed, formatted for inspection.' },
                ].map(({ title, desc }, i) => (
                  <FadeUp key={title} delay={i * 55}>
                    <div className="flex gap-4 group cursor-default">
                      <div className="w-0.5 rounded-full bg-brand/20 group-hover:bg-brand transition-colors duration-300 shrink-0 mt-1.5" style={{ minHeight:52 }}/>
                      <div className="transition-transform duration-300 group-hover:translate-x-0.5">
                        <p className="text-[15px] font-semibold text-charcoal mb-1.5">{title}</p>
                        <p className="text-[15px] text-charcoal/55 leading-[1.7]">{desc}</p>
                      </div>
                    </div>
                  </FadeUp>
                ))}
              </div>
              <FadeUp delay={250}>
                <Link to="/signup" className="inline-flex items-center gap-2 bg-brand text-cream px-6 py-3.5 rounded-xl text-[15px] font-semibold hover:bg-brand/85 hover:shadow-[0_6px_20px_rgba(19,54,42,0.25)] hover:-translate-y-0.5 transition-all duration-200 mt-10 cursor-pointer">
                  Start free trial
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </Link>
              </FadeUp>
            </div>
            <FadeUp dir="right" delay={80} className="flex justify-center lg:justify-end">
              <div className="flex flex-col items-center gap-10">
                <div className="lg:hidden">
                  <p className="text-[11px] tracking-[0.1em] uppercase text-charcoal/35 font-medium text-center mb-4">Staff view</p>
                  <IPhoneFrame><MockMobileHome /></IPhoneFrame>
                </div>
                <div>
                  <p className="text-[11px] tracking-[0.1em] uppercase text-charcoal/35 font-medium text-center mb-4">Checks hub</p>
                  <IPhoneFrame><MockChecksHub /></IPhoneFrame>
                </div>
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ── Team ─────────────────────────────────────────────────────────── */}
      <section id="team" className="bg-charcoal">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 pt-24 sm:pt-36 pb-24 sm:pb-36">
          {/* Heading */}
          <FadeUp className="max-w-3xl mb-12 sm:mb-16">
            <span className="inline-block text-[11px] tracking-[0.12em] uppercase text-accent font-semibold bg-accent/12 px-3.5 py-1.5 rounded-full mb-6">Team &amp; scheduling · Pro</span>
            <h2 className="text-[40px] sm:text-[52px] lg:text-[60px] font-bold text-cream tracking-[-0.025em] leading-[1.05] mb-6">
              Stop managing your<br />team over WhatsApp.
            </h2>
            <p className="text-cream/55 text-[17px] leading-[1.75] max-w-xl">
              Build the rota in minutes, publish it, done. Timesheets write themselves. Swaps and time-off come through the app. You stop being the middleman.
            </p>
          </FadeUp>
          {/* Rota — full width */}
          <FadeUp dir="up" delay={60} className="mb-12 sm:mb-16">
            <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0 sm:overflow-visible">
              <MockRota />
            </div>
          </FadeUp>
          {/* Features */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {[
              { n:'Rota builder',  d:'Drag-and-drop or auto-fill from your patterns' },
              { n:'Timesheets',    d:'Staff clock in/out on the app, exports to payroll' },
              { n:'Time off',      d:'Requests, approvals and shift swaps all in-app' },
              { n:'Training',      d:'Cert records and 30-day expiry alerts' },
              { n:'Tips',          d:'Enter the pot, set the split. Full audit trail' },
              { n:'Multi-venue',   d:'One login for every site you run' },
            ].map(({ n, d }, i) => (
              <FadeUp key={n} delay={i * 40}>
                <div className="border border-cream/8 rounded-2xl p-5 hover:border-cream/18 hover:bg-cream/5 hover:-translate-y-0.5 transition-all duration-300 ease-[cubic-bezier(.16,1,.3,1)] cursor-default">
                  <p className="text-[15px] font-semibold text-cream mb-1.5">{n}</p>
                  <p className="text-[13px] text-cream/50 leading-[1.65]">{d}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <section className="bg-brand">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-24 sm:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-0 lg:divide-x lg:divide-cream/12">
            {[
              { value:'An afternoon', sub:'From sign-up to your first check logged.', delay:0 },
              { value:'One app',      sub:'Checks, rotas, timesheets, training and tips.', delay:80 },
              { value:'Any device',   sub:'Phone, tablet and desktop. Staff use their own phones.', delay:160 },
            ].map(({ value, sub, delay }) => (
              <FadeUp key={value} delay={delay} className="lg:px-8 first:pl-0 last:pr-0">
                <p className="text-[44px] lg:text-[40px] font-bold text-cream mb-3 tracking-[-0.03em] leading-none whitespace-nowrap">{value}</p>
                <p className="text-[15px] text-cream/55 leading-[1.6] max-w-xs">{sub}</p>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature grid ─────────────────────────────────────────────────── */}
      <section className="bg-[#f0efec]">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-24 sm:py-36">
          <FadeUp className="mb-14">
            <h2 className="text-[40px] sm:text-[52px] font-bold text-charcoal tracking-[-0.025em] leading-[1.05] mb-3">There's a lot more inside.</h2>
            <p className="text-charcoal/50 text-[17px] leading-[1.7] max-w-sm">A glimpse at what's waiting once you're in.</p>
          </FadeUp>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {[
              { icon:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', title:'Document vault',     desc:'Certificates, policies and insurance in one organised place.' },
              { icon:'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 7a4 4 0 100 8 4 4 0 000-8z', title:'Staff profiles',    desc:'Contact details, roles, certs and notes for every team member.' },
              { icon:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2 M9 3h6v4H9z', title:'Incident log',      desc:'Record anything that happens. Timestamped, signed, searchable.' },
              { icon:'M22 12h-4l-3 9L9 3l-3 9H2', title:'Probe calibration', desc:'Scheduled calibration records with pass/fail. Inspection-proof.' },
              { icon:'M5 12h14 M12 5l7 7-7 7', title:'Delivery checks',   desc:'Temp reading, condition notes, signed on arrival.' },
              { icon:'M3 4h18v18H3z M16 2v4 M8 2v4 M3 10h18', title:'Opening checklists', desc:'Start every shift the same way. Signed and consistent.' },
              { icon:'M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16', title:'Allergen registry',  desc:'Every dish, every allergen, always current.' },
              { icon:'M18 7c0-5.333-8-5.333-8 0 M10 7v14 M6 21h12 M6 13h10', title:'Tip distribution',  desc:'Enter the pot, set the split, done. Full audit trail.' },
              { icon:'M5 8h14 M5 12h14 M5 16h6', title:'Clock in / out',    desc:'Staff clock on from their phone. Timesheets build automatically.' },
            ].map(({ icon, title, desc }, i) => (
              <FadeUp key={title} delay={i * 30}>
                <div className="bg-white rounded-2xl border border-charcoal/8 p-6 hover:border-brand/20 hover:shadow-[0_12px_40px_rgba(19,54,42,0.09)] hover:-translate-y-1.5 transition-all duration-300 ease-[cubic-bezier(.16,1,.3,1)] h-full group cursor-default">
                  <div className="w-10 h-10 rounded-xl bg-brand/7 text-brand flex items-center justify-center mb-5 group-hover:bg-brand group-hover:text-cream transition-all duration-300">
                    <Ico d={icon} size={18} />
                  </div>
                  <p className="text-[15px] font-semibold text-charcoal mb-2">{title}</p>
                  <p className="text-[14px] text-charcoal/55 leading-[1.65]">{desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="bg-white">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-24 sm:py-36">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20 items-center">
            <FadeUp>
              <span className="inline-block text-[11px] tracking-[0.12em] uppercase text-brand font-semibold bg-brand/8 px-3.5 py-1.5 rounded-full mb-6">Setup</span>
              <h2 className="text-[40px] sm:text-[52px] lg:text-[56px] font-bold text-charcoal tracking-[-0.025em] leading-[1.05] mb-6">Live this afternoon.</h2>
              <p className="text-charcoal/55 text-[17px] leading-[1.75] mb-8 max-w-sm">
                No IT department needed. Open Pelikn in your browser, add it to your home screen and it works like any other app. Offline included.
              </p>
              <Link to="/signup" className="inline-flex items-center gap-2 bg-brand text-cream px-6 py-3.5 rounded-xl text-[15px] font-semibold hover:bg-brand/85 hover:shadow-[0_6px_20px_rgba(19,54,42,0.25)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
                Get started free
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
            </FadeUp>
            <div className="flex flex-col gap-0">
              {[
                { n:'01', title:'Sign up', desc:'Create your account and set up your venue. Name, location, your first team members. About five minutes.' },
                { n:'02', title:'Install on any device', desc:"Open get-pelikn.com in Safari or Chrome. Tap 'Add to Home Screen'. It lands on your home screen like any other app." },
                { n:'03', title:'Invite your team', desc:"Send invite links. Staff install the app and they're ready to log checks, see their rota and clock in." },
              ].map(({ n, title, desc }, i) => (
                <FadeUp key={n} delay={i * 65}>
                  <div className="flex gap-5 items-start pb-9 last:pb-0 relative group cursor-default">
                    {i < 2 && <div className="absolute left-[20px] top-12 bottom-0 w-px bg-charcoal/8"/>}
                    <div className="w-11 h-11 rounded-full border-2 border-charcoal/10 bg-white flex items-center justify-center shrink-0 z-10 transition-all duration-300 group-hover:border-brand/30 group-hover:shadow-[0_4px_14px_rgba(19,54,42,0.12)]">
                      <span className="text-[12px] font-bold text-charcoal/30 tabular-nums group-hover:text-brand/60 transition-colors duration-300">{n}</span>
                    </div>
                    <div className="pt-2">
                      <p className="text-[16px] font-semibold text-charcoal mb-2">{title}</p>
                      <p className="text-[15px] text-charcoal/55 leading-[1.7]">{desc}</p>
                    </div>
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <Pricing />

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="bg-white">
        <div className="max-w-2xl mx-auto px-6 sm:px-10 py-24 sm:py-32">
          <FadeUp>
            <h2 className="text-[36px] sm:text-[44px] font-bold text-charcoal tracking-[-0.02em] mb-10">Common questions</h2>
          </FadeUp>
          <FadeUp delay={50}>
            <div className="border-t border-charcoal/8">
              {[
                { q:'Is this on the App Store?', a:"Not yet. Today Pelikn runs in your browser. Add it to your home screen in about 30 seconds and it opens like any other app, even when the signal drops. iPhone and Android apps are on the way." },
                { q:'Does it work on iPhone, iPad and Android?', a:"Yes, all of them. Install from Safari on iOS/iPadOS, or Chrome on Android. The manager dashboard works in any desktop browser with no install needed." },
                { q:"What's the difference between Starter and Pro?", a:`Starter covers everything on the compliance side: temperature logs, cleaning records, allergens, checklists and exports, for one venue and up to ${STARTER_STAFF_LIMIT} staff. Pro adds the whole team layer: rotas, timesheets, clock in/out, training records, tips and time off, with unlimited staff and multiple venues.` },
                { q:'What counts as a venue?', a:"Each physical location is a venue. Starter covers one venue. On Pro, your first venue is £25/mo and each extra one is £15/mo. Add a venue whenever you like and your bill updates automatically." },
                { q:'Is my data secure?', a:"All data is stored in a UK-based database with row-level security, so staff only ever see their own venue's data. We handle personal data in line with UK GDPR." },
                { q:'Can I cancel?', a:"Whenever you like. No contracts, no cancellation fees. Cancel from Plan & Billing in Settings and you keep access until the end of the period you've paid for." },
              ].map(({ q, a }) => <Faq key={q} q={q} a={a} />)}
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="bg-brand relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden style={{ backgroundImage:'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize:'28px 28px' }} />
        <div className="absolute top-0 left-0 w-[600px] h-[600px] pointer-events-none" aria-hidden style={{ background:'radial-gradient(ellipse at top left, rgba(201,79,42,0.14) 0%, transparent 60%)' }} />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] pointer-events-none" aria-hidden style={{ background:'radial-gradient(ellipse at bottom right, rgba(19,54,42,0.8) 0%, transparent 70%)' }} />
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-28 sm:py-40 relative">
          <FadeUp>
            <h2 className="text-[52px] sm:text-[68px] lg:text-[84px] font-bold text-cream tracking-[-0.035em] leading-[1.0] mb-6 max-w-2xl">
              Ditch the clipboard.<br />Keep the compliance.
            </h2>
            <p className="text-cream/50 text-[17px] leading-[1.7] mb-10 max-w-xs">
              7 days free. No card. Set up in an afternoon.
            </p>
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <Link to="/signup" className="bg-accent text-cream px-8 py-4 rounded-xl text-[15px] font-semibold hover:bg-[#b8431f] hover:shadow-[0_10px_36px_rgba(201,79,42,0.55)] hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200 text-center cursor-pointer shadow-[0_4px_24px_rgba(201,79,42,0.42)]">
                Start free trial
              </Link>
              <a href="mailto:hello@get-pelikn.com" className="border border-cream/14 text-cream/45 hover:text-cream/65 hover:border-cream/28 hover:-translate-y-0.5 px-8 py-4 rounded-xl text-[15px] font-medium transition-all duration-200 text-center cursor-pointer">
                Get in touch
              </a>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-charcoal/8">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-7 flex flex-col sm:flex-row items-center justify-between gap-4">
          <PeliknLogo />
          <a href="mailto:hello@get-pelikn.com" className="text-xs text-charcoal/30 hover:text-charcoal transition-colors">hello@get-pelikn.com</a>
          <div className="flex items-center gap-6">
            {[['Privacy','/privacy'],['Terms','/terms'],['Sign in','/login']].map(([l,h])=>(
              <Link key={l} to={h} className="text-xs text-charcoal/30 hover:text-charcoal transition-colors cursor-pointer">{l}</Link>
            ))}
          </div>
        </div>
        <div className="border-t border-charcoal/5 py-3 text-center">
          <p className="text-[11px] text-charcoal/16">© {new Date().getFullYear()} <span className="font-semibold tracking-[0.18em] uppercase">Pelikn</span> · UK-based data hosting</p>
        </div>
      </footer>
    </div>
  )
}
