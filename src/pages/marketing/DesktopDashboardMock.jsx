import React, { useLayoutEffect, useRef, useState } from 'react'
import { T, IcoHome, IcoShieldNav, IcoTruckNav, IcoUsersNav, IcoCogNav, PanelIcons } from '../../components/layout/navConfig'
import { colors, alpha, white, black } from '../../lib/tokens'

/*
 * Marketing-only mock of the desktop manager dashboard (rail + Today panel +
 * dashboard). Built at the real app's native size (1280×800) with the real
 * nav tokens, then scaled down to fit — so it reads like a screenshot.
 *
 * TODO: swap for a real screenshot of the demo venue once one is captured.
 * Names and numbers are made up and match the phone mocks (Depot, James).
 */

/* Renders `children` at a fixed native size and scales it to the container's
   width, like an image. Measured before paint, so there is no flash. */
export function ScaledCanvas({ width, height, className = '', label, clip = true, children }) {
  const ref = useRef(null)
  const [scale, setScale] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return
    const fit = () => setScale(el.clientWidth / width)
    fit()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', fit)
      return () => window.removeEventListener('resize', fit)
    }
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [width])
  return (
    <div ref={ref} role="img" aria-label={label} className={`relative ${clip ? 'overflow-hidden' : ''} ${className}`} style={{ aspectRatio: `${width} / ${height}` }}>
      <div aria-hidden="true" className="absolute top-0 left-0 origin-top-left pointer-events-none select-none" style={{ width, height, transform: `scale(${scale})`, visibility: scale ? 'visible' : 'hidden' }}>
        {children}
      </div>
    </div>
  )
}

/* Minimal browser chrome around a screen */
export function BrowserFrame({ children, className = '' }) {
  return (
    <div className={`rounded-xl overflow-hidden bg-white ring-1 ring-white/10 shadow-[0_40px_100px_theme(colors.black/45%)] ${className}`}>
      <div className="flex items-center gap-3 px-3.5 h-9 bg-line border-b border-charcoal/8">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-charcoal/15" />
          <span className="w-2.5 h-2.5 rounded-full bg-charcoal/15" />
          <span className="w-2.5 h-2.5 rounded-full bg-charcoal/15" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="h-5 w-[46%] max-w-[260px] rounded-md bg-white/80 flex items-center justify-center">
            <span className="font-mono text-micro text-charcoal/40 leading-none">get-pelikn.com</span>
          </div>
        </div>
        <div className="w-[42px]" />
      </div>
      {children}
    </div>
  )
}

const RAIL_CATS = [
  { label: 'Today',      icon: <IcoHome />,      active: true },
  { label: 'Compliance', icon: <IcoShieldNav />, alert: 4 },
  { label: 'Operations', icon: <IcoTruckNav /> },
  { label: 'Team',       icon: <IcoUsersNav />,  alert: 2 },
]

const PANEL_ITEMS = [
  { label: 'Dashboard',       sub: "Today's checks & open issues", icon: PanelIcons.dashboard, active: true },
  { label: 'Open / Close',    sub: 'Daily routines',               icon: PanelIcons.checks },
  { label: 'Tasks',           sub: 'All open tasks',               icon: PanelIcons.tasks },
  { label: 'Fitness to Work', sub: 'Staff readiness checks',       icon: PanelIcons.fitness },
]

const STATS = [
  { label: 'On Shift',       value: '5' },
  { label: 'Checks Done',    value: '9/22' },
  { label: 'Fridges Due',    value: '1/4', tone: 'warn' },
  { label: 'Overdue Cleans', value: '4',   tone: 'danger' },
  { label: 'Critical',       value: '0',   tone: 'good' },
  { label: 'Time Off',       value: '2',   tone: 'warn' },
]
const DOT = { neutral: 'bg-charcoal/20', good: 'bg-success', warn: 'bg-warning', danger: 'bg-danger' }
const NUM = { neutral: 'text-charcoal', good: 'text-charcoal', warn: 'text-warning', danger: 'text-danger' }

const ON_SHIFT = [
  { i: 'JM', n: 'James',  r: 'Manager', t: '08:00–16:00' },
  { i: 'PR', n: 'Priya',  r: 'Kitchen', t: '07:00–15:00' },
  { i: 'TO', n: 'Tom',    r: 'Barista', t: '07:30–14:00' },
  { i: 'EL', n: 'Ella',   r: 'FOH',     t: '09:00–17:00' },
]

