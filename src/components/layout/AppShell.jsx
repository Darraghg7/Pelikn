import React, { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useSession } from '../../contexts/SessionContext'
import { supabase } from '../../lib/supabase'
import NotificationBell from '../notifications/NotificationBell'
import OfflineBanner from '../ui/OfflineBanner'

function useOverdueCleaning() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const load = async () => {
      const { data: tasks } = await supabase
        .from('cleaning_tasks').select('id, frequency').eq('is_active', true)
      if (!tasks?.length) return
      const { data: completions } = await supabase
        .from('cleaning_completions').select('cleaning_task_id, completed_at')
        .order('completed_at', { ascending: false })
      const freqDays = { daily: 1, weekly: 7, fortnightly: 14, monthly: 30, quarterly: 90 }
      const now = new Date()
      let overdue = 0
      for (const t of tasks) {
        const last = completions?.find(c => c.cleaning_task_id === t.id)
        if (!last) { overdue++; continue }
        if ((now - new Date(last.completed_at)) / 86400000 > freqDays[t.frequency]) overdue++
      }
      setCount(overdue)
    }
    load()
  }, [])
  return count
}

function usePendingSwaps() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    supabase.from('shift_swaps').select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .then(({ count: c }) => setCount(c ?? 0))
  }, [])
  return count
}

function useVenueLogo() {
  const [logoUrl, setLogoUrl] = useState('')
  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'logo_url').single()
      .then(({ data }) => { if (data?.value) setLogoUrl(data.value) })
  }, [])
  return logoUrl
}

