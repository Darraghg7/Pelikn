import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  STARTER_PRICE, PRO_PRICE, EXTRA_VENUE_PRICE,
  PRO_PRICE_NUM, EXTRA_VENUE_PRICE_NUM,
  STARTER_ANNUAL, PRO_ANNUAL, EXTRA_VENUE_ANNUAL,
  PRO_ANNUAL_NUM, EXTRA_VENUE_ANNUAL_NUM,
} from '../../lib/pricing'

/* ─── Keyframes ─────────────────────────────────────────────────────────── */
function GlobalCSS() {
  return (
    <style>{`
      /* Generic entrance — slight Y + scale for depth */
      @keyframes pkIn {
        from { opacity:0; transform:translateY(16px) scale(0.98); }
        to   { opacity:1; transform:translateY(0) scale(1); }
      }
      /* Phone/mock entrance — rises from below */
      @keyframes pkRise {
        from { opacity:0; transform:translateY(52px) scale(0.96); }
        to   { opacity:1; transform:translateY(0) scale(1); }
      }
      /* Pill badge glow-pulse */
      @keyframes pkPulse {
        0%,100% { opacity:1; box-shadow:0 0 0 0 rgba(26,122,76,0.5); }
        60%      { opacity:0.55; box-shadow:0 0 0 5px rgba(26,122,76,0); }
      }
      /* Subtle shimmer on nav CTA */
      @keyframes pkShimmer {
        from { transform:translateX(-100%) skewX(-12deg); }
        to   { transform:translateX(220%) skewX(-12deg); }
      }
    `}</style>
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

/* ─── CountUp ───────────────────────────────────────────────────────────── */
function CountUp({ to, suffix = '', duration = 1600 }) {
  const [val, setVal] = useState(0)
  const ref = useRef(null), done = useRef(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const ob = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !done.current) {
        done.current = true; ob.disconnect()
        const t0 = performance.now()
        const tick = now => {
          const p = Math.min((now - t0) / duration, 1)
          setVal(Math.round((1 - Math.pow(1 - p, 3)) * to))
          if (p < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }
    }, { threshold: 0.5 })
    ob.observe(el); return () => ob.disconnect()
  }, [to, duration])
  return <span ref={ref}>{val}{suffix}</span>
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

/* Mobile staff home */
function MockMobileHome() {
  return (
    <div className="bg-[#f3f3ef]" style={{ width: 272 }}>
      {/* Status bar — sits below dynamic island */}
      <div className="bg-brand px-4 pt-14 pb-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-cream tracking-widest">SALT</span>
          <span className="text-[9px] text-cream/40 border border-cream/20 px-2 py-0.5 rounded">Sign Out</span>
        </div>
      </div>
      <div className="px-4 pt-3 pb-1">
        <p className="text-[9px] tracking-widest uppercase text-charcoal/35">MY SHIFT</p>
        <p className="text-[17px] font-bold text-charcoal mt-0.5">Good afternoon, Emma</p>
      </div>
      {/* Notifications card */}
      <div className="mx-3 mb-3 bg-white border border-charcoal/8 rounded-2xl p-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-charcoal/8 flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-charcoal/50"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0"/></svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-charcoal">Notifications</p>
          <p className="text-[9px] text-charcoal/40 leading-tight">Get notified about rota changes and shift updates.</p>
        </div>
        <button className="bg-charcoal text-cream text-[9px] font-semibold px-2.5 py-1.5 rounded-lg shrink-0">Enable</button>
      </div>
      {/* Shift card */}
      <div className="mx-3 mb-3 bg-brand rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] tracking-widest uppercase text-cream/40">YOUR SHIFT</span>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" style={{ boxShadow:'0 0 6px #4ade80' }}/>
            <span className="text-[9px] text-cream/60 font-medium">TODAY</span>
          </div>
        </div>
        <p className="text-[24px] font-bold text-cream leading-none tracking-tight">08:00 – 14:00</p>
        <p className="text-[9px] text-cream/45 mt-1 mb-3">Kitchen · Wednesday, 24 June</p>
        <div className="bg-white/10 rounded-xl px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cream/45"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span className="text-[10px] text-cream/50">Not clocked in</span>
          </div>
          <button className="bg-white text-brand text-[10px] font-bold px-3 py-1.5 rounded-lg">Clock In</button>
        </div>
      </div>
      {/* Alert */}
      <div className="mx-3 mb-3 border border-accent/25 bg-[#fff3ee] rounded-2xl px-3.5 py-3 flex items-center gap-2.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c94f2a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span className="text-[11px] font-semibold text-accent">23 cleaning tasks due</span>
      </div>
      {/* Training alert */}
      <div className="mx-3 mb-3 border border-accent/20 bg-[#fff3ee] rounded-2xl p-3.5">
        <div className="flex items-center gap-2 mb-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c94f2a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span className="text-[10px] font-semibold text-accent">Training record needs your signature</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-charcoal">Sarah</p>
            <p className="text-[9px] text-charcoal/40">1 May 2026 · 6 topics</p>
          </div>
          <button className="bg-accent text-cream text-[9px] font-semibold px-3 py-1.5 rounded-lg">Sign now</button>
        </div>
      </div>
      {/* Quick log */}
      <div className="px-3 mb-3">
        <p className="text-[9px] tracking-widest uppercase text-charcoal/35 mb-2">LOG QUICKLY</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            ['Fridge temp','M12 3a9 9 0 100 18A9 9 0 0012 3z M12 7v5l3 3'],
            ['Checks','M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2 M9 3h6v4H9z m0 9l2 2 4-4'],
          ].map(([l,d])=>(
            <div key={l} className="bg-white border border-charcoal/8 rounded-2xl p-3 flex flex-col items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-charcoal/45"><path d={d}/></svg>
              <span className="text-[10px] font-medium text-charcoal/55">{l}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Bottom nav */}
      <div className="bg-white border-t border-charcoal/8 flex justify-around px-2 py-2.5 pb-4">
        {['My Shift','Tasks','My Shifts','Time Off'].map((t,i)=>(
          <div key={t} className="flex flex-col items-center gap-1">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${i===0?'bg-brand/10':''}`}>
              <div className={`w-4 h-4 rounded-sm ${i===0?'bg-brand/40':'bg-charcoal/12'}`}/>
            </div>
            <span className={`text-[8px] font-medium ${i===0?'text-brand':'text-charcoal/30'}`}>{t}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* Mobile checks grid */
function MockChecksGrid() {
  const checks = [
    { l:'Cleaning',      s:'13 OVERDUE',       warn:true,  ok:false, n:13 },
    { l:'Opening Checks',s:'0/14 DONE',         warn:false, ok:false, n:14 },
    { l:'Cooking Temps', s:'NONE LOGGED YET',   warn:false, ok:false, n:null },
    { l:'Hot Holding',   s:'NONE LOGGED YET',   warn:false, ok:false, n:null },
    { l:'Probe Cal.',    s:'DUE IN 3D',          warn:true,  ok:false, n:1 },
    { l:'Fridge Temps',  s:'4 CHECKED',          warn:false, ok:true,  n:null },
    { l:'Cooling Logs',  s:'NONE ACTIVE',        warn:false, ok:false, n:null },
    { l:'Deliveries',    s:'NONE TODAY',         warn:false, ok:false, n:null },
  ]
  return (
    <div className="bg-[#f3f3ef]" style={{ width: 272 }}>
      {/* Status bar below dynamic island */}
      <div className="bg-brand px-4 pt-14 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-cream tracking-widest">SALT</span>
          <div className="w-5 h-5 bg-cream/15 rounded-full flex items-center justify-center relative">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cream"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/></svg>
            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-accent rounded-full flex items-center justify-center"><span className="text-[7px] font-bold text-white">4</span></div>
          </div>
        </div>
        <span className="text-[9px] text-cream/40 border border-cream/20 px-2 py-0.5 rounded">Sign Out</span>
      </div>
      <div className="px-4 pt-3 pb-1.5">
        <div className="flex items-center justify-between mb-0.5">
          <p className="text-[9px] tracking-widest uppercase text-charcoal/35">CHECKS</p>
          <span className="text-[10px] text-brand/50 font-medium">Edit</span>
        </div>
        <p className="text-[17px] font-bold text-charcoal">Today's checks</p>
      </div>
      <div className="mx-3 mb-3">
        <div className="bg-brand rounded-2xl px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-[9px] tracking-widest uppercase text-cream/35">TODAY</p>
            <span className="text-[9px] text-cream/45 font-medium">VIEW ALL ›</span>
          </div>
          <p className="text-[13px] font-bold text-cream mt-1">30 checks need doing</p>
          <div className="flex gap-4 mt-1.5">
            <span className="text-[9px] font-semibold text-accent">• 13 overdue</span>
            <span className="text-[9px] text-cream/40">• 17 due now</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 px-3 pb-3">
        {checks.map(({ l, s, warn, ok, n }) => (
          <div key={l} className={`bg-white rounded-2xl p-3 border relative ${warn?'border-accent/20':'border-charcoal/8'}`}>
            {n && <span className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: warn?'#c94f2a':'#2a7c56' }}>{n}</span>}
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center mb-2 ${warn?'bg-accent/10':ok?'bg-[#1a7a4c]/10':'bg-charcoal/6'}`}>
              <div className={`w-3.5 h-3.5 rounded ${warn?'bg-accent/50':ok?'bg-[#1a7a4c]/50':'bg-charcoal/25'}`}/>
            </div>
            <p className="text-[10px] font-bold text-charcoal leading-tight">{l}</p>
            {s && <p className={`text-[8px] font-semibold mt-0.5 ${warn?'text-accent':ok?'text-[#1a7a4c]':'text-charcoal/35'}`}>{s}</p>}
          </div>
        ))}
      </div>
      {/* Bottom nav */}
      <div className="bg-white border-t border-charcoal/8 flex justify-around px-2 py-2 pb-4">
        {['Home','Checks','Team','Tasks','Settings'].map((t,i)=>(
          <div key={t} className="flex flex-col items-center gap-1">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${i===1?'bg-brand/10':''}`}><div className={`w-4 h-4 rounded-sm ${i===1?'bg-brand/40':'bg-charcoal/12'}`}/></div>
            <span className={`text-[8px] font-medium ${i===1?'text-brand font-semibold':'text-charcoal/30'}`}>{t}</span>
          </div>
        ))}
      </div>
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
          <p className="text-charcoal/45 text-base mb-8 max-w-xs leading-relaxed">No per-user fees. No hidden charges. Cancel any time.</p>
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
          <FadeUp delay={70}>
            <div className="bg-white rounded-xl border-2 border-brand shadow-[0_8px_24px_rgba(19,54,42,0.10)] p-7 flex flex-col h-full relative">
              <span className="absolute -top-3.5 left-6 bg-brand text-cream text-[10px] tracking-widest uppercase font-semibold px-3 py-1 rounded-full">Most popular</span>
              <p className="text-[10px] tracking-widest uppercase text-brand font-semibold mb-4 mt-1">Pro</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-bold text-charcoal">{pp}</span>
                <span className="text-charcoal/35 text-sm">{sfx}</span>
              </div>
              <p className="text-xs text-charcoal/35 mb-1">first venue · {ep}{sfx} each extra</p>
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
                {['Everything in Starter','Rota builder + AI auto-fill','Timesheets & payroll export','Clock in/out & break tracking','Training records & expiry alerts','Staff time off & shift swaps','Tip distribution','Multi-venue, unlimited staff'].map((f,i)=>(
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
          </FadeUp>
          <FadeUp delay={130}>
            <div className="bg-white rounded-xl border border-charcoal/12 shadow-[0_4px_12px_rgba(0,0,0,0.04)] p-7 flex flex-col h-full">
              <p className="text-[10px] tracking-widest uppercase text-brand font-semibold mb-4">Starter</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-bold text-charcoal">{sp}</span>
                <span className="text-charcoal/35 text-sm">{sfx}</span>
              </div>
              <p className="text-xs text-charcoal/35 mb-1">per venue</p>
              {annual && <p className="text-xs font-medium text-brand mb-1">Save £20 vs monthly</p>}
              <p className="text-xs text-charcoal/50 leading-relaxed my-5">Everything you need to stay compliant and get off paper.</p>
              <ul className="flex flex-col gap-2.5 mb-7 flex-1">
                {['Temperature logs (fridge, cooking, hot-holding)','Cleaning schedules & records',"Allergen registry (Natasha's Law)",'Delivery checks','Opening & closing checklists','Document vault','Compliance PDF exports'].map(f=>(
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
          </FadeUp>
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

        <div className="max-w-3xl mx-auto px-6 sm:px-10 pt-20 sm:pt-28 pb-0 relative text-center">
          {/* Pill badge */}
          <div style={{ animation:'pkIn 0.55s cubic-bezier(.16,1,.3,1) both' }}>
            <div className="inline-flex items-center gap-2 bg-cream/8 border border-cream/12 rounded-full px-3.5 py-1.5 mb-8">
              <div className="w-1.5 h-1.5 rounded-full bg-[#1a7a4c]" style={{ animation:'pkPulse 2.4s ease-in-out infinite' }} />
              <span className="text-[11px] font-medium text-cream/50 tracking-wide">Food safety · Rota · Timesheets · Training</span>
            </div>
          </div>
          {/* Headline */}
          <h1 className="text-[48px] sm:text-[64px] lg:text-[76px] font-bold text-cream leading-[1.0] tracking-[-0.035em] mb-6" style={{ animation:'pkIn 0.7s 70ms cubic-bezier(.16,1,.3,1) both' }}>
            Ditch the clipboard,<br />
            <span className="text-cream/28">keep the compliance.</span>
          </h1>
          {/* Subtitle */}
          <p className="text-cream/48 text-[15px] sm:text-[16px] max-w-md mx-auto leading-[1.65] mb-9" style={{ animation:'pkIn 0.7s 150ms cubic-bezier(.16,1,.3,1) both' }}>
            One app for food safety records, rotas, timesheets and team management. EHO-ready from day one, on any device, for the whole team.
          </p>
          {/* CTAs */}
          <div className="flex flex-wrap justify-center items-center gap-3 mb-5" style={{ animation:'pkIn 0.65s 210ms cubic-bezier(.16,1,.3,1) both' }}>
            <Link to="/signup" className="bg-accent text-cream px-7 py-3.5 rounded-xl text-sm font-semibold hover:bg-[#b8431f] hover:shadow-[0_8px_28px_rgba(201,79,42,0.5)] active:scale-[0.97] transition-all duration-200 cursor-pointer shadow-[0_4px_18px_rgba(201,79,42,0.42)]">
              Start free for 7 days
            </Link>
            <a href="#compliance" className="flex items-center gap-1.5 text-cream/35 text-sm hover:text-cream/60 transition-colors duration-200 cursor-pointer">
              See how it works
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </a>
          </div>
          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 mb-16" style={{ animation:'pkIn 0.6s 280ms cubic-bezier(.16,1,.3,1) both' }}>
            {['No card required','Cancel any time','ICO registered · UK GDPR'].map(t=>(
              <div key={t} className="flex items-center gap-1.5">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-cream/22"><polyline points="20 6 9 17 4 12"/></svg>
                <span className="text-xs text-cream/28">{t}</span>
              </div>
            ))}
          </div>
          {/* Hero phones — staggered rise */}
          <div className="flex justify-center gap-5 sm:gap-8 items-end">
            <div className="hidden sm:block" style={{ transform:'translateY(44px)', animation:'pkRise 0.9s 360ms cubic-bezier(.16,1,.3,1) both' }}>
              <IPhoneFrame><MockMobileHome /></IPhoneFrame>
            </div>
            <div style={{ animation:'pkRise 0.9s 420ms cubic-bezier(.16,1,.3,1) both' }}>
              <IPhoneFrame><MockChecksGrid /></IPhoneFrame>
            </div>
          </div>
        </div>
        <div className="h-20 sm:h-28" />
      </section>

      {/* ── Replaces ─────────────────────────────────────────────────────── */}
      <div className="bg-[#f3f3ef] border-b border-charcoal/6">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-4">
          <div className="flex flex-wrap items-center gap-x-7 gap-y-2">
            <span className="text-xs text-charcoal/30 font-medium tracking-wide">Replaces your</span>
            {['Rota spreadsheet','WhatsApp group','Paper temperature logs','Training folder','Tip calculator'].map(item=>(
              <div key={item} className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1a7a4c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                <span className="text-sm text-charcoal/55 font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Compliance ───────────────────────────────────────────────────── */}
      <section id="compliance" className="bg-white">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <FadeUp>
                <span className="inline-block text-[10px] tracking-widest uppercase text-brand font-semibold bg-brand/8 px-3 py-1.5 rounded-full mb-5">Food safety</span>
                <h2 className="text-4xl sm:text-5xl font-bold text-charcoal tracking-tight leading-tight mb-4">
                  If the EHO walked<br />in today, would<br />you be ready?
                </h2>
                <p className="text-charcoal/45 text-[15px] leading-relaxed mb-8 max-w-sm">
                  Every temp log, cleaning record, allergen check and delivery sign-off captured and stored. Export a full audit trail PDF in one tap, exactly how an inspector expects it.
                </p>
              </FadeUp>
              <div className="flex flex-col gap-6">
                {[
                  { title:'Temperature logs',   desc:'Fridge, cooking, reheating and hot holding. Automatic pass/fail detection against your thresholds.' },
                  { title:'Cleaning schedules',  desc:'Daily, weekly and ad-hoc tasks assigned to staff. Live completion status at a glance.' },
                  { title:'Allergen registry',   desc:"All 14 allergens across every dish on your menu. Natasha's Law compliant by design." },
                  { title:'Audit-ready exports', desc:'One tap to a full compliance PDF. Timestamped, signed, formatted for inspection.' },
                ].map(({ title, desc }, i) => (
                  <FadeUp key={title} delay={i * 55}>
                    <div className="flex gap-4 group cursor-default">
                      <div className="w-0.5 rounded-full bg-brand/15 group-hover:bg-brand transition-colors duration-300 shrink-0 mt-1" style={{ minHeight:48 }}/>
                      <div className="transition-transform duration-300 group-hover:translate-x-0.5">
                        <p className="text-sm font-semibold text-charcoal mb-1">{title}</p>
                        <p className="text-[14px] text-charcoal/42 leading-relaxed">{desc}</p>
                      </div>
                    </div>
                  </FadeUp>
                ))}
              </div>
              <FadeUp delay={250}>
                <Link to="/signup" className="inline-flex items-center gap-2 bg-brand text-cream px-6 py-3 rounded-xl text-sm font-semibold hover:bg-brand/85 hover:shadow-[0_6px_20px_rgba(19,54,42,0.25)] hover:-translate-y-0.5 transition-all duration-200 mt-8 cursor-pointer">
                  Start free trial
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </Link>
              </FadeUp>
            </div>
            <FadeUp dir="right" delay={80} className="flex justify-center lg:justify-end">
              <div className="flex flex-col items-center gap-10">
                {/* Staff view — mobile only, stacked above Checks Hub */}
                <div className="lg:hidden">
                  <p className="text-[10px] tracking-widest uppercase text-charcoal/30 font-medium text-center mb-3">Staff view</p>
                  <IPhoneFrame><MockMobileHome /></IPhoneFrame>
                </div>
                {/* Checks hub — always shown, solo on desktop */}
                <div>
                  <p className="text-[10px] tracking-widest uppercase text-charcoal/30 font-medium text-center mb-3">Checks hub</p>
                  <IPhoneFrame><MockChecksGrid /></IPhoneFrame>
                </div>
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ── Team ─────────────────────────────────────────────────────────── */}
      <section id="team" className="bg-charcoal">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 pt-20 sm:pt-28 pb-20 sm:pb-28">
          {/* Heading */}
          <FadeUp className="max-w-2xl mb-10 sm:mb-12">
            <span className="inline-block text-[10px] tracking-widest uppercase text-accent font-semibold bg-accent/12 px-3 py-1.5 rounded-full mb-5">Team &amp; scheduling · Pro</span>
            <h2 className="text-4xl sm:text-5xl font-bold text-cream tracking-tight leading-tight mb-4">
              Stop managing your team over WhatsApp.
            </h2>
            <p className="text-cream/40 text-[15px] leading-relaxed max-w-lg">
              Build the rota in minutes, publish it, done. Timesheets write themselves. Swaps and time-off come through the app. You stop being the middleman.
            </p>
          </FadeUp>
          {/* Rota — full width */}
          <FadeUp dir="up" delay={60} className="mb-10 sm:mb-12">
            <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0 sm:overflow-visible">
              <MockRota />
            </div>
          </FadeUp>
          {/* Features */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { n:'Rota builder',  d:'Drag-and-drop or auto-fill from your patterns' },
              { n:'Timesheets',    d:'Staff clock in/out on the app, exports to payroll' },
              { n:'Time off',      d:'Requests, approvals and shift swaps all in-app' },
              { n:'Training',      d:'Cert records and 30-day expiry alerts' },
              { n:'Tips',          d:'Enter the pot, set the split. Full audit trail' },
              { n:'Multi-venue',   d:'One login for every site you run' },
            ].map(({ n, d }, i) => (
              <FadeUp key={n} delay={i * 40}>
                <div className="border border-cream/8 rounded-2xl p-4 hover:border-cream/18 hover:bg-cream/5 hover:-translate-y-0.5 transition-all duration-300 ease-[cubic-bezier(.16,1,.3,1)] cursor-default">
                  <p className="text-sm font-semibold text-cream mb-1">{n}</p>
                  <p className="text-[12px] text-cream/30 leading-relaxed">{d}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <section className="bg-brand">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-16 sm:py-20">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-0 sm:divide-x sm:divide-cream/15">
            {[
              { to:15, suffix:' min', label:'Average setup time',  sub:'From sign-up to first check logged', delay:0 },
              { to:5,  suffix:' apps', label:'Replaced by one',    sub:'Rota, compliance, timesheets, training, tips', delay:80 },
              { to:100,suffix:'%',    label:'On your phone',       sub:'No app store. Install from your browser in seconds', delay:160 },
            ].map(({ to, suffix, label, sub, delay }) => (
              <FadeUp key={label} delay={delay} className="sm:px-10 first:pl-0 last:pr-0">
                <p className="text-6xl font-bold text-cream mb-2 tabular-nums tracking-tight"><CountUp to={to} suffix={suffix} duration={1300}/></p>
                <p className="text-sm font-semibold text-cream/55 mb-1">{label}</p>
                <p className="text-[12px] text-cream/28 leading-relaxed">{sub}</p>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature grid ─────────────────────────────────────────────────── */}
      <section className="bg-[#f3f3ef]">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
          <FadeUp>
            <h2 className="text-4xl sm:text-5xl font-bold text-charcoal tracking-tight leading-tight mb-2">There's a lot more inside.</h2>
            <p className="text-charcoal/40 text-base mb-10 max-w-xs leading-relaxed">A glimpse at what's waiting once you're in.</p>
          </FadeUp>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {[
              { icon:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', title:'Document vault',     desc:'Certificates, policies and insurance in one organised place.' },
              { icon:'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 7a4 4 0 100 8 4 4 0 000-8z', title:'Staff profiles',    desc:'Contact details, roles, certs and notes for every team member.' },
              { icon:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2 M9 3h6v4H9z', title:'Incident log',      desc:'Record anything that happens. Timestamped, signed, searchable.' },
              { icon:'M22 12h-4l-3 9L9 3l-3 9H2', title:'Probe calibration', desc:'Scheduled calibration records with pass/fail. Inspection-proof.' },
              { icon:'M5 12h14 M12 5l7 7-7 7', title:'Delivery checks',   desc:'Temp reading, condition notes, signed on arrival.' },
              { icon:'M3 4h18v18H3z M16 2v4 M8 2v4 M3 10h18', title:'Opening checklists', desc:'Start every shift the same way. Signed and consistent.' },
              { icon:'M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16', title:'Allergen registry',  desc:"All 14 allergens. Natasha's Law compliant by design." },
              { icon:'M12 1v22 M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6', title:'Tip distribution',  desc:'Enter the pot, set the split, done. Full audit trail.' },
              { icon:'M5 8h14 M5 12h14 M5 16h6', title:'Clock in / out',    desc:'Staff clock on from their phone. Timesheets build automatically.' },
            ].map(({ icon, title, desc }, i) => (
              <FadeUp key={title} delay={i * 30}>
                <div className="bg-white rounded-2xl border border-brand/10 p-5 hover:border-brand/25 hover:shadow-[0_12px_36px_rgba(19,54,42,0.09)] hover:-translate-y-1.5 transition-all duration-300 ease-[cubic-bezier(.16,1,.3,1)] h-full group cursor-default">
                  <div className="w-9 h-9 rounded-xl bg-brand/7 text-brand flex items-center justify-center mb-4 group-hover:bg-brand group-hover:text-cream transition-all duration-300">
                    <Ico d={icon} size={17} />
                  </div>
                  <p className="text-sm font-semibold text-charcoal mb-1">{title}</p>
                  <p className="text-[12px] text-charcoal/40 leading-relaxed">{desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="bg-white">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <FadeUp>
              <span className="inline-block text-[10px] tracking-widest uppercase text-brand font-semibold bg-brand/8 px-3 py-1.5 rounded-full mb-5">Setup</span>
              <h2 className="text-4xl sm:text-5xl font-bold text-charcoal tracking-tight leading-tight mb-4">Live in 15 minutes.</h2>
              <p className="text-charcoal/45 text-[15px] leading-relaxed mb-7 max-w-sm">
                No app store. No IT department. Open in your browser, install to your home screen and it works like any other app. Offline included.
              </p>
              <Link to="/signup" className="inline-flex items-center gap-2 bg-brand text-cream px-6 py-3 rounded-xl text-sm font-semibold hover:bg-brand/85 hover:shadow-[0_6px_20px_rgba(19,54,42,0.25)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
                Get started free
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
            </FadeUp>
            <div className="flex flex-col">
              {[
                { n:'01', title:'Sign up', desc:'Create your account and set up your venue. Name, location, your first team members. About five minutes.' },
                { n:'02', title:'Install on any device', desc:"Open app.pelikn.app in Safari or Chrome. Tap 'Add to Home Screen'. It lands on your home screen like any other app." },
                { n:'03', title:'Invite your team', desc:"Send invite links. Staff install the app and they're ready to log checks, see their rota and clock in." },
              ].map(({ n, title, desc }, i) => (
                <FadeUp key={n} delay={i * 65}>
                  <div className="flex gap-5 items-start pb-8 last:pb-0 relative group cursor-default">
                    {i < 2 && <div className="absolute left-[19px] top-11 bottom-0 w-px bg-charcoal/8"/>}
                    <div className="w-10 h-10 rounded-full border-2 border-charcoal/10 bg-white flex items-center justify-center shrink-0 z-10 transition-all duration-300 group-hover:border-brand/30 group-hover:shadow-[0_4px_12px_rgba(19,54,42,0.12)]">
                      <span className="text-xs font-bold text-charcoal/30 tabular-nums group-hover:text-brand/60 transition-colors duration-300">{n}</span>
                    </div>
                    <div className="pt-1.5">
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

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <Pricing />

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="bg-white">
        <div className="max-w-2xl mx-auto px-6 sm:px-10 py-20 sm:py-24">
          <FadeUp>
            <h2 className="text-3xl font-bold text-charcoal tracking-tight mb-8">Common questions</h2>
          </FadeUp>
          <FadeUp delay={50}>
            <div className="border-t border-charcoal/8">
              {[
                { q:'Is this on the App Store?', a:"No, intentionally. Pelikn is a Progressive Web App. Install it from Safari or Chrome in about 30 seconds. It lives on your home screen, works offline, and behaves like any native app. No app store approval, no mandatory updates." },
                { q:'Does it work on iPhone, iPad and Android?', a:"Yes, all of them. Install from Safari on iOS/iPadOS, or Chrome on Android. The manager dashboard works in any desktop browser with no install needed." },
                { q:"What's the difference between Starter and Pro?", a:"Starter covers everything on the compliance side: temperature logs, cleaning records, allergens, checklists, and exports. Pro adds the whole team layer: rotas, timesheets, clock in/out, training records, tips, and time off management." },
                { q:'What counts as a venue?', a:"Each physical location is a venue. The first venue on Pro is £25/mo, each additional is £15/mo. Starter is £10/venue. You can add and remove venues at any time." },
                { q:'Is my data secure?', a:"All data is stored in a UK-based database with row-level security, so staff only ever see their own venue's data. We're ICO registered under UK GDPR." },
                { q:'Can I cancel?', a:"Whenever you like. No contracts, no cancellation fees. Cancel in settings and you keep access until the end of the billing period." },
              ].map(({ q, a }) => <Faq key={q} q={q} a={a} />)}
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="bg-brand relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden style={{ backgroundImage:'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize:'28px 28px' }} />
        <div className="absolute top-0 left-0 w-[500px] h-[500px] pointer-events-none" aria-hidden style={{ background:'radial-gradient(ellipse at top left, rgba(201,79,42,0.1) 0%, transparent 60%)' }} />
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-24 sm:py-32 relative">
          <FadeUp>
            <h2 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-cream tracking-tight leading-[1.02] mb-4 max-w-xl">
              Ditch the clipboard.<br />Keep the compliance.
            </h2>
            <p className="text-cream/38 text-base leading-relaxed mb-9 max-w-xs">
              7 days free. No card. 15 minutes to set up.
            </p>
            <div className="flex flex-col sm:flex-row items-start gap-3">
              <Link to="/signup" className="bg-accent text-cream px-8 py-4 rounded-xl text-sm font-semibold hover:bg-[#b8431f] hover:shadow-[0_10px_32px_rgba(201,79,42,0.52)] hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200 text-center cursor-pointer shadow-[0_4px_24px_rgba(201,79,42,0.42)]">
                Start free trial
              </Link>
              <a href="mailto:hello@pelikn.app" className="border border-cream/14 text-cream/35 hover:text-cream/55 hover:border-cream/25 hover:-translate-y-0.5 px-8 py-4 rounded-xl text-sm font-medium transition-all duration-200 text-center cursor-pointer">
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
          <a href="mailto:hello@pelikn.app" className="text-xs text-charcoal/30 hover:text-charcoal transition-colors">hello@pelikn.app</a>
          <div className="flex items-center gap-6">
            {[['Privacy','/privacy'],['Terms','/terms'],['Sign in','/login']].map(([l,h])=>(
              <Link key={l} to={h} className="text-xs text-charcoal/30 hover:text-charcoal transition-colors cursor-pointer">{l}</Link>
            ))}
          </div>
        </div>
        <div className="border-t border-charcoal/5 py-3 text-center">
          <p className="text-[11px] text-charcoal/16">© {new Date().getFullYear()} <span className="font-semibold tracking-[0.18em] uppercase">Pelikn</span> · ICO registered · UK GDPR compliant</p>
        </div>
      </footer>
    </div>
  )
}
