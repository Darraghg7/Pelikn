import React, { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useSession } from '../../contexts/SessionContext'
import { useVenue } from '../../contexts/VenueContext'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import NotificationBell from '../notifications/NotificationBell'
import OfflineBanner from '../ui/OfflineBanner'
import MobileNav from './MobileNav'
import { useVenueFeatures } from '../../hooks/useVenueFeatures'
import { useVenueBranding } from '../../hooks/useVenueBranding'

// Per-venue cache — busted automatically after TTL or on app restart
const CACHE_TTL = 60_000 // 1 minute
const _cache = { cleaning: {}, swaps: {} }

/** True if a cache entry exists and is still within the TTL window. */
function isFresh(bucket, key) {
  const ts = _cache[bucket][key + '_ts']
  return ts && Date.now() - ts < CACHE_TTL
}

function useOverdueCleaning(venueId) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!venueId) return
    if (isFresh('cleaning', venueId)) {
      setCount(_cache.cleaning[venueId] ?? 0)
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const { data: tasks } = await supabase
          .from('cleaning_tasks').select('id, frequency').eq('venue_id', venueId).eq('is_active', true)
        if (!tasks?.length || cancelled) return
        const { data: completions } = await supabase
          .from('cleaning_completions').select('cleaning_task_id, completed_at')
          .eq('venue_id', venueId)
          .order('completed_at', { ascending: false })
        if (cancelled) return
        const freqDays = { daily: 1, weekly: 7, fortnightly: 14, monthly: 30, quarterly: 90 }
        const now = new Date()
        let overdue = 0
        for (const t of tasks) {
          const last = completions?.find(c => c.cleaning_task_id === t.id)
          if (!last) { overdue++; continue }
          if ((now - new Date(last.completed_at)) / 86400000 > freqDays[t.frequency]) overdue++
        }
        _cache.cleaning[venueId] = overdue
        _cache.cleaning[venueId + '_ts'] = Date.now()
        setCount(overdue)
      } catch { /* network error — leave count at 0 */ }
    }
    load()
    return () => { cancelled = true }
  }, [venueId])
  return count
}

function usePendingSwaps(venueId) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!venueId) return
    if (isFresh('swaps', venueId)) {
      setCount(_cache.swaps[venueId] ?? 0)
      return
    }
    let cancelled = false
    supabase.from('shift_swaps').select('id', { count: 'exact', head: true })
      .eq('venue_id', venueId)
      .eq('status', 'pending')
      .then(({ count: c }) => {
        if (cancelled) return
        _cache.swaps[venueId] = c ?? 0
        _cache.swaps[venueId + '_ts'] = Date.now()
        setCount(c ?? 0)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [venueId])
  return count
}


/* ── Icons ─────────────────────────────────────────────────────────────────── */
function IcoDashboard() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  )
}
function IcoChecks() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h9"/>
    </svg>
  )
}
function IcoAudit() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  )
}
function IcoSettings() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  )
}
function IcoUser() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  )
}
function IcoCompliance() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
    </svg>
  )
}
function IcoTeam() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  )
}
function IcoRota() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}
function IcoClock() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  )
}
function IcoBoard() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  )
}
function IcoTimeOff() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/>
      <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
    </svg>
  )
}
function IcoTasks() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  )
}

/* ── Sidebar link component ─────────────────────────────────────────────────── */
function SideItem({ to, icon: Ico, label, badge, alert, isActive }) {
  return (
    <NavLink
      to={to}
      className={[
        'flex items-center gap-3 px-3.5 py-2 mx-2 rounded-lg transition-all duration-150 text-[13px] font-medium',
        isActive
          ? 'bg-white/14 text-white font-semibold'
          : alert
            ? 'text-warning/80 hover:text-warning hover:bg-white/8'
            : 'text-white/55 hover:text-white/85 hover:bg-white/8',
      ].join(' ')}
    >
      {Ico && (
        <span className={`shrink-0 ${isActive ? 'text-white' : alert ? 'text-warning/70' : 'text-white/35'}`}>
          <Ico />
        </span>
      )}
      <span className="flex-1 truncate tracking-wide">{label}</span>
      {badge > 0 && (
        <span className={`min-w-[18px] h-[18px] text-white text-[11px] font-bold rounded-full flex items-center justify-center px-1 shrink-0 ${alert ? 'bg-warning' : 'bg-accent'}`}>
          {badge}
        </span>
      )}
    </NavLink>
  )
}

