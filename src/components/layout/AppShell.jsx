import React, { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useSession } from '../../contexts/SessionContext'
import { useVenue } from '../../contexts/VenueContext'
import { supabase } from '../../lib/supabase'
import NotificationBell from '../notifications/NotificationBell'
import OfflineBanner from '../ui/OfflineBanner'
import MobileNav from './MobileNav'

// Simple per-venue cache to avoid refetching on every page navigation
const _cache = { cleaning: {}, swaps: {}, logo: {} }

function useOverdueCleaning(venueId) {
  const [count, setCount] = useState(() => _cache.cleaning[venueId] ?? 0)
  useEffect(() => {
    if (!venueId) return
    if (_cache.cleaning[venueId + '_ts'] && Date.now() - _cache.cleaning[venueId + '_ts'] < 60000) return
    const load = async () => {
      const { data: tasks } = await supabase
        .from('cleaning_tasks').select('id, frequency').eq('venue_id', venueId).eq('is_active', true)
      if (!tasks?.length) return
      const { data: completions } = await supabase
        .from('cleaning_completions').select('cleaning_task_id, completed_at')
        .eq('venue_id', venueId)
        .order('completed_at', { ascending: false })
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
    }
    load()
  }, [venueId])
  return count
}

function usePendingSwaps(venueId) {
  const [count, setCount] = useState(() => _cache.swaps[venueId] ?? 0)
  useEffect(() => {
    if (!venueId) return
    if (_cache.swaps[venueId + '_ts'] && Date.now() - _cache.swaps[venueId + '_ts'] < 60000) return
    supabase.from('shift_swaps').select('id', { count: 'exact', head: true })
      .eq('venue_id', venueId)
      .eq('status', 'pending')
      .then(({ count: c }) => {
        _cache.swaps[venueId] = c ?? 0
        _cache.swaps[venueId + '_ts'] = Date.now()
        setCount(c ?? 0)
      })
  }, [venueId])
  return count
}

function useVenueLogo(venueId) {
  const [logoUrl, setLogoUrl] = useState(() => _cache.logo[venueId] ?? '')
  useEffect(() => {
    if (!venueId) return
    if (_cache.logo[venueId + '_ts']) return
    supabase.from('app_settings').select('value').eq('venue_id', venueId).eq('key', 'logo_url').single()
      .then(({ data }) => {
        const url = data?.value ?? ''
        _cache.logo[venueId] = url
        _cache.logo[venueId + '_ts'] = Date.now()
        if (url) setLogoUrl(url)
      })
  }, [venueId])
  return logoUrl
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
function IcoTimeOff() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/>
      <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
    </svg>
  )
}

/* ── Sidebar link component ─────────────────────────────────────────────────── */
function SideItem({ to, icon: Ico, label, badge, alert, isActive }) {
  return (
    <NavLink
      to={to}
      className={[
        'flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg transition-all duration-150 text-[13px] font-medium border-l-2',
        isActive
          ? 'border-accent bg-charcoal/8 dark:bg-white/10 text-charcoal dark:text-white'
          : alert
            ? 'border-transparent text-warning/70 hover:text-warning hover:bg-charcoal/5 dark:hover:bg-white/5'
            : 'border-transparent text-charcoal/50 dark:text-white/40 hover:text-charcoal/80 dark:hover:text-white/75 hover:bg-charcoal/5 dark:hover:bg-white/5',
      ].join(' ')}
    >
      {Ico && (
        <span className={`shrink-0 ${isActive ? 'text-accent' : alert ? 'text-warning/60' : 'text-charcoal/30 dark:text-white/30'}`}>
          <Ico />
        </span>
      )}
      <span className="flex-1 truncate tracking-wide">{label}</span>
      {badge > 0 && (
        <span className={`min-w-[18px] h-[18px] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shrink-0 ${alert ? 'bg-warning' : 'bg-accent'}`}>
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
          ? 'text-charcoal dark:text-white bg-charcoal/8 dark:bg-white/8'
          : alert
            ? 'text-warning/65 hover:text-warning hover:bg-charcoal/5 dark:hover:bg-white/5'
            : 'text-charcoal/40 dark:text-white/35 hover:text-charcoal/70 dark:hover:text-white/65 hover:bg-charcoal/5 dark:hover:bg-white/5',
      ].join(' ')}
    >
      <span className={`w-1 h-1 rounded-full shrink-0 ${isActive ? 'bg-accent' : 'bg-charcoal/20 dark:bg-white/20'}`} />
      <span className="flex-1 truncate">{label}</span>
      {badge > 0 && (
        <span className={`min-w-[16px] h-4 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shrink-0 ${alert ? 'bg-warning' : 'bg-accent'}`}>
          {badge}
        </span>
      )}
    </NavLink>
  )
}

