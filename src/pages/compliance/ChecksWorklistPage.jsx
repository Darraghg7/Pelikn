/**
 * ChecksWorklistPage — Pattern C (cross-category worklist).
 * Reached via "View all" on ChecksHubPage.
 * Shows every action-needed check sorted Overdue → Due → Done,
 * filterable by chip. One tap → category page.
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { useAppSettings } from '../../hooks/useSettings'
import { useTodaySummary } from '../../hooks/useTodaySummary'
import { useChecksStatus } from '../../hooks/useChecksStatus'

// ── Design tokens ──────────────────────────────────────────────────────────
const MC = {
  brand:  '#13362a',
  bad:    '#b3331c', badBg:  '#fbeae6',
  warn:   '#a85d12', warnBg: '#fbeedc',
  good:   '#1a7a4c', goodBg: '#e3f0e7',
  ink:    '#0d1a14', ink2:   '#3d4a44', ink3:   '#76817b', ink4:   '#b3b9b5',
  line:   '#e4e6e2', line2:  '#eef0ec',
  paper:  '#ffffff', bg:     '#f3f3ef',
}

const STATUS_TONE = {
  overdue: { fg: MC.bad,  bg: MC.badBg,  rank: 0, label: 'Overdue' },
  due:     { fg: MC.warn, bg: MC.warnBg, rank: 1, label: 'Due' },
  done:    { fg: MC.good, bg: MC.goodBg, rank: 2, label: 'Done' },
  na:      { fg: MC.ink4, bg: MC.line2,  rank: 3, label: '—' },
}

const MONO = 'ui-monospace, SFMono-Regular, monospace'

// ── All check categories (mirrors ChecksHubPage) ───────────────────────────
const CHECKS = [
  { id: 'fitness',   label: 'Fitness to Work', area: 'Opening',      cadence: 'Daily',    icon: FitnessIcon,   route: '/fitness' },
  { id: 'openclose', label: 'Opening Checks',  area: 'Opening',      cadence: 'Daily',    icon: OpenCloseIcon, route: '/opening-closing' },
  { id: 'fridge',    label: 'Fridge Temps',    area: 'Temperature',  cadence: 'Daily',    icon: FridgeIcon,    route: '/fridge' },
  { id: 'cooking',   label: 'Cooking Temps',   area: 'Temperature',  cadence: 'Daily',    icon: CookingIcon,   route: '/cooking-temps' },
  { id: 'hot',       label: 'Hot Holding',     area: 'Temperature',  cadence: 'Daily',    icon: HotIcon,       route: '/hot-holding' },
  { id: 'cooling',   label: 'Cooling Logs',    area: 'Temperature',  cadence: 'As needed',icon: CoolingIcon,   route: '/cooling-logs' },
  { id: 'delivery',  label: 'Deliveries',      area: 'Food Safety',  cadence: 'As needed',icon: DeliveryIcon,  route: '/deliveries' },
  { id: 'probe',     label: 'Probe Cal.',      area: 'Food Safety',  cadence: 'Monthly',  icon: ProbeIcon,     route: '/probe' },
  { id: 'allergen',  label: 'Allergens',       area: 'Food Safety',  cadence: 'Ongoing',  icon: AllergenIcon,  route: '/allergens' },
  { id: 'pest',      label: 'Pest Control',    area: 'Food Safety',  cadence: 'Quarterly',icon: PestIcon,      route: '/pest-control' },
  { id: 'cleaning',  label: 'Cleaning',        area: 'Cleaning',     cadence: 'Schedule', icon: CleaningIcon,  route: '/cleaning' },
  { id: 'haccp',     label: 'HACCP',           area: 'Records',      cadence: 'Ongoing',  icon: HaccpIcon,     route: '/haccp' },
  { id: 'docs',      label: 'Documents',       area: 'Records',      cadence: 'Ongoing',  icon: DocsIcon,      route: '/documents' },
  { id: 'incident',  label: 'Incidents',       area: 'Records',      cadence: 'As needed',icon: IncidentIcon,  route: '/incidents' },
]

// ── Icons ──────────────────────────────────────────────────────────────────
function FitnessIcon()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width:'100%',height:'100%' }}><path d="M20 7h-9M14 17H5M17 17a3 3 0 1 0 6 0 3 3 0 0 0-6 0zM1 7a3 3 0 1 0 6 0 3 3 0 0 0-6 0z"/></svg> }
function OpenCloseIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width:'100%',height:'100%' }}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg> }
function FridgeIcon()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width:'100%',height:'100%' }}><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M5 10h14M9 5v2M9 13v3"/></svg> }
function CookingIcon()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width:'100%',height:'100%' }}><path d="M8.5 8.5c-1.5-1-1-3 .5-4 0 1.5 1 2 1.5 1 .5 2-1 3-2 3M12 8.5c-1.5-1-1-3 .5-4 0 1.5 1 2 1.5 1M5 13h14l-1.2 7.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8z"/></svg> }
function HotIcon()       { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width:'100%',height:'100%' }}><path d="M4 14h16a8 8 0 0 1-16 0zM12 14V8M9 4.5c0 1-1 1.5-1 2.5M15 4.5c0 1-1 1.5-1 2.5"/></svg> }
function CoolingIcon()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width:'100%',height:'100%' }}><path d="M12 2v20M4 6l16 12M20 6 4 18"/></svg> }
function DeliveryIcon()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width:'100%',height:'100%' }}><rect x="1" y="3" width="15" height="13" rx="1"/><polygon points="16 8 20 8 23 11 23 16 16 16"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> }
function ProbeIcon()     { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width:'100%',height:'100%' }}><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg> }
function AllergenIcon()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width:'100%',height:'100%' }}><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg> }
function PestIcon()      { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width:'100%',height:'100%' }}><path d="M12 8a4 4 0 0 1 4 4v3a4 4 0 0 1-8 0v-3a4 4 0 0 1 4-4zM12 8V5M9 5 7.5 3.5M15 5l1.5-1.5M8 12H4M20 12h-4M8 16l-3 1.5M16 16l3 1.5"/></svg> }
function CleaningIcon()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width:'100%',height:'100%' }}><path d="M19.4 5 11 13.4M14 6l4 4M9.5 11.5 4 17v3h3l5.5-5.5"/></svg> }
function HaccpIcon()     { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width:'100%',height:'100%' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/></svg> }
function DocsIcon()      { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width:'100%',height:'100%' }}><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7"/></svg> }
function IncidentIcon()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width:'100%',height:'100%' }}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg> }

// ── Back icon ──────────────────────────────────────────────────────────────
function BackIcon() {
  return (
    <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 1L1 7l6 6"/>
    </svg>
  )
}

// ── Filter chip ────────────────────────────────────────────────────────────
function FilterChip({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '6px 13px',
        borderRadius: 999,
        border: `1.5px solid ${active ? MC.brand : MC.line}`,
        background: active ? MC.brand : MC.paper,
        color: active ? '#fff' : MC.ink3,
        fontSize: 13, fontWeight: 600,
        cursor: 'pointer', whiteSpace: 'nowrap',
        transition: 'all 0.15s',
      }}
    >
      {label}
      {count != null && (
        <span style={{
          minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999,
          background: active ? 'rgba(255,255,255,0.22)' : MC.line2,
          color: active ? '#fff' : MC.ink3,
          fontFamily: MONO, fontSize: 11, fontWeight: 600,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {count}
        </span>
      )}
    </button>
  )
}

// ── Worklist row ───────────────────────────────────────────────────────────
function WorklistRow({ check, statusInfo, onClick }) {
  const status = statusInfo?.status ?? 'na'
  const t = STATUS_TONE[status]
  const Icon = check.icon

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer',
        background: MC.paper, border: 'none',
        borderBottom: `1px solid ${MC.line2}`,
        padding: '13px 16px',
        display: 'flex', alignItems: 'center', gap: 13,
      }}
    >
      {/* Icon badge */}
      <span style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: t.bg, color: t.fg,
        display: 'grid', placeItems: 'center',
      }}>
        <span style={{ width: 18, height: 18, display: 'inline-flex' }}>
          <Icon />
        </span>
      </span>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: MC.ink, letterSpacing: '-0.01em' }}>
          {check.label}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, color: MC.ink4, letterSpacing: '0.04em' }}>
            {check.area}
          </span>
          <span style={{ width: 2, height: 2, borderRadius: 1, background: MC.ink4 }} />
          <span style={{ fontFamily: MONO, fontSize: 10, color: MC.ink4, letterSpacing: '0.04em' }}>
            {check.cadence}
          </span>
        </div>
      </div>

      {/* Status */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {status === 'done' ? (
          <span style={{ color: t.fg, display: 'inline-flex' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </span>
        ) : status !== 'na' ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontFamily: MONO, fontSize: 10, fontWeight: 600,
            color: t.fg, letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: 3, background: 'currentColor' }} />
            {statusInfo?.statusText ?? t.label}
          </span>
        ) : (
          <span style={{ fontFamily: MONO, fontSize: 10, color: MC.ink4 }}>—</span>
        )}
      </div>

      {/* Chevron */}
      <span style={{ color: MC.ink4, display: 'inline-flex' }}>
        <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 1l4 4-4 4"/>
        </svg>
      </span>
    </button>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────
