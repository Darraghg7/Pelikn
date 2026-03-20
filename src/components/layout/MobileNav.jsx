import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useSession } from '../../contexts/SessionContext'
import { useVenue } from '../../contexts/VenueContext'

/* ── SVG Icon components ─────────────────────────────────────────────────── */
function HomeIcon({ active }) {
  return (
    <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
      {active
        ? <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 01-.53 1.28h-1.44v7.44a.75.75 0 01-.75.75h-4.5a.75.75 0 01-.75-.75v-4.5h-2.25v4.5a.75.75 0 01-.75.75h-4.5a.75.75 0 01-.75-.75v-7.44H3.31a.75.75 0 01-.53-1.28l8.69-8.69z" />
        : <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955a1.126 1.126 0 0 1 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      }
    </svg>
  )
}

function ClipboardIcon({ active }) {
  return (
    <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
      {active
        ? <path fillRule="evenodd" d="M10.5 3A1.501 1.501 0 009 4.5h6A1.5 1.5 0 0013.5 3h-3zm-2.693.178A3 3 0 0110.5 1.5h3a3 3 0 012.694 1.678c.497.042.992.092 1.486.15C18.89 3.482 19.9 4.438 19.9 5.635v13.23c0 1.197-1.01 2.153-2.22 2.307a36.37 36.37 0 01-11.36 0c-1.21-.154-2.22-1.11-2.22-2.307V5.635c0-1.197 1.01-2.153 2.22-2.307.494-.058.989-.108 1.486-.15zM15.75 9a.75.75 0 00-1.5 0v.75h-.75a.75.75 0 000 1.5h.75v.75a.75.75 0 001.5 0v-.75h.75a.75.75 0 000-1.5h-.75V9zm-7.5 3.75a.75.75 0 01.75-.75h3a.75.75 0 010 1.5h-3a.75.75 0 01-.75-.75zM9 15a.75.75 0 000 1.5h3a.75.75 0 000-1.5H9z" clipRule="evenodd" />
        : <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
      }
    </svg>
  )
}

function UsersIcon({ active }) {
  return (
    <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
      {active
        ? <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 117.5 0 3.75 3.75 0 01-7.5 0zM15.75 9.75a3 3 0 116 0 3 3 0 01-6 0zM2.25 9.75a3 3 0 116 0 3 3 0 01-6 0zM6.31 15.117A6.745 6.745 0 0112 12a6.745 6.745 0 016.709 7.498.75.75 0 01-.372.568A12.696 12.696 0 0112 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 01-.372-.568 6.787 6.787 0 011.019-4.38z" clipRule="evenodd" />
        : <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
      }
    </svg>
  )
}

function ShieldIcon({ active }) {
  return (
    <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
      {active
        ? <path fillRule="evenodd" d="M12.516 2.17a.75.75 0 00-1.032 0 11.209 11.209 0 01-7.877 3.08.75.75 0 00-.722.515A12.74 12.74 0 002.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 00.374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 00-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08zm3.094 8.016a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
        : <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      }
    </svg>
  )
}

function CogIcon({ active }) {
  return (
    <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
      {active
        ? <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.923-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clipRule="evenodd" />
        : <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.431.992a7.723 7.723 0 0 1 0 .255c-.007.378.138.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.248a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
      }
    </svg>
  )
}

function CalendarIcon({ active }) {
  return (
    <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
      {active
        ? <path d="M12.75 12.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM7.5 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zm0 2.25a.75.75 0 100-1.5.75.75 0 000 1.5zm3-2.25a.75.75 0 100-1.5.75.75 0 000 1.5zm0 2.25a.75.75 0 100-1.5.75.75 0 000 1.5zm3-2.25a.75.75 0 100-1.5.75.75 0 000 1.5zm0 2.25a.75.75 0 100-1.5.75.75 0 000 1.5zm3-2.25a.75.75 0 100-1.5.75.75 0 000 1.5zM6 18.75A2.25 2.25 0 018.25 21h7.5A2.25 2.25 0 0018 18.75V6A2.25 2.25 0 0015.75 3.75h-7.5A2.25 2.25 0 006 6v12.75zM6.75 6a.75.75 0 01.75-.75h9a.75.75 0 01.75.75v1.5a.75.75 0 01-.75.75h-9a.75.75 0 01-.75-.75V6z" />
        : <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      }
    </svg>
  )
}

function ClockIcon({ active }) {
  return (
    <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
      {active
        ? <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" />
        : <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      }
    </svg>
  )
}

function TasksIcon({ active }) {
  return (
    <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
      {active
        ? <path fillRule="evenodd" d="M7.502 6h7.128A3.375 3.375 0 0118 9.375v9.375a3 3 0 003-3V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" clipRule="evenodd" />
        : <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0 1 18 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
      }
    </svg>
  )
}

