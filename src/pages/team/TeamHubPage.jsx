import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { useTeamStatus } from '../../hooks/useTeamStatus'
import { useAppSettings } from '../../hooks/useSettings'
import useManagerCalendar from '../../hooks/useManagerCalendar'

const STATUS_TONE = {
  overdue: { statusBg: 'bg-danger/10',  statusText: 'text-danger',  statusFg: 'bg-danger',  rank: 0 },
  due:     { statusBg: 'bg-warning/10', statusText: 'text-warning', statusFg: 'bg-warning', rank: 1 },
  draft:   { statusBg: 'bg-[#faeee9]',  statusText: 'text-[#c94f2a]', statusFg: 'bg-[#c94f2a]', rank: 2 },
  done:    { statusBg: 'bg-success/10', statusText: 'text-success', statusFg: 'bg-success', rank: 3 },
  na:      { statusBg: 'bg-charcoal/6', statusText: 'text-charcoal/50', statusFg: 'bg-charcoal/50', rank: 4 },
}

function CalIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
}
function RotaIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/><path d="M8 14h2M14 14h2M8 17.5h2"/></svg>
}
function ClockIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
}
function GradCapIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
}
function LeafIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M21 3 9 15M15 3H21V9"/><path d="M18 13C18 17.4183 14.4183 21 10 21C5.58172 21 2 17.4183 2 13C2 8.58172 5.58172 5 10 5"/></svg>
}
function UsersIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}
function CalendarIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>
}

function AvatarChip({ name, status, index }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('')
  return (
    <span
      title={name}
      className="w-[30px] h-[30px] rounded-lg shrink-0 flex items-center justify-center font-mono text-[10.5px] font-semibold text-white border-[1.5px] border-brand bg-white/16 relative"
      style={{ marginLeft: index === 0 ? 0 : -6, zIndex: 6 - index }}
    >
      {initials}
      {status === 'late' && (
        <span className="absolute bottom-[-2px] right-[-2px] w-[9px] h-[9px] rounded-full bg-[#ff6b52] border-[1.5px] border-brand" />
      )}
      {status === 'break' && (
        <span className="absolute bottom-[-2px] right-[-2px] w-[9px] h-[9px] rounded-full bg-[#f2c48f] border-[1.5px] border-brand" />
      )}
    </span>
  )
}

function AttendanceHero({ onShift, lateCount, loading, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left cursor-pointer bg-brand text-white border-none rounded-[14px] px-4 py-3.5 flex items-center gap-3.5"
    >
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[10px] tracking-[0.1em] uppercase text-white/55 font-semibold">On shift now</div>
        <div className="text-base font-semibold tracking-[-0.015em] mt-[3px]">
          {loading
            ? 'Loading…'
            : onShift.length === 0
              ? 'No staff clocked in yet'
              : `${onShift.length} clocked in`}
        </div>
        {!loading && lateCount > 0 && (
          <div className="flex items-center gap-2 mt-[7px]">
            <span className="inline-flex items-center gap-[5px] font-mono text-[11px] font-semibold text-[#ffb4a6]">
              <span className="w-[5px] h-[5px] rounded-full bg-current" />
              {lateCount} late
            </span>
          </div>
        )}
      </div>
      <span className="shrink-0 inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.06em] uppercase font-semibold text-white/85">
        Attendance
        <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 1l4 4-4 4"/>
        </svg>
      </span>
    </button>
  )
}

function TeamCard({ label, icon: Icon, status, statusText, count, onClick, editMode, isHidden, onToggle }) {
  const { statusBg, statusText: statusTextClass, statusFg } = STATUS_TONE[status] ?? STATUS_TONE.na
  return (
    <button
      onClick={editMode ? onToggle : onClick}
      className={`text-left cursor-pointer w-full bg-white dark:bg-[#1e1e1e] border rounded-xl p-3 flex flex-col gap-2 min-h-[84px] transition-opacity ${editMode && isHidden ? 'opacity-40' : 'opacity-100'} ${!editMode && status === 'overdue' ? 'border-danger/30' : 'border-charcoal/10'}`}
    >
      <div className="flex items-start justify-between">
        <span className={`w-[30px] h-[30px] rounded-[9px] flex items-center justify-center ${statusBg} ${statusTextClass}`}>
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
          <span className={`${statusTextClass} inline-flex`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </span>
        ) : null}
      </div>

      <div className="mt-auto">
        <div className="text-sm font-semibold tracking-[-0.01em] text-charcoal">{label}</div>
        <div className={`font-mono text-[10.5px] mt-0.5 font-semibold tracking-[0.02em] uppercase ${editMode ? (isHidden ? 'text-charcoal/30' : 'text-success') : statusTextClass}`}>
          {editMode ? (isHidden ? 'Hidden' : 'Visible') : statusText}
        </div>
      </div>
    </button>
  )
}

