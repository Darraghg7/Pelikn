import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation } from 'react-router-dom'
import { useSession } from '../../contexts/SessionContext'
import { useVenue } from '../../contexts/VenueContext'
import { useVenueFeatures } from '../../hooks/useVenueFeatures'
import { useAppSettings } from '../../hooks/useSettings'
import { preloadRoute } from '../../lib/routePreload'

/* ── SVG Icon components — thin outline, Revolut/Linear style ─────────────
   Active state: slightly bolder stroke + brand colour (via parent text-brand)
   Inactive state: thin stroke + muted colour (via parent text-charcoal/35)
   ───────────────────────────────────────────────────────────────────────── */
function Ico({ active, children }) {
  return (
    <svg
      className="w-[22px] h-[22px]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={active ? 2 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

function HomeIcon({ active }) {
  return (
    <Ico active={active}>
      <path d="m2.25 12 8.954-8.955a1.126 1.126 0 0 1 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </Ico>
  )
}

function ClipboardIcon({ active }) {
  return (
    <Ico active={active}>
      <path d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
    </Ico>
  )
}

function UsersIcon({ active }) {
  return (
    <Ico active={active}>
      <path d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
    </Ico>
  )
}

function ShieldIcon({ active }) {
  return (
    <Ico active={active}>
      <path d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </Ico>
  )
}

function CogIcon({ active }) {
  return (
    <Ico active={active}>
      <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.431.992a7.723 7.723 0 0 1 0 .255c-.007.378.138.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.248a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </Ico>
  )
}

function CalendarIcon({ active }) {
  return (
    <Ico active={active}>
      <path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </Ico>
  )
}

function ClockIcon({ active }) {
  return (
    <Ico active={active}>
      <path d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </Ico>
  )
}

function TasksIcon({ active }) {
  return (
    <Ico active={active}>
      <path d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0 1 18 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
    </Ico>
  )
}

/* ── Nav order persistence ─────────────────────────────────────────────── */
const REORDERABLE_KEYS = ['compliance', 'team', 'tasks']

function useNavOrder(venueId) {
  const key = `pk-nav-order-${venueId}`
  const [order, setOrder] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key)) ?? null } catch { return null }
  })
  const save = useCallback((newOrder) => {
    setOrder(newOrder)
    localStorage.setItem(key, JSON.stringify(newOrder))
  }, [key])
  return [order, save]
}

function applyOrder(tabs, savedOrder) {
  if (!savedOrder?.length) return tabs
  const fixed = { home: tabs.find(t => t.key === 'home'), settings: tabs.find(t => t.key === 'settings') }
  const middle = tabs.filter(t => REORDERABLE_KEYS.includes(t.key))
  const sorted = savedOrder
    .map(k => middle.find(t => t.key === k))
    .filter(Boolean)
  // include any new middle tabs not yet in saved order
  middle.forEach(t => { if (!sorted.find(s => s.key === t.key)) sorted.push(t) })
  return [fixed.home, ...sorted, fixed.settings].filter(Boolean)
}

