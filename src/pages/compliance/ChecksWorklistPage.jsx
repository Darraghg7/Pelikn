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

const STATUS_TONE = {
  overdue: { fg: 'text-danger',  bg: 'bg-danger/10',  rank: 0, label: 'Overdue' },
  due:     { fg: 'text-warning', bg: 'bg-warning/10', rank: 1, label: 'Due' },
  done:    { fg: 'text-success', bg: 'bg-success/10', rank: 2, label: 'Done' },
  na:      { fg: 'text-charcoal/30', bg: 'bg-charcoal/6', rank: 3, label: '—' },
}

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

function FitnessIcon()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M20 7h-9M14 17H5M17 17a3 3 0 1 0 6 0 3 3 0 0 0-6 0zM1 7a3 3 0 1 0 6 0 3 3 0 0 0-6 0z"/></svg> }
function OpenCloseIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg> }
function FridgeIcon()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M5 10h14M9 5v2M9 13v3"/></svg> }
function CookingIcon()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M8.5 8.5c-1.5-1-1-3 .5-4 0 1.5 1 2 1.5 1 .5 2-1 3-2 3M12 8.5c-1.5-1-1-3 .5-4 0 1.5 1 2 1.5 1M5 13h14l-1.2 7.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8z"/></svg> }
function HotIcon()       { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M4 14h16a8 8 0 0 1-16 0zM12 14V8M9 4.5c0 1-1 1.5-1 2.5M15 4.5c0 1-1 1.5-1 2.5"/></svg> }
function CoolingIcon()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M12 2v20M4 6l16 12M20 6 4 18"/></svg> }
function DeliveryIcon()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><rect x="1" y="3" width="15" height="13" rx="1"/><polygon points="16 8 20 8 23 11 23 16 16 16"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> }
function ProbeIcon()     { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg> }
function AllergenIcon()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg> }
function PestIcon()      { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M12 8a4 4 0 0 1 4 4v3a4 4 0 0 1-8 0v-3a4 4 0 0 1 4-4zM12 8V5M9 5 7.5 3.5M15 5l1.5-1.5M8 12H4M20 12h-4M8 16l-3 1.5M16 16l3 1.5"/></svg> }
function CleaningIcon()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M19.4 5 11 13.4M14 6l4 4M9.5 11.5 4 17v3h3l5.5-5.5"/></svg> }
function HaccpIcon()     { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/></svg> }
function DocsIcon()      { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7"/></svg> }
function IncidentIcon()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg> }

function BackIcon() {
  return (
    <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 1L1 7l6 6"/>
    </svg>
  )
}

function FilterChip({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-[5px] px-[13px] py-1.5 rounded-full border-[1.5px] text-[13px] font-semibold cursor-pointer whitespace-nowrap transition-all ${active ? 'border-brand bg-brand text-white' : 'border-charcoal/10 bg-white dark:bg-[#1e1e1e] text-charcoal/50'}`}
    >
      {label}
      {count != null && (
        <span className={`min-w-[18px] h-[18px] px-[5px] rounded-full font-mono text-[11px] font-semibold inline-flex items-center justify-center ${active ? 'bg-white/22 text-white' : 'bg-charcoal/6 text-charcoal/50'}`}>
          {count}
        </span>
      )}
    </button>
  )
}

function WorklistRow({ check, statusInfo, onClick }) {
  const status = statusInfo?.status ?? 'na'
  const { fg, bg } = STATUS_TONE[status] ?? STATUS_TONE.na
  const Icon = check.icon

  return (
    <button
      onClick={onClick}
      className="w-full text-left cursor-pointer bg-white dark:bg-[#1e1e1e] border-none border-b border-charcoal/6 px-4 py-[13px] flex items-center gap-[13px] last:border-b-0"
    >
      <span className={`w-9 h-9 rounded-[10px] shrink-0 flex items-center justify-center ${bg} ${fg}`}>
        <span className="w-[18px] h-[18px] inline-flex"><Icon /></span>
      </span>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-charcoal tracking-[-0.01em]">
          {check.label}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="font-mono text-[10px] text-charcoal/30 tracking-[0.04em]">
            {check.area}
          </span>
          <span className="w-0.5 h-0.5 rounded-full bg-charcoal/30" />
          <span className="font-mono text-[10px] text-charcoal/30 tracking-[0.04em]">
            {check.cadence}
          </span>
        </div>
      </div>

      <div className="text-right shrink-0">
        {status === 'done' ? (
          <span className={`${fg} inline-flex`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </span>
        ) : status !== 'na' ? (
          <span className={`inline-flex items-center gap-1 font-mono text-[10px] font-semibold tracking-[0.04em] uppercase ${fg}`}>
            <span className="w-[5px] h-[5px] rounded-full bg-current" />
            {statusInfo?.statusText ?? STATUS_TONE[status].label}
          </span>
        ) : (
          <span className="font-mono text-[10px] text-charcoal/30">—</span>
        )}
      </div>

      <span className="text-charcoal/30 inline-flex">
        <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 1l4 4-4 4"/>
        </svg>
      </span>
    </button>
  )
}

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
    <div className="min-h-dvh bg-surface pb-24">

      <div className="pt-4 pb-3">
        <button
          onClick={() => navigate(vp('/checks'))}
          className="inline-flex items-center gap-1.5 font-mono text-[11.5px] font-semibold text-charcoal/50 tracking-[0.04em] bg-transparent border-none cursor-pointer p-0 mb-[10px]"
        >
          <BackIcon />
          Checks
        </button>
        <h1 className="text-2xl font-semibold tracking-[-0.025em] text-charcoal m-0 mb-0.5">
          All checks
        </h1>
        {!isLoading && (
          <p className="font-mono text-[11px] text-charcoal/50 m-0">
            {counts.Overdue > 0 && `${counts.Overdue} overdue · `}
            {counts.Due > 0 && `${counts.Due} due · `}
            {counts.Done} done
          </p>
        )}
      </div>

      <div className="flex gap-2 px-4 pb-[14px] overflow-x-auto [scrollbar-width:none]">
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

      <div className="bg-white dark:bg-[#1e1e1e] rounded-[14px] border border-charcoal/10 mx-4 overflow-hidden">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`h-16 border-b border-charcoal/6 ${i % 2 === 0 ? 'bg-white dark:bg-[#1e1e1e]' : 'bg-surface'}`} />
          ))
        ) : filtered.length === 0 ? (
          <div className="py-10 px-6 text-center">
            <p className="text-sm text-charcoal/50">No {filter.toLowerCase()} checks</p>
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

    </div>
  )
}