function Widget({ title, aside = null, children }) {
  return (
    <div className="bg-white rounded-2xl border border-line overflow-hidden flex flex-col">
      <div className="flex items-center justify-between gap-2.5 px-3.5 pt-2.5 pb-2">
        <p className="text-caption font-semibold tracking-[0.08em] uppercase text-ink3">{title}</p>
        {aside}
      </div>
      <div className="flex-1 px-3.5 pb-3">{children}</div>
    </div>
  )
}

function MiniRow({ label, value, tone = undefined }) {
  return (
    <div className="flex items-center justify-between gap-2.5 py-1.5">
      <span className="text-body-sm text-ink2">{label}</span>
      <span className={`font-mono text-body-sm font-semibold ${tone === 'bad' ? 'text-bad' : tone === 'good' ? 'text-good' : 'text-ink'}`}>{value}</span>
    </div>
  )
}

export default function DesktopDashboardMock() {
  return (
    <div className="flex font-sans text-left bg-surface text-charcoal" style={{ width: 1280, height: 800 }}>
      {/* Rail */}
      <div className="flex flex-col items-center shrink-0" style={{ width: 80, background: T.bg, color: T.ink, padding: '14px 8px 12px', borderRight: `1px solid ${T.divider}` }}>
        <div className="font-bold text-body-lg grid place-items-center mb-1" style={{ width: 40, height: 40, borderRadius: 10, background: T.inkBright, color: T.bg }}>D</div>
        <p className="font-mono text-micro font-medium uppercase tracking-[0.09em] mb-3" style={{ color: T.inkFaint }}>Depot</p>
        <div className="flex flex-col gap-0.5 w-full">
          {RAIL_CATS.map(c => (
            <div key={c.label} className="relative flex flex-col items-center gap-[5px] rounded-[9px]" style={{ padding: '10px 4px 8px', background: c.active ? T.bgActive : 'transparent', color: c.active ? T.inkBright : T.ink }}>
              {c.active && <span className="absolute" style={{ left: -8, top: '18%', bottom: '18%', width: 3, background: T.inkBright, borderRadius: '0 3px 3px 0' }} />}
              <span className="inline-flex" style={{ width: 18, height: 18, opacity: c.active ? 1 : 0.72 }}>{c.icon}</span>
              <span className={`text-micro leading-none ${c.active ? 'font-medium' : 'font-[450]'}`}>{c.label}</span>
              {c.alert && (
                <span className="absolute font-mono text-micro font-bold text-white grid place-items-center" style={{ top: 6, right: 8, minWidth: 14, height: 14, padding: '0 4px', borderRadius: 7, background: T.accent, border: `1.5px solid ${T.bg}` }}>{c.alert}</span>
              )}
            </div>
          ))}
        </div>
        <div className="flex-1" />
        <div className="w-full flex flex-col items-center gap-[5px] pt-2.5 pb-2 mb-2" style={{ borderTop: `1px solid ${T.divider}` }}>
          <span className="inline-flex" style={{ width: 18, height: 18, opacity: 0.72 }}><IcoCogNav /></span>
          <span className="text-micro leading-none font-[450]">Settings</span>
        </div>
        <div className="w-full flex justify-center pt-2.5" style={{ borderTop: `1px solid ${T.divider}` }}>
          <div className="font-semibold text-xs grid place-items-center" style={{ width: 32, height: 32, borderRadius: 8, background: T.inkBright, color: T.bg }}>JM</div>
        </div>
      </div>

      {/* Today panel */}
      <div className="flex flex-col shrink-0" style={{ width: 260, background: T.bgPanel, color: T.ink, borderRight: `1px solid ${black(0.12)}` }}>
        <div style={{ padding: '18px 18px 14px', borderBottom: `1px solid ${T.divider}` }}>
          <div className="font-mono text-micro font-semibold uppercase tracking-[0.12em] flex items-center gap-[7px] mb-1.5" style={{ color: T.inkFaint }}>
            <span className="inline-flex" style={{ width: 11, height: 11, opacity: 0.7 }}><IcoHome /></span>Today
          </div>
          <p className="text-title-sm font-semibold tracking-[-0.015em] leading-[1.15]" style={{ color: T.inkBright }}>Today</p>
          <p className="text-caption mt-[3px]" style={{ color: T.inkMuted }}>4 items</p>
        </div>
        <div style={{ padding: '6px 0 12px' }}>
          {PANEL_ITEMS.map(it => (
            <div key={it.label} className={`flex items-center gap-2.5 text-body-sm ${it.active ? 'font-medium' : 'font-[450]'}`} style={{ margin: '1px 8px', padding: '8px 10px', borderRadius: 8, background: it.active ? T.bgActive : 'transparent', border: it.active ? `1px solid ${white(0.10)}` : '1px solid transparent', color: it.active ? T.inkBright : T.ink }}>
              <span className="inline-flex shrink-0" style={{ width: 15, height: 15, opacity: it.active ? 1 : 0.78 }}>{it.icon}</span>
              <span className="min-w-0">
                <span className="block">{it.label}</span>
                <span className="block text-micro mt-px" style={{ color: it.active ? alpha(colors.cream, 0.55) : T.inkFaint }}>{it.sub}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Dashboard */}
      <div className="flex-1 min-w-0 flex flex-col gap-4" style={{ padding: '28px 32px' }}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-mono text-micro tracking-[0.08em] uppercase text-charcoal/40">Saturday, 28 June</p>
            <p className="text-display font-medium tracking-[-0.028em] leading-tight mt-0.5">Good morning, James</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm font-medium text-charcoal/50">Depot</p>
              <span className="text-micro tracking-widest uppercase font-semibold px-2 py-0.5 rounded border bg-accent/10 text-accent border-accent/25">Pro</span>
            </div>
            <p className="text-sm text-charcoal/40 mt-0.5">9 of 22 daily checks complete</p>
          </div>
          <span className="text-micro font-semibold tracking-wider uppercase text-charcoal/40 border border-charcoal/15 px-3 py-1.5 rounded-lg">Customise</span>
        </div>

        <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-danger/8 border border-danger/15 text-danger">
          <span className="w-5 h-5 rounded-full bg-danger/18 flex items-center justify-center shrink-0">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </span>
          <p className="text-sm font-semibold flex-1">4 overdue cleans</p>
          <span className="font-mono text-xs opacity-60">→</span>
        </div>

        <div className="grid grid-cols-[1fr_280px] gap-4 items-start">
          <div className="grid grid-cols-3 gap-3">
            {STATS.map(({ label, value, tone = 'neutral' }) => (
              <div key={label} className="flex flex-col gap-2 bg-white rounded-2xl p-4 min-h-[100px]">
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT[tone]}`} />
                  <span className="font-mono text-micro text-charcoal/40 uppercase tracking-[0.08em] leading-none">{label}</span>
                </div>
                <div className={`text-stat font-medium tracking-[-0.035em] leading-none tabular-nums ${NUM[tone]}`}>{value}</div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl p-5">
            <p className="text-micro tracking-widest uppercase font-semibold text-charcoal/40 mb-3">My Clock</p>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full shrink-0 bg-success" />
              <span className="text-sm font-medium text-success">Clocked in</span>
            </div>
            <p className="text-micro tracking-widest uppercase text-charcoal/40">Shift</p>
            <p className="font-mono text-2xl tabular-nums mb-4">2:46:12</p>
            <div className="flex gap-2">
              <span className="flex-1 text-center bg-warning/10 text-warning border border-warning/25 py-2.5 rounded-xl text-sm font-semibold">Start break</span>
              <span className="flex-1 text-center bg-charcoal text-cream py-2.5 rounded-xl text-sm font-semibold">Clock out</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Widget title="Compliance">
            <p className="font-mono text-display font-semibold leading-none tracking-tight text-good mt-1">94%</p>
            <p className="mt-2 text-body-sm font-semibold text-bad">↓ 1 item needs attention</p>
            <p className="text-body-sm text-ink3 mt-1">30-day average</p>
            <div className="mt-2 pt-2.5 border-t border-line">
              <MiniRow label="Cleaning overdue" value="4" tone="bad" />
            </div>
          </Widget>
          <Widget title="Fridge temps">
            <MiniRow label="Readings today" value="7" />
            <MiniRow label="Out of range" value="0" tone="good" />
            <MiniRow label="Not yet checked" value="1" tone="bad" />
            <MiniRow label="Last reading" value="3.2°C" />
          </Widget>
          <div className="bg-white rounded-2xl border border-line overflow-hidden">
            <div className="flex items-center justify-between px-3.5 pt-2.5 pb-2.5 border-b border-line">
              <p className="text-caption font-semibold tracking-[0.08em] uppercase text-ink3">On shift today</p>
              <span className="text-body-sm font-semibold text-ink">Rota</span>
            </div>
            <div className="divide-y divide-line">
              {ON_SHIFT.map(s => (
                <div key={s.n} className="flex items-center gap-2.5 px-3.5 py-2">
                  <span className="relative shrink-0 w-9 h-9 rounded-full bg-brand-tint inline-flex items-center justify-center text-body-sm font-semibold text-ink">
                    {s.i}
                    <span className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full border-2 border-white bg-success" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-body font-semibold text-ink">{s.n}</p>
                    <p className="text-body-sm text-ink3">{s.r}</p>
                  </div>
                  <p className="shrink-0 font-mono text-body-sm font-semibold text-ink2">{s.t}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