/* ── Sidebar sub-item (indented, no icon) ────────────────────────────────────── */
function SubItem({ to, label, badge, alert, isActive }) {
  return (
    <NavLink
      to={to}
      className={[
        'flex items-center gap-2 pl-10 pr-4 py-2 mx-2 rounded-lg transition-all duration-150 text-[12.5px]',
        isActive
          ? 'text-white font-medium bg-white/12'
          : alert
            ? 'text-warning/75 hover:text-warning hover:bg-white/8'
            : 'text-white/50 hover:text-white/80 hover:bg-white/8',
      ].join(' ')}
    >
      <span className={`w-1 h-1 rounded-full shrink-0 ${isActive ? 'bg-white' : 'bg-white/25'}`} />
      <span className="flex-1 truncate">{label}</span>
      {badge > 0 && (
        <span className={`min-w-[16px] h-4 text-white text-[11px] font-bold rounded-full flex items-center justify-center px-1 shrink-0 ${alert ? 'bg-warning' : 'bg-accent'}`}>
          {badge}
        </span>
      )}
    </NavLink>
  )
}

/* ── Pro-locked nav item (shown to starter users as an upsell hint) ─────────── */
function LockedSubItem({ label }) {
  return (
    <div className="flex items-center gap-2 pl-10 pr-4 py-2 mx-2 rounded-lg text-[12.5px] text-white/25 cursor-default select-none">
      <span className="w-1 h-1 rounded-full shrink-0 bg-white/15" />
      <span className="flex-1 truncate">{label}</span>
      <span className="text-[9px] tracking-widest uppercase font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded shrink-0">Pro</span>
    </div>
  )
}

/* ── Section divider ────────────────────────────────────────────────────────── */
function SideSection({ label }) {
  return (
    <p className="px-6 pt-5 pb-1.5 text-[9.5px] font-semibold tracking-[0.14em] uppercase text-white/35 select-none">
      {label}
    </p>
  )
}

