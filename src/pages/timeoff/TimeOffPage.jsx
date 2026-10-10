import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { format, addMonths, subMonths, isBefore, parseISO, startOfDay, isSameMonth } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { sendPush } from '../../lib/sendPush'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import { SkeletonList, PageSkeleton } from '../../components/ui/Skeleton'
import Modal from '../../components/ui/Modal'
import { countWorkingDaysInRequest } from '../../hooks/useLeaveBalance'
import { useZeroHoursAccrual, useTeamZeroHoursAccruals } from '../../hooks/useZeroHoursAccrual'
import { invalidateSummaryCache } from '../../hooks/useTodaySummary'
import { timeOffPermissions, isBlocking } from '../../lib/api/timeOff'
import { useAppSettings } from '../../hooks/useSettings'
import { leaveYearFor } from '../../lib/leaveYear'
import { hasHoursColumn, hoursInRange, requestHoursInRange, zeroHoursLeft } from '../../lib/api/holidayPay'
import CarryOverModal from './CarryOverModal'
import {
  requestableLeaveTypes,
  leaveTypeLabel, getRequestsForDay, fmtDays, maxStaffOffInRange, employmentLabel, isOnlyClosedDays,
} from './timeOffConstants'
import {
  useTimeOffRequests, useActiveStaff, useOwnProfile, useTeamLeaveBalances,
} from '../../hooks/useTimeOffData'
import CalendarView from './CalendarView'
import ManualLeaveModal from './ManualLeaveModal'
import EditRequestModal from './EditRequestModal'
import { CARD, TONE, PageHeader } from '../../components/temperature/TempPageParts'
import LoadError from '../../components/ui/LoadError'
import Avatar from '../../components/ui/Avatar'
import Button from '../../components/ui/Button'

const FIELD_LABEL = 'block text-body-sm font-semibold tracking-[0.08em] uppercase text-ink3 dark:text-white/45 mb-2'
const TEXT_FIELD  = 'w-full h-12 px-4 rounded-xl border border-line dark:border-white/10 bg-cream dark:bg-white/5 text-body-lg text-ink dark:text-white placeholder:text-ink4 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40 focus:bg-white dark:focus:bg-white/10 transition-colors'

const EMPTY_FORM = { startDate: '', endDate: '', reason: '', leaveType: 'annual', hours: '' }

