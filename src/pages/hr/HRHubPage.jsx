/**
 * HRHubPage.jsx — Workspace layout (sticky list left + employee record right).
 * Default layout per design handoff: two-pane master-detail, no page navigation on
 * staff selection. EmployeeRecordPage handles direct /hr/:id URL access.
 */
import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { addDays } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmployeeRecordPanel, { Avatar, nameInitials } from './EmployeeRecordPanel'

// ── Stat tile ─────────────────────────────────────────────────────────────────
function StatTile({ label, value, sub, tone, icon }) {
  const accentClass =
    tone === 'bad'  ? 'bg-danger'  :
    tone === 'warn' ? 'bg-warning' :
    tone === 'good' ? 'bg-success' : ''

  const valueClass =
    tone === 'bad'  ? 'text-danger'  :
    tone === 'warn' ? 'text-warning' :
    tone === 'good' ? 'text-success' : 'text-charcoal'

  const iconClass =
    tone === 'bad'  ? 'text-danger'  :
    tone === 'warn' ? 'text-warning' :
    tone === 'good' ? 'text-success' : 'text-charcoal/30'

  return (
    <div className="bg-white dark:bg-paperDark border border-charcoal/10 rounded-2xl px-[17px] py-[15px] flex flex-col gap-0.5 relative overflow-hidden shadow-sm">
      {tone && (
        <span className={`absolute left-0 top-[14px] bottom-[14px] w-[3px] rounded-r-full ${accentClass}`} />
      )}
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-charcoal/50 font-semibold">
          {label}
        </span>
        <span className={`ml-auto inline-flex ${iconClass}`}>
          {icon}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`font-mono text-[28px] font-medium tracking-[-0.03em] leading-none tabular-nums ${valueClass}`}>
          {value}
        </span>
        <span className="text-xs text-charcoal/50">{sub}</span>
      </div>
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const ICO = {
  users:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/></svg>,
  alert:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  clock:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  gavel:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 13l-7.5 7.5a2.12 2.12 0 01-3-3L11 10"/><path d="M9 8l6 6"/><path d="M14.5 5.5l4 4"/><path d="M11 3l10 10"/></svg>,
  search: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  plus:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
}

// ── Workspace list row ────────────────────────────────────────────────────────
function ListRow({ s, selected, actionIds, expiringIds, onClick }) {
  const [hovered, setHovered] = useState(false)
  const isSel  = selected?.id === s.id
  const dotCol = actionIds.has(s.id)   ? 'bg-danger'  :
                 expiringIds.has(s.id) ? 'bg-warning' : null

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`flex items-center gap-[11px] w-full text-left cursor-pointer px-[13px] py-2.5 rounded-xl border border-transparent transition-colors duration-[120ms] ${
        isSel ? 'bg-brand/8' : hovered ? 'bg-charcoal/6' : 'bg-transparent'
      }`}
    >
      <Avatar name={s.name} size={36} />
      <div className="flex-1 min-w-0">
        <div className={`text-[13.5px] text-charcoal overflow-hidden text-ellipsis whitespace-nowrap ${isSel ? 'font-bold' : 'font-medium'}`}>
          {s.name}
        </div>
        <div className="font-mono text-[11px] text-charcoal/50 uppercase tracking-[0.03em] mt-px overflow-hidden text-ellipsis whitespace-nowrap">
          {s.job_role ?? 'No role'}
        </div>
      </div>
      {dotCol && (
        <span className={`w-2 h-2 rounded-full shrink-0 ${dotCol}`} />
      )}
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function HRHubPage() {
  const navigate              = useNavigate()
  const { venueId, venueSlug } = useVenue()
  const vp = p => `/v/${venueSlug}${p}`

  const [staff,   setStaff]   = useState([])
  const [actions, setActions] = useState([])
  const [docs,    setDocs]    = useState([])
  const [loading, setLoading] = useState(true)

  const [query,    setQuery]    = useState('')
  const [selected, setSelected] = useState(null)
  const [tab,      setTab]      = useState('Profile')

  useEffect(() => {
    if (!venueId) return
    const since90 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
    const in30    = addDays(new Date(), 30).toISOString().slice(0, 10)

    Promise.all([
      supabase.from('staff')
        .select('id, name, job_role, employment_type, start_date')
        .eq('venue_id', venueId)
        .eq('is_active', true)
        .order('name'),
      supabase.from('hr_formal_actions')
        .select('staff_id')
        .eq('venue_id', venueId)
        .gte('occurred_at', since90),
      supabase.from('staff_hr_documents')
        .select('staff_id, expiry_date')
        .eq('venue_id', venueId)
        .not('expiry_date', 'is', null)
        .lte('expiry_date', in30),
    ]).then(([staffRes, actRes, docsRes]) => {
      const staffData = staffRes.data ?? []
      const actData   = actRes.data   ?? []
      const docsData  = docsRes.data  ?? []

      setStaff(staffData)
      setActions(actData)
      setDocs(docsData)
      setLoading(false)

      const actionIds   = new Set(actData.map(a => a.staff_id))
      const expiringIds = new Set(docsData.map(d => d.staff_id))
      const firstFlagged = staffData.find(s => actionIds.has(s.id) || expiringIds.has(s.id))
      setSelected(firstFlagged || staffData[0] || null)
    })
  }, [venueId])

  const actionIds   = useMemo(() => new Set(actions.map(a => a.staff_id)), [actions])
  const expiringIds = useMemo(() => new Set(docs.map(d => d.staff_id)),    [docs])

  const flaggedCount = useMemo(
    () => staff.filter(s => actionIds.has(s.id) || expiringIds.has(s.id)).length,
    [staff, actionIds, expiringIds],
  )
  const docsExpiringCount = useMemo(
    () => new Set(docs.filter(d => {
      const ms = new Date(d.expiry_date).getTime() - Date.now()
      return ms >= 0
    }).map(d => d.staff_id)).size,
    [docs],
  )

  const q = query.toLowerCase()
  const filtered = useMemo(() => staff.filter(s =>
    !q || s.name.toLowerCase().includes(q) || (s.job_role ?? '').toLowerCase().includes(q),
  ), [staff, q])

  const attentionRows = filtered.filter(s => actionIds.has(s.id) || expiringIds.has(s.id))
  const regularRows   = filtered.filter(s => !(actionIds.has(s.id) || expiringIds.has(s.id)))

  const openStaff = (s) => { setSelected(s); setTab('Profile') }

  const stats = [
    { label: 'Active staff',    value: staff.length,       sub: 'on the books',   tone: null,                                    icon: ICO.users  },
    { label: 'Needs attention', value: flaggedCount,        sub: 'staff',          tone: 'bad',                                   icon: ICO.alert  },
    { label: 'Docs expiring',   value: docsExpiringCount,   sub: 'within 30 days', tone: 'warn',                                  icon: ICO.clock  },
    { label: 'Formal actions',  value: actionIds.size,      sub: 'last 90 days',   tone: actionIds.size > 0 ? 'bad' : null,       icon: ICO.gavel  },
  ]

  return (
    <div className="pb-24 pt-4">
      {loading ? (
        <div className="flex justify-center pt-20">
          <LoadingSpinner />
        </div>
      ) : staff.length === 0 ? (
        <div className="text-center px-4 py-[60px] text-charcoal/30">
          <div className="mb-1.5 font-mono text-[11px] tracking-[0.1em] uppercase text-charcoal/50">Manager · Team</div>
          <h1 className="text-[28px] font-bold tracking-[-0.03em] text-charcoal mt-0 mb-2.5">HR Records</h1>
          <p className="text-[13.5px] text-charcoal/50 mb-6">No active staff members found.</p>
          <button
            onClick={() => navigate(vp('/settings'))}
            className="bg-brand text-white border-0 rounded-[11px] px-5 py-2.5 cursor-pointer text-[13px] font-semibold"
          >
            Add staff in Settings
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-[13px] mb-[22px]">
            {stats.map(s => (
              <StatTile key={s.label} label={s.label} value={s.value} sub={s.sub} tone={s.tone} icon={s.icon} />
            ))}
          </div>

          <div className="grid gap-[22px] items-start" style={{ gridTemplateColumns: '316px 1fr' }}>

            <div className="sticky top-[76px] h-[calc(100vh-160px)] flex flex-col">
              <div className="mb-3.5">
                <div className="font-mono text-[11px] tracking-[0.1em] uppercase text-charcoal/50 font-semibold">
                  Manager · Team
                </div>
                <h1 className="text-[23px] font-bold tracking-[-0.025em] text-charcoal leading-[1.1] mt-1 mb-0">
                  HR Records
                </h1>
              </div>

              <div className="relative mb-2.5">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/30 inline-flex pointer-events-none">
                  {ICO.search}
                </span>
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search staff…"
                  className="w-full py-[9px] pl-9 pr-3 rounded-[11px] border border-charcoal/10 text-[13px] outline-none bg-white dark:bg-paperDark text-charcoal box-border"
                />
              </div>

              <button
                onClick={() => navigate(vp('/settings'))}
                className="flex items-center gap-[7px] w-full px-[13px] py-[9px] rounded-[11px] border border-charcoal/10 bg-transparent text-charcoal/50 cursor-pointer text-[13px] font-medium mb-3.5"
              >
                {ICO.plus}
                <span>Add staff</span>
              </button>

              <div className="flex-1 overflow-y-auto flex flex-col gap-px pr-0.5">
                {filtered.length === 0 ? (
                  <div className="text-center px-3 py-6 text-charcoal/30 font-mono text-[11px]">
                    No staff match your search
                  </div>
                ) : (
                  <>
                    {attentionRows.length > 0 && (
                      <>
                        <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-danger font-bold px-3 pt-2 pb-[5px]">
                          Needs attention · {attentionRows.length}
                        </div>
                        {attentionRows.map(s => (
                          <ListRow key={s.id} s={s} selected={selected} actionIds={actionIds} expiringIds={expiringIds} onClick={() => openStaff(s)} />
                        ))}
                      </>
                    )}
                    <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-charcoal/50 font-bold px-3 pt-2.5 pb-[5px]">
                      All staff · {regularRows.length}
                    </div>
                    {regularRows.map(s => (
                      <ListRow key={s.id} s={s} selected={selected} actionIds={actionIds} expiringIds={expiringIds} onClick={() => openStaff(s)} />
                    ))}
                  </>
                )}
              </div>
            </div>

            <div className="border-l border-charcoal/10 pl-[22px] min-h-[calc(100vh-160px)]">
              <EmployeeRecordPanel
                key={selected?.id}
                staffId={selected?.id}
                venueId={venueId}
                venueSlug={venueSlug}
                onBack={null}
                tab={tab}
                setTab={setTab}
              />
            </div>

          </div>
        </>
      )}
    </div>
  )
}
