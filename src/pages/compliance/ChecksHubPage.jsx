import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useAppSettings } from '../../hooks/useSettings'
import { useTodaySummary } from '../../hooks/useTodaySummary'
import { useChecksStatus } from '../../hooks/useChecksStatus'
import { exportEHOReport } from '../../lib/exportData'

const STATUS_TONE = {
  overdue: { statusBg: 'bg-danger/10',  statusText: 'text-danger',  statusFg: 'bg-danger',  rank: 0 },
  due:     { statusBg: 'bg-warning/10', statusText: 'text-warning', statusFg: 'bg-warning', rank: 1 },
  done:    { statusBg: 'bg-success/10', statusText: 'text-success', statusFg: 'bg-success', rank: 3 },
  na:      { statusBg: 'bg-charcoal/6', statusText: 'text-charcoal/50', statusFg: 'bg-charcoal/50', rank: 4 },
}

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

function FitnessIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M20 7h-9M14 17H5M17 17a3 3 0 1 0 6 0 3 3 0 0 0-6 0zM1 7a3 3 0 1 0 6 0 3 3 0 0 0-6 0z"/></svg>
}
function OpenCloseIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>
}
function FridgeIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M5 10h14M9 5v2M9 13v3"/></svg>
}
function CookingIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M8.5 8.5c-1.5-1-1-3 .5-4 0 1.5 1 2 1.5 1 .5 2-1 3-2 3M12 8.5c-1.5-1-1-3 .5-4 0 1.5 1 2 1.5 1M5 13h14l-1.2 7.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8z"/></svg>
}
function HotIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M4 14h16a8 8 0 0 1-16 0zM12 14V8M9 4.5c0 1-1 1.5-1 2.5M15 4.5c0 1-1 1.5-1 2.5"/></svg>
}
function CoolingIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M12 2v20M4 6l16 12M20 6 4 18"/></svg>
}
function DeliveryIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><rect x="1" y="3" width="15" height="13" rx="1"/><polygon points="16 8 20 8 23 11 23 16 16 16"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
}
function ProbeIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>
}
function AllergenIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
}
function PestIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M12 8a4 4 0 0 1 4 4v3a4 4 0 0 1-8 0v-3a4 4 0 0 1 4-4zM12 8V5M9 5 7.5 3.5M15 5l1.5-1.5M8 12H4M20 12h-4M8 16l-3 1.5M16 16l3 1.5"/></svg>
}
function CleaningIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M19.4 5 11 13.4M14 6l4 4M9.5 11.5 4 17v3h3l5.5-5.5"/></svg>
}
function HaccpIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/></svg>
}
function DocsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7"/></svg>
}
function IncidentIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>
}

function StatusPill({ status, text }) {
  const toneMap = {
    overdue: { toneBg: 'bg-danger/10',  toneFg: 'text-danger' },
    due:     { toneBg: 'bg-warning/10', toneFg: 'text-warning' },
    done:    { toneBg: 'bg-success/10', toneFg: 'text-success' },
    na:      { toneBg: 'bg-charcoal/6', toneFg: 'text-charcoal/50' },
  }
  const { toneBg, toneFg } = toneMap[status] ?? toneMap.na
  return (
    <span className={`inline-flex items-center gap-1 px-[7px] py-[2px] rounded-full font-mono text-[10px] font-semibold tracking-[0.04em] uppercase whitespace-nowrap ${toneBg} ${toneFg}`}>
      {status !== 'na' && <span className="w-[5px] h-[5px] rounded-full bg-current shrink-0" />}
      {text}
    </span>
  )
}

