import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths,
  isSameDay, isWithinInterval, isBefore, parseISO, startOfDay,
} from 'date-fns'
import { supabase } from '../../lib/supabase'
import { sendPush } from '../../lib/sendPush'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import { calculateEntitlementDays, countWorkingDaysInRequest } from '../../hooks/useLeaveBalance'
import { useZeroHoursAccrual, useTeamZeroHoursAccruals } from '../../hooks/useZeroHoursAccrual'

/* ── Constants ─────────────────────────────────────────────────────────── */
const LEAVE_TYPES = [
  { value: 'annual',  label: 'Annual Leave' },
  { value: 'unpaid',  label: 'Unpaid Leave' },
  { value: 'other',   label: 'Other' },
]

const LEAVE_TYPE_COLOURS = {
  annual:  'bg-brand/10 text-brand',
  unpaid:  'bg-charcoal/8 text-charcoal/50',
  other:   'bg-charcoal/8 text-charcoal/50',
}

/* ── Helpers ───────────────────────────────────────────────────────────── */
function getRequestsForDay(requests, day) {
  if (!day) return []
  return requests.filter(r =>
    isWithinInterval(day, { start: parseISO(r.start_date), end: parseISO(r.end_date) })
  )
}

function fmtDays(n) {
  if (n === null || n === undefined) return '—'
  return n === 1 ? '1 day' : `${n} days`
}

/* ── Hooks ─────────────────────────────────────────────────────────────── */
function useTimeOffRequests(venueId) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const load = useCallback(async () => {
    if (!venueId) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('time_off_requests')
      .select('*, staff:staff_id(name, working_days), reviewer:reviewed_by(name)')
      .eq('venue_id', venueId)
      .order('start_date', { ascending: true })
    if (err) { setError(err.message); setLoading(false); return }
    setRequests(data ?? [])
    setLoading(false)
  }, [venueId])
  useEffect(() => { load() }, [load])
  return { requests, loading, error, reload: load }
}

function useActiveStaff(venueId) {
  const [staff, setStaff] = useState([])
  useEffect(() => {
    if (!venueId) return
    supabase.from('staff')
      .select('id, name, employment_type, working_days')
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setStaff(data ?? []))
  }, [venueId])
  return staff
}

function useOwnProfile(staffId) {
  const [profile, setProfile] = useState(null)
  useEffect(() => {
    if (!staffId) return
    supabase.from('staff')
      .select('id, employment_type, working_days')
      .eq('id', staffId)
      .maybeSingle()
      .then(({ data }) => setProfile(data))
  }, [staffId])
  return profile
}

// Compute all staff leave balances in a single batch fetch
function useTeamLeaveBalances(staff, leaveYear) {
  const year = leaveYear ?? new Date().getFullYear()
  const [approvedReqs, setApprovedReqs] = useState([])
  const [overrides, setOverrides]       = useState({})
  const [loading, setLoading]           = useState(true)
  const [tick, setTick]                 = useState(0)

  useEffect(() => {
    if (!staff.length) { setLoading(false); return }
    const ids = staff.map(s => s.id)
    Promise.all([
      supabase.from('time_off_requests')
        .select('staff_id, start_date, end_date')
        .in('staff_id', ids)
        .eq('status', 'approved')
        .eq('leave_type', 'annual')
        .gte('start_date', `${year}-01-01`)
        .lte('start_date', `${year}-12-31`),
      supabase.from('leave_entitlements')
        .select('staff_id, override_days')
        .in('staff_id', ids)
        .eq('leave_year', year),
    ]).then(([reqRes, ovRes]) => {
      setApprovedReqs(reqRes.data ?? [])
      const map = {}
      for (const o of (ovRes.data ?? [])) map[o.staff_id] = o.override_days
      setOverrides(map)
      setLoading(false)
    })
  }, [staff.length, year, tick]) // eslint-disable-line react-hooks/exhaustive-deps

  const reloadBalances = useCallback(() => setTick(t => t + 1), [])

  const balances = useMemo(() => staff.map(s => {
    const calculated  = calculateEntitlementDays(s.employment_type, s.working_days)
    const entitlement = overrides[s.id] ?? calculated
    const myReqs      = approvedReqs.filter(r => r.staff_id === s.id)
    const used        = myReqs.reduce((sum, r) =>
      sum + countWorkingDaysInRequest(r.start_date, r.end_date, s.working_days), 0)
    const remaining   = entitlement != null ? Math.max(0, entitlement - used) : null
    return { ...s, entitlement, used, remaining, isZeroHours: s.employment_type === 'zero_hours' }
  }), [staff, approvedReqs, overrides])

  return { balances, loading, reloadBalances }
}

