import React, { useEffect, useRef, useState, useCallback } from 'react'
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
    if (!venueId) { setCount(0); return }
    if (isFresh('cleaning', venueId)) {
      setCount(_cache.cleaning[venueId] ?? 0)
      return
    }
    setCount(0) // reset while fetching for the new venue
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
    if (!venueId) { setCount(0); return }
    if (isFresh('swaps', venueId)) {
      setCount(_cache.swaps[venueId] ?? 0)
      return
    }
    setCount(0) // reset while fetching for the new venue
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


/* ── Icons (top-level nav) ────────────────────────────────────────────────── */
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

function IcoVenues() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
}

/* ── Sub-item icons (14px, lighter stroke for smaller size) ────────────────── */
function IcoThermometer() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4v10.54a4 4 0 11-4 0V4a2 2 0 014 0z"/></svg>
}
function IcoFlame() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/></svg>
}
function IcoSnowflake() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><path d="M20 16l-4-4 4-4"/><path d="M4 8l4 4-4 4"/><path d="M16 4l-4 4-4-4"/><path d="M8 20l4-4 4 4"/></svg>
}
function IcoTruck() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
}
function IcoAllergen() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
}
function IcoBroom() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V7l7-4 7 4v14"/><line x1="9" y1="21" x2="9" y2="14"/><line x1="15" y1="21" x2="15" y2="14"/></svg>
}
function IcoAlert() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
}
function IcoDoc() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
}
function IcoBug() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3 3 0 016 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 014-4h4a4 4 0 014 4v3c0 3.3-2.7 6-6 6z"/><path d="M12 20v-9"/></svg>
}
function IcoSupplier() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
}
function IcoShield() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
}
function IcoBook() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
}
function IcoChevron({ className = '' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 18l6-6-6-6"/>
    </svg>
  )
}

/* ── Sidebar link component ─────────────────────────────────────────────────── */
function SideItem({ to, icon: Ico, label, badge, alert, isActive }) {
  return (
    <NavLink
      to={to}
      className={[
        'relative flex items-center gap-3 px-3.5 py-2 mx-2 rounded-lg text-[13.5px] font-medium',
        isActive
          ? 'bg-white/[0.14] text-white font-semibold'
          : alert
            ? 'text-warning/80 hover:text-warning hover:bg-white/8'
            : 'text-white/55 hover:text-white/85 hover:bg-white/8',
      ].join(' ')}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-brand-300" />
      )}
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

/* ── Sidebar sub-item (with icon) ──────────────────────────────────────────── */
function SubItem({ to, icon: Ico, label, badge, alert, isActive }) {
  return (
    <NavLink
      to={to}
      className={[
        'relative flex items-center gap-2.5 pl-5 pr-4 py-[7px] mx-2 rounded-lg text-[13px]',
        isActive
          ? 'text-white font-semibold bg-white/[0.1]'
          : alert
            ? 'text-warning/75 hover:text-warning hover:bg-white/8'
            : 'text-white/45 hover:text-white/80 hover:bg-white/[0.06]',
      ].join(' ')}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] rounded-r-full bg-brand-300" />
      )}
      {Ico ? (
        <span className={`shrink-0 ${isActive ? 'opacity-90' : 'opacity-45'}`}>
          <Ico />
        </span>
      ) : (
        <span className={`w-1 h-1 rounded-full shrink-0 ${isActive ? 'bg-white' : 'bg-white/25'}`} />
      )}
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
    <div className="flex items-center gap-2.5 pl-5 pr-4 py-[7px] mx-2 rounded-lg text-[13px] text-white/25 cursor-default select-none">
      <span className="w-1 h-1 rounded-full shrink-0 bg-white/15" />
      <span className="flex-1 truncate">{label}</span>
      <span className="text-[9px] tracking-widest uppercase font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded shrink-0">Pro</span>
    </div>
  )
}