/* ── Venue switcher dropdown (manager only, multi-venue) ─────────────────────── */
function VenueSwitcher({ venues, currentSlug, onSelect }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (!venues || venues.length <= 1) return null

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-white/50 hover:text-white/80 transition-colors"
        aria-label="Switch venue"
        title="Switch venue"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 9l4-4 4 4M16 15l-4 4-4-4"/>
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-2 w-52 bg-[#1a3c2e] rounded-xl shadow-2xl border border-white/10 overflow-hidden z-50">
          <p className="px-3 pt-2.5 pb-1.5 text-[9px] tracking-[0.15em] uppercase text-white/35 font-semibold">Your venues</p>
          {venues.map(v => (
            <button
              key={v.id}
              onClick={() => { setOpen(false); onSelect(v.slug) }}
              className={[
                'w-full text-left px-3 py-2.5 text-[13px] flex items-center justify-between transition-colors',
                v.slug === currentSlug
                  ? 'text-white bg-white/12'
                  : 'text-white/60 hover:text-white hover:bg-white/8',
              ].join(' ')}
            >
              <span className="truncate">{v.name}</span>
              {v.slug === currentSlug && <span className="text-white/40 text-[10px]">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Main AppShell ───────────────────────────────────────────────────────────── */
export default function AppShell({ children }) {
  const { session, isManager, signOut } = useSession()
  const { venueId, venueSlug, venueName } = useVenue()
  const { venues, selectVenue } = useAuth()
  const location     = useLocation()
  const navigate     = useNavigate()
  const overdueCount = useOverdueCleaning(venueId)
  const pendingSwaps = usePendingSwaps(venueId)
  const { logoUrl }  = useVenueBranding(venueId)

  const { isEnabled, isPlanLocked, venuePlan } = useVenueFeatures()

  const name = session?.staffName ?? ''

  const vp = (p) => `/v/${venueSlug}${p}`

  const base      = `/v/${venueSlug}`
  const localPath = location.pathname.startsWith(base)
    ? (location.pathname.slice(base.length) || '/')
    : location.pathname

  const handleSignOut = () => {
    signOut()
    navigate(`/v/${venueSlug}`, { replace: true })
  }

  const isAt = (p) => localPath === p
  const isUnder = (p) => localPath.startsWith(p)

  const bgClass = isManager ? 'bg-cream dark:bg-[#111111]' : 'bg-staffbg dark:bg-[#111111]'
  const maxW    = isManager ? 'max-w-[1280px]' : 'max-w-[860px]'

  return (
    <div className="min-h-dvh flex font-sans" style={{ paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>

      {/* Skip to content — a11y */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:z-[100] focus:top-2 focus:left-2 focus:bg-accent focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-semibold">
        Skip to content
      </a>

      {/* ── Desktop sidebar (hidden on everything below 1024px — lg breakpoint) ─ */}
      <aside
        className="hidden lg:flex flex-col w-[220px] fixed top-3 bottom-3 left-3 z-30 bg-brand rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.18)]"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
        aria-label="Sidebar navigation"
      >
        {/* Logo + venue name + notification bell */}
        <div className="px-4 pt-5 pb-4 border-b border-white/8 shrink-0">
          <div className="flex items-center gap-2">
            {logoUrl ? (
              <img src={logoUrl} alt="Venue logo" className="h-7 w-7 rounded-md object-contain bg-white/10 p-0.5 shrink-0" />
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white text-xl leading-none tracking-tight truncate">{venueName || 'SafeServ'}</span>
                {isManager && (
                  <VenueSwitcher
                    venues={venues}
                    currentSlug={venueSlug}
                    onSelect={(slug) => { selectVenue(slug); window.location.replace(`/v/${slug}/dashboard`) }}
                  />
                )}
              </div>
              <span className="mt-2 inline-flex items-center gap-1 bg-white/10 text-white/50 text-[9px] tracking-[0.15em] uppercase font-semibold px-2 py-0.5 rounded-full">
                ⚡ Powered by SafeServ
              </span>
            </div>
            {/* Bell lives here — top of sidebar, always visible */}
            <NotificationBell variant="dark" />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden" aria-label="Main navigation">
          {isManager ? (
            <>
              <div className="space-y-0.5 px-0 pt-2">
                <SideItem to={vp('/dashboard')}      icon={IcoDashboard} label="Dashboard"   isActive={isAt('/dashboard')} />
                {isEnabled('opening_closing') && <SideItem to={vp('/opening-closing')} icon={IcoChecks} label="Checks" isActive={isUnder('/opening-closing')} />}
                <SideItem to={vp('/tasks')}    icon={IcoTasks}     label="Tasks"          isActive={isUnder('/tasks')} />
                <SideItem to={vp('/fitness')}  icon={IcoUser}      label="Fitness to Work" isActive={isUnder('/fitness')} />
              </div>

              <SideSection label="Compliance" />
              <div className="space-y-0.5">
                {isEnabled('fridge')        && <SubItem to={vp('/fridge')}         label="Fridge Temps"   isActive={isUnder('/fridge')} />}
                {isEnabled('cooking_temps') && <SubItem to={vp('/cooking-temps')}  label="Cooking Temps"  isActive={isUnder('/cooking-temps')} />}
                {isEnabled('hot_holding')   && <SubItem to={vp('/hot-holding')}    label="Hot Holding"    isActive={isUnder('/hot-holding')} />}
                {isEnabled('cooling_logs')  && <SubItem to={vp('/cooling-logs')}   label="Cooling Logs"   isActive={isUnder('/cooling-logs')} />}
                {isEnabled('deliveries')    && <SubItem to={vp('/deliveries')}     label="Deliveries"     isActive={isUnder('/deliveries')} />}
                {isEnabled('probe')         && <SubItem to={vp('/probe')}          label="Probe Cal."     isActive={isUnder('/probe')} />}
                {isEnabled('allergens')     && <SubItem to={vp('/allergens')}      label="Allergens"      isActive={isUnder('/allergens')} />}
                {isEnabled('pest_control')  && <SubItem to={vp('/pest-control')}   label="Pest Control"   isActive={isUnder('/pest-control')} />}
                {isEnabled('cleaning')      && <SubItem to={vp('/cleaning')}       label="Cleaning"       badge={overdueCount} alert={overdueCount > 0} isActive={isUnder('/cleaning')} />}
                {isEnabled('corrective')    && <SubItem to={vp('/corrective')}     label="Actions"        isActive={isUnder('/corrective')} />}
                <SubItem to={vp('/suppliers')}  label="Suppliers"       isActive={isUnder('/suppliers')} />
                <SubItem to={vp('/haccp')}      label="HACCP"           isActive={isUnder('/haccp')} />
                <SubItem to={vp('/eho-mock')}   label="Mock Inspection" isActive={isUnder('/eho-mock')} />
              </div>

              <SideSection label="Team" />
              <div className="space-y-0.5">
                {isPlanLocked('rota')      ? <LockedSubItem label="Rota" />
                  : isEnabled('rota')      && <SubItem to={vp('/rota')}      label="Rota"      badge={pendingSwaps} alert={pendingSwaps > 0} isActive={isUnder('/rota')} />}
                {isPlanLocked('timesheet') ? <LockedSubItem label="Hours" />
                  : isEnabled('timesheet') && <SubItem to={vp('/timesheet')} label="Hours"     isActive={isUnder('/timesheet')} />}
                {isPlanLocked('training')  ? <LockedSubItem label="Training" />
                  : isEnabled('training')  && <SubItem to={vp('/training')}  label="Training"  isActive={isUnder('/training')} />}
                {isPlanLocked('time_off')  ? <LockedSubItem label="Time Off" />
                  : isEnabled('time_off')  && <SubItem to={vp('/time-off')}  label="Time Off"  isActive={isUnder('/time-off')} />}
                {isPlanLocked('clock-in')    ? <LockedSubItem label="Clock In / Out" />
                  : <SubItem to={vp('/clock-in')}    label="Clock In / Out"  isActive={isUnder('/clock-in')} />}
                {isPlanLocked('noticeboard') ? <LockedSubItem label="Noticeboard" />
                  : <SubItem to={vp('/noticeboard')} label="Noticeboard"     isActive={isUnder('/noticeboard')} />}
              </div>

              <div className="mt-2 space-y-0.5 border-t border-white/8 pt-2">
                <SideItem to={vp('/audit')}    icon={IcoAudit}    label="EHO Audit"  isActive={isAt('/audit')} />
                <SideItem to={vp('/settings')} icon={IcoSettings} label="Settings"   isActive={isUnder('/settings')} />
              </div>
            </>
          ) : (
            <div className="space-y-0.5 pt-2">
              <SideItem to={vp('/dashboard')}       icon={IcoUser}       label="My Shift"      isActive={isAt('/dashboard')} />
              <SideItem to={vp('/tasks')}           icon={IcoTasks}      label="Tasks"         isActive={isUnder('/tasks')} />
              {!isPlanLocked('clock-in')    && <SideItem to={vp('/clock-in')}    icon={IcoClock} label="Clock In / Out" isActive={isUnder('/clock-in')} />}
              {!isPlanLocked('noticeboard') && <SideItem to={vp('/noticeboard')} icon={IcoBoard} label="Noticeboard"   isActive={isUnder('/noticeboard')} />}
              {isEnabled('opening_closing') && <SideItem to={vp('/opening-closing')} icon={IcoChecks}     label="Checks"    isActive={isUnder('/opening-closing')} />}
              {isEnabled('cleaning')        && <SideItem to={vp('/cleaning')}        icon={IcoCompliance} label="Cleaning"  isActive={isUnder('/cleaning')} />}
              {isEnabled('fridge') && session?.showTempLogs && (
                <SideItem to={vp('/fridge')} icon={IcoCompliance} label="Temp Logs" isActive={isUnder('/fridge')} />
              )}
              {isEnabled('allergens') && <SideItem to={vp('/allergens')} icon={IcoCompliance} label="Allergens" isActive={isUnder('/allergens')} />}
              {isEnabled('rota')     && <SideItem to={vp('/rota')}      icon={IcoRota}       label="Rota"      isActive={isUnder('/rota')} />}
              {isEnabled('time_off') && <SideItem to={vp('/time-off')}  icon={IcoTimeOff}    label="Time Off"  isActive={isUnder('/time-off')} />}
            </div>
          )}
        </nav>

        {/* Bottom: user name + signout */}
        <div className="shrink-0 border-t border-white/10 px-4 py-4 space-y-3">
          {name && (
            <p className="text-[12px] text-white/45 truncate text-center">{name}</p>
          )}
          <button
            onClick={handleSignOut}
            className="w-full text-[11px] tracking-widest uppercase text-white/40 border border-white/15 rounded-lg py-2 hover:text-white/70 hover:border-white/30 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Content area (offset by sidebar on desktop) ───────────────────── */}
      <div className={`flex-1 lg:ml-[236px] flex flex-col min-h-dvh overflow-x-hidden ${bgClass}`}>

        {/* Mobile-only header (shown below lg breakpoint) */}
        <header
          className="lg:hidden bg-brand shrink-0"
          role="banner"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="px-3 h-12 flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="font-bold text-white text-base tracking-tight truncate max-w-[160px]">{venueName || 'SafeServ'}</span>
              {isManager && (
                <VenueSwitcher
                  venues={venues}
                  currentSlug={venueSlug}
                  onSelect={(slug) => { selectVenue(slug); window.location.replace(`/v/${slug}/dashboard`) }}
                />
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <NotificationBell />
              <button
                onClick={handleSignOut}
                className="text-[11px] tracking-wider uppercase text-cream/50 border border-cream/20 px-1.5 py-0.5 rounded hover:text-cream hover:border-cream/50 transition-colors whitespace-nowrap"
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>

        {/* Offline banner */}
        <OfflineBanner />

        {/* Mobile sub-nav */}
        <MobileNav />

        {/* Page content */}
        <main
          id="main-content"
          role="main"
          className={`flex-1 ${maxW} mx-auto w-full px-4 lg:px-8 py-5 lg:py-8 pb-[max(5.5rem,calc(4.5rem+env(safe-area-inset-bottom)))] lg:pb-8`}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