/* ── Calendar ──────────────────────────────────────────────────────────── */
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function CalendarView({ month, requests, onDayClick }) {
  const start = startOfMonth(month)
  const end   = endOfMonth(month)
  const days  = eachDayOfInterval({ start, end })

  const startDow     = getDay(start)
  const mondayOffset = startDow === 0 ? 6 : startDow - 1
  const padBefore    = Array.from({ length: mondayOffset }, () => null)
  const allCells     = [...padBefore, ...days]
  while (allCells.length % 7 !== 0) allCells.push(null)

  const today = new Date()

  return (
    <div className="overflow-x-auto -mx-0">
      <div style={{ minWidth: '320px' }}>
        <div className="grid grid-cols-7 gap-px bg-charcoal/8 rounded-t-xl overflow-hidden">
          {DAY_LABELS.map(d => (
            <div key={d} className="bg-white py-2 text-center text-[11px] tracking-widest uppercase text-charcoal/40 font-medium">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-charcoal/8 rounded-b-xl overflow-hidden">
          {allCells.map((day, i) => {
            if (!day) return <div key={`pad-${i}`} className="bg-charcoal/3 min-h-[60px] sm:min-h-[72px]" />
            const dayRequests = getRequestsForDay(requests, day)
            const isToday     = isSameDay(day, today)
            const isPast      = isBefore(day, today) && !isToday
            return (
              <button
                key={i}
                onClick={() => onDayClick(day)}
                className={`bg-white min-h-[60px] sm:min-h-[72px] p-1 text-left transition-colors hover:bg-charcoal/3 ${isPast ? 'opacity-50' : ''}`}
              >
                <span className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${
                  isToday ? 'bg-charcoal text-cream' : 'text-charcoal/70'
                }`}>
                  {format(day, 'd')}
                </span>
                <div className="flex flex-col gap-0.5 mt-0.5">
                  {dayRequests.slice(0, 2).map(r => (
                    <div
                      key={r.id}
                      className={`rounded px-1 py-0.5 text-[9px] sm:text-[11px] font-medium truncate ${
                        r.status === 'approved'
                          ? 'bg-success/15 text-success'
                          : r.status === 'pending'
                            ? 'bg-warning/15 text-warning'
                            : 'bg-danger/10 text-danger/60 line-through'
                      }`}
                    >
                      {r.staff?.name?.split(' ')[0] ?? '?'}
                    </div>
                  ))}
                  {dayRequests.length > 2 && (
                    <span className="text-[9px] text-charcoal/30">+{dayRequests.length - 2}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ── Balance pill ──────────────────────────────────────────────────────── */
function BalancePill({ entitlement, used, remaining, isZeroHours, accrued, small }) {
  if (isZeroHours) return (
    <span className={`inline-flex items-center gap-1 ${small ? 'text-[10px]' : 'text-xs'} font-medium text-charcoal/60 bg-charcoal/6 px-2 py-0.5 rounded-full`}>
      {accrued != null ? `${accrued} hrs accrued` : 'Calculating…'}
    </span>
  )
  if (entitlement == null) return null
  const colour   = remaining === 0 ? 'text-danger' : remaining <= 5 ? 'text-warning' : 'text-success'
  return (
    <span className={`inline-flex items-center gap-1 ${small ? 'text-[10px]' : 'text-xs'} font-medium`}>
      <span className={colour}>{fmtDays(remaining)} left</span>
      <span className="text-charcoal/30">({used}/{entitlement} used)</span>
    </span>
  )
}

/* ── Manual leave entry modal (manager) ───────────────────────────────── */
function ManualLeaveModal({ staff, venueId, managerId, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm]     = useState({ startDate: '', endDate: '', leaveType: 'annual', note: '' })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.startDate || !form.endDate) { toast('Please select start and end dates', 'error'); return }
    if (form.endDate < form.startDate)    { toast('End date must be after start date', 'error'); return }
    setSaving(true)
    const { error: err } = await supabase.from('time_off_requests').insert({
      staff_id:    staff.id,
      venue_id:    venueId,
      start_date:  form.startDate,
      end_date:    form.endDate,
      leave_type:  form.leaveType,
      status:      'approved',
      reviewed_by: managerId,
      reviewed_at: new Date().toISOString(),
      manager_note: form.note.trim() || 'Manually logged — pre-app record',
      is_manual_entry: true,
    })
    setSaving(false)
    if (err) { toast(err.message, 'error'); return }
    toast(`Past leave logged for ${staff.name}`)
    onSaved()
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={`Log past leave — ${staff.name}`}>
      <div className="flex flex-col gap-4">

        {/* Leave type */}
        <div>
          <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">Leave Type</label>
          <div className="flex gap-2 flex-wrap">
            {LEAVE_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => setForm(f => ({ ...f, leaveType: t.value }))}
                className={[
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                  form.leaveType === t.value
                    ? 'bg-charcoal text-cream border-charcoal'
                    : 'bg-white text-charcoal/50 border-charcoal/15',
                ].join(' ')}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] tracking-widests uppercase text-charcoal/40 block mb-1">Start date</label>
            <input
              type="date"
              value={form.startDate}
              onChange={e => setForm(f => ({ ...f, startDate: e.target.value, endDate: f.endDate || e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>
          <div>
            <label className="text-[11px] tracking-widests uppercase text-charcoal/40 block mb-1">End date</label>
            <input
              type="date"
              value={form.endDate}
              min={form.startDate}
              onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>
        </div>

        {/* Optional note */}
        <div>
          <label className="text-[11px] tracking-widests uppercase text-charcoal/40 block mb-1">Note (optional)</label>
          <input
            type="text"
            value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            placeholder="e.g. Summer holiday 2024"
            className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
          />
        </div>

        <p className="text-[11px] text-charcoal/35 -mt-2">
          This will be recorded as approved leave and counted against {staff.name}'s annual balance.
        </p>

        <button
          onClick={save}
          disabled={saving || !form.startDate || !form.endDate}
          className="bg-charcoal text-cream py-3 rounded-xl text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Log Leave'}
        </button>
      </div>
    </Modal>
  )
}

/* ── Main page ─────────────────────────────────────────────────────────── */
export default function TimeOffPage() {
  const toast = useToast()
  const { venueId }          = useVenue()
  const { session, isManager } = useSession()
  const { requests, loading, error, reload } = useTimeOffRequests(venueId)
  const staff      = useActiveStaff(venueId)
  const ownProfile = useOwnProfile(session?.staffId)

  const currentYear = new Date().getFullYear()
  const { balances: teamBalances, loading: balancesLoading, reloadBalances } = useTeamLeaveBalances(
    isManager ? staff : [],
    currentYear
  )

  // Zero-hours accrual — own (staff view)
  const { accrued: ownAccrued } = useZeroHoursAccrual(
    ownProfile?.employment_type === 'zero_hours' ? session?.staffId : null,
    currentYear
  )

  // Zero-hours accrual — team (manager view)
  const zeroHoursIds = useMemo(
    () => teamBalances.filter(b => b.isZeroHours).map(b => b.id),
    [teamBalances]
  )
  const { map: zeroHoursMap } = useTeamZeroHoursAccruals(zeroHoursIds, currentYear)

  // Manual leave entry state
  const [manualEntry, setManualEntry] = useState(null) // null = closed; staff balance obj = open

  // Own balance (staff view)
  const ownBalance = useMemo(() => {
    if (!ownProfile) return null
    const calculated  = calculateEntitlementDays(ownProfile.employment_type, ownProfile.working_days)
    const myApproved  = requests.filter(r =>
      r.staff_id === session?.staffId && r.status === 'approved' && r.leave_type === 'annual'
    )
    const used = myApproved.reduce((sum, r) =>
      sum + countWorkingDaysInRequest(r.start_date, r.end_date, ownProfile.working_days), 0)
    const entitlement = calculated
    const remaining   = entitlement != null ? Math.max(0, entitlement - used) : null
    return { entitlement, used, remaining, isZeroHours: ownProfile.employment_type === 'zero_hours' }
  }, [ownProfile, requests, session?.staffId])

  const [month, setMonth]           = useState(new Date())
  const [showRequest, setShowRequest] = useState(false)
  const [showDayDetail, setShowDayDetail] = useState(null)
  const [form, setForm]             = useState({ startDate: '', endDate: '', reason: '', leaveType: 'annual' })
  const [saving, setSaving]         = useState(false)
  const [showTeamBalances, setShowTeamBalances] = useState(true)

  // Manager review state
  const [reviewing, setReviewing]   = useState(null)
  const [managerNote, setManagerNote] = useState('')

  const prevMonth = () => setMonth(m => subMonths(m, 1))
  const nextMonth = () => setMonth(m => addMonths(m, 1))

  // Days this form request would consume (for annual leave preview)
  const previewDays = useMemo(() => {
    if (form.leaveType !== 'annual' || !form.startDate || !form.endDate) return null
    return countWorkingDaysInRequest(form.startDate, form.endDate, ownProfile?.working_days)
  }, [form.startDate, form.endDate, form.leaveType, ownProfile?.working_days])

  const submitRequest = async () => {
    if (!form.startDate || !form.endDate) { toast('Please select start and end dates', 'error'); return }
    if (form.endDate < form.startDate)    { toast('End date must be after start date', 'error'); return }
    setSaving(true)
    const { error: err } = await supabase.from('time_off_requests').insert({
      staff_id:   session?.staffId,
      start_date: form.startDate,
      end_date:   form.endDate,
      reason:     form.reason.trim() || null,
      leave_type: form.leaveType,
      venue_id:   venueId,
    })
    setSaving(false)
    if (err) { toast(err.message, 'error'); return }
    toast('Time-off request submitted')
    sendPush({
      venueId,
      notificationType: 'time_off_request',
      title: 'New Leave Request',
      body:  `${session?.staffName ?? 'A staff member'} requested ${LEAVE_TYPES.find(t => t.value === form.leaveType)?.label ?? 'time off'}: ${form.startDate} – ${form.endDate}`,
      url:   '/timeoff',
      roles: ['manager', 'owner'],
    }).catch(() => {})
    setForm({ startDate: '', endDate: '', reason: '', leaveType: 'annual' })
    setShowRequest(false)
    reload()
  }

  const approve = async (id) => {
    setReviewing(id)
    const req = requests.find(r => r.id === id)
    const { error: err } = await supabase.from('time_off_requests').update({
      status:       'approved',
      reviewed_by:  session?.staffId,
      reviewed_at:  new Date().toISOString(),
      manager_note: managerNote.trim() || null,
    }).eq('id', id)
    setReviewing(null)
    setManagerNote('')
    if (err) { toast(err.message, 'error'); return }
    toast('Time off approved')
    reloadBalances()
    if (req?.staff_id) {
      sendPush({
        venueId,
        notificationType: 'time_off_decision',
        title: 'Time Off Approved',
        body:  `Your ${LEAVE_TYPES.find(t => t.value === req.leave_type)?.label ?? 'time off'} (${req.start_date} – ${req.end_date}) has been approved.`,
        url:   '/time-off',
        staffIds: [req.staff_id],
      }).catch(() => {})
    }
    reload()
  }

  const reject = async (id) => {
    setReviewing(id)
    const req = requests.find(r => r.id === id)
    const { error: err } = await supabase.from('time_off_requests').update({
      status:       'rejected',
      reviewed_by:  session?.staffId,
      reviewed_at:  new Date().toISOString(),
      manager_note: managerNote.trim() || null,
    }).eq('id', id)
    setReviewing(null)
    setManagerNote('')
    if (err) { toast(err.message, 'error'); return }
    toast('Time off rejected')
    reloadBalances()
    if (req?.staff_id) {
      sendPush({
        venueId,
        notificationType: 'time_off_decision',
        title: 'Time Off Rejected',
        body:  `Your time off request (${req.start_date} – ${req.end_date}) was not approved.${managerNote.trim() ? ' Note: ' + managerNote.trim() : ''}`,
        url:   '/time-off',
        staffIds: [req.staff_id],
      }).catch(() => {})
    }
    reload()
  }

  const myRequests      = useMemo(() => requests.filter(r => r.staff_id === session?.staffId), [requests, session?.staffId])
  const pendingRequests = useMemo(() => requests.filter(r => r.status === 'pending'), [requests])
  const dayDetailRequests = useMemo(() => getRequestsForDay(requests, showDayDetail), [requests, showDayDetail])

  const statusColors = {
    pending:  'bg-warning/10 text-warning border-warning/20',
    approved: 'bg-success/10 text-success border-success/20',
    rejected: 'bg-danger/10 text-danger border-danger/20',
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Time Off</h1>
          {/* Own balance pill shown below title for staff */}
          {ownBalance && (
            <div className="mt-0.5">
              <BalancePill {...ownBalance} accrued={ownAccrued} small />
              {!ownBalance.isZeroHours && ownBalance.entitlement != null && (
                <span className="text-[10px] text-charcoal/30 ml-1">{currentYear} annual leave</span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => setShowRequest(true)}
          className="bg-charcoal text-cream px-4 py-2 rounded-lg text-sm font-medium hover:bg-charcoal/90 transition-colors"
        >
          + Request
        </button>
      </div>

      {/* Legend */}
      <div className="flex gap-4">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-warning/30" />
          <span className="text-[11px] tracking-wider uppercase text-charcoal/40">Pending</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-success/30" />
          <span className="text-[11px] tracking-wider uppercase text-charcoal/40">Approved</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-danger/20" />
          <span className="text-[11px] tracking-wider uppercase text-charcoal/40">Rejected</span>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-2xl border-charcoal/10 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-charcoal/8">
          <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-charcoal/8 text-charcoal/50 hover:text-charcoal transition-colors text-sm">‹</button>
          <span className="text-sm font-medium text-charcoal">{format(month, 'MMMM yyyy')}</span>
          <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-charcoal/8 text-charcoal/50 hover:text-charcoal transition-colors text-sm">›</button>
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><LoadingSpinner /></div>
        ) : error ? (
          <p className="text-center text-sm text-danger/70 py-10">{error}</p>
        ) : (
          <CalendarView
            month={month}
            requests={requests.filter(r => r.status !== 'rejected')}
            onDayClick={setShowDayDetail}
          />
        )}
      </div>

      {/* Manager: pending requests */}
      {isManager && pendingRequests.length > 0 && (
        <div className="bg-white rounded-2xl overflow-hidden border border-warning/20">
          <div className="px-5 py-3 border-b border-warning/10 bg-warning/5">
            <p className="text-[11px] tracking-widest uppercase text-warning font-medium">
              {pendingRequests.length} Pending Request{pendingRequests.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex flex-col divide-y divide-charcoal/6">
            {pendingRequests.map(r => {
              const memberBalance = teamBalances.find(b => b.id === r.staff_id)
              const daysRequested = r.leave_type === 'annual'
                ? countWorkingDaysInRequest(r.start_date, r.end_date, r.staff?.working_days)
                : null
              return (
                <div key={r.id} className="p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-charcoal">{r.staff?.name}</p>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${LEAVE_TYPE_COLOURS[r.leave_type] ?? LEAVE_TYPE_COLOURS.other}`}>
                          {LEAVE_TYPES.find(t => t.value === r.leave_type)?.label ?? r.leave_type}
                        </span>
                      </div>
                      <p className="text-sm text-charcoal/50 mt-0.5">
                        {format(parseISO(r.start_date), 'd MMM')} — {format(parseISO(r.end_date), 'd MMM yyyy')}
                        {daysRequested != null && <span className="text-charcoal/35"> · {fmtDays(daysRequested)}</span>}
                      </p>
                      {r.reason && <p className="text-xs text-charcoal/40 mt-1 italic">"{r.reason}"</p>}
                      {/* Balance impact for annual leave */}
                      {r.leave_type === 'annual' && memberBalance && !memberBalance.isZeroHours && memberBalance.entitlement != null && daysRequested != null && (() => {
                        const afterApproval = memberBalance.remaining - daysRequested
                        return (
                          <>
                            <p className="text-[11px] text-charcoal/40 mt-1">
                              Balance after approval:
                              <span className={`ml-1 font-medium ${afterApproval < 0 ? 'text-danger' : 'text-charcoal/60'}`}>
                                {fmtDays(Math.max(0, afterApproval))} remaining
                              </span>
                              <span className="text-charcoal/25 ml-1">(currently {fmtDays(memberBalance.remaining)})</span>
                            </p>
                            {afterApproval < 0 && (
                              <div className="mt-2 flex items-center gap-2 rounded-lg bg-danger/8 border border-danger/20 px-3 py-2">
                                <svg className="w-3.5 h-3.5 text-danger shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
                                <p className="text-[11px] text-danger font-medium">
                                  Approval exceeds entitlement by {fmtDays(Math.abs(afterApproval))}
                                </p>
                              </div>
                            )}
                          </>
                        )
                      })()}
                    </div>
                    <span className="text-[11px] tracking-wider uppercase font-medium px-2 py-0.5 rounded-full bg-warning/15 text-warning shrink-0">
                      Pending
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Optional note..."
                    value={reviewing === r.id ? managerNote : ''}
                    onFocus={() => setReviewing(r.id)}
                    onChange={e => setManagerNote(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-charcoal/20 placeholder-charcoal/25"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => approve(r.id)}
                      disabled={reviewing === r.id}
                      className="flex-1 py-2 rounded-lg bg-success text-white text-xs font-medium hover:bg-success/90 transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => reject(r.id)}
                      className="flex-1 py-2 rounded-lg border border-danger/25 text-danger text-xs font-medium hover:bg-danger/5 transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Manager: team annual leave balances */}
      {isManager && (
        <div className="bg-white rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowTeamBalances(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 text-left"
          >
            <p className="text-[11px] tracking-widests uppercase text-charcoal/40 font-medium">
              Team Annual Leave — {currentYear}
            </p>
            <svg className={`w-4 h-4 text-charcoal/30 transition-transform ${showTeamBalances ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {showTeamBalances && (
            <div className="border-t border-charcoal/8">
              {balancesLoading ? (
                <div className="flex justify-center py-6"><LoadingSpinner /></div>
              ) : (
                <div className="divide-y divide-charcoal/6">
                  {teamBalances.length === 0 && (
                    <p className="text-sm text-charcoal/35 italic px-5 py-4">No active staff.</p>
                  )}
                  {teamBalances.map(b => (
                    <div key={b.id} className="flex items-center justify-between px-5 py-3 gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 flex-wrap">
                          <p className="text-sm font-medium text-charcoal truncate">{b.name}</p>
                          <button
                            onClick={() => setManualEntry(b)}
                            className="text-[10px] text-charcoal/35 hover:text-charcoal/65 underline underline-offset-2 shrink-0"
                          >
                            + log past leave
                          </button>
                        </div>
                        {b.employment_type && (
                          <p className="text-[10px] text-charcoal/35 capitalize mt-0.5">
                            {b.employment_type.replace('_', '-')}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <BalancePill
                          entitlement={b.entitlement}
                          used={b.used}
                          remaining={b.remaining}
                          isZeroHours={b.isZeroHours}
                          accrued={b.isZeroHours ? zeroHoursMap[b.id] : undefined}
                          small
                        />
                        {!b.isZeroHours && b.entitlement != null && (
                          <p className="text-[10px] text-charcoal/25 mt-0.5">{b.entitlement} days entitlement</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* My requests */}
      {myRequests.length > 0 && (
        <div>
          <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-2">My Requests</p>
          <div className="flex flex-col gap-2">
            {myRequests.map(r => (
              <div key={r.id} className={`rounded-2xl border px-4 py-3 ${statusColors[r.status]}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">
                        {format(parseISO(r.start_date), 'd MMM')} — {format(parseISO(r.end_date), 'd MMM yyyy')}
                      </p>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${LEAVE_TYPE_COLOURS[r.leave_type] ?? LEAVE_TYPE_COLOURS.other}`}>
                        {LEAVE_TYPES.find(t => t.value === r.leave_type)?.label ?? r.leave_type}
                      </span>
                    </div>
                    {r.reason       && <p className="text-xs opacity-70 mt-0.5">{r.reason}</p>}
                    {r.manager_note && <p className="text-xs opacity-60 mt-0.5 italic">Note: {r.manager_note}</p>}
                  </div>
                  <span className="text-[11px] tracking-wider uppercase font-semibold shrink-0">
                    {r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request modal */}
      <Modal open={showRequest} onClose={() => setShowRequest(false)} title="Request Time Off">
        <div className="flex flex-col gap-4">

          {/* Leave type selector */}
          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">Leave Type</label>
            <div className="flex gap-2 flex-wrap">
              {LEAVE_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, leaveType: t.value }))}
                  className={[
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                    form.leaveType === t.value
                      ? 'bg-charcoal text-cream border-charcoal'
                      : 'bg-white text-charcoal/50 border-charcoal/15',
                  ].join(' ')}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Balance display for annual leave */}
          {form.leaveType === 'annual' && ownBalance && !ownBalance.isZeroHours && ownBalance.entitlement != null && (
            <div className="rounded-xl bg-charcoal/4 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-charcoal">{currentYear} Annual Leave</p>
                <p className="text-[11px] text-charcoal/45 mt-0.5">
                  {ownBalance.used} of {ownBalance.entitlement} days used
                </p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${ownBalance.remaining === 0 ? 'text-danger' : ownBalance.remaining <= 5 ? 'text-warning' : 'text-success'}`}>
                  {fmtDays(ownBalance.remaining)}
                </p>
                <p className="text-[10px] text-charcoal/30">remaining</p>
              </div>
            </div>
          )}
          {form.leaveType === 'annual' && ownBalance?.isZeroHours && (
            <p className="text-xs text-charcoal/40 bg-charcoal/4 rounded-xl px-4 py-3">
              {ownAccrued != null
                ? `You've accrued ${ownAccrued} hrs of holiday this year (12.07% of hours worked).`
                : 'Calculating your accrued holiday…'}
            </p>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">Start date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value, endDate: f.endDate || e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            </div>
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">End date</label>
              <input
                type="date"
                value={form.endDate}
                min={form.startDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            </div>
          </div>

          {/* Days preview for annual leave */}
          {form.leaveType === 'annual' && previewDays != null && previewDays > 0 && (
            <p className="text-xs text-charcoal/50 -mt-2">
              This request covers <span className="font-semibold text-charcoal">{fmtDays(previewDays)}</span> of your working days.
              {ownBalance && !ownBalance.isZeroHours && ownBalance.remaining != null && (
                <span className={(ownBalance.remaining - previewDays) < 0 ? ' text-danger font-medium' : ''}>
                  {(ownBalance.remaining - previewDays) < 0
                    ? ` You only have ${fmtDays(ownBalance.remaining)} remaining — this exceeds your balance.`
                    : ` You'll have ${fmtDays(ownBalance.remaining - previewDays)} left after this.`}
                </span>
              )}
            </p>
          )}

          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">Reason (optional)</label>
            <textarea
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              rows={2}
              placeholder="e.g. Holiday, family event, appointment..."
              className="w-full px-4 py-2.5 rounded-xl border border-charcoal/15 bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>

          <button
            onClick={submitRequest}
            disabled={saving || !form.startDate || !form.endDate}
            className="bg-charcoal text-cream py-3 rounded-xl text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40"
          >
            {saving ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </Modal>

      {/* Day detail modal */}
      <Modal
        open={!!showDayDetail}
        onClose={() => setShowDayDetail(null)}
        title={showDayDetail ? format(showDayDetail, 'EEEE d MMMM yyyy') : ''}
      >
        {dayDetailRequests.length === 0 ? (
          <p className="text-sm text-charcoal/30 italic py-4">No time-off requests for this day.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {dayDetailRequests.map(r => (
              <div key={r.id} className={`rounded-2xl border px-4 py-3 ${statusColors[r.status]}`}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{r.staff?.name}</p>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${LEAVE_TYPE_COLOURS[r.leave_type] ?? LEAVE_TYPE_COLOURS.other}`}>
                        {LEAVE_TYPES.find(t => t.value === r.leave_type)?.label ?? r.leave_type}
                      </span>
                    </div>
                    <p className="text-xs opacity-70 mt-0.5">
                      {format(parseISO(r.start_date), 'd MMM')} — {format(parseISO(r.end_date), 'd MMM')}
                    </p>
                    {r.reason && <p className="text-xs opacity-60 mt-0.5">{r.reason}</p>}
                  </div>
                  <span className="text-[11px] tracking-wider uppercase font-semibold shrink-0">
                    {r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        {showDayDetail && !isBefore(showDayDetail, startOfDay(new Date())) && (
          <button
            onClick={() => {
              const dateStr = format(showDayDetail, 'yyyy-MM-dd')
              setForm(f => ({ ...f, startDate: dateStr, endDate: dateStr }))
              setShowDayDetail(null)
              setShowRequest(true)
            }}
            className="mt-4 w-full bg-charcoal text-cream py-2.5 rounded-xl text-sm font-medium hover:bg-charcoal/90 transition-colors"
          >
            + Request this day off
          </button>
        )}
      </Modal>

      {/* Manual leave entry modal */}
      {manualEntry && (
        <ManualLeaveModal
          staff={manualEntry}
          venueId={venueId}
          managerId={session?.staffId}
          onClose={() => setManualEntry(null)}
          onSaved={() => { reloadBalances(); reload() }}
        />
      )}
    </div>
  )
}
