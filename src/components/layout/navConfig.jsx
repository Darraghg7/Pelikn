import React from 'react'

/* ── Design tokens ──────────────────────────────────────────────────────────── */
export const T = {
  bg:          '#1c2f2a',
  bgPanel:     '#243a34',
  bgHover:     'rgba(255,255,255,0.05)',
  bgActive:    'rgba(255,255,255,0.10)',
  ink:         'rgba(239,234,222,0.78)',
  inkBright:   '#f3ede0',
  inkMuted:    'rgba(239,234,222,0.50)',
  inkFaint:    'rgba(239,234,222,0.30)',
  divider:     'rgba(255,255,255,0.07)',
  warn:        '#e08a4a',
  warnBg:      'rgba(224,138,74,0.16)',
  accent:      '#c46340',
  alertRed:    '#d44d3a',
  paper:       '#F0EFEB',
  paperWhite:  '#FFFFFF',
  mainInk:     '#0E1411',
  mainInk2:    'rgba(14,20,17,0.62)',
  mainInk3:    'rgba(14,20,17,0.42)',
  mainInk4:    'rgba(14,20,17,0.22)',
  mainLine:    'rgba(14,20,17,0.08)',
  brand:       '#2D4F45',
}

/* ── Rail category icons (18×18, stroke 1.7) ────────────────────────────────── */
export function IcoHome() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
}
export function IcoShieldNav() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  )
}
export function IcoTruckNav() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="1"/>
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
      <circle cx="5.5" cy="18.5" r="2.5"/>
      <circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  )
}
export function IcoUsersNav() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87"/>
      <path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  )
}
export function IcoCogNav() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  )
}