export default function TeamHubPage() {
  const navigate = useNavigate()
  const { venueId, venueSlug } = useVenue()
  const vp = (path) => `/v/${venueSlug}${path}`

  const { data, loading } = useTeamStatus(venueId)
  const { hiddenTeamTiles, saveHiddenTeamTiles } = useAppSettings()
  const { upcomingCount } = useManagerCalendar()

  const [editMode, setEditMode] = useState(false)
  const [localHidden, setLocalHidden] = useState([])

  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const dayStr  = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

  function handleEdit() {
    setLocalHidden(hiddenTeamTiles ?? [])
    setEditMode(true)
  }

  function handleDone() {
    saveHiddenTeamTiles(localHidden)
    setEditMode(false)
  }

  function toggleTile(id) {
    setLocalHidden(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const ALL_CARDS = [
    {
      id: 'team-rota', label: 'Rota', icon: RotaIcon, route: '/rota',
      ...(data?.rotaPublished
        ? { status: 'done', statusText: 'Published' }
        : {
            status: 'draft',
            statusText: data?.rotaUnfilled > 0
              ? `Draft · ${data.rotaUnfilled} to fill`
              : 'Draft · ready to publish',
            count: data?.rotaUnfilled || undefined,
          }),
    },
    {
      id: 'rota', label: 'My Shifts', icon: CalIcon, route: '/rota?personal=1',
      ...(data?.pendingSwaps > 0
        ? { status: 'due', statusText: `${data.pendingSwaps} swap${data.pendingSwaps > 1 ? 's' : ''} pending`, count: data.pendingSwaps }
        : { status: 'done', statusText: 'No swaps pending' }),
    },
    {
      id: 'timesheet', label: 'Hours', icon: ClockIcon, route: '/timesheet',
      status: 'na', statusText: 'View timesheets',
    },
    {
      id: 'training', label: 'Training', icon: GradCapIcon, route: '/training',
      ...(data?.expiringTraining > 0
        ? { status: 'due', statusText: `${data.expiringTraining} expiring`, count: data.expiringTraining }
        : { status: 'done', statusText: 'All up to date' }),
    },
    {
      id: 'time-off', label: 'Time Off', icon: LeafIcon, route: '/time-off',
      ...(data?.pendingTimeOff > 0
        ? { status: 'due', statusText: `${data.pendingTimeOff} pending`, count: data.pendingTimeOff }
        : { status: 'done', statusText: 'No requests' }),
    },
    {
      id: 'staff', label: 'Staff Members', icon: UsersIcon, route: '/staff',
      status: 'na',
      statusText: loading ? '…' : `${data?.totalStaff ?? 0} active`,
    },
    {
      id: 'calendar', label: 'My Calendar', icon: CalendarIcon, route: '/calendar',
      ...(upcomingCount > 0
        ? { status: 'due', statusText: `${upcomingCount} upcoming`, count: upcomingCount }
        : { status: 'na', statusText: 'No upcoming events' }),
    },
  ]

  const ordered = editMode
    ? ALL_CARDS
    : ALL_CARDS
        .filter(c => !(hiddenTeamTiles ?? []).includes(c.id))
        .sort((a, b) => (STATUS_TONE[a.status]?.rank ?? 4) - (STATUS_TONE[b.status]?.rank ?? 4))

  return (
    <div className="pb-24">

      <div className="mb-[10px]">
        <div className="flex justify-between items-center">
          <span className="font-mono text-[10.5px] text-charcoal/50 tracking-[0.08em] uppercase">
            Team
          </span>
          <button
            onClick={editMode ? handleDone : handleEdit}
            className={`font-mono text-[11.5px] font-semibold tracking-[0.04em] bg-transparent border-none cursor-pointer py-0.5 px-0 ${editMode ? 'text-success' : 'text-charcoal/50'}`}
          >
            {editMode ? 'Done' : 'Edit'}
          </button>
        </div>
        <h1 className="text-[26px] font-semibold tracking-[-0.028em] leading-[1.12] mt-1 mb-0 text-charcoal">
          Your team
        </h1>
        {editMode && (
          <div className="mt-[5px] text-xs text-charcoal/50 font-mono">
            Tap a tile to show or hide it
          </div>
        )}
      </div>

      {!editMode && (
        <div className="mb-3.5">
          <AttendanceHero
            onShift={data?.onShift ?? []}
            lateCount={data?.lateCount ?? 0}
            loading={loading}
            onClick={() => navigate(vp('/timesheet'))}
          />
        </div>
      )}

      {loading && !editMode ? (
        <div className="grid grid-cols-2 gap-2">
          {[0,1,2,3,4].map(i => (
            <div key={i} className="h-[104px] rounded-[14px] bg-charcoal/6" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {ordered.map(c => (
            <TeamCard
              key={c.id}
              label={c.label}
              icon={c.icon}
              status={c.status}
              statusText={c.statusText}
              count={c.count}
              onClick={() => navigate(vp(c.route))}
              editMode={editMode}
              isHidden={localHidden.includes(c.id)}
              onToggle={() => toggleTile(c.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
