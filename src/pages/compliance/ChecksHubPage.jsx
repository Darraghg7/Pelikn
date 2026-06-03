import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
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
  paper:  '#ffffff', surf:   '#f3f3ef',
}

const STATUS_TONE = {
  overdue: { fg: MC.bad,  bg: MC.badBg,  rank: 0 },
  due:     { fg: MC.warn, bg: MC.warnBg, rank: 1 },
  done:    { fg: MC.good, bg: MC.goodBg, rank: 3 },
  na:      { fg: MC.ink3, bg: MC.line2,  rank: 4 },
}

// ── Category definitions ───────────────────────────────────────────────────
const CHECKS = [
  { id: 'fitness',   label: 'Fitness to Work', icon: FitnessIcon,   route: '/fitness' },
  { id: 'openclose', label: 'Opening Checks',  icon: OpenCloseIcon, route: '/opening-closing' },
  { id: 'fridge',    label: 'Fridge Temps',    icon: FridgeIcon,    route: '/fridge' },
  { id: 'cooking',   label: 'Cooking Temps',   icon: CookingIcon,   route: '/cooking-temps' },
  { id: 'hot',       label: 'Hot Holding',     icon: HotIcon,       route: '/hot-holding' },
  { id: 'cooling',   label: 'Cooling Logs',    icon: CoolingIcon,   route: '/cooling-logs' },
  { id: 'delivery',  label: 'Deliveries',      icon: DeliveryIcon,  route: '/deliveries' },
  { id: 'probe',     label: 'Probe Cal.',      icon: ProbeIcon,     route: '/probe' },
  { id: 'allergen',  label: 'Allergens',       icon: AllergenIcon,  route: '/allergens' },
  { id: 'pest',      label: 'Pest Control',    icon: PestIcon,      route: '/pest-control' },
  { id: 'cleaning',  label: 'Cleaning',        icon: CleaningIcon,  route: '/cleaning' },
  { id: 'haccp',     label: 'HACCP',           icon: HaccpIcon,     route: '/haccp' },
  { id: 'docs',      label: 'Documents',       icon: DocsIcon,      route: '/documents' },
  { id: 'incident',  label: 'Incidents',       icon: IncidentIcon,  route: '/incidents' },
]

// ── Icons (stroke, currentColor) ──────────────────────────────────────────
function FitnessIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}><path d="M20 7h-9M14 17H5M17 17a3 3 0 1 0 6 0 3 3 0 0 0-6 0zM1 7a3 3 0 1 0 6 0 3 3 0 0 0-6 0z"/></svg>
}
function OpenCloseIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>
}
function FridgeIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M5 10h14M9 5v2M9 13v3"/></svg>
}
function CookingIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}><path d="M8.5 8.5c-1.5-1-1-3 .5-4 0 1.5 1 2 1.5 1 .5 2-1 3-2 3M12 8.5c-1.5-1-1-3 .5-4 0 1.5 1 2 1.5 1M5 13h14l-1.2 7.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8z"/></svg>
}
function HotIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}><path d="M4 14h16a8 8 0 0 1-16 0zM12 14V8M9 4.5c0 1-1 1.5-1 2.5M15 4.5c0 1-1 1.5-1 2.5"/></svg>
}
function CoolingIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}><path d="M12 2v20M4 6l16 12M20 6 4 18"/></svg>
}
function DeliveryIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}><rect x="1" y="3" width="15" height="13" rx="1"/><polygon points="16 8 20 8 23 11 23 16 16 16"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
}
function ProbeIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>
}
function AllergenIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
}
function PestIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}><path d="M12 8a4 4 0 0 1 4 4v3a4 4 0 0 1-8 0v-3a4 4 0 0 1 4-4zM12 8V5M9 5 7.5 3.5M15 5l1.5-1.5M8 12H4M20 12h-4M8 16l-3 1.5M16 16l3 1.5"/></svg>
}
function CleaningIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}><path d="M19.4 5 11 13.4M14 6l4 4M9.5 11.5 4 17v3h3l5.5-5.5"/></svg>
}
function HaccpIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/></svg>
}
function DocsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7"/></svg>
}
function IncidentIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '100%', height: '100%' }}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>
}