/* ── Panel item icons (15×15, stroke 1.8) ───────────────────────────────────── */
function P(children) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}
const PanelIcons = {
  dashboard:  P(<><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>),
  checks:     P(<><path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h9"/></>),
  tasks:      P(<><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>),
  user:       P(<><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></>),
  therm:      P(<path d="M14 4v10.54a4 4 0 11-4 0V4a2 2 0 014 0z"/>),
  flame:      P(<path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/>),
  snow:       P(<><line x1="12" y1="2" x2="12" y2="22"/><path d="M20 16l-4-4 4-4"/><path d="M4 8l4 4-4 4"/><path d="M16 4l-4 4-4-4"/><path d="M8 20l4-4 4 4"/></>),
  truck:      P(<><rect x="1" y="3" width="15" height="13" rx="1"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></>),
  allergen:   P(<><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></>),
  bug:        P(<><path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3 3 0 016 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 014-4h4a4 4 0 014 4v3c0 3.3-2.7 6-6 6z"/><path d="M12 20v-9"/></>),
  broom:      P(<><path d="M3 21h18M5 21V7l7-4 7 4v14"/><line x1="9" y1="21" x2="9" y2="14"/><line x1="15" y1="21" x2="15" y2="14"/></>),
  alert:      P(<><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>),
  doc:        P(<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></>),
  shield:     P(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>),
  supplier:   P(<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>),
  board:      P(<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>),
  coins:      P(<><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1110.34 18"/><line x1="7" y1="6" x2="7.01" y2="6"/><line x1="13" y1="12" x2="13.01" y2="12"/></>),
  calendar:   P(<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>),
  clock:      P(<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>),
  book:       P(<><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></>),
  timeoff:    P(<><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></>),
  waste:      P(<><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></>),
  wrench:     P(<path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>),
  label:      P(<><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></>),
  staff:      P(<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></>),
  fitness:    P(<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>),
  hr:         P(<><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M16 11h2a2 2 0 012 2v1"/><line x1="17" y1="16" x2="17" y2="19"/><line x1="19" y1="16" x2="15" y2="19"/></>),
}

/* ── Route → { cat, itemId } map ───────────────────────────────────────────── */
const ROUTE_MAP = [
  ['/dashboard',              { cat: 'today',      itemId: 'dashboard' }],
  ['/opening-closing',        { cat: 'today',      itemId: 'openclose' }],
  ['/tasks',                  { cat: 'today',      itemId: 'tasks' }],
  ['/fitness',                { cat: 'today',      itemId: 'fitness' }],
  ['/fridge',                 { cat: 'compliance', itemId: 'fridge' }],
  ['/cooking-temps',          { cat: 'compliance', itemId: 'cook' }],
  ['/hot-holding',            { cat: 'compliance', itemId: 'hothold' }],
  ['/cooling-logs',           { cat: 'compliance', itemId: 'cooling' }],
  ['/deliveries',             { cat: 'compliance', itemId: 'deliveries' }],
  ['/probe',                  { cat: 'compliance', itemId: 'probecal' }],
  ['/allergens',              { cat: 'compliance', itemId: 'allergen' }],
  ['/pest-control',           { cat: 'compliance', itemId: 'pest' }],
  ['/cleaning',               { cat: 'compliance', itemId: 'clean' }],
  ['/corrective',             { cat: 'compliance', itemId: 'corrective' }],
  ['/date-labelling',         { cat: 'compliance', itemId: 'datelabel' }],
  ['/equipment-maintenance',  { cat: 'compliance', itemId: 'equipment' }],
  ['/suppliers',              { cat: 'ops',        itemId: 'supp' }],
  ['/documents',              { cat: 'compliance', itemId: 'docs' }],
  ['/incidents',              { cat: 'compliance', itemId: 'incident' }],
  ['/haccp',                  { cat: 'compliance', itemId: 'haccp' }],
  ['/eho-mock',               { cat: 'compliance', itemId: 'mock' }],
  ['/audit',                  { cat: 'compliance', itemId: 'audit' }],
  ['/noticeboard',            { cat: 'ops',        itemId: 'note' }],
  ['/tips',                   { cat: 'ops',        itemId: 'tip' }],
  ['/rota',                   { cat: 'team',       itemId: 'rota' }],
  ['/timesheet',              { cat: 'team',       itemId: 'hours' }],
  ['/staff',                  { cat: 'team',       itemId: 'staff' }],
  ['/training',               { cat: 'team',       itemId: 'train' }],
  ['/time-off',               { cat: 'team',       itemId: 'off' }],
  ['/clock-in',               { cat: 'team',       itemId: 'clock' }],
  ['/hr',                     { cat: 'team',       itemId: 'hr' }],
  ['/waste',                  { cat: 'compliance', itemId: 'waste' }],
]

export function routeToNav(localPath) {
  for (const [prefix, info] of ROUTE_MAP) {
    if (localPath === prefix || localPath.startsWith(prefix + '/') || localPath.startsWith(prefix + '?')) {
      return info
    }
  }
  return { cat: 'today', itemId: 'dashboard' }
}

/* ── Manager category / item tree ───────────────────────────────────────────── */
export function buildManagerCats({ isEnabled, isPlanLocked, overdueCount, pendingSwaps, vp }) {
  const cats = [
    {
      id: 'today',
      label: 'Today',
      icon: <IcoHome />,
      items: [
        { id: 'dashboard', label: 'Dashboard',       sub: "Today's checks & open issues", icon: PanelIcons.dashboard, route: vp('/dashboard') },
        ...(isEnabled('opening_closing') ? [{ id: 'openclose', label: 'Open / Close', sub: 'Daily routines', icon: PanelIcons.checks, route: vp('/opening-closing') }] : []),
        { id: 'tasks',    label: 'Tasks',            sub: 'All open tasks',               icon: PanelIcons.tasks,    route: vp('/tasks') },
        { id: 'fitness',  label: 'Fitness to Work',  sub: 'Staff readiness checks',       icon: PanelIcons.fitness,  route: vp('/fitness') },
      ],
    },
    {
      id: 'compliance',
      label: 'Compliance',
      icon: <IcoShieldNav />,
      alert: overdueCount || null,
      items: [
        ...(isEnabled('fridge')               ? [{ id: 'fridge',     label: 'Fridge Temps',  sub: 'Daily logs',             icon: PanelIcons.therm,    route: vp('/fridge'),              badge: overdueCount > 0 ? overdueCount : undefined, warn: overdueCount > 0 }] : []),
        ...(isEnabled('cooking_temps')        ? [{ id: 'cook',       label: 'Cooking Temps', sub: 'Core temp readings',      icon: PanelIcons.flame,    route: vp('/cooking-temps') }] : []),
        ...(isEnabled('hot_holding')          ? [{ id: 'hothold',    label: 'Hot Holding',   sub: 'Holding temperature',     icon: PanelIcons.snow,     route: vp('/hot-holding') }] : []),
        ...(isEnabled('cooling_logs')         ? [{ id: 'cooling',    label: 'Cooling Logs',  sub: 'Cook → chill tracking',   icon: PanelIcons.snow,     route: vp('/cooling-logs') }] : []),
        ...(isEnabled('deliveries')           ? [{ id: 'deliveries', label: 'Deliveries',    sub: 'Incoming deliveries',     icon: PanelIcons.truck,    route: vp('/deliveries') }] : []),
        ...(isEnabled('probe')                ? [{ id: 'probecal',   label: 'Probe Cal.',    sub: 'Weekly calibration',      icon: PanelIcons.therm,    route: vp('/probe') }] : []),
        ...(isEnabled('allergens')            ? [{ id: 'allergen',   label: 'Allergens',     sub: 'Tagging & QR menu',       icon: PanelIcons.allergen, route: vp('/allergens') }] : []),
        ...(isEnabled('pest_control')         ? [{ id: 'pest',       label: 'Pest Control',  sub: 'Walks & sightings',       icon: PanelIcons.bug,      route: vp('/pest-control') }] : []),
        ...(isEnabled('cleaning')             ? [{ id: 'clean',      label: 'Cleaning',      sub: 'Daily / weekly / monthly', icon: PanelIcons.broom,   route: vp('/cleaning'),            badge: overdueCount > 0 ? overdueCount : undefined, warn: overdueCount > 0 }] : []),
        ...(isEnabled('corrective')           ? [{ id: 'corrective', label: 'Actions',       sub: 'Corrective actions',      icon: PanelIcons.alert,    route: vp('/corrective') }] : []),
        ...(isEnabled('date_labelling')       ? [{ id: 'datelabel',  label: 'Date Labels',   sub: 'Label printing',          icon: PanelIcons.label,    route: vp('/date-labelling') }] : []),
        ...(isEnabled('equipment_maintenance')? [{ id: 'equipment',  label: 'Equipment',     sub: 'Maintenance logs',        icon: PanelIcons.wrench,   route: vp('/equipment-maintenance') }] : []),
        { id: 'docs',     label: 'Documents',        sub: 'Policies & SOPs',              icon: PanelIcons.doc,     route: vp('/documents') },
        { id: 'incident', label: 'Incidents',         sub: 'Logbook',                      icon: PanelIcons.alert,   route: vp('/incidents') },
        { id: 'haccp',    label: 'HACCP',             sub: 'Plan & flow chart',            icon: PanelIcons.doc,     route: vp('/haccp') },
        { id: 'mock',     label: 'Mock Inspection',   sub: 'Self-audit checklist',         icon: PanelIcons.shield,  route: vp('/eho-mock') },
        { id: 'audit',    label: 'EHO Audit',         sub: 'Readiness score & export',     icon: PanelIcons.shield,  route: vp('/audit') },
      ],
    },
    {
      id: 'ops',
      label: 'Operations',
      icon: <IcoTruckNav />,
      items: [
        { id: 'supp', label: 'Suppliers',   sub: 'Vendors & contacts',   icon: PanelIcons.supplier, route: vp('/suppliers') },
        ...(!isPlanLocked('noticeboard') ? [{ id: 'note', label: 'Noticeboard', sub: 'Team announcements', icon: PanelIcons.board, route: vp('/noticeboard') }] : []),
        ...(!isPlanLocked('tips') && isEnabled('tips') ? [{ id: 'tip', label: 'Tips', sub: 'Pool & distribution', icon: PanelIcons.coins, route: vp('/tips') }] : []),
      ],
    },
    {
      id: 'team',
      label: 'Team',
      icon: <IcoUsersNav />,
      alert: pendingSwaps || null,
      items: [
        ...(!isPlanLocked('rota') && isEnabled('rota')         ? [{ id: 'rota',  label: 'Rota',            sub: 'Weekly schedule',       icon: PanelIcons.calendar, route: vp('/rota'),      badge: pendingSwaps > 0 ? pendingSwaps : undefined }] : []),
        ...(!isPlanLocked('timesheet') && isEnabled('timesheet')? [{ id: 'hours', label: 'Hours',           sub: 'Timesheets & exports',  icon: PanelIcons.clock,    route: vp('/timesheet') }] : []),
        { id: 'staff',  label: 'Staff Members',   sub: 'Team directory',         icon: PanelIcons.staff,    route: vp('/staff') },
        ...(!isPlanLocked('training') && isEnabled('training')  ? [{ id: 'train', label: 'Training',        sub: 'Assigned docs & quizzes', icon: PanelIcons.book,   route: vp('/training') }] : []),
        ...(!isPlanLocked('time_off') && isEnabled('time_off')  ? [{ id: 'off',   label: 'Time Off',        sub: 'Requests & approvals',  icon: PanelIcons.timeoff,  route: vp('/time-off') }] : []),
        { id: 'clock',  label: 'Clock In / Out',  sub: "Today's attendance",     icon: PanelIcons.clock,    route: vp('/clock-in') },
        { id: 'hr',     label: 'HR Records',       sub: 'Staff files & disciplinary', icon: PanelIcons.hr,    route: vp('/hr') },
      ],
    },
  ]

  return cats.filter(c => c.items.length > 0)
}

/* ── Staff category / item tree ─────────────────────────────────────────────── */
export function buildStaffCats({ isEnabled, isPlanLocked, hasPermission, overdueCount, vp }) {
  const cats = [
    {
      id: 'today',
      label: 'Today',
      icon: <IcoHome />,
      items: [
        { id: 'dashboard', label: 'My Shift', sub: "Today's shift overview", icon: PanelIcons.user,     route: vp('/dashboard') },
        { id: 'tasks',     label: 'Tasks',    sub: 'My assigned tasks',      icon: PanelIcons.tasks,    route: vp('/tasks') },
        ...(isEnabled('opening_closing') && hasPermission('manage_opening') ? [{ id: 'openclose', label: 'Checks', sub: 'Open / close routines', icon: PanelIcons.checks, route: vp('/opening-closing') }] : []),
        ...(!isPlanLocked('clock-in') ? [{ id: 'clock', label: 'Clock In / Out', sub: "Today's attendance", icon: PanelIcons.clock, route: vp('/clock-in') }] : []),
      ],
    },
    {
      id: 'compliance',
      label: 'Compliance',
      icon: <IcoShieldNav />,
      items: [
        ...(isEnabled('fridge')     && hasPermission('view_temp_logs')   ? [{ id: 'fridge',     label: 'Temp Logs',  sub: 'Fridge & cooking temps', icon: PanelIcons.therm,    route: vp('/fridge') }] : []),
        ...(isEnabled('cleaning')   && hasPermission('manage_cleaning')  ? [{ id: 'clean',      label: 'Cleaning',   sub: 'Daily tasks',             icon: PanelIcons.broom,    route: vp('/cleaning') }] : []),
        ...(isEnabled('allergens')  && hasPermission('manage_allergens') ? [{ id: 'allergen',   label: 'Allergens',  sub: 'Allergen records',        icon: PanelIcons.allergen, route: vp('/allergens') }] : []),
        ...(isEnabled('deliveries') && hasPermission('log_deliveries')   ? [{ id: 'deliveries', label: 'Deliveries', sub: 'Incoming deliveries',     icon: PanelIcons.truck,    route: vp('/deliveries') }] : []),
        ...(isEnabled('waste')      && hasPermission('log_waste')        ? [{ id: 'waste',      label: 'Waste',      sub: 'Waste tracking',          icon: PanelIcons.waste,    route: vp('/waste') }] : []),
      ],
    },
    {
      id: 'ops',
      label: 'Operations',
      icon: <IcoTruckNav />,
      items: [
        ...(!isPlanLocked('noticeboard') ? [{ id: 'note', label: 'Noticeboard', sub: 'Team announcements', icon: PanelIcons.board, route: vp('/noticeboard') }] : []),
      ],
    },
    {
      id: 'team',
      label: 'Team',
      icon: <IcoUsersNav />,
      items: [
        ...(isEnabled('rota')     ? [{ id: 'rota', label: 'Rota',     sub: 'View your schedule', icon: PanelIcons.calendar, route: vp('/rota') }] : []),
        ...(isEnabled('time_off') ? [{ id: 'off',  label: 'Time Off', sub: 'Request leave',      icon: PanelIcons.timeoff,  route: vp('/time-off') }] : []),
      ],
    },
  ]

  return cats.filter(c => c.items.length > 0)
}