/* ── Section divider ────────────────────────────────────────────────────────── */
function SideSection({ label }) {
  return (
    <p className="px-6 pt-5 pb-1.5 text-[9.5px] font-semibold tracking-[0.14em] uppercase text-charcoal/35 dark:text-white/22 select-none">
      {label}
    </p>
  )
}

/* ── Main AppShell ───────────────────────────────────────────────────────────── */
export default function AppShell({ children }) {
  const { session, isManager, signOut } = useSession()
  const { venueId, venueSlug, venueName } = useVenue()
  const location     = useLocation()
  const navigate     = useNavigate()
  const overdueCount = useOverdueCleaning(venueId)
  const pendingSwaps = usePendingSwaps(venueId)
  const logoUrl      = useVenueLogo(venueId)

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
  const maxW    = isManager ? 'max-w-[900px]' : 'max-w-[560px]'

  return (
    <div className="min-h-dvh flex font-sans" style={{ paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>

      {/* Skip to content — a11y */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:z-[100] focus:top-2 focus:left-2 focus:bg-accent focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-semibold">
        Skip to content
      </a>

      {/* ── Desktop sidebar ───────────────────────────────────────────────── */}
      <aside
        className="hidden sm:flex flex-col w-[220px] fixed inset-y-0 left-0 z-30 bg-white dark:bg-[#1a1a18] border-r border-charcoal/10 dark:border-white/8 overflow-y-auto overflow-x-hidden"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
        aria-label="Sidebar navigation"
      >
        {/* Logo + venue name */}
        <div className="px-5 pt-5 pb-4 border-b border-charcoal/10 dark:border-white/8 shrink-0">
          <div className="flex items-center gap-2.5">
            {logoUrl ? (
              <img src={logoUrl} alt="Venue logo" className="h-7 w-7 rounded-md object-contain bg-charcoal/8 dark:bg-white/10 p-0.5 shrink-0" />
            ) : null}
            <div className="min-w-0">
              <span className="font-serif text-charcoal dark:text-cream text-lg leading-none tracking-tight block">SafeServ</span>
              {venueName && (
                <p className="text-[11px] text-charcoal/45 dark:text-white/35 mt-0.5 truncate">{venueName}</p>
              )}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2" aria-label="Main navigation">
          {isManager ? (
            <>
              <div className="space-y-0.5 px-0 pt-2">
                <SideItem to={vp('/dashboard')}      icon={IcoDashboard} label="Dashboard"   isActive={isAt('/dashboard')} />
                <SideItem to={vp('/opening-closing')} icon={IcoChecks}   label="Checks"      isActive={isUnder('/opening-closing')} />
              </div>

              <SideSection label="Compliance" />
              <div className="space-y-0.5">
                <SubItem to={vp('/fridge')}         label="Fridge Temps"   isActive={isUnder('/fridge')} />
                <SubItem to={vp('/cooking-temps')}  label="Cooking Temps"  isActive={isUnder('/cooking-temps')} />
                <SubItem to={vp('/hot-holding')}    label="Hot Holding"    isActive={isUnder('/hot-holding')} />
                <SubItem to={vp('/deliveries')}     label="Deliveries"     isActive={isUnder('/deliveries')} />
                <SubItem to={vp('/probe')}          label="Probe Cal."     isActive={isUnder('/probe')} />
                <SubItem to={vp('/allergens')}      label="Allergens"      isActive={isUnder('/allergens')} />
                <SubItem to={vp('/cleaning')}       label="Cleaning"       badge={overdueCount} alert={overdueCount > 0} isActive={isUnder('/cleaning')} />
                <SubItem to={vp('/corrective')}     label="Actions"        isActive={isUnder('/corrective')} />
              </div>

              <SideSection label="Team" />
              <div className="space-y-0.5">
                <SubItem to={vp('/rota')}      label="Rota"      badge={pendingSwaps} alert={pendingSwaps > 0} isActive={isUnder('/rota')} />
                <SubItem to={vp('/timesheet')} label="Hours"     isActive={isUnder('/timesheet')} />
                <SubItem to={vp('/training')}  label="Training"  isActive={isUnder('/training')} />
                <SubItem to={vp('/time-off')}  label="Time Off"  isActive={isUnder('/time-off')} />
              </div>

              <div className="mt-2 space-y-0.5 border-t border-white/8 pt-2">
                <SideItem to={vp('/audit')}    icon={IcoAudit}    label="EHO Audit"  isActive={isAt('/audit')} />
                <SideItem to={vp('/settings')} icon={IcoSettings} label="Settings"   isActive={isUnder('/settings')} />
              </div>
            </>
          ) : (
            <div className="space-y-0.5 pt-2">
              <SideItem to={vp('/dashboard')}       icon={IcoUser}       label="My Shift"  isActive={isAt('/dashboard')} />
              <SideItem to={vp('/opening-closing')} icon={IcoChecks}     label="Checks"    isActive={isUnder('/opening-closing')} />
              <SideItem to={vp('/cleaning')}        icon={IcoCompliance} label="Cleaning"  isActive={isUnder('/cleaning')} />
              {session?.showTempLogs && (
                <SideItem to={vp('/fridge')} icon={IcoCompliance} label="Temp Logs" isActive={isUnder('/fridge')} />
              )}
              <SideItem to={vp('/allergens')} icon={IcoCompliance} label="Allergens" isActive={isUnder('/allergens')} />
              <SideItem to={vp('/rota')}      icon={IcoRota}       label="Rota"      isActive={isUnder('/rota')} />
              <SideItem to={vp('/time-off')}  icon={IcoTimeOff}    label="Time Off"  isActive={isUnder('/time-off')} />
            </div>
          )}
        </nav>

        {/* Bottom: notifications + user + signout */}
        <div className="shrink-0 border-t border-charcoal/10 dark:border-white/8 px-4 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <NotificationBell />
            <span className="text-[12px] text-charcoal/50 dark:text-white/40 truncate ml-2 flex-1 text-right">{name}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/30 border border-charcoal/12 dark:border-white/12 rounded-lg py-2 hover:text-charcoal dark:hover:text-white/60 hover:border-charcoal/30 dark:hover:border-white/30 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Content area (offset by sidebar on desktop) ───────────────────── */}
      <div className={`flex-1 sm:ml-[220px] flex flex-col min-h-dvh ${bgClass}`}>

        {/* Mobile-only header */}
        <header
          className="sm:hidden bg-charcoal dark:bg-[#0a0a0a] shrink-0"
          role="banner"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="px-3 h-12 flex items-center justify-between gap-1.5">
            <span className="font-serif text-cream text-lg tracking-tight shrink-0">SafeServ</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <NotificationBell />
              <button
                onClick={handleSignOut}
                className="text-[10px] tracking-wider uppercase text-cream/50 border border-cream/20 px-1.5 py-0.5 rounded hover:text-cream hover:border-cream/50 transition-colors whitespace-nowrap"
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
          className={`flex-1 ${maxW} mx-auto w-full px-4 sm:px-8 py-6 sm:py-8 pb-[max(5rem,calc(4rem+env(safe-area-inset-bottom)))] sm:pb-8`}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
