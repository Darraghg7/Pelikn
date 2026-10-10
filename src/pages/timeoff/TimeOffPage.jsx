import React, { useState, useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { format, addMonths, subMonths, isBefore, parseISO, startOfDay, isSameMonth } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { sendPush } from '../../lib/sendPush'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import { SkeletonList, PageSkeleton } from '../../components/ui/Skeleton'
import Modal from '../../components/ui/Modal'
import { calculateEntitlementDays, countWorkingDaysInRequest } from '../../hooks/useLeaveBalance'
import { useHolidayBalances, useRotaHours, usePaidOut, HOLIDAY_BALANCES_KEY } from '../../hooks/useHolidayBalances'
import { suggestedPaidHours } from '../../lib/holiday'
import { invalidateSummaryCache } from '../../hooks/useTodaySummary'
import { timeOffPermissions, isBlocking } from '../../lib/api/timeOff'
import { useAppSettings } from '../../hooks/useSettings'
import {
  LEAVE_TYPES,
  leaveTypeLabel, getRequestsForDay, fmtDays, maxStaffOffInRange,
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

const NO_STAFF = []

const FIELD_LABEL = 'block text-body-sm font-semibold tracking-[0.08em] uppercase text-ink3 dark:text-white/45 mb-2'
const TEXT_FIELD  = 'w-full h-12 px-4 rounded-xl border border-line dark:border-white/10 bg-cream dark:bg-white/5 text-body-lg text-ink dark:text-white placeholder:text-ink4 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40 focus:bg-white dark:focus:bg-white/10 transition-colors'

/* ── Main page ─────────────────────────────────────────────────────────── */
export default function TimeOffPage() {
  const { venueSlug } = useVenue()
  const toast = useToast()
  const queryClient = useQueryClient()
  const { venueId }          = useVenue()
  const { session, isManager } = useSession()
  const { maxStaffOffEnabled, maxStaffOffCount } = useAppSettings()
  const { requests, loading, error, reload } = useTimeOffRequests(venueId)
  const staff      = useActiveStaff(venueId)
  const ownProfile = useOwnProfile(session?.staffId)

  const currentYear = new Date().getFullYear()
  const { balances: teamBalancesRaw, loading: balancesLoading, failed: balancesFailed, reloadBalances } = useTeamLeaveBalances(
    isManager ? staff : [],
    currentYear
  )

  // Zero-hours holiday is in hours, not days — see lib/holiday.js.
  const { byId: teamHoliday } = useHolidayBalances(isManager ? staff : NO_STAFF, currentYear)
  const ownList = useMemo(() => (ownProfile ? [ownProfile] : NO_STAFF), [ownProfile])
  const { byId: ownHolidayById } = useHolidayBalances(ownList, currentYear)
  const ownHoliday = ownHolidayById[session?.staffId] ?? null

  // Holiday already paid outside a dated booking (migration 150). Zero-hours
  // balances include it already; days-based ones take it off here.
  const paidOutIds = useMemo(
    () => [session?.staffId, ...(isManager ? staff.map(s => s.id) : [])],
    [session?.staffId, isManager, staff],
  )
  const paidOut = usePaidOut(paidOutIds, currentYear)
  const teamBalances = useMemo(() => teamBalancesRaw.map(b => {
    const days = paidOut[b.id]?.days ?? 0
    if (b.isZeroHours || !days || b.entitlement == null) return { ...b, paidOutDays: days }
    const used = b.used + days
    return { ...b, used, paidOutDays: days, remaining: Math.max(0, b.entitlement - used) }
  }), [teamBalancesRaw, paidOut])

  /**
   * Time off drives availability everywhere else in the app, so any write here
   * has to bust the caches those screens read from — otherwise a staff member
   * who just freed themselves up still shows as unavailable on the rota.
   */
  const refreshDependents = useCallback(() => {
    reload()
    reloadBalances()
    queryClient.invalidateQueries({ queryKey: [HOLIDAY_BALANCES_KEY] })
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
    // This year's leave only — this used to count every approved request the
    // person had ever made, so last year's holiday came off this year's balance.
    const myApproved  = requests.filter(r =>
      r.staff_id === session?.staffId && r.status === 'approved' && r.leave_type === 'annual' &&
      r.start_date?.startsWith(String(currentYear))
    )
    const used = myApproved.reduce((sum, r) =>
      sum + countWorkingDaysInRequest(r.start_date, r.end_date, ownProfile.working_days), 0) +
      (ownProfile.employment_type === 'zero_hours' ? 0 : paidOut[session?.staffId]?.days ?? 0)
    const entitlement = calculated
    const remaining   = entitlement != null ? Math.max(0, entitlement - used) : null
    return { entitlement, used, remaining, isZeroHours: ownProfile.employment_type === 'zero_hours' }
  }, [ownProfile, requests, session?.staffId, currentYear, paidOut])

  const [month, setMonth]           = useState(new Date())
  const [showRequest, setShowRequest] = useState(false)
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()))
  // No leave type picked up front: defaulting to annual is how "can't work"
  // ended up recorded as holiday.
  const [form, setForm]             = useState({ startDate: '', endDate: '', reason: '', leaveType: '' })
  const [saving, setSaving]         = useState(false)
  const [showTeamBalances, setShowTeamBalances] = useState(true)

  // Manager review state
  const [reviewing, setReviewing]   = useState(null)
  const [notes, setNotes]           = useState({})  // pending request id → manager note
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

  const submitRequest = async () => {
    if (!form.leaveType) { toast('Choose what kind of time off this is', 'error'); return }
    if (!form.startDate || !form.endDate) { toast('Please select start and end dates', 'error'); return }
    if (form.endDate < form.startDate)    { toast('End date must be after start date', 'error'); return }
    // Staff request leave ahead; leave already taken is recorded by a manager
    // with "+ log past leave" on the team list.
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
    setForm({ startDate: '', endDate: '', reason: '', leaveType: '' })
    setShowRequest(false)
    refreshDependents()
  }

  const approve = async (id, paidHours = null) => {
    setReviewing(id)
    const req = requests.find(r => r.id === id)
    const patch = {
      status:       'approved',
      reviewed_by:  session?.staffId,
      reviewed_at:  new Date().toISOString(),
      manager_note: noteFor(id) || null,
    }
    if (paidHours != null) patch.paid_hours = paidHours
    let { error: err } = await supabase.from('time_off_requests').update(patch).eq('id', id)
    // Before migration 149 there is no paid_hours column: approve without it
    // rather than not at all. The balance then estimates, as it always did.
    if (err && paidHours != null && (err.code === 'PGRST204' || err.code === '42703')) {
      delete patch.paid_hours
      ;({ error: err } = await supabase.from('time_off_requests').update(patch).eq('id', id))
    }
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

  const myRequests      = useMemo(() => requests.filter(r => r.staff_id === session?.staffId), [requests, session?.staffId])
  const pendingRequests = useMemo(() => requests.filter(r => r.status === 'pending'), [requests])
  // Rota shifts on pending zero-hours holiday, so the hours to pay can start from the real shift.
  const pendingHoliday = pendingRequests.filter(r => r.leave_type === 'annual' && r.staff?.employment_type === 'zero_hours')
  const rotaHours = useRotaHours(
    pendingHoliday.map(r => r.staff_id),
    pendingHoliday.reduce((m, r) => (!m || r.start_date < m ? r.start_date : m), ''),
    pendingHoliday.reduce((m, r) => (!m || r.end_date > m ? r.end_date : m), ''),
  )
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
          year={currentYear}
          holiday={ownHoliday}
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
                busy={reviewing === r.id}
                holiday={teamHoliday[r.staff_id]}
                rotaHoursByDate={rotaHours[r.staff_id]}
                onApprove={(paidHours) => approve(r.id, paidHours)}
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
                  setForm(f => ({ ...f, startDate: dateStr, endDate: dateStr }))
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
            <span className="text-caption font-semibold tracking-[0.08em] uppercase text-ink3 dark:text-white/45">Team annual leave · {currentYear}</span>
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
                      holiday={b.isZeroHours ? teamHoliday[b.id] : undefined}
                      settingsPath={`/v/${venueSlug}/settings/attendance`}
                      onLogPast={() => setManualEntry(b)}
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
              {LEAVE_TYPES.map(t => (
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
            {form.leaveType === 'unavailable' && (
              <p className="text-body-sm text-ink3 dark:text-white/45 mt-2">
                For days you can't work. You won't be put on the rota, it isn't paid, and it doesn't use your holiday.
              </p>
            )}
            {form.leaveType === 'annual' && ownBalance?.isZeroHours && (
              <p className="text-body-sm text-ink3 dark:text-white/45 mt-2">
                Paid holiday. If you just can't work these days, choose Not available instead.
              </p>
            )}
          </div>

          {/* Balance for annual leave */}
          {form.leaveType === 'annual' && ownBalance && !ownBalance.isZeroHours && ownBalance.entitlement != null && (
            <div className="rounded-xl bg-cream dark:bg-white/5 px-3.5 py-2.5 flex items-center justify-between">
              <div>
                <p className="text-body-sm font-semibold text-ink dark:text-white">{currentYear} annual leave</p>
                <p className="text-body-sm text-ink3 dark:text-white/45 mt-0.5">{ownBalance.used} of {ownBalance.entitlement} days used</p>
              </div>
              <p className={`font-mono text-body font-semibold ${ownBalance.remaining === 0 ? 'text-bad' : ownBalance.remaining <= 5 ? 'text-warn' : 'text-good'}`}>
                {fmtDays(ownBalance.remaining)} left
              </p>
            </div>
          )}
          {form.leaveType === 'annual' && ownBalance?.isZeroHours && ownHoliday?.status === 'ok' && (
            <div className="rounded-xl bg-cream dark:bg-white/5 px-3.5 py-2.5 flex items-center justify-between">
              <p className="text-body-sm font-semibold text-ink dark:text-white">Holiday left</p>
              <p className={`font-mono text-body font-semibold ${balanceTone(ownHoliday.balance)}`}>
                {fmtHours(ownHoliday.balance)}
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
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value, endDate: f.endDate || e.target.value }))}
                className={TEXT_FIELD}
              />
            </label>
            <label>
              <span className={FIELD_LABEL}>End date</span>
              <input
                type="date"
                value={form.endDate}
                min={form.startDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className={TEXT_FIELD}
              />
            </label>
          </div>

          {form.startDate && form.endDate && form.endDate < form.startDate && (
            <p className="text-body-sm text-bad dark:text-badDark -mt-1">End date is before the start date.</p>
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
          {form.leaveType === 'annual' && form.startDate && form.endDate && form.endDate >= form.startDate && ownBalance?.isZeroHours && ownHoliday?.status === 'ok' && (() => {
            const reqHours = suggestedPaidHours(
              { start_date: form.startDate, end_date: form.endDate },
              ownHoliday.avgWeekHours,
              ownProfile?.working_days,
            )
            if (reqHours == null) return null
            const after = Math.round((ownHoliday.balance - reqHours) * 10) / 10
            return (
              <div className={`-mt-2 rounded-xl px-3.5 py-2.5 text-body-sm ${after < 0 ? 'bg-warnBg dark:bg-warn/20' : 'bg-cream dark:bg-white/5'}`}>
                <p className="text-ink2 dark:text-white/70">
                  About <span className="font-semibold text-ink dark:text-white">{fmtHours(reqHours)}</span> of holiday — your manager confirms the exact hours.
                </p>
                {after < 0 ? (
                  <p className="mt-1 font-semibold text-warn dark:text-warnDark">
                    That's {fmtHours(-after)} more than you have left — the rest would be unpaid.
                  </p>
                ) : (
                  <p className="mt-1 text-ink3 dark:text-white/50">You'd have about {fmtHours(after)} left after this.</p>
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

          <Button
            fullWidth
            loading={saving}
            onClick={submitRequest}
            disabled={saving || !form.leaveType || !form.startDate || !form.endDate}
          >
            {saving ? 'Submitting…' : 'Submit request'}
          </Button>
        </div>
      </Modal>

      {/* Manual leave entry modal */}
      {manualEntry && (
        <ManualLeaveModal
          staff={manualEntry}
          holiday={teamHoliday[manualEntry.id]}
          paidOut={paidOut[manualEntry.id]?.rows ?? []}
          year={currentYear}
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

// "12.5 h", "−4 h" — zero-hours holiday is counted in hours
function fmtHours(n) {
  if (n == null) return '—'
  const v = Math.round(n * 10) / 10
  return `${v < 0 ? '−' : ''}${Math.abs(v)} h`
}

function balanceTone(balance) {
  if (balance < 0) return 'text-bad dark:text-badDark'
  if (balance <= 4) return 'text-warn dark:text-warnDark'
  return 'text-good dark:text-goodDark'
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

function OwnBalanceCard({ balance, year, holiday }) {
  if (balance.isZeroHours) {
    if (holiday?.status === 'self_employed') return null
    if (holiday?.status === 'needs_region') {
      return (
        <p className={`${CARD} px-3.5 sm:px-3.5 py-2.5 text-body-sm text-ink3 dark:text-white/45`}>
          Your holiday balance isn't set up yet — your manager needs to finish setting up holiday in Settings.
        </p>
      )
    }
    return (
      <div className={`${CARD} px-3.5 sm:px-3.5 py-2.5`}>
        <div className="flex items-baseline justify-between gap-2.5 flex-wrap">
          <p className="flex items-baseline gap-2">
            <span className={`font-mono text-title leading-none font-semibold ${holiday ? balanceTone(holiday.balance) : 'text-ink3'}`}>
              {holiday ? fmtHours(holiday.balance) : '—'}
            </span>
            <span className="text-body font-semibold text-ink dark:text-white">holiday left</span>
          </p>
        </div>
        {holiday?.balance < 0 && (
          <p className="text-body-sm text-bad dark:text-badDark mt-1.5">You've had more paid holiday than you've built up so far.</p>
        )}
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

function PendingRequest({ request: r, balance, holiday, rotaHoursByDate, note, onNote, busy, onApprove, onReject }) {
  // Zero-hours annual leave is paid in hours, so the manager confirms how many.
  const asksForHours = r.leave_type === 'annual' && balance?.isZeroHours && holiday?.status === 'ok'
  const suggested = asksForHours ? suggestedPaidHours(r, holiday.avgWeekHours, r.staff?.working_days, rotaHoursByDate) : null
  // null until the manager types: shows the suggestion, which may load after this renders
  const [typed, setHours] = useState(null)
  const hours = typed ?? (suggested != null ? String(suggested) : '')
  const paidHours = asksForHours && hours.trim() !== '' && Number(hours) >= 0 ? Math.round(Number(hours) * 100) / 100 : null
  const hoursInvalid = asksForHours && hours.trim() !== '' && !(Number(hours) >= 0)

  const daysRequested = r.leave_type === 'annual' && !balance?.isZeroHours
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
      {asksForHours && (
        <label className="flex items-center gap-2.5">
          <span className="flex-1 min-w-0 text-body-sm text-ink2 dark:text-white/70">
            Holiday hours to pay
            <span className="block text-ink3 dark:text-white/45">
              {fmtHours(holiday.balance)} left{suggested != null && ` · suggested ${fmtHours(suggested)} from their rota and average week`}
            </span>
          </span>
          <span className="w-28 shrink-0">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.5"
              value={hours}
              onChange={e => setHours(e.target.value)}
              aria-label={`Holiday hours to pay ${r.staff?.name ?? ''}`}
              className={`${TEXT_FIELD} text-right font-mono`}
            />
          </span>
        </label>
      )}
      {asksForHours && paidHours != null && holiday.balance - paidHours < 0 && (
        <p className="text-body-sm font-semibold text-warn dark:text-warnDark -mt-1">
          That's {fmtHours(paidHours - holiday.balance)} more than they've built up.
        </p>
      )}
      {r.leave_type === 'unavailable' && (
        <p className="text-body-sm text-ink3 dark:text-white/45 -mt-1">Not paid and doesn't use holiday — it keeps them off the rota on these days.</p>
      )}
      <input
        type="text"
        value={note}
        onChange={e => onNote(e.target.value)}
        placeholder="Note (optional)"
        aria-label={`Note for ${r.staff?.name ?? 'this request'}`}
        className={TEXT_FIELD}
      />
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
          onClick={() => onApprove(asksForHours ? paidHours : null)}
          disabled={busy || hoursInvalid}
        >
          Approve
        </Button>
      </div>
    </div>
  )
}

// One line per person: their name and what they have left. The detail behind
// the number (allowance, estimates, missing clock-outs) lives elsewhere — this
// list is for "how much holiday has everyone got?" at a glance.
function TeamBalanceRow({ balance: b, holiday, settingsPath, onLogPast }) {
  const tone = b.remaining === 0 ? 'text-bad' : b.remaining != null && b.remaining <= 5 ? 'text-warn' : 'text-good dark:text-goodDark'

  let left
  if (b.isZeroHours) {
    if (holiday?.status === 'needs_region') {
      left = <Button variant="link" size="sm" to={settingsPath}>Set up holiday</Button>
    } else if (holiday?.status === 'self_employed') {
      left = <span className="text-body-sm text-ink3 dark:text-white/45">Self-employed</span>
    } else {
      left = (
        <span className={`font-mono text-body font-semibold ${holiday ? balanceTone(holiday.balance) : 'text-ink3'}`}>
          {holiday ? `${fmtHours(holiday.balance)} left` : '…'}
        </span>
      )
    }
  } else if (b.entitlement != null) {
    left = <span className={`font-mono text-body font-semibold ${tone}`}>{fmtDays(b.remaining)} left</span>
  } else {
    left = <span className="text-body-sm text-ink3 dark:text-white/45">No holiday</span>
  }

  return (
    <div className="flex items-center gap-2.5 px-3.5 sm:px-3.5 py-2.5">
      <p className="flex-1 min-w-0 text-body font-semibold text-ink dark:text-white truncate">{b.name}</p>
      <div className="shrink-0 text-right">{left}</div>
      <Button
        variant="secondary"
        size="sm"
        iconOnly
        onClick={onLogPast}
        aria-label={`Log past leave or holiday already paid for ${b.name}`}
        title="Log past leave or holiday already paid"
        className="shrink-0"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
      </Button>
    </div>
  )
}