// ── StatusPill ─────────────────────────────────────────────────────────────
function StatusPill({ status, text }) {
  const t = STATUS_TONE[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 7px', borderRadius: 999,
      background: t.bg, color: t.fg,
      fontFamily: 'ui-monospace, SFMono-Regular, monospace',
      fontSize: 10, fontWeight: 600,
      letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>
      {status !== 'na' && <span style={{ width: 5, height: 5, borderRadius: 3, background: 'currentColor', flexShrink: 0 }} />}
      {text}
    </span>
  )
}

// ── HubCard ────────────────────────────────────────────────────────────────
function HubCard({ check, statusInfo, onClick, editMode, isHidden, onToggle }) {
  const status = statusInfo?.status ?? 'na'
  const statusText = statusInfo?.statusText ?? '—'
  const count = statusInfo?.count
  const t = STATUS_TONE[status]
  const Icon = check.icon

  return (
    <button
      onClick={editMode ? onToggle : onClick}
      style={{
        textAlign: 'left', cursor: 'pointer', width: '100%',
        background: MC.paper,
        border: `1px solid ${!editMode && status === 'overdue' ? t.fg + '55' : MC.line}`,
        borderRadius: 12, padding: '12px',
        display: 'flex', flexDirection: 'column', gap: 8,
        minHeight: 84, position: 'relative',
        opacity: editMode && isHidden ? 0.38 : 1,
        transition: 'opacity 0.15s ease',
      }}
    >
      {/* Top row: icon + badge/check/edit-checkbox */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 9,
          background: t.bg, color: t.fg,
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <span style={{ width: 15, height: 15, display: 'inline-flex' }}>
            <Icon />
          </span>
        </span>

        {editMode ? (
          <span style={{
            width: 20, height: 20, borderRadius: 10, flexShrink: 0,
            border: `2px solid ${isHidden ? MC.line : MC.good}`,
            background: isHidden ? 'transparent' : MC.good,
            display: 'grid', placeItems: 'center',
          }}>
            {!isHidden && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
          </span>
        ) : count && status !== 'done' && status !== 'na' ? (
          <span style={{
            minWidth: 20, height: 20, padding: '0 6px', borderRadius: 10,
            background: t.fg, color: '#fff',
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            fontSize: 11, fontWeight: 600, display: 'grid', placeItems: 'center',
          }}>{count}</span>
        ) : status === 'done' ? (
          <span style={{ color: t.fg, display: 'inline-flex' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </span>
        ) : null}
      </div>

      {/* Bottom: label + status text */}
      <div style={{ marginTop: 'auto' }}>
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', color: MC.ink }}>
          {check.label}
        </div>
        <div style={{
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          fontSize: 10.5, marginTop: 3,
          color: t.fg, fontWeight: 600,
          letterSpacing: '0.02em', textTransform: 'uppercase',
        }}>
          {editMode ? (isHidden ? 'Hidden' : 'Visible') : statusText}
        </div>
      </div>
    </button>
  )
}

// ── ChecksHubPage ──────────────────────────────────────────────────────────
export default function ChecksHubPage() {
  const navigate = useNavigate()
  const { venueId, venueSlug } = useVenue()
  const { session } = useSession()
  const { actionSchedules, closedDays, hiddenCheckTiles, saveHiddenCheckTiles } = useAppSettings()

  const [editMode, setEditMode] = useState(false)
  const [localHidden, setLocalHidden] = useState([])

  const { summary, loading: summaryLoading } = useTodaySummary(venueId, closedDays, actionSchedules)
  const { statuses, loading: statusLoading } = useChecksStatus(venueId, summary, summaryLoading)

  const vp = (path) => `/v/${venueSlug}${path}`
  const isLoading = summaryLoading || statusLoading

  function handleEdit() {
    setLocalHidden(hiddenCheckTiles ?? [])
    setEditMode(true)
  }

  function handleDone() {
    saveHiddenCheckTiles(localHidden)
    setEditMode(false)
  }

  function toggleTile(id) {
    setLocalHidden(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  // In edit mode: show all tiles in natural order. Normal mode: filter hidden, sort by status.
  const ordered = editMode
    ? CHECKS.map(c => ({ ...c, statusInfo: statuses[c.id] ?? { status: 'na', statusText: isLoading ? '…' : '—' } }))
    : CHECKS
        .filter(c => !(hiddenCheckTiles ?? []).includes(c.id))
        .map(c => ({ ...c, statusInfo: statuses[c.id] ?? { status: 'na', statusText: isLoading ? '…' : '—' } }))
        .sort((a, b) => (STATUS_TONE[a.statusInfo.status]?.rank ?? 4) - (STATUS_TONE[b.statusInfo.status]?.rank ?? 4))

  const overdueCount = ordered.filter(c => c.statusInfo.status === 'overdue')
    .reduce((n, c) => n + (c.statusInfo.count ?? 1), 0)
  const dueCount = ordered.filter(c => c.statusInfo.status === 'due')
    .reduce((n, c) => n + (c.statusInfo.count ?? 1), 0)
  const total = overdueCount + dueCount

  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const dayStr  = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <div style={{ padding: '16px 0 96px' }}>

      {/* Page header */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            fontSize: 10.5, color: MC.ink3, letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>Checks</span>
          <button
            onClick={editMode ? handleDone : handleEdit}
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              fontSize: 11.5, fontWeight: 600, letterSpacing: '0.04em',
              color: editMode ? MC.good : MC.ink3,
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0',
            }}
          >
            {editMode ? 'Done' : 'Edit'}
          </button>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.028em', lineHeight: 1.12, margin: '4px 0 0', color: MC.ink }}>
          Today's checks
        </h1>
        {editMode && (
          <div style={{
            marginTop: 5, fontSize: 12, color: MC.ink3,
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          }}>
            Tap a tile to show or hide it
          </div>
        )}
      </div>

      {/* Today forest summary card — hidden in edit mode */}
      {!editMode && (
        <button
          onClick={() => navigate(vp('/checks/worklist'))}
          style={{
            width: '100%', textAlign: 'left', cursor: 'pointer',
            background: MC.brand, color: '#fff',
            border: 'none', borderRadius: 14, padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.55)', fontWeight: 600,
            }}>Today</div>
            <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.015em', marginTop: 3 }}>
              {isLoading
                ? 'Loading…'
                : total === 0
                  ? 'All checks up to date'
                  : `${total} ${total === 1 ? 'check needs' : 'checks need'} doing`}
            </div>
            {!summaryLoading && !statusLoading && total > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
                {overdueCount > 0 && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                    fontSize: 11, fontWeight: 600, color: '#ffb4a6',
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: 3, background: 'currentColor' }} />
                    {overdueCount} overdue
                  </span>
                )}
                {dueCount > 0 && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                    fontSize: 11, fontWeight: 600, color: '#f2c48f',
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: 3, background: 'currentColor' }} />
                    {dueCount} due now
                  </span>
                )}
              </div>
            )}
          </div>
          <span style={{
            flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6,
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
            fontWeight: 600, color: 'rgba(255,255,255,0.85)',
          }}>
            View all
            <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 1l4 4-4 4"/>
            </svg>
          </span>
        </button>
      )}

      {/* 2-col category grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {ordered.map(c => (
          <HubCard
            key={c.id}
            check={c}
            statusInfo={c.statusInfo}
            onClick={() => navigate(vp(c.route))}
            editMode={editMode}
            isHidden={localHidden.includes(c.id)}
            onToggle={() => toggleTile(c.id)}
          />
        ))}
      </div>
    </div>
  )
}
