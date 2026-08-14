import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths,
  isSameDay, isWithinInterval, isBefore, parseISO, startOfDay,
} from 'date-fns'
import { supabase } from '../../lib/supabase'
import { sendPush } from '../../lib/sendPush'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import { SkeletonList } from '../../components/ui/Skeleton'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { calculateEntitlementDays, countWorkingDaysInRequest } from '../../hooks/useLeaveBalance'
import { useZeroHoursAccrual, useTeamZeroHoursAccruals } from '../../hooks/useZeroHoursAccrual'
import { invalidateSummaryCache } from '../../hooks/useTodaySummary'
import { cancelTimeOffRequest, updateTimeOffRequest, timeOffPermissions, isBlocking } from '../../lib/api/timeOff'
import { useAppSettings } from '../../hooks/useSettings'

/* ── Constants ─────────────────────────────────────────────────────────── */
const LEAVE_TYPES = [
  { value: 'annual',  label: 'Annual Leave' },
  { value: 'unpaid',  label: 'Unpaid Leave' },
  { value: 'other',   label: 'Other' },
]

const LEAVE_TYPE_COLOURS = {
  annual:  'bg-brand/10 text-brand',
  unpaid:  'bg-charcoal/8 dark:bg-white/8 text-charcoal/50 dark:text-white/40',
  other:   'bg-charcoal/8 dark:bg-white/8 text-charcoal/50 dark:text-white/40',
}

const STATUS_COLOURS = {
  pending:   'bg-warning/10 text-warning border-warning/20',
  approved:  'bg-success/10 text-success border-success/20',
  rejected:  'bg-danger/10 text-danger border-danger/20',
  cancelled: 'bg-charcoal/5 dark:bg-white/5 text-charcoal/45 dark:text-white/40 border-charcoal/10 dark:border-white/10',
}

const leaveTypeLabel = (value) => LEAVE_TYPES.find(t => t.value === value)?.label ?? value

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