/* ── Nav reorder sheet ─────────────────────────────────────────────────── */
function NavReorderSheet({ items, onSave, onClose }) {
  const [list, setList] = useState(items)
  const dragState = useRef(null) // { index, startY, lastIndex }
  const rowRefs = useRef([])

  const onPointerDown = useCallback((e, index) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragState.current = { index, startY: e.clientY, lastIndex: index }
  }, [])

  const onPointerMove = useCallback((e) => {
    const ds = dragState.current
    if (!ds) return
    const rows = rowRefs.current
    let newIndex = ds.index
    for (let i = 0; i < rows.length; i++) {
      if (!rows[i]) continue
      const { top, height } = rows[i].getBoundingClientRect()
      if (e.clientY < top + height / 2) { newIndex = i; break }
      newIndex = i
    }
    if (newIndex !== ds.index) {
      setList(prev => {
        const next = [...prev]
        const [removed] = next.splice(ds.index, 1)
        next.splice(newIndex, 0, removed)
        return next
      })
      dragState.current = { ...ds, index: newIndex }
    }
  }, [])

  const onPointerUp = useCallback(() => {
    dragState.current = null
  }, [])

  return (
    <div className="fixed inset-0 z-[200] flex items-end" style={{ touchAction: 'none' }}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl w-full shadow-2xl" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 20px)' }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-charcoal/8">
          <div>
            <p className="font-semibold text-charcoal text-base">Reorder tabs</p>
            <p className="text-[12px] text-charcoal/45 mt-0.5">Drag to rearrange your nav</p>
          </div>
          <button onClick={onClose} className="text-charcoal/40 hover:text-charcoal p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="px-4 py-2" onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          {list.map((item, index) => {
            const isDragging = dragState.current?.index === index
            return (
              <div
                key={item.key}
                ref={el => { rowRefs.current[index] = el }}
                className={[
                  'flex items-center gap-4 px-3 py-4 rounded-2xl my-1 select-none transition-colors',
                  isDragging ? 'bg-charcoal/6 shadow-lg scale-[1.02]' : 'bg-transparent active:bg-charcoal/4',
                ].join(' ')}
                style={{ transform: isDragging ? 'scale(1.02)' : undefined, touchAction: 'none' }}
              >
                <div
                  className="touch-none cursor-grab active:cursor-grabbing p-1 text-charcoal/30 hover:text-charcoal/60"
                  onPointerDown={e => onPointerDown(e, index)}
                  style={{ touchAction: 'none' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
                    <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                    <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
                  </svg>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-charcoal/6 flex items-center justify-center text-charcoal/50">
                    <item.icon active={false} />
                  </span>
                  <span className="text-sm font-semibold text-charcoal">{item.label}</span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="px-5 pt-2 pb-1">
          <button
            onClick={() => { onSave(list.map(t => t.key)); onClose() }}
            className="w-full bg-charcoal text-cream font-semibold text-sm rounded-2xl py-3.5 hover:bg-charcoal/90 transition-colors"
          >
            Save order
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Sub-navigation pills ──────────────────────────────────────────────── */
function SubNav({ items, currentPath }) {
  const scrollRef = useRef(null)
  const activeRef = useRef(null)

  useEffect(() => {
    const active = activeRef.current
    const container = scrollRef.current
    if (!active || !container) return
    const { offsetLeft, offsetWidth } = active
    const { scrollLeft, offsetWidth: containerWidth } = container
    const itemRight = offsetLeft + offsetWidth
    if (offsetLeft < scrollLeft || itemRight > scrollLeft + containerWidth) {
      container.scrollTo({ left: offsetLeft - 16, behavior: 'instant' })
    }
  }, [currentPath])

  return (
    <nav ref={scrollRef} className="lg:hidden relative flex gap-2 px-4 py-2.5 overflow-x-auto scrollbar-hide bg-white dark:bg-[#1a1a1a] border-b border-charcoal/8" aria-label="Section navigation" style={{ maskImage: 'linear-gradient(90deg, black 90%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, black 90%, transparent)' }}>
      {items.map(item => {
        const isActive = currentPath === item.to || currentPath.startsWith(item.to + '/')
        return (
          <NavLink
            key={item.to}
            to={item.to}
            ref={isActive ? activeRef : null}
            preventScrollReset
            onPointerEnter={() => preloadRoute(item.to)}
            onTouchStart={() => preloadRoute(item.to)}
            onFocus={() => preloadRoute(item.to)}
            aria-current={isActive ? 'page' : undefined}
            className={[
              'px-3.5 py-2 rounded-full text-[12px] font-semibold tracking-wide whitespace-nowrap transition-all shrink-0',
              isActive
                ? 'bg-brand text-cream shadow-sm shadow-brand/20 dark:bg-cream dark:text-charcoal'
                : 'text-charcoal/55 hover:text-charcoal/80',
            ].join(' ')}
          >
            {item.label}
          </NavLink>
        )
      })}
    </nav>
  )
}

/* ── Tab configurations ─────────────────────────────────────────────────── */
function getManagerTabs(vp, isEnabled, complianceNavOrder = []) {
  const complianceChildren = [
    { key: 'opening-closing', to: vp('/opening-closing'), label: 'Checks',       feature: 'opening_closing' },
    { key: 'fitness',         to: vp('/fitness'),         label: 'Fitness',       feature: null },
    { key: 'fridge',          to: vp('/fridge'),          label: 'Fridge Temps',  feature: 'fridge' },
    { key: 'cooking-temps',   to: vp('/cooking-temps'),   label: 'Cooking Temps', feature: null },
    { key: 'hot-holding',     to: vp('/hot-holding'),     label: 'Hot Holding',   feature: null },
    { key: 'cooling-logs',    to: vp('/cooling-logs'),    label: 'Cooling Logs',  feature: null },
    { key: 'deliveries',      to: vp('/deliveries'),      label: 'Deliveries',    feature: 'deliveries' },
    { key: 'probe',           to: vp('/probe'),           label: 'Probe Cal.',    feature: 'probe' },
    { key: 'allergens',       to: vp('/allergens'),       label: 'Allergens',     feature: 'allergens' },
    { key: 'cleaning',        to: vp('/cleaning'),        label: 'Cleaning',      feature: 'cleaning' },
    { key: 'corrective',      to: vp('/corrective'),      label: 'Actions',       feature: 'corrective' },
    { key: 'documents',       to: vp('/documents'),       label: 'Documents',     feature: null },
    { key: 'incidents',       to: vp('/incidents'),       label: 'Incidents',     feature: null },
  ]
    .filter(c => c.feature === null || isEnabled(c.feature))
    .sort((a, b) => {
      if (!complianceNavOrder.length) return 0
      const ai = complianceNavOrder.indexOf(a.key)
      const bi = complianceNavOrder.indexOf(b.key)
      if (ai === -1 && bi === -1) return 0
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })

  const teamChildren = [
    { to: vp('/rota'),      label: 'Rota',     feature: 'rota' },
    { to: vp('/timesheet'), label: 'Hours',    feature: 'timesheet' },
    { to: vp('/training'),  label: 'Training', feature: 'training' },
    { to: vp('/time-off'),  label: 'Time Off', feature: 'time_off' },
    { to: vp('/tips'),      label: 'Tips',     feature: 'tips' },
  ].filter(c => isEnabled(c.feature))

  return [
    {
      key: 'home',
      label: 'Home',
      to: vp('/dashboard'),
      icon: HomeIcon,
      match: ['/dashboard'],
    },
    {
      key: 'compliance',
      label: 'Checks',
      to: vp('/checks'),
      icon: ClipboardIcon,
      match: ['/checks', '/opening-closing', '/fitness', '/fridge', '/cooking-temps', '/hot-holding', '/cooling-logs', '/deliveries', '/probe', '/allergens', '/cleaning', '/corrective', '/documents', '/incidents', '/pest-control'],
      children: complianceChildren,
    },
    {
      key: 'team',
      label: 'Team',
      to: vp('/team'),
      icon: UsersIcon,
      match: ['/team', '/rota', '/timesheet', '/training', '/time-off', '/tips', '/staff'],
      children: teamChildren,
    },
    {
      key: 'tasks',
      label: 'Tasks',
      to: vp('/tasks'),
      icon: TasksIcon,
      match: ['/tasks'],
    },
    {
      key: 'settings',
      label: 'Settings',
      to: vp('/settings/hub'),
      icon: CogIcon,
      match: ['/settings', '/audit'],
      children: [
        { to: vp('/settings'), label: 'Settings' },
        { to: vp('/audit'),    label: 'EHO Audit' },
      ],
    },
  ]
}

function getStaffTabs(session, vp, isEnabled) {
  const taskChildren = [
    ...(isEnabled('opening_closing') ? [{ to: vp('/opening-closing'), label: 'Checks' }] : []),
    ...(isEnabled('cleaning')        ? [{ to: vp('/cleaning'),        label: 'Cleaning' }] : []),
    ...(isEnabled('fridge') && session?.showTempLogs ? [
      { to: vp('/fridge'),        label: 'Fridge Temps' },
      { to: vp('/cooking-temps'), label: 'Cooking Temps' },
      { to: vp('/hot-holding'),   label: 'Hot Holding' },
      { to: vp('/cooling-logs'),  label: 'Cooling Logs' },
    ] : []),
    ...(isEnabled('allergens')       ? [{ to: vp('/allergens'),       label: 'Allergens' }] : []),
  ]

  return [
    {
      key: 'shift',
      label: 'My Shift',
      to: vp('/dashboard'),
      icon: HomeIcon,
      match: ['/dashboard'],
    },
    {
      key: 'tasks',
      label: 'Tasks',
      to: vp('/tasks'),
      icon: TasksIcon,
      match: ['/tasks'],
    },
    ...(isEnabled('rota') ? [{
      key: 'rota',
      label: 'Rota',
      to: vp('/rota'),
      icon: CalendarIcon,
      match: ['/rota'],
    }] : []),
    ...(isEnabled('time_off') ? [{
      key: 'timeoff',
      label: 'Time Off',
      to: vp('/time-off'),
      icon: ClockIcon,
      match: ['/time-off'],
    }] : []),
  ]
}

/* ── MobileNav component ───────────────────────────────────────────────── */
export default function MobileNav() {
  const { session, isManager } = useSession()
  const { venueSlug, venueId } = useVenue()
  const { pathname } = useLocation()
  const { isEnabled } = useVenueFeatures()
  const { complianceNavOrder } = useAppSettings()
  const [savedOrder, saveOrder] = useNavOrder(venueId)
  const [showReorder, setShowReorder] = useState(false)
  const longPressTimer = useRef(null)

  const vp = (p) => `/v/${venueSlug}${p}`

  const base = `/v/${venueSlug}`
  const localPath = pathname.startsWith(base)
    ? (pathname.slice(base.length) || '/')
    : pathname

  const rawTabs = isManager ? getManagerTabs(vp, isEnabled, complianceNavOrder) : getStaffTabs(session, vp, isEnabled)
  const tabs = isManager ? applyOrder(rawTabs, savedOrder) : rawTabs

  const activeTab = tabs.find(t => t.match.some(m => localPath === m || (m !== '/dashboard' && localPath.startsWith(m))))
  const HUB_PATHS = ['/checks', '/team']
  const showSubNav = activeTab?.children && activeTab.children.length > 1 && !HUB_PATHS.includes(localPath)

  const startLongPress = useCallback(() => {
    if (!isManager) return
    longPressTimer.current = setTimeout(() => setShowReorder(true), 500)
  }, [isManager])

  const cancelLongPress = useCallback(() => {
    clearTimeout(longPressTimer.current)
  }, [])

  const reorderableTabs = tabs.filter(t => REORDERABLE_KEYS.includes(t.key))

  return (
    <>
      {showSubNav && <SubNav items={activeTab.children} currentPath={pathname} />}

      {createPortal(
        <>
          <nav
            className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#1a1a1a] border-t border-charcoal/8 shadow-[0_-4px_20px_rgba(0,0,0,0.04)]"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            aria-label="Main navigation"
            role="tablist"
          >
            <div className="flex items-center justify-around h-14 max-w-lg mx-auto px-1">
              {tabs.map(tab => {
                const isActive = tab.match.some(m => localPath === m || (m !== '/dashboard' && localPath.startsWith(m)))
                const Icon = tab.icon
                return (
                  <NavLink
                    key={tab.key}
                    to={tab.to}
                    preventScrollReset
                    onPointerDown={startLongPress}
                    onPointerUp={cancelLongPress}
                    onPointerCancel={cancelLongPress}
                    onPointerLeave={cancelLongPress}
                    onPointerEnter={() => preloadRoute(tab.to)}
                    onTouchStart={() => preloadRoute(tab.to)}
                    onFocus={() => preloadRoute(tab.to)}
                    role="tab"
                    aria-selected={isActive}
                    aria-label={tab.label}
                    className={[
                      'flex flex-col items-center justify-center flex-1 gap-0.5 transition-colors relative focus-visible:outline-none',
                      isActive ? 'text-brand dark:text-accent' : 'text-charcoal/40 active:text-charcoal/60',
                    ].join(' ')}
                  >
                    <span className={[
                      'flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all',
                      isActive ? 'bg-navpill dark:bg-brand/30' : '',
                    ].join(' ')}>
                      <Icon active={isActive} />
                      <span className={['text-[10px] leading-none tracking-wide', isActive ? 'font-semibold' : 'font-medium'].join(' ')}>
                        {tab.label}
                      </span>
                    </span>
                  </NavLink>
                )
              })}
            </div>
          </nav>

          {showReorder && (
            <NavReorderSheet
              items={reorderableTabs}
              onSave={saveOrder}
              onClose={() => setShowReorder(false)}
            />
          )}
        </>,
        document.body
      )}
    </>
  )
}

export { SubNav }