function HubCard({ check, statusInfo, onClick, editMode, isHidden, onToggle }) {
  const status = statusInfo?.status ?? 'na'
  const statusText = statusInfo?.statusText ?? '—'
  const count = statusInfo?.count
  const { statusBg, statusText: statusTextClass, statusFg } = STATUS_TONE[status] ?? STATUS_TONE.na
  const Icon = check.icon

  return (
    <button
      onClick={editMode ? onToggle : onClick}
      className={`text-left cursor-pointer w-full bg-white dark:bg-[#1e1e1e] border rounded-xl p-3 flex flex-col gap-2 min-h-[84px] relative transition-opacity ${editMode && isHidden ? 'opacity-40' : 'opacity-100'} ${!editMode && status === 'overdue' ? 'border-danger/30' : 'border-charcoal/10'}`}
    >
      <div className="flex items-start justify-between">
        <span className={`w-[30px] h-[30px] rounded-[9px] flex items-center justify-center shrink-0 ${statusBg} ${statusTextClass}`}>
          <span className="w-[15px] h-[15px] inline-flex"><Icon /></span>
        </span>

        {editMode ? (
          <span className={`w-5 h-5 rounded-full shrink-0 border-2 flex items-center justify-center ${isHidden ? 'border-charcoal/20 bg-transparent' : 'border-success bg-success'}`}>
            {!isHidden && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
          </span>
        ) : count && status !== 'done' && status !== 'na' ? (
          <span className={`min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center font-mono text-[11px] font-semibold text-white ${statusFg}`}>
            {count}
          </span>
        ) : status === 'done' ? (
          <span className={statusTextClass}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </span>
        ) : null}
      </div>

      <div className="mt-auto">
        <div className="text-sm font-semibold tracking-[-0.01em] text-charcoal">{check.label}</div>
        <div className={`font-mono text-[10.5px] mt-0.5 font-semibold tracking-[0.02em] uppercase ${statusTextClass}`}>
          {editMode ? (isHidden ? 'Hidden' : 'Visible') : statusText}
        </div>
      </div>
    </button>
  )
}

export default function ChecksHubPage() {
  const navigate = useNavigate()
  const { venueId, venueSlug, venueName } = useVenue()
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
    <div className="pb-24">

      <div className="mb-[10px]">
        <div className="flex justify-between items-center">
          <span className="font-mono text-[10.5px] text-charcoal/50 tracking-[0.08em] uppercase">Checks</span>
          <button
            onClick={editMode ? handleDone : handleEdit}
            className={`font-mono text-[11.5px] font-semibold tracking-[0.04em] bg-transparent border-none cursor-pointer py-0.5 px-0 ${editMode ? 'text-success' : 'text-charcoal/50'}`}
          >
            {editMode ? 'Done' : 'Edit'}
          </button>
        </div>
        <h1 className="text-[26px] font-semibold tracking-[-0.028em] leading-[1.12] mt-1 mb-0 text-charcoal">
          Today's checks
        </h1>
        {editMode && (
          <div className="mt-[5px] text-xs text-charcoal/50 font-mono">
            Tap a tile to show or hide it
          </div>
        )}
      </div>

      {!editMode && (
        <button
          onClick={() => navigate(vp('/checks/worklist'))}
          className="w-full text-left bg-brand text-white rounded-[14px] px-4 py-3.5 flex items-center gap-3.5 mb-3.5 hover:bg-brand/90 transition-colors border-none cursor-pointer"
        >
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[10px] tracking-[0.1em] uppercase text-white/55 font-semibold">Today</div>
            <div className="text-base font-semibold tracking-[-0.015em] mt-[3px]">
              {isLoading
                ? 'Loading…'
                : total === 0
                  ? 'All checks up to date'
                  : `${total} ${total === 1 ? 'check needs' : 'checks need'} doing`}
            </div>
            {!summaryLoading && !statusLoading && total > 0 && (
              <div className="flex items-center gap-2 mt-[7px]">
                {overdueCount > 0 && (
                  <span className="inline-flex items-center gap-[5px] font-mono text-[11px] font-semibold text-[#ffb4a6]">
                    <span className="w-[5px] h-[5px] rounded-full bg-current" />
                    {overdueCount} overdue
                  </span>
                )}
                {dueCount > 0 && (
                  <span className="inline-flex items-center gap-[5px] font-mono text-[11px] font-semibold text-[#f2c48f]">
                    <span className="w-[5px] h-[5px] rounded-full bg-current" />
                    {dueCount} due now
                  </span>
                )}
              </div>
            )}
          </div>
          <span className="shrink-0 inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.06em] uppercase font-semibold text-white/85">
            View all
            <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 1l4 4-4 4"/>
            </svg>
          </span>
        </button>
      )}

      <div className="grid grid-cols-2 gap-2">
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

      {!editMode && (
        <div className="mt-4 rounded-xl border border-charcoal/10 bg-white dark:bg-[#1e1e1e] overflow-hidden">
          <button
            onClick={() => navigate(vp('/audit'))}
            className="w-full text-left cursor-pointer bg-transparent border-none px-[14px] py-[13px] flex items-center gap-[10px]"
          >
            <span className="w-8 h-8 rounded-[9px] shrink-0 bg-surface text-charcoal/75 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/>
              </svg>
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-charcoal tracking-[-0.01em]">EHO Audit</div>
              <div className="text-[11.5px] text-charcoal/50 mt-[1px]">Compliance summary &amp; export</div>
            </div>
            <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-charcoal/30">
              <path d="M1 1l4 4-4 4"/>
            </svg>
          </button>
          <div className="border-t border-charcoal/6 px-[14px] py-[10px]">
            <button
              onClick={() => exportEHOReport(venueId, venueName, 90)}
              className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold tracking-[0.04em] uppercase text-charcoal/75 bg-surface border-none rounded-[7px] px-2.5 py-1.5 cursor-pointer hover:bg-charcoal/8 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
              </svg>
              Export Report
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