function maxStaffOffInRange(requests, startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return 0
  const days = eachDayOfInterval({ start: parseISO(startDateStr), end: parseISO(endDateStr) })
  return days.reduce((max, day) => Math.max(max, getRequestsForDay(requests, day).length), 0)
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
      .select('id, name, employment_type, working_days, holiday_pay_eligible')
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
      .select('id, employment_type, working_days, holiday_pay_eligible')
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
    const eligible    = s.holiday_pay_eligible !== false
    const calculated  = eligible ? calculateEntitlementDays(s.employment_type, s.working_days) : null
    const entitlement = eligible ? (overrides[s.id] ?? calculated) : null
    const myReqs      = approvedReqs.filter(r => r.staff_id === s.id)
    const used        = myReqs.reduce((sum, r) =>
      sum + countWorkingDaysInRequest(r.start_date, r.end_date, s.working_days), 0)
    const remaining   = entitlement != null ? Math.max(0, entitlement - used) : null
    return { ...s, entitlement, used, remaining, isZeroHours: s.employment_type === 'zero_hours', isEligible: eligible }
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
        <div className="grid grid-cols-7 gap-px bg-charcoal/8 dark:bg-white/8 rounded-t-xl overflow-hidden">
          {DAY_LABELS.map(d => (
            <div key={d} className="bg-white dark:bg-paperDark py-2 text-center text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 font-medium">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-charcoal/8 dark:bg-white/8 rounded-b-xl overflow-hidden">
          {allCells.map((day, i) => {
            if (!day) return <div key={`pad-${i}`} className="bg-charcoal/3 dark:bg-white/5 min-h-[60px] sm:min-h-[72px]" />
            const dayRequests = getRequestsForDay(requests, day)
            const isToday     = isSameDay(day, today)
            const isPast      = isBefore(day, today) && !isToday
            return (
              <button
                key={i}
                onClick={() => onDayClick(day)}
                className={`bg-white dark:bg-paperDark min-h-[60px] sm:min-h-[72px] p-1 text-left transition-colors hover:bg-charcoal/3 dark:hover:bg-white/5 ${isPast ? 'opacity-50' : ''}`}
              >
                <span className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${
                  isToday ? 'bg-charcoal text-cream' : 'text-charcoal/70 dark:text-white/60'
                }`}>
                  {format(day, 'd')}
                </span>
                <div className="flex flex-col gap-0.5 mt-0.5">
                  {dayRequests.slice(0, 2).map(r => (
                    <div
                      key={r.id}
                      className={`rounded px-1 py-0.5 text-[11px] sm:text-[11px] font-medium truncate ${
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
                    <span className="text-[11px] text-charcoal/30 dark:text-white/30">+{dayRequests.length - 2}</span>
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
    <span className={`inline-flex items-center gap-1 ${small ? 'text-[11px]' : 'text-xs'} font-medium text-charcoal/60 dark:text-white/50 bg-charcoal/6 dark:bg-white/8 px-2 py-0.5 rounded-full`}>
      {accrued != null ? `${accrued} hrs accrued` : 'Calculating…'}
    </span>
  )
  if (entitlement == null) return null
  const colour   = remaining === 0 ? 'text-danger' : remaining <= 5 ? 'text-warning' : 'text-success'
  return (
    <span className={`inline-flex items-center gap-1 ${small ? 'text-[11px]' : 'text-xs'} font-medium`}>
      <span className={colour}>{fmtDays(remaining)} left</span>
      <span className="text-charcoal/30 dark:text-white/30">({used}/{entitlement} used)</span>
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
          <label className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 block mb-2">Leave Type</label>
          <div className="flex gap-2 flex-wrap">
            {LEAVE_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => setForm(f => ({ ...f, leaveType: t.value }))}
                className={[
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                  form.leaveType === t.value
                    ? 'bg-charcoal text-cream border-charcoal dark:border-white'
                    : 'bg-white dark:bg-paperDark text-charcoal/50 dark:text-white/40 border-charcoal/15 dark:border-white/15',
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
            <label className="text-[11px] tracking-widests uppercase text-charcoal/40 dark:text-white/35 block mb-1">Start date</label>
            <input
              type="date"
              value={form.startDate}
              onChange={e => setForm(f => ({ ...f, startDate: e.target.value, endDate: f.endDate || e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
            />
          </div>
          <div>
            <label className="text-[11px] tracking-widests uppercase text-charcoal/40 dark:text-white/35 block mb-1">End date</label>
            <input
              type="date"
              value={form.endDate}
              min={form.startDate}
              onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
            />
          </div>
        </div>

        {/* Optional note */}
        <div>
          <label className="text-[11px] tracking-widests uppercase text-charcoal/40 dark:text-white/35 block mb-1">Note (optional)</label>
          <input
            type="text"
            value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            placeholder="e.g. Summer holiday 2024"
            className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
          />
        </div>

        <p className="text-[11px] text-charcoal/35 dark:text-white/30 -mt-2">
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

/* ── Edit / withdraw modal ─────────────────────────────────────────────── */
/**
 * Opened from a calendar day or the "My Requests" list. Staff manage their own
 * booked time off here; managers can manage anyone's. Withdrawing sets the
 * request to 'cancelled', which is what frees the staff member up on the rota.
 */
function EditRequestModal({ request, isManager, actorId, actorName, venueId, onClose, onSaved }) {
  const toast = useToast()
  const perms = timeOffPermissions(request, { staffId: actorId, isManager })

  const [form, setForm] = useState({
    startDate: request.start_date,
    endDate:   request.end_date,
    leaveType: request.leave_type,
    reason:    request.reason ?? '',
  })
  const [saving, setSaving]     = useState(false)
  const [confirming, setConfirm] = useState(false)

  const isOwn   = request.staff_id === actorId
  const changed =
    form.startDate !== request.start_date ||
    form.endDate   !== request.end_date   ||
    form.leaveType !== request.leave_type ||
    form.reason    !== (request.reason ?? '')

  const days = useMemo(
    () => (form.leaveType === 'annual' && form.startDate && form.endDate
      ? countWorkingDaysInRequest(form.startDate, form.endDate, request.staff?.working_days)
      : null),
    [form.startDate, form.endDate, form.leaveType, request.staff?.working_days],
  )

  // A staff member changing leave a manager already approved sends it back to pending.
  const willNeedReapproval = perms.needsReapproval && changed

  // Keep the other side of the request in the loop: managers need to know the
  // rota has changed, staff need to know a manager touched their booking.
  const notify = (action, patch) => {
    const range = patch
      ? `${patch.start_date} – ${patch.end_date}`
      : `${request.start_date} – ${request.end_date}`

    if (isOwn) {
      sendPush({
        venueId,
        notificationType: 'time_off_request',
        title: action === 'withdrawn' ? 'Leave Request Withdrawn' : 'Leave Request Updated',
        body: action === 'withdrawn'
          ? `${actorName ?? 'A staff member'} withdrew their ${leaveTypeLabel(request.leave_type)} (${range}) — they are free for the rota again.`
          : `${actorName ?? 'A staff member'} changed their ${leaveTypeLabel(patch?.leave_type ?? request.leave_type)} to ${range}.`,
        url: '/time-off',
        roles: ['manager', 'owner'],
      })
    } else if (request.staff_id) {
      sendPush({
        venueId,
        notificationType: 'time_off_decision',
        title: action === 'withdrawn' ? 'Time Off Removed' : 'Time Off Changed',
        body: action === 'withdrawn'
          ? `Your time off (${range}) was removed by a manager.`
          : `Your time off was changed to ${range}.`,
        url: '/time-off',
        staffIds: [request.staff_id],
      })
    }
  }

  const save = async () => {
    if (!form.startDate || !form.endDate) { toast('Please select start and end dates', 'error'); return }
    if (form.endDate < form.startDate)    { toast('End date must be after start date', 'error'); return }

    const patch = {
      start_date: form.startDate,
      end_date:   form.endDate,
      leave_type: form.leaveType,
      reason:     form.reason.trim() || null,
    }
    if (willNeedReapproval) {
      patch.status       = 'pending'
      patch.reviewed_by  = null
      patch.reviewed_at  = null
      patch.manager_note = null
    }

    setSaving(true)
    const { error: err } = await updateTimeOffRequest(request.id, patch)
    setSaving(false)
    if (err) { toast(err.message, 'error'); return }

    toast(willNeedReapproval ? 'Updated — sent back to your manager for approval' : 'Time off updated')
    notify('updated', patch)
    onSaved()
    onClose()
  }

  const withdraw = async () => {
    setSaving(true)
    const { error: err } = await cancelTimeOffRequest(request.id, actorId)
    setSaving(false)
    setConfirm(false)
    if (err) { toast(err.message, 'error'); return }

    toast(request.status === 'approved' ? 'Time off removed' : 'Request withdrawn')
    notify('withdrawn')
    onSaved()
    onClose()
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={isOwn ? 'Your time off' : `${request.staff?.name ?? 'Staff'} — time off`}
      >
        <div className="flex flex-col gap-4">

          {/* Current status */}
          <div className={`rounded-xl border px-4 py-2.5 flex items-center justify-between ${STATUS_COLOURS[request.status]}`}>
            <span className="text-xs font-medium">
              {format(parseISO(request.start_date), 'd MMM')} — {format(parseISO(request.end_date), 'd MMM yyyy')}
            </span>
            <span className="text-[11px] tracking-wider uppercase font-semibold">{request.status}</span>
          </div>

          {perms.lockedReason && (
            <p className="text-xs text-charcoal/45 dark:text-white/40">{perms.lockedReason}</p>
          )}

          {!perms.canEdit && !perms.lockedReason && (
            <p className="text-xs text-charcoal/45 dark:text-white/40">Only {request.staff?.name ?? 'this staff member'} or a manager can change this.</p>
          )}

          {perms.canEdit && (
            <>
              {/* Leave type */}
              <div>
                <label className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 block mb-2">Leave Type</label>
                <div className="flex gap-2 flex-wrap">
                  {LEAVE_TYPES.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, leaveType: t.value }))}
                      className={[
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                        form.leaveType === t.value
                          ? 'bg-charcoal text-cream border-charcoal dark:border-white'
                          : 'bg-white dark:bg-paperDark text-charcoal/50 dark:text-white/40 border-charcoal/15 dark:border-white/15',
                      ].join(' ')}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 block mb-1">Start date</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={e => setForm(f => ({
                      ...f,
                      startDate: e.target.value,
                      endDate: f.endDate < e.target.value ? e.target.value : f.endDate,
                    }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
                  />
                </div>
                <div>
                  <label className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 block mb-1">End date</label>
                  <input
                    type="date"
                    value={form.endDate}
                    min={form.startDate}
                    onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
                  />
                </div>
              </div>

              {days != null && days > 0 && (
                <p className="text-xs text-charcoal/50 dark:text-white/40 -mt-2">
                  Covers <span className="font-semibold text-charcoal dark:text-white">{fmtDays(days)}</span> of working days.
                </p>
              )}

              {/* Reason */}
              <div>
                <label className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 block mb-1">Reason (optional)</label>
                <textarea
                  value={form.reason}
                  onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm resize-none focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
                />
              </div>

              {willNeedReapproval && (
                <div className="rounded-xl bg-warning/8 border border-warning/20 px-4 py-2.5">
                  <p className="text-[11px] text-warning font-medium">
                    This leave is already approved — saving changes sends it back to your manager for approval.
                  </p>
                </div>
              )}

              <button
                onClick={save}
                disabled={saving || !changed}
                className="bg-charcoal text-cream py-3 rounded-xl text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </>
          )}

          {perms.canCancel && (
            <button
              onClick={() => setConfirm(true)}
              disabled={saving}
              className="py-2.5 rounded-xl border border-danger/25 text-danger text-sm font-medium hover:bg-danger/5 transition-colors disabled:opacity-40"
            >
              {request.status === 'approved' ? 'Remove this time off' : 'Withdraw request'}
            </button>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirming}
        title={request.status === 'approved' ? 'Remove this time off?' : 'Withdraw this request?'}
        message={
          request.status === 'approved'
            ? `${isOwn ? 'You' : request.staff?.name ?? 'This staff member'} will be available for shifts on these days again${request.leave_type === 'annual' ? ', and the days go back into the annual leave balance' : ''}.`
            : 'The request will be removed from the calendar and your manager will no longer see it.'
        }
        confirmLabel={request.status === 'approved' ? 'Remove' : 'Withdraw'}
        danger
        onConfirm={withdraw}
        onClose={() => setConfirm(false)}
      />
    </>
  )
}

/* ── Main page ─────────────────────────────────────────────────────────── */
export default function TimeOffPage() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { venueId }          = useVenue()
  const { session, isManager } = useSession()
  const { maxStaffOffEnabled, maxStaffOffCount } = useAppSettings()
  const { requests, loading, error, reload } = useTimeOffRequests(venueId)
  const staff      = useActiveStaff(venueId)
  const ownProfile = useOwnProfile(session?.staffId)

  const currentYear = new Date().getFullYear()
  const { balances: teamBalances, loading: balancesLoading, reloadBalances } = useTeamLeaveBalances(
    isManager ? staff : [],
    currentYear
  )

  // Zero-hours accrual — own (staff view)
  const { accrued: ownAccrued, avgDailyHours: ownAvgDaily } = useZeroHoursAccrual(
    ownProfile?.employment_type === 'zero_hours' ? session?.staffId : null,
    currentYear
  )

  // Zero-hours accrual — team (manager view)
  const zeroHoursIds = useMemo(
    () => teamBalances.filter(b => b.isZeroHours).map(b => b.id),
    [teamBalances]
  )
  const { map: zeroHoursMap } = useTeamZeroHoursAccruals(zeroHoursIds, currentYear)

  /**
   * Time off drives availability everywhere else in the app, so any write here
   * has to bust the caches those screens read from — otherwise a staff member
   * who just freed themselves up still shows as unavailable on the rota.
   */
  const refreshDependents = useCallback(() => {
    reload()
    reloadBalances()
    queryClient.invalidateQueries({ queryKey: ['availability'] })        // rota grid + AI/auto builder
    queryClient.invalidateQueries({ queryKey: ['calendar_staff_leave'] }) // manager calendar
    invalidateSummaryCache(venueId)                                       // dashboard pending-leave counts
  }, [reload, reloadBalances, queryClient, venueId])

  // Manual leave entry state
  const [manualEntry, setManualEntry] = useState(null) // null = closed; staff balance obj = open

  // Request being edited / withdrawn — set from the calendar or "My Requests"
  const [editing, setEditing] = useState(null)

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

  // For zero-hours: convert approved leave days → estimated hours used
  const ownUsedHours = useMemo(() => {
    if (!ownBalance?.isZeroHours || ownBalance.used == null) return null
    return Math.round(ownBalance.used * (ownAvgDaily ?? 7.6) * 10) / 10
  }, [ownBalance, ownAvgDaily])
  const ownRemainingHours = useMemo(() => {
    if (ownAccrued == null || ownUsedHours == null) return ownAccrued ?? null
    return Math.round(Math.max(0, ownAccrued - ownUsedHours) * 10) / 10
  }, [ownAccrued, ownUsedHours])

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
      body:  `${session?.staffName ?? 'A staff member'} requested ${leaveTypeLabel(form.leaveType)}: ${form.startDate} – ${form.endDate}`,
      url:   '/time-off',
      roles: ['manager', 'owner'],
    })
    setForm({ startDate: '', endDate: '', reason: '', leaveType: 'annual' })
    setShowRequest(false)
    refreshDependents()
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
    if (req?.staff_id) {
      sendPush({
        venueId,
        notificationType: 'time_off_decision',
        title: 'Time Off Approved',
        body:  `Your ${leaveTypeLabel(req.leave_type)} (${req.start_date} – ${req.end_date}) has been approved.`,
        url:   '/time-off',
        staffIds: [req.staff_id],
      })
    }
    refreshDependents()
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
    if (req?.staff_id) {
      sendPush({
        venueId,
        notificationType: 'time_off_decision',
        title: 'Time Off Rejected',
        body:  `Your time off request (${req.start_date} – ${req.end_date}) was not approved.${managerNote.trim() ? ' Note: ' + managerNote.trim() : ''}`,
        url:   '/time-off',
        staffIds: [req.staff_id],
      })
    }
    refreshDependents()
  }

  const myRequests      = useMemo(() => requests.filter(r => r.staff_id === session?.staffId), [requests, session?.staffId])
  const pendingRequests = useMemo(() => requests.filter(r => r.status === 'pending'), [requests])
  // Withdrawn and rejected requests no longer hold anyone off the rota, so they
  // stay off the calendar — the staff member still sees them in "My Requests".
  const bookedRequests  = useMemo(() => requests.filter(r => isBlocking(r.status)), [requests])
  const dayDetailRequests = useMemo(() => getRequestsForDay(bookedRequests, showDayDetail), [bookedRequests, showDayDetail])

  // Staffing limit: how many staff are already off on the busiest day of the
  // requested range, before this request is added.
  const staffAlreadyOff = useMemo(() => {
    if (!maxStaffOffEnabled || !form.startDate || !form.endDate) return 0
    return maxStaffOffInRange(bookedRequests, form.startDate, form.endDate)
  }, [maxStaffOffEnabled, bookedRequests, form.startDate, form.endDate])
  const overStaffOffLimit = maxStaffOffEnabled && staffAlreadyOff >= maxStaffOffCount

  const canActOn = useCallback(
    (r) => {
      const p = timeOffPermissions(r, { staffId: session?.staffId, isManager })
      return p.canEdit || p.canCancel
    },
    [session?.staffId, isManager],
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal dark:text-white">Time Off</h1>
          {/* Own balance pill shown below title for staff */}
          {ownBalance && (
            <div className="mt-0.5">
              <BalancePill {...ownBalance} accrued={ownAccrued} small />
              {!ownBalance.isZeroHours && ownBalance.entitlement != null && (
                <span className="text-[11px] text-charcoal/30 dark:text-white/30 ml-1">{currentYear} annual leave</span>
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
          <span className="text-[11px] tracking-wider uppercase text-charcoal/40 dark:text-white/35">Pending</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-success/30" />
          <span className="text-[11px] tracking-wider uppercase text-charcoal/40 dark:text-white/35">Approved</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-danger/20" />
          <span className="text-[11px] tracking-wider uppercase text-charcoal/40 dark:text-white/35">Rejected</span>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white dark:bg-paperDark rounded-2xl border-charcoal/10 dark:border-white/10 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-charcoal/8 dark:border-white/8">
          <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-charcoal/8 dark:hover:bg-white/8 text-charcoal/50 dark:text-white/40 hover:text-charcoal dark:hover:text-white transition-colors text-sm">‹</button>
          <span className="text-sm font-medium text-charcoal dark:text-white">{format(month, 'MMMM yyyy')}</span>
          <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-charcoal/8 dark:hover:bg-white/8 text-charcoal/50 dark:text-white/40 hover:text-charcoal dark:hover:text-white transition-colors text-sm">›</button>
        </div>
        {loading ? (
          <SkeletonList rows={4} />
        ) : error ? (
          <p className="text-center text-sm text-danger/70 py-10">{error}</p>
        ) : (
          <CalendarView
            month={month}
            requests={bookedRequests}
            onDayClick={setShowDayDetail}
          />
        )}
      </div>

      {/* Manager: pending requests */}
      {isManager && pendingRequests.length > 0 && (
        <div className="bg-white dark:bg-paperDark rounded-2xl overflow-hidden border border-warning/20">
          <div className="px-5 py-3 border-b border-warning/10 bg-warning/5">
            <p className="text-[11px] tracking-widest uppercase text-warning font-medium">
              {pendingRequests.length} Pending Request{pendingRequests.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex flex-col divide-y divide-charcoal/6 dark:divide-white/8">
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
                        <p className="font-semibold text-charcoal dark:text-white">{r.staff?.name}</p>
                        <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${LEAVE_TYPE_COLOURS[r.leave_type] ?? LEAVE_TYPE_COLOURS.other}`}>
                          {LEAVE_TYPES.find(t => t.value === r.leave_type)?.label ?? r.leave_type}
                        </span>
                      </div>
                      <p className="text-sm text-charcoal/50 dark:text-white/40 mt-0.5">
                        {format(parseISO(r.start_date), 'd MMM')} — {format(parseISO(r.end_date), 'd MMM yyyy')}
                        {daysRequested != null && <span className="text-charcoal/35 dark:text-white/30"> · {fmtDays(daysRequested)}</span>}
                      </p>
                      {r.reason && <p className="text-xs text-charcoal/40 dark:text-white/35 mt-1 italic">"{r.reason}"</p>}
                      {/* Balance impact for annual leave */}
                      {r.leave_type === 'annual' && memberBalance && !memberBalance.isZeroHours && memberBalance.entitlement != null && daysRequested != null && (() => {
                        const afterApproval = memberBalance.remaining - daysRequested
                        return (
                          <>
                            <p className="text-[11px] text-charcoal/40 dark:text-white/35 mt-1">
                              Balance after approval:
                              <span className={`ml-1 font-medium ${afterApproval < 0 ? 'text-danger' : 'text-charcoal/60 dark:text-white/50'}`}>
                                {fmtDays(Math.max(0, afterApproval))} remaining
                              </span>
                              <span className="text-charcoal/25 dark:text-white/25 ml-1">(currently {fmtDays(memberBalance.remaining)})</span>
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
                    className="w-full px-3 py-2 rounded-lg border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-xs focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20 placeholder-charcoal/25 dark:placeholder-white/20"
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
        <div className="bg-white dark:bg-paperDark rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowTeamBalances(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 text-left"
          >
            <p className="text-[11px] tracking-widests uppercase text-charcoal/40 dark:text-white/35 font-medium">
              Team Annual Leave — {currentYear}
            </p>
            <svg className={`w-4 h-4 text-charcoal/30 dark:text-white/30 transition-transform ${showTeamBalances ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {showTeamBalances && (
            <div className="border-t border-charcoal/8 dark:border-white/8">
              {balancesLoading ? (
                <SkeletonList rows={3} />
              ) : (
                <div className="divide-y divide-charcoal/6 dark:divide-white/8">
                  {teamBalances.length === 0 && (
                    <p className="text-sm text-charcoal/35 dark:text-white/30 italic px-5 py-4">No active staff.</p>
                  )}
                  {teamBalances.map(b => (
                    <div key={b.id} className="flex items-center justify-between px-5 py-3 gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 flex-wrap">
                          <p className="text-sm font-medium text-charcoal dark:text-white truncate">{b.name}</p>
                          <button
                            onClick={() => setManualEntry(b)}
                            className="text-[11px] text-charcoal/35 dark:text-white/30 hover:text-charcoal/65 dark:hover:text-white/55 underline underline-offset-2 shrink-0"
                          >
                            + log past leave
                          </button>
                        </div>
                        {b.employment_type && (
                          <p className="text-[11px] text-charcoal/35 dark:text-white/30 capitalize mt-0.5">
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
                          <p className="text-[11px] text-charcoal/25 dark:text-white/25 mt-0.5">{b.entitlement} days entitlement</p>
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
          <p className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 mb-2">My Requests</p>
          <div className="flex flex-col gap-2">
            {myRequests.map(r => {
              const actionable = canActOn(r)
              const Row = actionable ? 'button' : 'div'
              return (
                <Row
                  key={r.id}
                  {...(actionable ? { type: 'button', onClick: () => setEditing(r) } : {})}
                  className={`w-full text-left rounded-2xl border px-4 py-3 ${STATUS_COLOURS[r.status]} ${
                    actionable ? 'hover:brightness-[0.98] transition-[filter]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">
                          {format(parseISO(r.start_date), 'd MMM')} — {format(parseISO(r.end_date), 'd MMM yyyy')}
                        </p>
                        <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${LEAVE_TYPE_COLOURS[r.leave_type] ?? LEAVE_TYPE_COLOURS.other}`}>
                          {leaveTypeLabel(r.leave_type)}
                        </span>
                      </div>
                      {r.reason       && <p className="text-xs opacity-70 mt-0.5">{r.reason}</p>}
                      {r.manager_note && <p className="text-xs opacity-60 mt-0.5 italic">Note: {r.manager_note}</p>}
                      {actionable && (
                        <p className="text-[11px] opacity-60 mt-1 underline underline-offset-2">
                          Edit or remove
                        </p>
                      )}
                    </div>
                    <span className="text-[11px] tracking-wider uppercase font-semibold shrink-0">
                      {r.status}
                    </span>
                  </div>
                </Row>
              )
            })}
          </div>
        </div>
      )}

      {/* Request modal */}
      <Modal open={showRequest} onClose={() => setShowRequest(false)} title="Request Time Off">
        <div className="flex flex-col gap-4">

          {/* Leave type selector */}
          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 block mb-2">Leave Type</label>
            <div className="flex gap-2 flex-wrap">
              {LEAVE_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, leaveType: t.value }))}
                  className={[
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                    form.leaveType === t.value
                      ? 'bg-charcoal text-cream border-charcoal dark:border-white'
                      : 'bg-white dark:bg-paperDark text-charcoal/50 dark:text-white/40 border-charcoal/15 dark:border-white/15',
                  ].join(' ')}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Balance display for annual leave */}
          {form.leaveType === 'annual' && ownBalance && !ownBalance.isZeroHours && ownBalance.entitlement != null && (
            <div className="rounded-xl bg-charcoal/4 dark:bg-white/5 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-charcoal dark:text-white">{currentYear} Annual Leave</p>
                <p className="text-[11px] text-charcoal/45 dark:text-white/40 mt-0.5">
                  {ownBalance.used} of {ownBalance.entitlement} days used
                </p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${ownBalance.remaining === 0 ? 'text-danger' : ownBalance.remaining <= 5 ? 'text-warning' : 'text-success'}`}>
                  {fmtDays(ownBalance.remaining)}
                </p>
                <p className="text-[11px] text-charcoal/30 dark:text-white/30">remaining</p>
              </div>
            </div>
          )}
          {form.leaveType === 'annual' && ownBalance?.isZeroHours && (
            <div className="rounded-xl bg-charcoal/4 dark:bg-white/5 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-charcoal dark:text-white">{currentYear} Holiday Accrual</p>
                <p className="text-[11px] text-charcoal/45 dark:text-white/40 mt-0.5">
                  {ownUsedHours != null ? `~${ownUsedHours} h used · ` : ''}
                  {ownAccrued != null ? `${ownAccrued} h accrued (12.07%)` : 'Calculating…'}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${ownRemainingHours === 0 ? 'text-danger' : ownRemainingHours != null && ownRemainingHours <= 4 ? 'text-warning' : 'text-success'}`}>
                  {ownRemainingHours != null ? `${ownRemainingHours} h` : '—'}
                </p>
                <p className="text-[11px] text-charcoal/30 dark:text-white/30">remaining</p>
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 block mb-1">Start date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value, endDate: f.endDate || e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
              />
            </div>
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 block mb-1">End date</label>
              <input
                type="date"
                value={form.endDate}
                min={form.startDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
              />
            </div>
          </div>

          {/* Staffing limit warning — informational only, submit is never blocked */}
          {overStaffOffLimit && (
            <div className="rounded-xl bg-danger/8 border border-danger/20 px-4 py-3">
              <p className="text-xs font-semibold text-danger">Maximum number of staff already off</p>
              <p className="text-[11.5px] text-charcoal/60 mt-1 leading-[1.4]">
                {staffAlreadyOff} staff {staffAlreadyOff === 1 ? 'is' : 'are'} already off on at least one of these days (limit: {maxStaffOffCount}). You can still submit if this has been pre-cleared with your manager.
              </p>
            </div>
          )}

          {/* Days / hours preview for annual leave */}
          {form.leaveType === 'annual' && previewDays != null && previewDays > 0 && !ownBalance?.isZeroHours && (
            <p className="text-xs text-charcoal/50 dark:text-white/40 -mt-2">
              This request covers <span className="font-semibold text-charcoal dark:text-white">{fmtDays(previewDays)}</span> of your working days.
              {ownBalance && ownBalance.remaining != null && (
                <span className={(ownBalance.remaining - previewDays) < 0 ? ' text-danger font-medium' : ''}>
                  {(ownBalance.remaining - previewDays) < 0
                    ? ` You only have ${fmtDays(ownBalance.remaining)} remaining — this exceeds your balance.`
                    : ` You'll have ${fmtDays(ownBalance.remaining - previewDays)} left after this.`}
                </span>
              )}
            </p>
          )}
          {form.leaveType === 'annual' && previewDays != null && previewDays > 0 && ownBalance?.isZeroHours && ownAccrued != null && (() => {
            const avgD = ownAvgDaily ?? 7.6
            const reqHours = Math.round(previewDays * avgD * 10) / 10
            const remaining = ownRemainingHours ?? ownAccrued
            const paidHours = Math.min(reqHours, remaining)
            const unpaidHours = Math.round(Math.max(0, reqHours - remaining) * 10) / 10
            const afterHours = Math.round(Math.max(0, remaining - reqHours) * 10) / 10
            return (
              <div className={`-mt-2 rounded-xl px-4 py-3 text-xs ${unpaidHours > 0 ? 'bg-warning/8 border border-warning/20' : 'bg-charcoal/4 dark:bg-white/5'}`}>
                <p className="text-charcoal/60 dark:text-white/50">
                  This request covers <span className="font-semibold text-charcoal dark:text-white">{fmtDays(previewDays)}</span> (~{reqHours} h based on your average shift length).
                </p>
                {unpaidHours > 0 ? (
                  <p className="mt-1 font-medium text-warning">
                    ~{Math.round(paidHours * 10) / 10} h paid · ~{unpaidHours} h unpaid — you don't have enough accrued hours to cover this in full.
                  </p>
                ) : (
                  <p className="mt-1 text-charcoal/50 dark:text-white/40">
                    You'll have ~{afterHours} h remaining after this.
                  </p>
                )}
              </div>
            )
          })()}

          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 block mb-1">Reason (optional)</label>
            <textarea
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              rows={2}
              placeholder="e.g. Holiday, family event, appointment..."
              className="w-full px-4 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm resize-none focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
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
          <p className="text-sm text-charcoal/30 dark:text-white/30 italic py-4">No time-off requests for this day.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {dayDetailRequests.map(r => {
              const actionable = canActOn(r)
              const Row = actionable ? 'button' : 'div'
              return (
                <Row
                  key={r.id}
                  {...(actionable
                    ? { type: 'button', onClick: () => { setShowDayDetail(null); setEditing(r) } }
                    : {})}
                  className={`w-full text-left rounded-2xl border px-4 py-3 ${STATUS_COLOURS[r.status]} ${
                    actionable ? 'hover:brightness-[0.98] transition-[filter]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{r.staff?.name}</p>
                        <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${LEAVE_TYPE_COLOURS[r.leave_type] ?? LEAVE_TYPE_COLOURS.other}`}>
                          {leaveTypeLabel(r.leave_type)}
                        </span>
                      </div>
                      <p className="text-xs opacity-70 mt-0.5">
                        {format(parseISO(r.start_date), 'd MMM')} — {format(parseISO(r.end_date), 'd MMM')}
                      </p>
                      {r.reason && <p className="text-xs opacity-60 mt-0.5">{r.reason}</p>}
                      {actionable && (
                        <p className="text-[11px] opacity-60 mt-1 underline underline-offset-2">
                          Edit or remove
                        </p>
                      )}
                    </div>
                    <span className="text-[11px] tracking-wider uppercase font-semibold shrink-0">
                      {r.status}
                    </span>
                  </div>
                </Row>
              )
            })}
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
          onSaved={refreshDependents}
        />
      )}

      {/* Edit / withdraw an existing request */}
      {editing && (
        <EditRequestModal
          request={editing}
          isManager={isManager}
          actorId={session?.staffId}
          actorName={session?.staffName}
          venueId={venueId}
          onClose={() => setEditing(null)}
          onSaved={refreshDependents}
        />
      )}
    </div>
  )
}
