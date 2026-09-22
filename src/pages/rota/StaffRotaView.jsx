import React, { useState, useEffect, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { useClockSessions } from '../../hooks/useClockSessions'
import { fetchPayrollLocks, submitClockEditRequest } from '../../lib/api/shifts'
import { sendPush } from '../../lib/sendPush'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { shiftDurationHours, paidShiftHours } from '../../hooks/useShifts'
import { getWeekDays } from '../../lib/utils'
import { useToast } from '../../components/ui/Toast'
import { SkeletonList } from '../../components/ui/Skeleton'
import RotaSwapRequestModal from './RotaSwapRequestModal'
import GanttChart from './GanttChart'
import FixHoursSheet from './FixHoursSheet'
import { DayWorkedCard, WorkedSection } from './WorkedHours'
import { durationLabel, ehWorkedMins, fmtHM, applyTimeToDate } from './rotaTimeHelpers'

/*
 * The staff-facing rota: their own week, worked hours, and the fix-hours
 * flow. The manager-facing builder lives in RotaPage.jsx.
 */

export default function StaffRotaView({ shifts, staff, loading, weekStart, prevWeek, nextWeek, session, swapModal, setSwapModal, swapForm, setSwapForm, swapSaving, submitSwapRequest, swapCandidates, swaps, readOnly }) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const weekDays = getWeekDays(weekStart)

  const [selectedDate, setSelectedDate] = React.useState(() => {
    const todayInWeek = weekDays.find(d => format(d, 'yyyy-MM-dd') === today)
    return todayInWeek ?? weekDays[0]
  })

  React.useEffect(() => {
    const todayInWeek = weekDays.find(d => format(d, 'yyyy-MM-dd') === today)
    setSelectedDate(todayInWeek ?? weekDays[0])
  }, [weekStart]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd')
  const myShifts = shifts.filter(s => s.staff_id === session?.staffId)
  const selectedShift = myShifts.find(s => s.shift_date === selectedDateStr)
  const upcomingShifts = myShifts.filter(s => s.shift_date > today).sort((a, b) => a.shift_date.localeCompare(b.shift_date))
  const me = staff.find(s => s.id === session?.staffId)
  const hourlyRate = me?.hourly_rate
  const dayShifts = shifts.filter(s => s.shift_date === selectedDateStr)
  const myShiftDates = new Set(myShifts.map(s => s.shift_date))
  const otherShiftDates = new Set(shifts.filter(s => s.staff_id !== session?.staffId).map(s => s.shift_date))
  const weekNum = format(weekStart, 'w')
  const weekRange = `${format(weekDays[0], 'd MMM')} – ${format(weekDays[6], 'd MMM')}`
  const upcomingHours = upcomingShifts.reduce((sum, s) => sum + shiftDurationHours(s.start_time, s.end_time), 0)
  const upcomingPay = hourlyRate ? upcomingShifts.reduce((sum, s) => sum + paidShiftHours(s.start_time, s.end_time) * hourlyRate, 0) : null
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes()
  const mySwaps = swaps.filter(s => s.requester_id === session?.staffId)
  const myPending = mySwaps.filter(s => s.status === 'pending')

  /* ── edit-hours state ── */
  const { venueId }   = useVenue()
  const ehToast       = useToast()
  const { sessions: clockSessions, reload: reloadClockSessions } = useClockSessions(session?.staffId ?? '')
  const [fixCtx, setFixCtx]     = React.useState(null)
  const [reqs, setReqs]         = React.useState({})
  const [payrollLocks, setPayrollLocks] = React.useState([])

  // Load payroll locks so staff can't submit corrections for locked periods
  React.useEffect(() => {
    if (!venueId) return
    fetchPayrollLocks(venueId).then(setPayrollLocks)
  }, [venueId])

  const isDateLocked = React.useCallback((date) => {
    const d = format(date, 'yyyy-MM-dd')
    return payrollLocks.some(l => d >= l.from && d <= l.to)
  }, [payrollLocks])

  // Fetch pending/denied clock_edit_requests for this staff member
  React.useEffect(() => {
    if (!session?.staffId || !venueId) return
    supabase
      .from('clock_edit_requests')
      .select('clock_in_id, status, requested_clock_in, requested_clock_out, break_minutes')
      .eq('staff_id', session.staffId)
      .eq('venue_id', venueId)
      .in('status', ['pending', 'denied', 'approved'])
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!data) return
        const map = {}
        for (const r of data) {
          if (map[r.clock_in_id]) continue // most recent wins
          const rIn  = r.requested_clock_in  ? new Date(r.requested_clock_in)  : null
          const rOut = r.requested_clock_out ? new Date(r.requested_clock_out) : null
          map[r.clock_in_id] = {
            status:   r.status,
            start:    rIn  ? fmtHM(rIn)  : null,
            end:      rOut ? fmtHM(rOut) : null,
            newMins:  (rIn && rOut) ? ehWorkedMins(fmtHM(rIn), fmtHM(rOut), r.break_minutes ?? 0) : 0,
          }
        }
        setReqs(map)
      })
  }, [session?.staffId, venueId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Filter clock sessions to the current week
  const weekDateStrs = weekDays.map(d => format(d, 'yyyy-MM-dd'))
  const weekClockSessions = React.useMemo(() => {
    return clockSessions.filter(s => s.clockOutAt && weekDateStrs.includes(format(s.date, 'yyyy-MM-dd')))
  }, [clockSessions, weekStart]) // eslint-disable-line react-hooks/exhaustive-deps

  // Build worked rows with display data
  const workedRows = React.useMemo(() => {
    return weekClockSessions.map(sess => {
      const dateStr = format(sess.date, 'yyyy-MM-dd')
      const shift   = myShifts.find(s => s.shift_date === dateStr)
      const sStr    = fmtHM(sess.clockInAt)
      const eStr    = fmtHM(sess.clockOutAt)
      return {
        session:    sess,
        dateStr,
        startStr:   sStr,
        endStr:     eStr,
        workedMins: ehWorkedMins(sStr, eStr, sess.breakMinutes ?? 0),
        role:       shift?.role_label ?? '',
        dow:        format(sess.date, 'EEE').toUpperCase(),
        dateNum:    format(sess.date, 'd'),
      }
    }).sort((a, b) => a.session.date - b.session.date) // chronological
  }, [weekClockSessions, myShifts])

  // The clock session for the selected day (if any)
  const selectedDaySession = React.useMemo(() => {
    return workedRows.find(r => r.dateStr === selectedDateStr)
  }, [workedRows, selectedDateStr])

  // Submit a correction request
  const submitFix = React.useCallback(async (clockSess, data) => {
    if (isDateLocked(clockSess.date)) {
      ehToast('This period has been locked for payroll — contact your manager', 'error')
      return
    }
    const reqIn  = applyTimeToDate(clockSess.clockInAt,  data.start)
    const reqOut = applyTimeToDate(clockSess.clockOutAt ?? clockSess.clockInAt, data.end)
    const { error } = await submitClockEditRequest({
      p_venue_id:           venueId,
      p_staff_id:           session.staffId,
      p_clock_in_id:        clockSess.clockInId,
      p_clock_out_id:       clockSess.clockOutId,
      p_original_clock_in:  clockSess.clockInAt.toISOString(),
      p_original_clock_out: clockSess.clockOutAt?.toISOString() ?? null,
      p_requested_clock_in: reqIn.toISOString(),
      p_requested_clock_out: reqOut.toISOString(),
      p_break_minutes:      data.brk,
      p_reason:             data.note ? `${data.reason} — ${data.note}` : data.reason,
    })
    if (error) { ehToast(error.message, 'error'); return }
    await sendPush({
      venueId,
      notificationType: 'hour_edit_request',
      title: 'Hour edit request',
      body: `${me?.name ?? 'Staff'} requested a change to their hours on ${format(clockSess.date, 'EEE d MMM')}`,
      url: '/timesheet',
      roles: ['manager', 'owner'],
    })
    // Optimistic update
    setReqs(prev => ({
      ...prev,
      [clockSess.clockInId]: {
        status:  'pending',
        start:   data.start,
        end:     data.end,
        newMins: data.newMins,
      },
    }))
    ehToast('Sent to your manager for approval ✓')
    reloadClockSessions()
  }, [venueId, session, me, ehToast, reloadClockSessions]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div className="flex items-baseline justify-between px-1">
        <span className="font-mono text-[10.5px] text-charcoal/50 dark:text-white/40 tracking-[0.08em] uppercase">My Shifts</span>
        <span className="font-mono text-[10.5px] text-charcoal/50 dark:text-white/40">Week {weekNum} · {weekRange}</span>
      </div>

      {/* Week strip */}
      <div className="flex items-center gap-1.5">
        <button onClick={prevWeek} className="w-8 h-[60px] flex items-center justify-center rounded-[9px] bg-white dark:bg-paperDark border border-charcoal/15 dark:border-white/15 text-charcoal/40 dark:text-white/35 hover:text-charcoal dark:hover:text-white hover:border-charcoal/30 dark:hover:border-white/30 transition-colors shrink-0">
          <svg width="10" height="14" viewBox="0 0 10 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 1L1 7l6 6"/></svg>
        </button>
        <div className="flex-1 grid grid-cols-7 gap-1">
          {weekDays.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const isSel = dateStr === selectedDateStr
            const hasMyShift = myShiftDates.has(dateStr)
            const hasOtherShift = otherShiftDates.has(dateStr)
            const isT = dateStr === today
            return (
              <button key={dateStr} onClick={() => setSelectedDate(day)}
                className={`h-[60px] rounded-[9px] flex flex-col items-center justify-center gap-0.5 relative transition-colors ${isSel ? 'bg-charcoal border border-charcoal dark:border-white text-white' : 'bg-white dark:bg-paperDark border border-charcoal/15 dark:border-white/15 text-charcoal dark:text-white hover:border-charcoal/30 dark:hover:border-white/30'}`}>
                <span className={`font-mono text-[9px] font-semibold tracking-[0.06em] ${isSel ? 'text-white/70' : 'text-charcoal/50 dark:text-white/40'}`}>
                  {format(day, 'EEE').toUpperCase()}
                </span>
                <span className="font-mono text-[17px] font-semibold leading-none">{format(day, 'd')}</span>
                {(hasMyShift || hasOtherShift) && (
                  <span className={`absolute bottom-1.5 w-1 h-1 rounded-full ${hasMyShift ? (isSel ? 'bg-white dark:bg-paperDark' : 'bg-brand') : (isSel ? 'bg-white/40' : 'bg-charcoal/25 dark:bg-white/25')}`} />
                )}
                {isT && !isSel && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-accent" />
                )}
              </button>
            )
          })}
        </div>
        <button onClick={nextWeek} className="w-8 h-[60px] flex items-center justify-center rounded-[9px] bg-white dark:bg-paperDark border border-charcoal/15 dark:border-white/15 text-charcoal/40 dark:text-white/35 hover:text-charcoal dark:hover:text-white hover:border-charcoal/30 dark:hover:border-white/30 transition-colors shrink-0">
          <svg width="10" height="14" viewBox="0 0 10 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 1l6 6-6 6"/></svg>
        </button>
      </div>

      {loading ? (
        <SkeletonList rows={6} />
      ) : (
        <>
          {/* Day heading */}
          <div className="flex items-baseline gap-2 px-1">
            <h1 className="text-[22px] font-semibold tracking-[-0.022em]">{format(selectedDate, 'EEEE, d MMMM')}</h1>
            {selectedDateStr === today && (
              <span className="font-mono text-[11px] text-accent font-semibold tracking-[0.06em]">TODAY</span>
            )}
          </div>

          {/* Day at a glance — always at top */}
          {dayShifts.length > 0 && (
            <div>
              <div className="flex items-baseline justify-between px-1 mb-2">
                <span className="font-mono text-[10.5px] text-charcoal/50 dark:text-white/40 tracking-[0.08em] uppercase font-semibold">Day at a glance</span>
                <span className="font-mono text-[11px] text-charcoal/50 dark:text-white/40">{dayShifts.length} on shift</span>
              </div>
              <GanttChart shifts={dayShifts} staff={staff} currentStaffId={session?.staffId} nowMins={nowMins} showNow={selectedDateStr === today} />
            </div>
          )}

          {/* Per-day card — worked day OR scheduled shift OR empty */}
          {selectedDaySession ? (
            <DayWorkedCard
              session={selectedDaySession.session}
              role={selectedDaySession.role}
              req={reqs[selectedDaySession.session.clockInId]}
            />
          ) : selectedShift ? (
            <div className="rounded-2xl p-4 text-white" style={{ background: '#13362a' }}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10.5px] text-white/55 tracking-[0.1em] uppercase">Your shift</span>
              </div>
              <div className="font-mono text-[30px] font-medium tracking-[-0.025em] tabular-nums mt-1.5">
                {selectedShift.start_time.slice(0, 5)} — {selectedShift.end_time.slice(0, 5)}
              </div>
              <div className="flex items-center gap-2.5 mt-1 text-white/70 text-sm">
                {selectedShift.role_label && <span>{selectedShift.role_label}</span>}
                <span className="text-white/30">·</span>
                <span className="font-mono">{durationLabel(selectedShift.start_time, selectedShift.end_time)}</span>
                {hourlyRate && (
                  <>
                    <span className="text-white/30">·</span>
                    <span className="font-mono">£{(paidShiftHours(selectedShift.start_time, selectedShift.end_time) * hourlyRate).toFixed(2)}</span>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-charcoal/4 dark:bg-white/5 border border-dashed border-charcoal/20 dark:border-white/20 px-5 py-5 text-center">
              <p className="text-sm text-charcoal/40 dark:text-white/35">No shift scheduled on this day</p>
            </div>
          )}

          {/* This week · worked */}
          <WorkedSection
            rows={workedRows}
            reqs={reqs}
            hourlyRate={hourlyRate}
            onFix={readOnly ? null : (sess, role) => setFixCtx({ session: sess, role })}
            isDateLocked={isDateLocked}
          />

          {/* Upcoming shifts */}
          {upcomingShifts.length > 0 ? (
            <div>
              <div className="flex items-baseline justify-between px-1 mb-2">
                <span className="font-mono text-[10.5px] text-charcoal/50 dark:text-white/40 tracking-[0.08em] uppercase font-semibold">Your upcoming shifts</span>
                <span className="font-mono text-[11px] text-charcoal/50 dark:text-white/40">{upcomingShifts.length} · next 2 wks</span>
              </div>
              <div className="bg-white dark:bg-paperDark border border-charcoal/10 dark:border-white/10 rounded-2xl overflow-hidden">
                {upcomingShifts.map((shift, i) => (
                  <div key={shift.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-charcoal/8 dark:border-white/8' : ''}`}>
                    <div className="w-11 h-12 rounded-[9px] bg-charcoal/4 dark:bg-white/5 border border-charcoal/10 dark:border-white/10 shrink-0 flex flex-col items-center justify-center gap-0.5">
                      <span className="font-mono text-[9px] text-charcoal/50 dark:text-white/40 tracking-[0.06em] font-semibold">{format(parseISO(shift.shift_date), 'EEE').toUpperCase()}</span>
                      <span className="font-mono text-[17px] font-semibold text-charcoal dark:text-white leading-none">{format(parseISO(shift.shift_date), 'd')}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-[13.5px] font-semibold tabular-nums text-charcoal dark:text-white">
                        {shift.start_time.slice(0, 5)}–{shift.end_time.slice(0, 5)}
                      </div>
                      <div className="text-[11.5px] text-charcoal/50 dark:text-white/40 mt-0.5 flex items-center gap-1.5">
                        <span>{durationLabel(shift.start_time, shift.end_time)}</span>
                        {shift.role_label && <><span className="text-charcoal/30 dark:text-white/30">·</span><span>{shift.role_label}</span></>}
                        <span className="text-charcoal/30 dark:text-white/30">·</span>
                        <span>{shift.shift_date === today ? 'Today' : format(parseISO(shift.shift_date), 'EEE d MMM')}</span>
                      </div>
                    </div>
                    {!readOnly && (
                      <button
                        onClick={() => {
                          const staffMember = staff.find(s => s.id === shift.staff_id)
                          setSwapModal({ staffMember, date: parseISO(shift.shift_date), shift })
                          setSwapForm({ targetStaffId: '', message: '' })
                        }}
                        className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg border border-charcoal/15 dark:border-white/15 text-charcoal/60 dark:text-white/50 text-[11.5px] font-semibold hover:border-charcoal/30 dark:hover:border-white/30 hover:text-charcoal dark:hover:text-white transition-colors"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3"/></svg>
                        Swap
                      </button>
                    )}
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-3 border-t border-charcoal/8 dark:border-white/8 bg-charcoal/3 dark:bg-white/5">
                  <div className="flex gap-4">
                    <div>
                      <div className="font-mono text-[9.5px] text-charcoal/50 dark:text-white/40 tracking-[0.06em] uppercase">Shifts</div>
                      <div className="font-mono text-[14px] font-semibold mt-0.5">{upcomingShifts.length}</div>
                    </div>
                    <div>
                      <div className="font-mono text-[9.5px] text-charcoal/50 dark:text-white/40 tracking-[0.06em] uppercase">Hours</div>
                      <div className="font-mono text-[14px] font-semibold mt-0.5">{Math.round(upcomingHours)}h</div>
                    </div>
                    {upcomingPay != null && (
                      <div>
                        <div className="font-mono text-[9.5px] text-charcoal/50 dark:text-white/40 tracking-[0.06em] uppercase">Est. Pay</div>
                        <div className="font-mono text-[14px] font-semibold mt-0.5 text-success">£{upcomingPay.toFixed(2)}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-paperDark border border-charcoal/10 dark:border-white/10 rounded-2xl px-5 py-6 text-center">
              <p className="text-sm text-charcoal/40 dark:text-white/35">No upcoming shifts in the next 2 weeks</p>
            </div>
          )}

          {/* My swap requests */}
          {mySwaps.length > 0 && (
            <div className={`rounded-2xl border px-5 py-4 ${myPending.length > 0 ? 'bg-warning/5 border-warning/20' : 'bg-charcoal/4 dark:bg-white/5 border-charcoal/10 dark:border-white/10'}`}>
              <p className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 mb-2">My Swap Requests</p>
              <div className="flex flex-col gap-2">
                {mySwaps.slice(0, 3).map((swap) => (
                  <div key={swap.id} className="flex items-center justify-between text-sm">
                    <span className="text-charcoal/70 dark:text-white/60">
                      Swap with <span className="font-medium text-charcoal dark:text-white">{swap.target_staff_name}</span>
                      {swap.shift && <span className="text-xs text-charcoal/40 dark:text-white/35 ml-1">({swap.shift.shift_date})</span>}
                    </span>
                    <span className={`text-[11px] tracking-widest uppercase px-2 py-0.5 rounded-full font-medium ${swap.status === 'pending' ? 'bg-warning/15 text-warning' : swap.status === 'approved' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                      {swap.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <RotaSwapRequestModal
        swapModal={swapModal}
        setSwapModal={setSwapModal}
        swapForm={swapForm}
        setSwapForm={setSwapForm}
        swapSaving={swapSaving}
        submitSwapRequest={submitSwapRequest}
        swapCandidates={swapCandidates}
      />

      {/* Fix-hours sheet */}
      <FixHoursSheet
        ctx={fixCtx}
        onClose={() => setFixCtx(null)}
        onSubmit={submitFix}
      />
    </div>
  )
}