/* ── Sub-navigation pills ──────────────────────────────────────────────── */
function SubNav({ items, currentPath }) {
  return (
    <nav className="sm:hidden flex gap-2 px-4 py-2.5 overflow-x-auto scrollbar-hide bg-white dark:bg-[#1a1a1a] border-b border-charcoal/8" aria-label="Section navigation">
      {items.map(item => {
        const isActive = currentPath === item.to || currentPath.startsWith(item.to + '/')
        return (
          <NavLink
            key={item.to}
            to={item.to}
            aria-current={isActive ? 'page' : undefined}
            className={[
              'px-3 py-1.5 rounded-full text-[11px] font-semibold tracking-wide whitespace-nowrap transition-all shrink-0',
              isActive
                ? 'bg-charcoal text-cream dark:bg-cream dark:text-charcoal'
                : 'bg-charcoal/6 text-charcoal/50 hover:bg-charcoal/10 hover:text-charcoal/70',
            ].join(' ')}
          >
            {item.label}
          </NavLink>
        )
      })}
    </nav>
  )
}

/* ── Tab configurations (accept vp helper to prefix paths) ────────────── */
function getManagerTabs(vp) {
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
      label: 'Compliance',
      to: vp('/opening-closing'),
      icon: ClipboardIcon,
      match: ['/opening-closing', '/fridge', '/deliveries', '/probe', '/allergens', '/cleaning', '/corrective'],
      children: [
        { to: vp('/opening-closing'), label: 'Checks' },
        { to: vp('/fridge'),          label: 'Temp Logs' },
        { to: vp('/deliveries'),      label: 'Deliveries' },
        { to: vp('/probe'),           label: 'Probe Cal.' },
        { to: vp('/allergens'),       label: 'Allergens' },
        { to: vp('/cleaning'),        label: 'Cleaning' },
        { to: vp('/corrective'),      label: 'Actions' },
      ],
    },
    {
      key: 'team',
      label: 'Team',
      to: vp('/rota'),
      icon: UsersIcon,
      match: ['/rota', '/timesheet', '/training', '/time-off'],
      children: [
        { to: vp('/rota'),       label: 'Rota' },
        { to: vp('/timesheet'),  label: 'Hours' },
        { to: vp('/training'),   label: 'Training' },
        { to: vp('/time-off'),   label: 'Time Off' },
      ],
    },
    {
      key: 'audit',
      label: 'Audit',
      to: vp('/audit'),
      icon: ShieldIcon,
      match: ['/audit'],
    },
    {
      key: 'settings',
      label: 'Settings',
      to: vp('/settings'),
      icon: CogIcon,
      match: ['/settings'],
    },
  ]
}

function getStaffTabs(session, vp) {
  const taskChildren = [
    { to: vp('/opening-closing'), label: 'Checks' },
    { to: vp('/cleaning'),        label: 'Cleaning' },
    ...(session?.showTempLogs  ? [{ to: vp('/fridge'),    label: 'Temp Logs' }] : []),
    { to: vp('/allergens'), label: 'Allergens' },
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
      to: vp('/opening-closing'),
      icon: TasksIcon,
      match: ['/opening-closing', '/cleaning', '/fridge', '/allergens'],
      children: taskChildren.length > 1 ? taskChildren : undefined,
    },
    {
      key: 'rota',
      label: 'Rota',
      to: vp('/rota'),
      icon: CalendarIcon,
      match: ['/rota'],
    },
    {
      key: 'timeoff',
      label: 'Time Off',
      to: vp('/time-off'),
      icon: ClockIcon,
      match: ['/time-off'],
    },
  ]
}

/* ── MobileNav component ───────────────────────────────────────────────── */
export default function MobileNav() {
  const { session, isManager } = useSession()
  const { venueSlug } = useVenue()
  const { pathname } = useLocation()

  /** Prefix a local path with the venue base */
  const vp = (p) => `/v/${venueSlug}${p}`

  /** Strip venue prefix from current pathname for matching */
  const base = `/v/${venueSlug}`
  const localPath = pathname.startsWith(base)
    ? (pathname.slice(base.length) || '/')
    : pathname

  const tabs = isManager ? getManagerTabs(vp) : getStaffTabs(session, vp)

  // Find active tab — match array uses local paths (without venue prefix)
  const activeTab = tabs.find(t => t.match.some(m => localPath === m || (m !== '/dashboard' && localPath.startsWith(m))))
  const showSubNav = activeTab?.children && activeTab.children.length > 1

  return (
    <>
      {/* Sub-navigation pills at top of content area */}
      {showSubNav && <SubNav items={activeTab.children} currentPath={pathname} />}

      {/* Bottom tab bar */}
      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#1a1a1a] border-t border-charcoal/8"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Main navigation"
        role="tablist"
      >
        <div className="flex items-stretch justify-around h-14 max-w-lg mx-auto">
          {tabs.map(tab => {
            const isActive = tab.match.some(m => localPath === m || (m !== '/dashboard' && localPath.startsWith(m)))
            const Icon = tab.icon
            return (
              <NavLink
                key={tab.key}
                to={tab.to}
                role="tab"
                aria-selected={isActive}
                aria-label={tab.label}
                className={[
                  'flex flex-col items-center justify-center flex-1 gap-0.5 transition-colors relative',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
                  isActive ? 'text-accent' : 'text-charcoal/35 active:text-charcoal/50',
                ].join(' ')}
              >
                <Icon active={isActive} />
                <span className={[
                  'text-[10px] leading-none font-semibold tracking-wide',
                  isActive ? 'text-accent' : '',
                ].join(' ')}>
                  {tab.label}
                </span>
              </NavLink>
            )
          })}
        </div>
      </nav>
    </>
  )
}

export { SubNav }