/* ── Collapsible section ───────────────────────────────────────────────────── */
function CollapsibleSection({ label, badge, isOpen, onToggle, children }) {
  return (
    <div className="mt-1">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-5 pt-3 pb-1.5 group"
      >
        <span className="text-[10.5px] font-semibold tracking-[0.12em] uppercase text-white/25 group-hover:text-white/40 transition-colors flex-1 text-left select-none">
          {label}
        </span>
        {badge > 0 && (
          <span className="min-w-[18px] h-[18px] text-[10px] font-bold rounded-full flex items-center justify-center px-1 shrink-0 bg-amber-400/15 text-amber-400">
            {badge}
          </span>
        )}
        <IcoChevron className={`text-white/20 group-hover:text-white/35 transition-transform duration-[280ms] ease-[cubic-bezier(0.4,0,0.2,1)] shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      <div className={`sidebar-collapse-grid ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-collapse-inner">
          <div className="space-y-0.5 pb-1">
            {children}
          </div>
        </div>
      </div>
    </div>
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
        className="w-7 h-7 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/10 hover:border-white/20 transition-all"
        aria-label="Switch venue"
        title="Switch venue"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 9l4-4 4 4M16 15l-4 4-4-4"/>
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-2 w-52 bg-brand-800 rounded-xl shadow-dropdown border border-white/10 overflow-hidden z-50 animate-fade-in">
          <p className="px-3 pt-2.5 pb-1.5 text-[10px] tracking-[0.12em] uppercase text-white/30 font-semibold">Your venues</p>
          {venues.map(v => (
            <button
              key={v.id}
              onClick={() => { setOpen(false); onSelect(v.slug) }}
              className={[
                'w-full text-left px-3 py-2.5 text-[13px] flex items-center justify-between',
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

/* ── Sidebar section open/close persistence ────────────────────────────────── */
const STORAGE_KEY = 'safeserv_sidebar_sections'

function useSidebarSections(venueId, localPath) {
  // Determine which section the current path belongs to
  const compliancePaths = ['/fridge', '/cooking-temps', '/hot-holding', '/cooling-logs', '/deliveries', '/probe', '/allergens', '/pest-control', '/cleaning', '/corrective', '/suppliers', '/haccp', '/eho-mock']
  const teamPaths = ['/rota', '/timesheet', '/training', '/time-off', '/clock-in', '/noticeboard', '/staff']

  const activeSection = compliancePaths.some(p => localPath.startsWith(p))
    ? 'compliance'
    : teamPaths.some(p => localPath.startsWith(p))
      ? 'team'
      : null

  const [sections, setSections] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) return JSON.parse(stored)
    } catch {}
    // Default: auto-expand based on active section
    return { compliance: activeSection === 'compliance', team: activeSection === 'team' }
  })

  // Auto-expand the section containing the active page
  useEffect(() => {
    if (activeSection && !sections[activeSection]) {
      setSections(prev => {
        const next = { ...prev, [activeSection]: true }
        // Collapse the other section for cleanliness
        if (activeSection === 'compliance') next.team = false
        if (activeSection === 'team') next.compliance = false
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
        return next
      })
    }
  }, [activeSection]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = useCallback((section) => {
    setSections(prev => {
      const next = { ...prev, [section]: !prev[section] }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  return { sections, toggle }
}


/* ── Main AppShell ───────────────────────────────────────────────────────────── */
export default function AppShell({ children }) {
  const { session, isManager, signOut, hasMultiVenueAccess, hasPermission } = useSession()
  const { venueId, venueSlug, venueName } = useVenue()
  const { venues, selectVenue } = useAuth()
  const location     = useLocation()
  const navigate     = useNavigate()
  const overdueCount = useOverdueCleaning(venueId)
  const pendingSwaps = usePendingSwaps(venueId)
  const { logoUrl }  = useVenueBranding(venueId)

  const { isEnabled, isPlanLocked, venuePlan } = useVenueFeatures()

  const name = session?.staffName ?? ''
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

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

  const { sections, toggle } = useSidebarSections(venueId, localPath)

  const complianceBadge = overdueCount
  const teamBadge = pendingSwaps

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
        className="hidden lg:flex flex-col w-[232px] fixed top-3 bottom-3 left-3 z-30 bg-brand rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.18)]"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
        aria-label="Sidebar navigation"
      >
        {/* Logo + venue name */}
        <div className="px-5 pt-6 pb-5 border-b border-white/[0.07] shrink-0">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="Venue logo" className="h-9 w-9 rounded-lg object-contain bg-white/10 p-0.5 shrink-0" />
            ) : (
              <div className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center text-[15px] font-extrabold text-white/70 shrink-0">
                {(venueName || 'S')[0]}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-white text-lg leading-tight tracking-tight truncate">{venueName || 'SafeServ'}</span>
                {isManager && (
                  <VenueSwitcher
                    venues={venues}
                    currentSlug={venueSlug}
                    onSelect={(slug) => { selectVenue(slug); window.location.replace(`/v/${slug}/dashboard`) }}
                  />
                )}
              </div>
            </div>
            {/* Bell lives here — top of sidebar, always visible */}
            <NotificationBell variant="dark" />
          </div>
          <span className="mt-3 inline-flex items-center gap-1 bg-white/[0.05] border border-white/[0.05] text-white/25 text-[10px] tracking-[0.1em] uppercase font-semibold px-2.5 py-1 rounded-full">
            Powered by SafeServ
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden" aria-label="Main navigation">
          {isManager ? (
            <>
              {/* Top-level items — always visible */}
              <div className="space-y-0.5 px-0 pt-2">
                {hasMultiVenueAccess && (
                  <SideItem to={vp('/overview')} icon={IcoVenues} label="All Venues" isActive={isAt('/overview')} />
                )}
                <SideItem to={vp('/dashboard')}      icon={IcoDashboard} label="Dashboard"   isActive={isAt('/dashboard')} />
                {isEnabled('opening_closing') && <SideItem to={vp('/opening-closing')} icon={IcoChecks} label="Checks" isActive={isUnder('/opening-closing')} />}
                <SideItem to={vp('/tasks')}    icon={IcoTasks}     label="Tasks"          isActive={isUnder('/tasks')} />
                <SideItem to={vp('/fitness')}  icon={IcoUser}      label="Fitness to Work" isActive={isUnder('/fitness')} />
              </div>

              {/* Compliance — collapsible */}
              <CollapsibleSection
                label="Compliance"
                badge={complianceBadge}
                isOpen={sections.compliance}
                onToggle={() => toggle('compliance')}
              >
                {isEnabled('fridge')        && <SubItem to={vp('/fridge')}         icon={IcoThermometer} label="Fridge Temps"   isActive={isUnder('/fridge')} />}
                {isEnabled('cooking_temps') && <SubItem to={vp('/cooking-temps')}  icon={IcoFlame}       label="Cooking Temps"  isActive={isUnder('/cooking-temps')} />}
                {isEnabled('hot_holding')   && <SubItem to={vp('/hot-holding')}    icon={IcoSnowflake}   label="Hot Holding"    isActive={isUnder('/hot-holding')} />}
                {isEnabled('cooling_logs')  && <SubItem to={vp('/cooling-logs')}   icon={IcoSnowflake}   label="Cooling Logs"   isActive={isUnder('/cooling-logs')} />}
                {isEnabled('deliveries')    && <SubItem to={vp('/deliveries')}     icon={IcoTruck}       label="Deliveries"     isActive={isUnder('/deliveries')} />}
                {isEnabled('probe')         && <SubItem to={vp('/probe')}          icon={IcoThermometer} label="Probe Cal."     isActive={isUnder('/probe')} />}
                {isEnabled('allergens')     && <SubItem to={vp('/allergens')}      icon={IcoAllergen}    label="Allergens"      isActive={isUnder('/allergens')} />}
                {isEnabled('pest_control')  && <SubItem to={vp('/pest-control')}   icon={IcoBug}         label="Pest Control"   isActive={isUnder('/pest-control')} />}
                {isEnabled('cleaning')      && <SubItem to={vp('/cleaning')}       icon={IcoBroom}       label="Cleaning"       badge={overdueCount} alert={overdueCount > 0} isActive={isUnder('/cleaning')} />}
                {isEnabled('corrective')    && <SubItem to={vp('/corrective')}     icon={IcoAlert}       label="Actions"        isActive={isUnder('/corrective')} />}
                <SubItem to={vp('/suppliers')}  icon={IcoSupplier} label="Suppliers"       isActive={isUnder('/suppliers')} />
                <SubItem to={vp('/haccp')}      icon={IcoDoc}      label="HACCP"           isActive={isUnder('/haccp')} />
                <SubItem to={vp('/eho-mock')}   icon={IcoShield}   label="Mock Inspection" isActive={isUnder('/eho-mock')} />
              </CollapsibleSection>

              {/* Team — collapsible */}
              <CollapsibleSection
                label="Team"
                badge={teamBadge}
                isOpen={sections.team}
                onToggle={() => toggle('team')}
              >
                {isPlanLocked('rota')      ? <LockedSubItem label="Rota" />
                  : isEnabled('rota')      && <SubItem to={vp('/rota')}      icon={IcoRota}    label="Rota"      badge={pendingSwaps} alert={pendingSwaps > 0} isActive={isUnder('/rota')} />}
                {isPlanLocked('timesheet') ? <LockedSubItem label="Hours" />
                  : isEnabled('timesheet') && <SubItem to={vp('/timesheet')} icon={IcoClock}   label="Hours"     isActive={isUnder('/timesheet')} />}
                {isPlanLocked('training')  ? <LockedSubItem label="Training" />
                  : isEnabled('training')  && <SubItem to={vp('/training')}  icon={IcoBook}    label="Training"  isActive={isUnder('/training')} />}
                {isPlanLocked('time_off')  ? <LockedSubItem label="Time Off" />
                  : isEnabled('time_off')  && <SubItem to={vp('/time-off')}  icon={IcoTimeOff} label="Time Off"  isActive={isUnder('/time-off')} />}
                {isPlanLocked('clock-in')    ? <LockedSubItem label="Clock In / Out" />
                  : <SubItem to={vp('/clock-in')}    icon={IcoClock}   label="Clock In / Out"  isActive={isUnder('/clock-in')} />}
                {isPlanLocked('noticeboard') ? <LockedSubItem label="Noticeboard" />
                  : <SubItem to={vp('/noticeboard')} icon={IcoBoard}   label="Noticeboard"     isActive={isUnder('/noticeboard')} />}
                <SubItem to={vp('/staff')} icon={IcoTeam} label="Staff" isActive={isUnder('/staff')} />
              </CollapsibleSection>

              {/* Bottom fixed items */}
              <div className="mt-2 space-y-0.5 border-t border-white/[0.07] pt-2">
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
              {isEnabled('opening_closing') && hasPermission('manage_opening') && <SideItem to={vp('/opening-closing')} icon={IcoChecks}     label="Checks"    isActive={isUnder('/opening-closing')} />}
              {isEnabled('cleaning') && hasPermission('manage_cleaning') && <SideItem to={vp('/cleaning')}        icon={IcoCompliance} label="Cleaning"  isActive={isUnder('/cleaning')} />}
              {isEnabled('fridge') && hasPermission('view_temp_logs') && (
                <SideItem to={vp('/fridge')} icon={IcoCompliance} label="Temp Logs" isActive={isUnder('/fridge')} />
              )}
              {isEnabled('allergens') && hasPermission('manage_allergens') && (
                <SideItem to={vp('/allergens')} icon={IcoCompliance} label="Allergens" isActive={isUnder('/allergens')} />
              )}
              {isEnabled('deliveries') && hasPermission('log_deliveries') && (
                <SideItem to={vp('/deliveries')} icon={IcoCompliance} label="Deliveries" isActive={isUnder('/deliveries')} />
              )}
              {isEnabled('waste') && hasPermission('log_waste') && (
                <SideItem to={vp('/waste')} icon={IcoCompliance} label="Waste" isActive={isUnder('/waste')} />
              )}
              {isEnabled('rota')     && <SideItem to={vp('/rota')}      icon={IcoRota}       label="Rota"      isActive={isUnder('/rota')} />}
              {isEnabled('time_off') && <SideItem to={vp('/time-off')}  icon={IcoTimeOff}    label="Time Off"  isActive={isUnder('/time-off')} />}
            </div>
          )}
        </nav>

        {/* Bottom: avatar + user name + signout */}
        <div className="shrink-0 border-t border-white/[0.07] px-4 py-4 flex items-center gap-3">
          {initials && (
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[12px] font-bold text-white/60 shrink-0">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            {name && <p className="text-[13px] font-semibold text-white/70 truncate">{name}</p>}
            <p className="text-[10.5px] text-white/30">{isManager ? 'Manager' : 'Staff'}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-[11px] font-semibold text-white/25 border border-white/[0.08] rounded-lg px-3 py-1.5 hover:text-white/55 hover:border-white/20 hover:bg-white/[0.04]"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Content area (offset by sidebar on desktop) ───────────────────── */}
      <div className={`flex-1 lg:ml-[248px] flex flex-col min-h-dvh overflow-x-hidden ${bgClass}`}>

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
                className="text-[11px] tracking-wider uppercase text-cream/50 border border-cream/20 px-1.5 py-0.5 rounded hover:text-cream hover:border-cream/50 whitespace-nowrap"
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