const FILTERS = ['All', 'Overdue', 'Due', 'Done']

export default function ChecksWorklistPage() {
  const navigate = useNavigate()
  const { venueId, venueSlug } = useVenue()
  const { actionSchedules, closedDays, hiddenCheckTiles } = useAppSettings()
  const { summary, loading: summaryLoading } = useTodaySummary(venueId, closedDays, actionSchedules)
  const { statuses, loading: statusLoading } = useChecksStatus(venueId, summary, summaryLoading)

  const [filter, setFilter] = useState('All')
  const vp = (path) => `/v/${venueSlug}${path}`
  const isLoading = summaryLoading || statusLoading

  // Build full list (all checks, including hidden — worklist shows everything)
  const allItems = CHECKS.map(c => ({
    ...c,
    statusInfo: statuses[c.id] ?? { status: 'na', statusText: isLoading ? '…' : '—' },
  })).sort((a, b) => {
    const ra = STATUS_TONE[a.statusInfo.status]?.rank ?? 3
    const rb = STATUS_TONE[b.statusInfo.status]?.rank ?? 3
    return ra - rb
  })

  const filtered = filter === 'All'
    ? allItems
    : allItems.filter(c => c.statusInfo.status === filter.toLowerCase())

  const counts = {
    Overdue: allItems.filter(c => c.statusInfo.status === 'overdue').length,
    Due:     allItems.filter(c => c.statusInfo.status === 'due').length,
    Done:    allItems.filter(c => c.statusInfo.status === 'done').length,
  }

  return (
    <div style={{ minHeight: '100dvh', background: MC.bg }}>

      {/* Header */}
      <div style={{ padding: '16px 0 12px' }}>
        <button
          onClick={() => navigate(vp('/checks'))}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontFamily: MONO, fontSize: 11.5, fontWeight: 600,
            color: MC.ink3, letterSpacing: '0.04em',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            marginBottom: 10,
          }}
        >
          <BackIcon />
          Checks
        </button>
        <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.025em', color: MC.ink, margin: '0 0 2px' }}>
          All checks
        </h1>
        {!isLoading && (
          <p style={{ fontFamily: MONO, fontSize: 11, color: MC.ink3, margin: 0 }}>
            {counts.Overdue > 0 && `${counts.Overdue} overdue · `}
            {counts.Due > 0 && `${counts.Due} due · `}
            {counts.Done} done
          </p>
        )}
      </div>

      {/* Filter chips */}
      <div style={{
        display: 'flex', gap: 8, padding: '0 16px 14px',
        overflowX: 'auto', scrollbarWidth: 'none',
      }}>
        {FILTERS.map(f => (
          <FilterChip
            key={f}
            label={f}
            count={f !== 'All' ? counts[f] : null}
            active={filter === f}
            onClick={() => setFilter(f)}
          />
        ))}
      </div>

      {/* List */}
      <div style={{
        background: MC.paper,
        borderRadius: 14,
        border: `1px solid ${MC.line}`,
        margin: '0 16px',
        overflow: 'hidden',
      }}>
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{
              height: 64, borderBottom: `1px solid ${MC.line2}`,
              background: i % 2 === 0 ? MC.paper : MC.bg,
            }} />
          ))
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: MC.ink3 }}>No {filter.toLowerCase()} checks</p>
          </div>
        ) : (
          filtered.map(c => (
            <WorklistRow
              key={c.id}
              check={c}
              statusInfo={c.statusInfo}
              onClick={() => navigate(vp(c.route))}
            />
          ))
        )}
      </div>

      <div style={{ height: 96 }} />
    </div>
  )
}