/* ── Main page ─────────────────────────────────────────────────────────── */
export default function TimeOffPage() {
  const { venueSlug } = useVenue()
  const toast = useToast()
  const queryClient = useQueryClient()
  const { venueId }          = useVenue()
  const { session, isManager } = useSession()
  const { maxStaffOffEnabled, maxStaffOffCount, blockOverBalance, allowUnpaidLeave, closedDays, leaveYearStartMonth } = useAppSettings()
  const { requests, loading, error, reload } = useTimeOffRequests(venueId)
  const staff      = useActiveStaff(venueId)
  const ownProfile = useOwnProfile(session?.staffId)

  // The venue's holiday year (calendar year unless set otherwise in settings)
  const leaveYear = useMemo(() => leaveYearFor(new Date(), leaveYearStartMonth), [leaveYearStartMonth])
  const { balances: teamBalances, loading: balancesLoading, failed: balancesFailed, reloadBalances } = useTeamLeaveBalances(
    isManager ? staff : [],
    leaveYear
  )
  // Own balance goes through the same calculation as the manager's team list,
  // so both see this year's leave only and any custom allowance.
  const ownStaffList = useMemo(() => (ownProfile ? [ownProfile] : []), [ownProfile])
  const { balances: ownBalances, loading: ownBalanceLoading, failed: ownBalanceFailed, reloadBalances: reloadOwnBalance } =
    useTeamLeaveBalances(ownStaffList, leaveYear)

  // Zero-hours accrual — own (staff view)
  const { accrued: ownAccrued, avgDailyHours: ownAvgDaily } = useZeroHoursAccrual(
    ownProfile?.employment_type === 'zero_hours' ? session?.staffId : null,
    leaveYear
  )

  // Zero-hours accrual — team (manager view)
  const zeroHoursIds = useMemo(
    () => teamBalances.filter(b => b.isZeroHours).map(b => b.id),
    [teamBalances]
  )
  const { map: zeroHoursMap } = useTeamZeroHoursAccruals(zeroHoursIds, leaveYear)

  // Holiday is booked in hours once migration 148 has added the column
  const [hoursReady, setHoursReady] = useState(false)
  useEffect(() => { hasHoursColumn().then(setHoursReady) }, [])

  /**
   * Time off drives availability everywhere else in the app, so any write here
   * has to bust the caches those screens read from — otherwise a staff member
   * who just freed themselves up still shows as unavailable on the rota.
   */
  const refreshDependents = useCallback(() => {
    reload()
    reloadBalances()
    reloadOwnBalance()
    queryClient.invalidateQueries({ queryKey: ['availability'] })        // rota grid + AI/auto builder
    queryClient.invalidateQueries({ queryKey: ['calendar_staff_leave'] }) // manager calendar
    invalidateSummaryCache(venueId)                                       // dashboard pending-leave counts
  }, [reload, reloadBalances, reloadOwnBalance, queryClient, venueId])

  // Manual leave entry state
  const [manualEntry, setManualEntry] = useState(null) // null = closed; staff balance obj = open
  // Carry-over for one zero-hours person — their balance row
  const [adjusting, setAdjusting] = useState(null)

  // Request being edited / withdrawn — set from the calendar or "My Requests"
  const [editing, setEditing] = useState(null)

  // Own balance (staff view) — unknown while loading or if it failed, rather
  // than a full allowance with nothing used.
  const ownBalance = ownBalanceLoading || ownBalanceFailed ? null : (ownBalances[0] ?? null)

  // Zero-hours: a usual day is their average shift this holiday year
  const ownDayHours = ownAvgDaily ?? 7.6
  // Zero-hours balance in hours: earned + carried over − approved − awaiting
  // approval. Pending counts straight away, so it moves the moment they book.
  const ownHours = useMemo(() => {
    if (!ownBalance?.isZeroHours || ownAccrued == null) return null
    const wd       = ownProfile?.working_days
    const approved = hoursInRange(ownBalance.approvedRequests, wd, ownDayHours, leaveYear.from, leaveYear.to)
    const pending  = hoursInRange(ownBalance.pendingRequests, wd, ownDayHours, leaveYear.from, leaveYear.to)
    const left     = zeroHoursLeft({ accrued: ownAccrued, carriedOver: ownBalance.carriedOver, approved, pending })
    return { approved, pending, left }
  }, [ownBalance, ownAccrued, ownProfile?.working_days, ownDayHours, leaveYear])
  const ownRemainingHours = ownHours ? Math.max(0, ownHours.left) : (ownAccrued ?? null)

  const [month, setMonth]           = useState(new Date())
  const [showRequest, setShowRequest] = useState(false)
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()))
  const [form, setForm]             = useState(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)
  const [showTeamBalances, setShowTeamBalances] = useState(true)

  // Manager review state
  const [reviewing, setReviewing]   = useState(null)
  const [notes, setNotes]           = useState({})  // pending request id → manager note
  const [approveHours, setApproveHours] = useState({}) // pending request id → hours typed by the manager
  const noteFor = (id) => (notes[id] ?? '').trim()
  const clearNote = (id) => setNotes(n => { const next = { ...n }; delete next[id]; return next })

  const prevMonth = () => setMonth(m => subMonths(m, 1))
  const nextMonth = () => setMonth(m => addMonths(m, 1))
  const selectDay = (day) => { setSelectedDay(day); if (!isSameMonth(day, month)) setMonth(day) }

  // Days this form request would consume (for annual leave preview)
  const previewDays = useMemo(() => {
    if (form.leaveType !== 'annual' || !form.startDate || !form.endDate) return null
    // Reversed dates used to preview as "5 days" while submit refused them
    if (form.endDate < form.startDate) return null
    return countWorkingDaysInRequest(form.startDate, form.endDate, ownProfile?.working_days)
  }, [form.startDate, form.endDate, form.leaveType, ownProfile?.working_days])

  // Holiday hours for this request: what they typed, else their usual day ×
  // working days (zero-hours). Blank for salaried staff = their usual hours.
  const suggestedHours = previewDays != null && ownBalance?.isZeroHours
    ? Math.round(previewDays * ownDayHours * 10) / 10
    : null
  const typedHours = form.hours === '' ? null : parseFloat(form.hours)
  const formHours  = typedHours ?? suggestedHours

  // Zero-hours: hours this request would use, against what they have left
  const zeroHoursRequest = useMemo(() => {
    if (!ownBalance?.isZeroHours || formHours == null || ownHours == null) return null
    return { reqHours: formHours, remaining: Math.max(0, ownHours.left) }
  }, [ownBalance?.isZeroHours, formHours, ownHours])

  // When the venue blocks over-balance holiday: why this much annual leave is
  // too much for this staff member, or null. `credit` gives back the days and
  // hours of a request being edited, which already count against the balance.
  const overBalanceProblem = useCallback((days, hours, credit = { days: 0, hours: 0 }) => {
    // Managers can book over a balance — that's the override.
    if (!blockOverBalance || isManager || !ownBalance || days == null) return null
    const tail = 'Request unpaid leave for the rest, or ask your manager.'
    if (!ownBalance.isZeroHours) {
      if (ownBalance.remaining == null) return null
      const left = ownBalance.remaining + credit.days
      return days > left ? `You only have ${fmtDays(left)} of holiday left. ${tail}` : null
    }
    if (ownHours == null || hours == null) return null
    const left = Math.round((Math.max(0, ownHours.left) + credit.hours) * 10) / 10
    return hours > left ? `You only have ${left} h of holiday left. ${tail}` : null
  }, [blockOverBalance, isManager, ownBalance, ownHours])

  // Why this request can't be sent, if it can't. Checked as the form changes
  // so the reason shows before anyone presses submit.
  const requestProblem = useMemo(() => {
    if (!form.startDate || !form.endDate || form.endDate < form.startDate) return null
    if (isOnlyClosedDays(form.startDate, form.endDate, closedDays)) {
      return "We're closed on these days, so there's nothing to book off."
    }
    if (form.leaveType !== 'annual' || previewDays == null) return null
    if (previewDays === 0) {
      return "None of these days are your working days, so they don't use holiday. If that's wrong, ask your manager to check your working days."
    }
    if (typedHours != null && !(typedHours > 0 && typedHours <= 1000)) return 'Enter the holiday hours for this booking.'
    return overBalanceProblem(previewDays, formHours)
  }, [form.startDate, form.endDate, form.leaveType, closedDays, previewDays, typedHours, formHours, overBalanceProblem])

  // Same balance check when someone moves their own booking to new dates
  const editBalanceCheck = useMemo(() => {
    if (!editing || editing.staff_id !== session?.staffId) return null
    // Its own hours are already counted (approved or pending), so give them back
    const wd      = ownProfile?.working_days
    const counted = editing.leave_type === 'annual' && ['approved', 'pending'].includes(editing.status)
    const credit  = counted
      ? {
          days:  editing.status === 'approved' ? countWorkingDaysInRequest(editing.start_date, editing.end_date, wd) : 0,
          hours: requestHoursInRange(editing, wd, ownDayHours, leaveYear.from, leaveYear.to),
        }
      : { days: 0, hours: 0 }
    return (days, hours) => overBalanceProblem(days, hours, credit)
  }, [editing, session?.staffId, ownProfile?.working_days, ownDayHours, leaveYear, overBalanceProblem])

  const submitRequest = async () => {
    if (!form.startDate || !form.endDate) { toast('Please select start and end dates', 'error'); return }
    if (form.endDate < form.startDate)    { toast('End date must be after start date', 'error'); return }
    if (requestProblem)                   { toast(requestProblem, 'error'); return }
    if (!requestableLeaveTypes({ allowUnpaidLeave, isManager }).some(t => t.value === form.leaveType)) {
      toast("Unpaid leave can't be requested here — ask your manager", 'error')
      return
    }
    // Staff request leave ahead; leave already taken is recorded by a manager
    // with "+ add leave" on the team list.
    if (!isManager && form.startDate < format(new Date(), 'yyyy-MM-dd')) {
      toast('Leave can only be requested from today onwards — ask your manager to record past leave', 'error')
      return
    }
    setSaving(true)
    const { error: err } = await supabase.from('time_off_requests').insert({
      staff_id:   session?.staffId,
      start_date: form.startDate,
      end_date:   form.endDate,
      reason:     form.reason.trim() || null,
      leave_type: form.leaveType,
      venue_id:   venueId,
      ...(hoursReady && form.leaveType === 'annual' ? { hours: formHours ?? null } : {}),
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
    setForm(EMPTY_FORM)
    setShowRequest(false)
    refreshDependents()
  }

  // Approving is the decision to pay: the hours shown on the request (or
  // changed by the manager) are what the timesheet pays and the balance loses.
  const approve = async (id, hours) => {
    setReviewing(id)
    const req = requests.find(r => r.id === id)
    const { error: err } = await supabase.from('time_off_requests').update({
      status:       'approved',
      reviewed_by:  session?.staffId,
      reviewed_at:  new Date().toISOString(),
      manager_note: noteFor(id) || null,
      ...(hoursReady && req?.leave_type === 'annual' && hours != null ? { hours } : {}),
    }).eq('id', id)
    setReviewing(null)
    if (err) { toast(err.message, 'error'); return }
    clearNote(id)
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
      manager_note: noteFor(id) || null,
    }).eq('id', id)
    setReviewing(null)
    if (err) { toast(err.message, 'error'); return }
    const note = noteFor(id)
    clearNote(id)
    toast('Time off rejected')
    if (req?.staff_id) {
      sendPush({
        venueId,
        notificationType: 'time_off_decision',
        title: 'Time Off Rejected',
        body:  `Your time off request (${req.start_date} – ${req.end_date}) was not approved.${note ? ' Note: ' + note : ''}`,
        url:   '/time-off',
        staffIds: [req.staff_id],
      })
    }
    refreshDependents()
  }

  // Hours to pay on a pending request: what was booked, else (zero-hours)
  // their working days × average shift
  const suggestedApprovalHours = (r) => {
    if (r.hours != null) return Number(r.hours)
    const accrual = zeroHoursMap[r.staff_id]
    if (r.leave_type !== 'annual' || r.staff?.employment_type !== 'zero_hours' || !accrual) return null
    return Math.round(countWorkingDaysInRequest(r.start_date, r.end_date, r.staff?.working_days) * accrual.avgDailyHours * 10) / 10
  }

  const myRequests      = useMemo(() => requests.filter(r => r.staff_id === session?.staffId), [requests, session?.staffId])
  const pendingRequests = useMemo(() => requests.filter(r => r.status === 'pending'), [requests])
  // Withdrawn and rejected requests no longer hold anyone off the rota, so they
  // stay off the calendar — the staff member still sees them in "My Requests".
  const bookedRequests  = useMemo(() => requests.filter(r => isBlocking(r.status)), [requests])
  const dayRequests = useMemo(() => getRequestsForDay(bookedRequests, selectedDay), [bookedRequests, selectedDay])

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

  if (loading && requests.length === 0) return <PageSkeleton />

  const selectedIsFuture = selectedDay && !isBefore(selectedDay, startOfDay(new Date()))

  return (
    <div className="flex flex-col gap-2.5 max-w-3xl">
      <PageHeader
        title="Time off"
        subtitle="Requests, approvals and balances"
        compact
        backTo={isManager ? `/v/${venueSlug}/team` : null}
        backLabel="Team"
        action={(
          <Button
            size="sm"
            onClick={() => setShowRequest(true)}
            className="self-start mt-1"
          >
            Request
          </Button>
        )}
      />

      {ownBalance && (
        <OwnBalanceCard
          balance={ownBalance}
          year={leaveYear.label}
          accrued={ownAccrued}
          hours={ownHours}
        />
      )}

      {/* Manager: pending requests */}
      {isManager && pendingRequests.length > 0 && (
        <div className={`${CARD} overflow-hidden`}>
          <p className="px-3.5 sm:px-3.5 py-2.5 bg-warnBg dark:bg-warn/20 text-caption font-semibold tracking-[0.08em] uppercase text-warn dark:text-warnDark">
            {pendingRequests.length} pending request{pendingRequests.length !== 1 ? 's' : ''}
          </p>
          <div className="divide-y divide-line dark:divide-white/10">
            {pendingRequests.map(r => (
              <PendingRequest
                key={r.id}
                request={r}
                balance={teamBalances.find(b => b.id === r.staff_id)}
                note={notes[r.id] ?? ''}
                onNote={(value) => setNotes(n => ({ ...n, [r.id]: value }))}
                hoursReady={hoursReady}
                suggestedHours={suggestedApprovalHours(r)}
                hoursText={approveHours[r.id]}
                onHours={(value) => setApproveHours(h => ({ ...h, [r.id]: value }))}
                busy={reviewing === r.id}
                onApprove={(hours) => approve(r.id, hours)}
                onReject={() => reject(r.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Calendar */}
      {error ? (
        <p className={`${CARD} text-center text-body-sm text-bad py-10`}>{error}</p>
      ) : (
        <CalendarView
          month={month}
          requests={bookedRequests}
          selected={selectedDay}
          onSelect={selectDay}
          onPrev={prevMonth}
          onNext={nextMonth}
        />
      )}

      {/* Who's off on the selected day */}
      {selectedDay && (
        <div className={`${CARD} overflow-hidden`}>
          <div className="flex items-center justify-between gap-2 px-3.5 sm:px-3.5 py-2.5 bg-cream dark:bg-white/5 border-b border-line dark:border-white/10">
            <p className="text-body font-semibold text-ink dark:text-white">{format(selectedDay, 'EEE d MMM')}</p>
            <span className="font-mono text-body-sm text-ink3 dark:text-white/45">{dayRequests.length} off</span>
          </div>
          {dayRequests.length === 0 ? (
            <p className="px-3.5 sm:px-3.5 py-2.5 text-body-sm text-ink3 dark:text-white/45">Nobody is off.</p>
          ) : (
            <div className="divide-y divide-line dark:divide-white/10">
              {dayRequests.map(r => {
                const actionable = canActOn(r)
                const Row = actionable ? 'button' : 'div'
                return (
                  <Row
                    key={r.id}
                    {...(actionable ? { type: 'button', onClick: () => setEditing(r) } : {})}
                    className={`w-full flex items-center gap-2.5 px-3.5 sm:px-3.5 py-2.5 text-left ${actionable ? 'hover:bg-cream/60 dark:hover:bg-white/5' : ''}`}
                  >
                    <Avatar name={r.staff?.name} id={r.staff_id} colour={r.staff?.colour} photoUrl={r.staff?.photo_url} size="md" decorative />
                    <span className="flex-1 min-w-0 text-body truncate">
                      <span className="font-semibold text-ink dark:text-white">{r.staff?.name ?? 'Someone'}</span>
                      <span className="text-ink3 dark:text-white/45"> · {leaveName(r.leave_type)}</span>
                    </span>
                    <StatusPill status={r.status} />
                  </Row>
                )
              })}
            </div>
          )}
          {selectedIsFuture && (
            <div className="px-3.5 sm:px-3.5 py-2.5 border-t border-line dark:border-white/10">
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  const dateStr = format(selectedDay, 'yyyy-MM-dd')
                  setForm(f => ({ ...f, startDate: dateStr, endDate: dateStr, hours: '' }))
                  setShowRequest(true)
                }}
              >
                + Request this day off
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Manager: team annual leave */}
      {isManager && (
        <div className={`${CARD} overflow-hidden`}>
          <button
            type="button"
            onClick={() => setShowTeamBalances(v => !v)}
            aria-expanded={showTeamBalances}
            className="w-full flex items-center justify-between px-3.5 sm:px-3.5 py-2.5 text-left"
          >
            <span className="text-caption font-semibold tracking-[0.08em] uppercase text-ink3 dark:text-white/45">Team annual leave · {leaveYear.label}</span>
            <svg className={`w-5 h-5 text-ink3 dark:text-white/45 transition-transform ${showTeamBalances ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {showTeamBalances && (
            <div className="border-t border-line dark:border-white/10">
              {balancesLoading ? (
                <SkeletonList rows={3} />
              ) : balancesFailed ? (
                <LoadError what="leave balances" onRetry={reloadBalances} />
              ) : teamBalances.length === 0 ? (
                <p className="text-body-sm text-ink3 dark:text-white/45 px-3.5 sm:px-3.5 py-2.5">No active staff.</p>
              ) : (
                <div className="divide-y divide-line dark:divide-white/10">
                  {teamBalances.map(b => (
                    <TeamBalanceRow
                      key={b.id}
                      balance={b}
                      accrual={b.isZeroHours ? zeroHoursMap[b.id] : undefined}
                      leaveYear={leaveYear}
                      onLogPast={() => setManualEntry(b)}
                      onAdjust={() => setAdjusting(b)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* My requests */}
      {myRequests.length > 0 && (
        <>
          <p className="px-1 -mb-1 text-caption font-semibold tracking-[0.08em] uppercase text-ink3 dark:text-white/45">My requests</p>
          <div className={`${CARD} divide-y divide-line dark:divide-white/10 overflow-hidden`}>
            {myRequests.map(r => {
              const actionable = canActOn(r)
              const Row = actionable ? 'button' : 'div'
              return (
                <Row
                  key={r.id}
                  {...(actionable ? { type: 'button', onClick: () => setEditing(r) } : {})}
                  className={`w-full block px-3.5 sm:px-3.5 py-2 text-left ${actionable ? 'hover:bg-cream/60 dark:hover:bg-white/5' : ''}`}
                >
                  <span className="flex items-start justify-between gap-2.5">
                    <span className="min-w-0">
                      <span className="block text-body-sm font-semibold text-ink dark:text-white">{leaveName(r.leave_type)}</span>
                      <span className="block text-body-sm text-ink3 dark:text-white/45 mt-0.5">{dateRange(r)}</span>
                    </span>
                    <StatusPill status={r.status} />
                  </span>
                  {r.reason && <span className="block text-body-sm text-ink2 dark:text-white/70 mt-1.5">{r.reason}</span>}
                  {r.manager_note && <span className="block text-body-sm text-ink3 dark:text-white/50 mt-1">Manager: {r.manager_note}</span>}
                  {actionable && <span className="block text-body-sm font-semibold text-brand dark:text-white mt-1.5">Edit or withdraw</span>}
                </Row>
              )
            })}
          </div>
        </>
      )}

      {/* Request modal */}
      <Modal open={showRequest} onClose={() => setShowRequest(false)} title="Request time off">
        <div className="flex flex-col gap-4">
          <div>
            <span className={FIELD_LABEL}>Leave type</span>
            <div className="flex gap-2 flex-wrap">
              {requestableLeaveTypes({ allowUnpaidLeave, isManager }).map(t => (
                <button
                  key={t.value}
                  type="button"
                  aria-pressed={form.leaveType === t.value}
                  onClick={() => setForm(f => ({ ...f, leaveType: t.value }))}
                  className={[
                    'h-8 px-3.5 rounded-full border text-body-sm transition-colors',
                    form.leaveType === t.value
                      ? 'bg-brand-tint border-brand/40 text-brand font-semibold dark:bg-white/10 dark:text-white dark:border-white/30'
                      : 'bg-white dark:bg-paperDark border-line dark:border-white/10 text-ink2 dark:text-white/75 hover:border-ink4',
                  ].join(' ')}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Balance for annual leave */}
          {form.leaveType === 'annual' && ownBalance && !ownBalance.isZeroHours && ownBalance.entitlement != null && (
            <div className="rounded-xl bg-cream dark:bg-white/5 px-3.5 py-2.5 flex items-center justify-between">
              <div>
                <p className="text-body-sm font-semibold text-ink dark:text-white">{leaveYear.label} annual leave</p>
                <p className="text-body-sm text-ink3 dark:text-white/45 mt-0.5">{ownBalance.used} of {ownBalance.entitlement} days used</p>
              </div>
              <p className={`font-mono text-body font-semibold ${ownBalance.remaining === 0 ? 'text-bad' : ownBalance.remaining <= 5 ? 'text-warn' : 'text-good'}`}>
                {fmtDays(ownBalance.remaining)} left
              </p>
            </div>
          )}
          {form.leaveType === 'annual' && ownBalance?.isZeroHours && (
            <div className="rounded-xl bg-cream dark:bg-white/5 px-3.5 py-2.5 flex items-center justify-between">
              <div>
                <p className="text-body-sm font-semibold text-ink dark:text-white">{leaveYear.label} holiday accrual</p>
                <p className="text-body-sm text-ink3 dark:text-white/45 mt-0.5">
                  {ownAccrued != null ? `${ownAccrued} h earned (12.07% of hours worked)` : 'Calculating…'}
                  {ownHours && (ownHours.approved + ownHours.pending) > 0 ? ` · ${Math.round((ownHours.approved + ownHours.pending) * 10) / 10} h booked` : ''}
                </p>
              </div>
              <p className={`font-mono text-body font-semibold ${ownRemainingHours === 0 ? 'text-bad' : ownRemainingHours != null && ownRemainingHours <= 4 ? 'text-warn' : 'text-good'}`}>
                {ownRemainingHours != null ? `${ownRemainingHours} h` : '—'}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <label>
              <span className={FIELD_LABEL}>Start date</span>
              <input
                type="date"
                value={form.startDate}
                min={isManager ? undefined : format(new Date(), 'yyyy-MM-dd')}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value, endDate: f.endDate || e.target.value, hours: '' }))}
                className={TEXT_FIELD}
              />
            </label>
            <label>
              <span className={FIELD_LABEL}>End date</span>
              <input
                type="date"
                value={form.endDate}
                min={form.startDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value, hours: '' }))}
                className={TEXT_FIELD}
              />
            </label>
          </div>

          {form.startDate && form.endDate && form.endDate < form.startDate && (
            <p className="text-body-sm text-bad dark:text-badDark -mt-1">End date is before the start date.</p>
          )}

          {/* Holiday hours — what this booking uses and gets paid */}
          {hoursReady && form.leaveType === 'annual' && previewDays > 0 && (
            <label className="flex items-center gap-2.5">
              <span className="flex-1">
                <span className="block text-body-sm font-semibold text-ink dark:text-white">Holiday hours</span>
                <span className="block text-body-sm text-ink3 dark:text-white/45">
                  {suggestedHours != null
                    ? `${fmtDays(previewDays)} × ${ownDayHours} h (your average shift) — change it if you need to`
                    : 'Leave blank to use your usual hours'}
                </span>
              </span>
              <input
                type="number" inputMode="decimal" min="0" step="0.25"
                value={form.hours === '' ? (suggestedHours ?? '') : form.hours}
                onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
                aria-label="Holiday hours"
                className="w-24 h-12 px-3 rounded-xl border border-line dark:border-white/10 bg-cream dark:bg-white/5 text-body-lg text-right text-ink dark:text-white"
              />
              <span className="text-body-sm text-ink3 dark:text-white/45">h</span>
            </label>
          )}

          {/* Staffing limit warning — informational only, submit is never blocked */}
          {overStaffOffLimit && (
            <div className="rounded-xl bg-badBg dark:bg-bad/20 px-3.5 py-2.5">
              <p className="text-body-sm font-semibold text-bad dark:text-badDark">Maximum number of staff already off</p>
              <p className="text-body-sm text-ink2 dark:text-white/70 mt-1">
                {staffAlreadyOff} staff {staffAlreadyOff === 1 ? 'is' : 'are'} already off on at least one of these days (limit: {maxStaffOffCount}). You can still submit if this has been pre-cleared with your manager.
              </p>
            </div>
          )}

          {/* Days / hours preview for annual leave */}
          {form.leaveType === 'annual' && previewDays != null && previewDays > 0 && !ownBalance?.isZeroHours && (
            <p className="text-body-sm text-ink2 dark:text-white/70 -mt-2">
              This request covers <span className="font-semibold text-ink dark:text-white">{fmtDays(previewDays)}</span> of your working days.
              {ownBalance && ownBalance.remaining != null && (
                <span className={(ownBalance.remaining - previewDays) < 0 ? ' text-bad font-semibold' : ''}>
                  {(ownBalance.remaining - previewDays) < 0
                    ? ` You only have ${fmtDays(ownBalance.remaining)} remaining — this exceeds your balance.`
                    : ` You'll have ${fmtDays(ownBalance.remaining - previewDays)} left after this.`}
                </span>
              )}
            </p>
          )}
          {form.leaveType === 'annual' && previewDays != null && previewDays > 0 && zeroHoursRequest && (() => {
            const { reqHours, remaining } = zeroHoursRequest
            const paidHours = Math.min(reqHours, remaining)
            const unpaidHours = Math.round(Math.max(0, reqHours - remaining) * 10) / 10
            const afterHours = Math.round(Math.max(0, remaining - reqHours) * 10) / 10
            return (
              <div className={`-mt-2 rounded-xl px-3.5 py-2.5 text-body-sm ${unpaidHours > 0 ? 'bg-warnBg dark:bg-warn/20' : 'bg-cream dark:bg-white/5'}`}>
                <p className="text-ink2 dark:text-white/70">
                  This request covers <span className="font-semibold text-ink dark:text-white">{fmtDays(previewDays)}</span> and uses <span className="font-semibold text-ink dark:text-white">{reqHours} h</span> of holiday.
                </p>
                {unpaidHours > 0 ? (
                  <p className="mt-1 font-semibold text-warn dark:text-warnDark">
                    {Math.round(paidHours * 10) / 10} h paid · {unpaidHours} h unpaid — you don't have enough holiday left to cover this in full.
                  </p>
                ) : (
                  <p className="mt-1 text-ink3 dark:text-white/50">You'll have {afterHours} h left after this.</p>
                )}
              </div>
            )
          })()}

          <label>
            <span className={FIELD_LABEL}>Reason <span className="normal-case tracking-normal font-normal">(optional)</span></span>
            <textarea
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              rows={2}
              placeholder="e.g. Holiday, family event, appointment"
              className="w-full px-3.5 py-2.5 rounded-xl border border-line dark:border-white/10 bg-cream dark:bg-white/5 text-body-sm text-ink dark:text-white placeholder:text-ink4 dark:placeholder:text-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40"
            />
          </label>

          {requestProblem && (
            <p role="alert" className="rounded-xl bg-badBg dark:bg-bad/20 px-3.5 py-2.5 text-body-sm font-semibold text-bad dark:text-badDark">
              {requestProblem}
            </p>
          )}

          <Button
            fullWidth
            loading={saving}
            onClick={submitRequest}
            disabled={saving || !form.startDate || !form.endDate || !!requestProblem}
          >
            {saving ? 'Submitting…' : 'Submit request'}
          </Button>
        </div>
      </Modal>

      {/* Manual leave entry modal */}
      {manualEntry && (
        <ManualLeaveModal
          staff={manualEntry}
          hoursReady={hoursReady}
          dayHours={zeroHoursMap[manualEntry.id]?.avgDailyHours ?? null}
          venueId={venueId}
          managerId={session?.staffId}
          onClose={() => setManualEntry(null)}
          onSaved={refreshDependents}
        />
      )}

      {/* Carry-over */}
      {adjusting && (
        <CarryOverModal
          balance={adjusting}
          leaveYear={leaveYear}
          available={hoursReady}
          venueId={venueId}
          onClose={() => setAdjusting(null)}
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
          closedDays={closedDays}
          allowUnpaidLeave={allowUnpaidLeave}
          checkBalance={editBalanceCheck}
          hoursReady={hoursReady}
          dayHours={editing.staff_id === session?.staffId
            ? (ownBalance?.isZeroHours ? ownDayHours : null)
            : (zeroHoursMap[editing.staff_id]?.avgDailyHours ?? null)}
          onClose={() => setEditing(null)}
          onSaved={refreshDependents}
        />
      )}
    </div>
  )
}

// "Unpaid Leave" → "Unpaid leave" for lists (push messages keep the stored label)
function leaveName(type) {
  return leaveTypeLabel(type).replace(/ Leave$/, ' leave')
}

/* ── Pieces ───────────────────────────────────────────────────────────────── */
const STATUS_PILL = {
  pending:   { label: 'Pending',   cls: TONE.explained },
  approved:  { label: 'Approved',  cls: TONE.ok },
  rejected:  { label: 'Rejected',  cls: TONE.bad },
  cancelled: { label: 'Withdrawn', cls: 'bg-line2 text-ink3 dark:bg-white/10 dark:text-white/50' },
}

function StatusPill({ status }) {
  const pill = STATUS_PILL[status] ?? STATUS_PILL.pending
  return <span className={`shrink-0 h-7 px-3.5 rounded-full inline-flex items-center text-body-sm font-semibold ${pill.cls}`}>{pill.label}</span>
}

// "12 Dec 2026" for one day, "12–14 Dec 2026" within a month, otherwise "30 Dec – 2 Jan 2027"
function dateRange(r) {
  const start = parseISO(r.start_date)
  const end   = parseISO(r.end_date)
  if (r.start_date === r.end_date) return format(start, 'd MMM yyyy')
  if (format(start, 'MMM yyyy') === format(end, 'MMM yyyy')) return `${format(start, 'd')}–${format(end, 'd MMM yyyy')}`
  return `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}`
}

// hours: { approved, pending, left } for zero-hours staff
function OwnBalanceCard({ balance, year, accrued, hours }) {
  if (balance.isZeroHours) {
    const left = hours ? Math.max(0, hours.left) : null
    return (
      <div className={`${CARD} px-3.5 sm:px-3.5 py-2.5`}>
        <div className="flex items-baseline justify-between gap-2.5 flex-wrap">
          <p className="flex items-baseline gap-2">
            <span className={`font-mono text-title leading-none font-semibold ${left === 0 ? 'text-bad' : 'text-good dark:text-goodDark'}`}>{left ?? '—'}</span>
            <span className="text-body font-semibold text-ink dark:text-white">hrs left</span>
          </p>
          <p className="text-body-sm text-ink3 dark:text-white/45">{year} holiday</p>
        </div>
        <p className="text-body-sm text-ink3 dark:text-white/45 mt-1.5">
          {accrued != null ? `${accrued} h earned` : 'Calculating…'}
          {balance.carriedOver > 0 && ` + ${balance.carriedOver} h carried over`}
          {hours?.approved > 0 && ` − ${hours.approved} h booked`}
          {hours?.pending > 0 && ` − ${hours.pending} h awaiting approval`}
        </p>
      </div>
    )
  }
  if (balance.entitlement == null) return null
  const pct  = balance.entitlement ? Math.min(100, (balance.used / balance.entitlement) * 100) : 0
  const tone = balance.remaining === 0 ? 'text-bad' : balance.remaining <= 5 ? 'text-warn' : 'text-good dark:text-goodDark'
  return (
    <div className={`${CARD} px-3.5 sm:px-3.5 py-2.5`}>
      <div className="flex items-baseline justify-between gap-2.5 flex-wrap">
        <p className="flex items-baseline gap-2">
          <span className={`font-mono text-title leading-none font-semibold ${tone}`}>{balance.remaining}</span>
          <span className="text-body font-semibold text-ink dark:text-white">{balance.remaining === 1 ? 'day' : 'days'} left</span>
        </p>
        <p className="text-body-sm text-ink3 dark:text-white/45">{balance.used} of {balance.entitlement} used · {year} annual leave</p>
      </div>
      <div className="mt-2 h-2 rounded-full bg-line2 dark:bg-white/10 overflow-hidden">
        <div className="h-full rounded-full bg-good" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function PendingRequest({ request: r, balance, note, onNote, hoursReady, suggestedHours, hoursText, onHours, busy, onApprove, onReject }) {
  // The hours approving will pay: the manager's edit, else what was booked
  const showHours = hoursReady && r.leave_type === 'annual'
  const hours = hoursText !== undefined && hoursText !== '' ? parseFloat(hoursText) : suggestedHours
  const hoursInvalid = showHours && hoursText !== undefined && hoursText !== '' && !(hours > 0 && hours <= 1000)
  const daysRequested = r.leave_type === 'annual'
    ? countWorkingDaysInRequest(r.start_date, r.end_date, r.staff?.working_days)
    : null
  const afterApproval = r.leave_type === 'annual' && balance && !balance.isZeroHours && balance.entitlement != null && daysRequested != null
    ? balance.remaining - daysRequested
    : null

  return (
    <div className="px-3.5 sm:px-3.5 py-2.5 flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <p className="text-body-lg font-semibold text-ink dark:text-white">{r.staff?.name ?? 'Someone'}</p>
          <p className="text-body-sm text-ink3 dark:text-white/45 mt-0.5">
            {leaveName(r.leave_type)} · <span className="font-mono text-ink2 dark:text-white/70">{dateRange(r)}</span>
            {daysRequested != null && ` · ${fmtDays(daysRequested)}`}
          </p>
          {/* Still worth deciding — approving records leave that was taken —
              but it shouldn't look like an upcoming request. */}
          {r.end_date < format(new Date(), 'yyyy-MM-dd') && (
            <p className="text-body-sm font-semibold text-warn dark:text-warnDark mt-1">
              These dates have passed — approve to record the leave as taken, or reject.
            </p>
          )}
          {r.reason && <p className="text-body-sm text-ink2 dark:text-white/70 mt-1">“{r.reason}”</p>}
          {afterApproval != null && (
            <p className={`text-body-sm mt-1 ${afterApproval < 0 ? 'text-bad font-semibold' : 'text-ink3 dark:text-white/45'}`}>
              {afterApproval < 0
                ? `Exceeds their entitlement by ${fmtDays(Math.abs(afterApproval))}`
                : `${fmtDays(afterApproval)} left after approval (currently ${fmtDays(balance.remaining)})`}
            </p>
          )}
        </div>
        <StatusPill status="pending" />
      </div>
      <input
        type="text"
        value={note}
        onChange={e => onNote(e.target.value)}
        placeholder="Note (optional)"
        aria-label={`Note for ${r.staff?.name ?? 'this request'}`}
        className={TEXT_FIELD}
      />
      {showHours && (
        <label className="flex items-center gap-2.5">
          <span className="flex-1 text-body-sm text-ink2 dark:text-white/70">
            Holiday hours to pay
            {suggestedHours == null && <span className="block text-ink3 dark:text-white/45">Leave blank to pay their usual hours</span>}
          </span>
          <input
            type="number" inputMode="decimal" min="0" step="0.25"
            value={hoursText ?? (suggestedHours ?? '')}
            onChange={e => onHours(e.target.value)}
            aria-label={`Holiday hours to pay ${r.staff?.name ?? ''}`}
            className="w-24 h-10 px-3 rounded-xl border border-line dark:border-white/10 bg-cream dark:bg-white/5 text-body text-right text-ink dark:text-white"
          />
          <span className="text-body-sm text-ink3 dark:text-white/45">h</span>
        </label>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        <Button
          variant="secondary"
          size="sm"
          onClick={onReject}
          disabled={busy}
        >
          Reject
        </Button>
        <Button
          size="sm"
          onClick={() => onApprove(showHours ? hours ?? null : null)}
          disabled={busy || hoursInvalid}
        >
          {showHours && hours ? `Approve · pay ${hours} h` : 'Approve'}
        </Button>
      </div>
    </div>
  )
}

function TeamBalanceRow({ balance: b, accrual, leaveYear, onLogPast, onAdjust }) {
  // Zero-hours: earned this holiday year plus carry-over, less approved and
  // awaiting-approval holiday hours
  const pendingHours = b.isZeroHours && accrual
    ? hoursInRange(b.pendingRequests, b.working_days, accrual.avgDailyHours, leaveYear.from, leaveYear.to)
    : 0
  const hoursLeft = b.isZeroHours && accrual
    ? Math.max(0, zeroHoursLeft({
        accrued:     accrual.accrued,
        carriedOver: b.carriedOver,
        approved:    hoursInRange(b.approvedRequests, b.working_days, accrual.avgDailyHours, leaveYear.from, leaveYear.to),
        pending:     pendingHours,
      }))
    : null
  const kind = employmentLabel(b.employment_type)
  const subline = b.isZeroHours
    ? [
        kind ?? 'Zero hours', 'accrues hourly',
        b.carriedOver > 0 && `+${b.carriedOver} h carried over`,
        pendingHours > 0 && `${pendingHours} h awaiting approval`,
      ].filter(Boolean).join(' · ')
    : [kind, b.entitlement != null && `${b.entitlement} days`].filter(Boolean).join(' · ')
  const tone = b.remaining === 0 ? 'text-bad' : b.remaining != null && b.remaining <= 5 ? 'text-warn' : 'text-good dark:text-goodDark'

  return (
    <div className="flex items-center gap-2.5 px-3.5 sm:px-3.5 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-body font-semibold text-ink dark:text-white truncate">{b.name}</p>
        {subline && <p className="text-body-sm text-ink3 dark:text-white/45 mt-0.5">{subline}</p>}
      </div>
      <div className="shrink-0 text-right">
        {b.isZeroHours ? (
          <>
            <p className={`font-mono text-body font-semibold ${hoursLeft === 0 ? 'text-bad' : 'text-ink dark:text-white'}`}>{hoursLeft != null ? `${hoursLeft} hrs left` : '…'}</p>
            <p className="text-body-sm text-ink3 dark:text-white/45">{accrual ? `of ${accrual.accrued} accrued` : 'accrued'}</p>
          </>
        ) : b.entitlement != null ? (
          <>
            <p className={`font-mono text-body font-semibold ${tone}`}>{fmtDays(b.remaining)}</p>
            <p className="text-body-sm text-ink3 dark:text-white/45">{b.used}/{b.entitlement} used</p>
          </>
        ) : (
          <p className="text-body-sm text-ink3 dark:text-white/45">No entitlement</p>
        )}
      </div>
      <Button
        variant="secondary"
        size="sm"
        iconOnly
        onClick={onLogPast}
        aria-label={`Add leave for ${b.name}`}
        title="Add leave"
        className="shrink-0"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
      </Button>
      {b.isZeroHours && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onAdjust}
          aria-label={`Holiday carried over for ${b.name}`}
          className="shrink-0"
        >
          Carry over
        </Button>
      )}
    </div>
  )
}