/* ── Dropdown menu component ─────────────────────────────────────────────── */
function NavDropdown({ label, items, alert, currentPath }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Is any child route active?
  const isGroupActive = items.some(
    item => currentPath === item.to || (item.to !== '/dashboard' && currentPath.startsWith(item.to))
  )

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [open])

  // Close on route change
  useEffect(() => { setOpen(false) }, [currentPath])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className={[
          'px-3 sm:px-4 py-3 sm:py-3.5 text-[10px] sm:text-[11px] tracking-widest font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px flex items-center gap-1',
          isGroupActive
            ? 'text-charcoal border-accent'
            : alert
              ? 'text-warning border-transparent hover:text-warning/80'
              : 'text-charcoal/35 border-transparent hover:text-charcoal/60',
        ].join(' ')}
      >
        {label}
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-px bg-white rounded-xl shadow-xl border border-charcoal/10 py-1.5 z-50 min-w-[180px]">
          {items.map(item => {
            const isActive = currentPath === item.to || (item.to !== '/dashboard' && currentPath.startsWith(item.to))
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={[
                  'block px-4 py-2.5 text-[11px] tracking-widest font-medium transition-colors',
                  isActive
                    ? 'text-charcoal bg-accent/8'
                    : item.alert
                      ? 'text-warning hover:bg-warning/5'
                      : 'text-charcoal/50 hover:text-charcoal hover:bg-charcoal/4',
                ].join(' ')}
              >
                {item.label}
              </NavLink>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Main AppShell ───────────────────────────────────────────────────────── */
export default function AppShell({ children }) {
  const { session, isManager, signOut } = useSession()
  const location     = useLocation()
  const navigate     = useNavigate()
  const overdueCount = useOverdueCleaning()
  const pendingSwaps = usePendingSwaps()
  const logoUrl      = useVenueLogo()
  const navRef       = useRef(null)
  const [canScrollLeft, setCanScrollLeft]   = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const name = session?.staffName ?? ''

  const handleSignOut = () => {
    signOut()
    navigate('/', { replace: true })
  }

  // ── Nav scroll state ───────────────────────────────────────────────────
  const updateScrollIndicators = () => {
    const el = navRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 2)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
  }

  useEffect(() => {
    const el = navRef.current
    if (!el) return
    updateScrollIndicators()
    el.addEventListener('scroll', updateScrollIndicators, { passive: true })
    window.addEventListener('resize', updateScrollIndicators)
    return () => {
      el.removeEventListener('scroll', updateScrollIndicators)
      window.removeEventListener('resize', updateScrollIndicators)
    }
  }, [])

  useEffect(() => {
    const el = navRef.current
    if (!el) return
    const active = el.querySelector('[data-active="true"]')
    if (active) active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
    setTimeout(updateScrollIndicators, 100)
  }, [location.pathname])

  // ── Manager nav: grouped with dropdowns ──────────────────────────────
  const complianceItems = [
    { to: '/fridge',       label: 'TEMP LOGS' },
    { to: '/deliveries',   label: 'DELIVERIES' },
    { to: '/probe',        label: 'PROBE CAL.' },
    { to: '/allergens',    label: 'ALLERGENS' },
    { to: '/cleaning',     label: overdueCount > 0 ? `CLEANING (${overdueCount})` : 'CLEANING', alert: overdueCount > 0 },
    { to: '/corrective',   label: 'ACTIONS' },
  ]
  const hasComplianceAlert = overdueCount > 0

  const teamItems = [
    { to: '/rota',       label: pendingSwaps > 0 ? `ROTA (${pendingSwaps})` : 'ROTA', alert: pendingSwaps > 0 },
    { to: '/timesheet',  label: 'HOURS' },
    { to: '/training',   label: 'TRAINING' },
    { to: '/time-off',   label: 'TIME OFF' },
  ]
  const hasTeamAlert = pendingSwaps > 0

  // Staff nav: flat (fewer items, no dropdowns needed)
  const staffLinks = [
    { to: '/dashboard',       label: 'MY SHIFT' },
    { to: '/opening-closing', label: 'CHECKS' },
    { to: '/cleaning',        label: 'CLEANING' },
    ...(session?.showTempLogs  ? [{ to: '/fridge',    label: 'TEMP LOGS' }] : []),
    ...(session?.showAllergens ? [{ to: '/allergens', label: 'ALLERGENS' }] : []),
    { to: '/rota',            label: 'ROTA' },
    { to: '/time-off',        label: 'TIME OFF' },
  ]

  const bgClass = isManager ? 'bg-cream'   : 'bg-staffbg'
  const maxW    = isManager ? 'max-w-[900px]' : 'max-w-[560px]'

  return (
    <div className={`min-h-dvh ${bgClass} font-sans flex flex-col`} style={{ paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>

      {/* Header */}
      <header className="bg-charcoal shrink-0" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className={`${maxW} mx-auto px-3 sm:px-8 h-12 flex items-center justify-between gap-1.5`}>
          {/* Left: logo */}
          <span className="font-serif text-cream text-lg tracking-tight shrink-0">SafeServ</span>
          {/* Right: bell + name + sign out + logo */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <NotificationBell />
            <span className="hidden sm:block text-xs text-cream/60 font-medium max-w-[120px] truncate">{name}</span>
            <button
              onClick={handleSignOut}
              className="text-[10px] sm:text-[11px] tracking-wider sm:tracking-widest uppercase text-cream/50 border border-cream/20 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded hover:text-cream hover:border-cream/50 transition-colors whitespace-nowrap"
            >
              Sign Out
            </button>
            {logoUrl && (
              <img
                src={logoUrl}
                alt="Venue logo"
                className="h-7 w-7 sm:h-8 sm:w-8 rounded-md object-contain bg-white/10 p-0.5 shrink-0"
              />
            )}
          </div>
        </div>
      </header>

      {/* Offline banner */}
      <OfflineBanner />

      {/* Nav tabs */}
      <nav className="bg-white border-b border-charcoal/10 shrink-0 relative">
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
        )}
        <div
          ref={navRef}
          className={`${maxW} mx-auto px-3 sm:px-8 flex ${isManager ? 'overflow-visible flex-wrap' : 'overflow-x-auto scrollbar-hide'}`}
          style={isManager ? {} : { scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          {isManager ? (
            <>
              {/* Dashboard — direct link */}
              <NavLink
                to="/dashboard"
                data-active={location.pathname === '/dashboard'}
                className={[
                  'px-3 sm:px-4 py-3 sm:py-3.5 text-[10px] sm:text-[11px] tracking-widest font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px shrink-0',
                  location.pathname === '/dashboard'
                    ? 'text-charcoal border-accent'
                    : 'text-charcoal/35 border-transparent hover:text-charcoal/60',
                ].join(' ')}
              >
                DASHBOARD
              </NavLink>

              {/* Checks — direct link */}
              <NavLink
                to="/opening-closing"
                data-active={location.pathname.startsWith('/opening-closing')}
                className={[
                  'px-3 sm:px-4 py-3 sm:py-3.5 text-[10px] sm:text-[11px] tracking-widest font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px shrink-0',
                  location.pathname.startsWith('/opening-closing')
                    ? 'text-charcoal border-accent'
                    : 'text-charcoal/35 border-transparent hover:text-charcoal/60',
                ].join(' ')}
              >
                CHECKS
              </NavLink>

              {/* Compliance dropdown */}
              <NavDropdown
                label={hasComplianceAlert ? 'COMPLIANCE !' : 'COMPLIANCE'}
                items={complianceItems}
                alert={hasComplianceAlert}
                currentPath={location.pathname}
              />

              {/* Team dropdown */}
              <NavDropdown
                label={hasTeamAlert ? 'TEAM !' : 'TEAM'}
                items={teamItems}
                alert={hasTeamAlert}
                currentPath={location.pathname}
              />

              {/* EHO Audit — direct link */}
              <NavLink
                to="/audit"
                data-active={location.pathname === '/audit'}
                className={[
                  'px-3 sm:px-4 py-3 sm:py-3.5 text-[10px] sm:text-[11px] tracking-widest font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px shrink-0',
                  location.pathname === '/audit'
                    ? 'text-charcoal border-accent'
                    : 'text-charcoal/35 border-transparent hover:text-charcoal/60',
                ].join(' ')}
              >
                EHO AUDIT
              </NavLink>

              {/* Settings — direct link */}
              <NavLink
                to="/settings"
                data-active={location.pathname.startsWith('/settings')}
                className={[
                  'px-3 sm:px-4 py-3 sm:py-3.5 text-[10px] sm:text-[11px] tracking-widest font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px shrink-0',
                  location.pathname.startsWith('/settings')
                    ? 'text-charcoal border-accent'
                    : 'text-charcoal/35 border-transparent hover:text-charcoal/60',
                ].join(' ')}
              >
                SETTINGS
              </NavLink>
            </>
          ) : (
            // Staff: flat nav (fewer items)
            staffLinks.map(l => {
              const isActive = location.pathname === l.to || (l.to !== '/dashboard' && location.pathname.startsWith(l.to))
              return (
                <NavLink
                  key={l.to} to={l.to}
                  data-active={isActive}
                  className={[
                    'px-3 sm:px-4 py-3 sm:py-3.5 text-[10px] sm:text-[11px] tracking-widest font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px',
                    isActive
                      ? 'text-charcoal border-accent'
                      : 'text-charcoal/35 border-transparent hover:text-charcoal/60',
                  ].join(' ')}
                >
                  {l.label}
                </NavLink>
              )
            })
          )}
        </div>
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
        )}
      </nav>

      {/* Page content */}
      <main className={`flex-1 ${maxW} mx-auto w-full px-4 sm:px-8 py-6 sm:py-8`}>
        {children}
      </main>
    </div>
  )
}
