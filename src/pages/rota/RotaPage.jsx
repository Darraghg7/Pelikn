import React, { useState, useEffect, useCallback } from 'react'
import { format, addWeeks, addDays, eachDayOfInterval, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useShifts, useStaffList, shiftDurationHours, paidShiftHours, unpaidBreakMins } from '../../hooks/useShifts'
import { useCrossVenueShifts } from '../../hooks/useCrossVenueShifts'
import { useShiftSwaps } from '../../hooks/useShiftSwaps'
import { useAvailability } from '../../hooks/useAvailability'
import { useSession } from '../../contexts/SessionContext'
import { getWeekStart, getWeekDays } from '../../lib/utils'
import { useToast } from '../../components/ui/Toast'
import TimeSelect from '../../components/ui/TimeSelect'
import { SHIFT_PRESETS } from '../../lib/constants'
import { useAppSettings } from '../../hooks/useSettings'
import { useVenueRoles } from '../../hooks/useVenueRoles'
import RotaWeekView from './RotaWeekView'
import RotaBuilderModal from './RotaBuilderModal'
import RotaAIModal from './RotaAIModal'
import RotaConfigModal from './RotaConfigModal'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'

function SectionLabel({ children }) {
  return <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-1">{children}</p>
}

function fmtDuration(startTime, endTime) {
  const hrs = shiftDurationHours(startTime, endTime)
  if (hrs <= 0) return null
  const h = Math.floor(hrs)
  const m = Math.round((hrs - h) * 60)
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}

function fmtGBP(n) { return `£${Number(n).toFixed(2)}` }

export default function RotaPage() {
  const toast = useToast()
  const { venueId } = useVenue()
  const { session, isManager } = useSession()

  const [weekStart, setWeekStart] = useState(() => getWeekStart())
  const [numWeeks, setNumWeeks]   = useState(1)
  const { shifts, loading, reload } = useShifts(weekStart, numWeeks)
  const { staff, loading: staffLoading } = useStaffList()
  const crossShifts = useCrossVenueShifts(staff, weekStart, numWeeks, venueId)
  const { swaps, loading: swapsLoading, reload: reloadSwaps, pendingCount } = useShiftSwaps()
  const { unavailability, toggleAvailability, reload: reloadAvail } = useAvailability(weekStart, numWeeks)
  const { customRoles, closedDays, breakDurationMins } = useAppSettings()
  const { roles: venueRoles } = useVenueRoles()

  // ── Venue closures ──
  const [closures, setClosures] = useState([])
  const loadClosures = useCallback(async () => {
    if (!venueId) return
    const { data } = await supabase
      .from('venue_closures')
      .select('id, start_date, end_date')
      .eq('venue_id', venueId)
    setClosures(data ?? [])
  }, [venueId])
  useEffect(() => { loadClosures() }, [loadClosures])

  // Expand all closure ranges into a Set of 'yyyy-MM-dd' strings
  const closedDates = React.useMemo(() => {
    const set = new Set()
    for (const c of closures) {
      try {
        const days = eachDayOfInterval({ start: parseISO(c.start_date), end: parseISO(c.end_date) })
        days.forEach(d => set.add(format(d, 'yyyy-MM-dd')))
      } catch { /* skip invalid ranges */ }
    }
    return set
  }, [closures])

  // ── Closure mode: pending local state, saved on "Save" ──
  const [closureMode, setClosureMode]       = useState(false)
  const [pendingClosed, setPendingClosed]   = useState(null) // Set<string> while in mode
  const [savingClosures, setSavingClosures] = useState(false)

  const enterClosureMode = () => {
    setPendingClosed(new Set(closedDates)) // copy current saved state
    setClosureMode(true)
  }

  const cancelClosureMode = () => {
    setPendingClosed(null)
    setClosureMode(false)
  }

  // Toggle a date locally — no DB write yet
  const togglePendingClosure = (dateStr) => {
    setPendingClosed(prev => {
      const next = new Set(prev)
      if (next.has(dateStr)) next.delete(dateStr)
      else next.add(dateStr)
      return next
    })
  }

  // Save all pending changes to DB, then exit mode
  const saveClosures = async () => {
    if (!pendingClosed || savingClosures) return
    setSavingClosures(true)

    // Dates to add (in pending but not in DB)
    const toAdd = [...pendingClosed].filter(d => !closedDates.has(d))
    // Dates to remove (in DB but not in pending) — only single-day closures we manage here
    const toDelete = [...closedDates].filter(d => !pendingClosed.has(d))

    // Delete removed single-day closures
    for (const dateStr of toDelete) {
      const existing = closures.find(c => c.start_date === dateStr && c.end_date === dateStr)
      if (existing) {
        await supabase.from('venue_closures').delete().eq('id', existing.id)
      }
    }

    // Insert new closures in a single batch
    if (toAdd.length > 0) {
      await supabase.from('venue_closures').insert(
        toAdd.map(dateStr => ({ venue_id: venueId, start_date: dateStr, end_date: dateStr }))
      )
    }

    await loadClosures()
    setSavingClosures(false)
    setPendingClosed(null)
    setClosureMode(false)
    toast(toAdd.length + toDelete.length > 0 ? 'Closed days saved ✓' : 'No changes made')
  }

  // The dates used for display/blocking: pending state while in mode, saved state otherwise
  const effectiveClosedDates = closureMode && pendingClosed != null ? pendingClosed : closedDates

  const [showBuilder, setShowBuilder]   = useState(false)
  const [showAI, setShowAI]             = useState(false)
  const [showConfig, setShowConfig]     = useState(false)

  // Manager shift modal state
  const [modal, setModal]         = useState(null)
  const [editShift, setEditShift] = useState(null)
  const [form, setForm]           = useState({ staffId: '', startTime: '09:00', endTime: '17:00', roleLabel: 'Chef' })
  const [saving, setSaving]       = useState(false)
  const [emailing, setEmailing]   = useState(false)

  // Staff swap request modal state
  const [swapModal, setSwapModal]   = useState(null) // { staffMember, date, shift }
  const [swapForm, setSwapForm]     = useState({ targetStaffId: '', message: '' })
  const [swapSaving, setSwapSaving] = useState(false)

  // Manager swap panel state
  const [showSwaps, setShowSwaps]     = useState(false)
  const [rejectNote, setRejectNote]   = useState({}) // { [swapId]: note }
  const [resolving, setResolving]     = useState(null)

  const prevWeek = () => setWeekStart((w) => addWeeks(w, -numWeeks))
  const nextWeek = () => setWeekStart((w) => addWeeks(w, numWeeks))

  // ── Manager: shift cell click ──
  const openCell = (staffMember, date, dayShifts) => {
    if (!isManager) return // staff handled separately via RotaWeekView callback
    if (closureMode) return // in closure mode, day header handles clicks
    const dateStr = format(date, 'yyyy-MM-dd')
    if (effectiveClosedDates.has(dateStr)) return // can't add shifts on closed days
    setModal({ staffMember, date, dayShifts })
    const lastRole = localStorage.getItem(`mise_last_role_${staffMember.id}`) || venueRoles[0]?.name || ''
    setForm({ staffId: staffMember.id, startTime: '09:00', endTime: '17:00', roleLabel: lastRole })
    setEditShift(null)
  }

  // ── Staff: cell click → open swap request if they have a shift ──
  const openStaffCell = (staffMember, date, dayShifts) => {
    if (isManager) return openCell(staffMember, date, dayShifts)
    // Staff: only allow interaction on their own shifts
    if (staffMember.id !== session?.staffId) return
    if (dayShifts.length === 0) return
    setSwapModal({ staffMember, date, shift: dayShifts[0] })
    setSwapForm({ targetStaffId: '', message: '' })
  }

  const onToggleAvailability = (staffId, date) => {
    toggleAvailability(staffId, date)
  }

  const openEdit = (sh) => {
    setEditShift(sh)
    setForm({
      staffId:   sh.staff_id,
      startTime: sh.start_time.slice(0, 5),
      endTime:   sh.end_time.slice(0, 5),
      roleLabel: sh.role_label,
    })
  }

  const applyPreset = (preset) => {
    setForm((f) => ({ ...f, startTime: preset.start, endTime: preset.end }))
  }

  const saveShift = async () => {
    setSaving(true)
    const payload = {
      staff_id:   form.staffId,
      shift_date: format(modal.date, 'yyyy-MM-dd'),
      week_start: format(getWeekStart(modal.date), 'yyyy-MM-dd'),
      start_time: form.startTime,
      end_time:   form.endTime,
      role_label: form.roleLabel,
      venue_id:   venueId,
    }
    const { error } = editShift
      ? await supabase.from('shifts').update(payload).eq('id', editShift.id)
      : await supabase.from('shifts').insert(payload)
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    if (form.roleLabel) localStorage.setItem(`mise_last_role_${form.staffId}`, form.roleLabel)
    toast(editShift ? 'Shift updated' : 'Shift added')
    setModal(null)
    reload()
  }

  const deleteShift = async (shiftId) => {
    const { error } = await supabase.from('shifts').delete().eq('id', shiftId)
    if (error) { toast(error.message, 'error'); return }
    toast('Shift removed')
    setModal(null)
    reload()
  }

  const emailRota = async () => {
    setEmailing(true)
    const { error } = await supabase.functions.invoke('send-rota-email', {
      body: { weekStart: format(weekStart, 'yyyy-MM-dd') },
    })
    setEmailing(false)
    if (error) { toast('Failed to send: ' + error.message, 'error'); return }
    toast('Rota emailed to all staff ✓')
  }

  // ── Staff: submit swap request ──
  const submitSwapRequest = async () => {
    if (!swapForm.targetStaffId) { toast('Please select a colleague to swap with', 'error'); return }
    setSwapSaving(true)
    const targetStaff = staff.find((s) => s.id === swapForm.targetStaffId)
    const { error } = await supabase.rpc('create_swap_request', {
      p_token:          session?.token,
      p_shift_id:       swapModal.shift.id,
      p_target_staff_id: swapForm.targetStaffId,
      p_message:        swapForm.message.trim() || null,
    })
    setSwapSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast(`Swap request sent to ${targetStaff?.name ?? 'colleague'} ✓`)
    setSwapModal(null)
    reloadSwaps()
  }

  // ── Manager: approve swap ──
  const approveSwap = async (swap) => {
    setResolving(swap.id)
    const { error: shiftErr } = await supabase
      .from('shifts')
      .update({ staff_id: swap.target_staff_id })
      .eq('id', swap.shift_id)
    if (shiftErr) { toast(shiftErr.message, 'error'); setResolving(null); return }
    const { error } = await supabase
      .from('shift_swaps')
      .update({ status: 'approved', resolved_at: new Date().toISOString() })
      .eq('id', swap.id)
    setResolving(null)
    if (error) { toast(error.message, 'error'); return }
    toast('Swap approved — shift reassigned ✓')
    reloadSwaps()
    reload()
  }

  // ── Manager: reject swap ──
  const rejectSwap = async (swap) => {
    setResolving(swap.id)
    const { error } = await supabase
      .from('shift_swaps')
      .update({
        status:       'rejected',
        manager_note: rejectNote[swap.id]?.trim() || null,
        resolved_at:  new Date().toISOString(),
      })
      .eq('id', swap.id)
    setResolving(null)
    if (error) { toast(error.message, 'error'); return }
    toast('Swap request rejected')
    reloadSwaps()
  }

  // ── WhatsApp rota share ──
  const shareViaWhatsApp = () => {
    const currentShifts = shifts.filter(
      (sh) => sh.week_start === format(weekStart, 'yyyy-MM-dd')
    )
    const lines = [`SafeServ Rota — Week of ${format(weekStart, 'EEE d MMM')}\n`]
    for (let d = 0; d < 7; d++) {
      const date    = addDays(weekStart, d)
      const dateStr = format(date, 'yyyy-MM-dd')
      const dayShifts = currentShifts.filter((sh) => sh.shift_date === dateStr)
      if (dayShifts.length === 0) continue
      lines.push(`${format(date, 'EEEE d MMM')}`)
      for (const sh of dayShifts) {
        const staffMember = staff.find((s) => s.id === sh.staff_id)
        const name  = staffMember?.name ?? 'Unknown'
        const start = sh.start_time?.slice(0, 5) ?? ''
        const end   = sh.end_time?.slice(0, 5) ?? ''
        const role  = sh.role_label ? ` (${sh.role_label})` : ''
        lines.push(`• ${name} — ${start}–${end}${role}`)
      }
      lines.push('')
    }
    const text = lines.join('\n')
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  // ── Builder: batch save ──
  const batchSaveShifts = async (newShifts, isRebuild) => {
    if (isRebuild) {
      // Delete existing shifts for this week
      const wsStr = format(weekStart, 'yyyy-MM-dd')
      const { error: delErr } = await supabase.from('shifts').delete().eq('week_start', wsStr)
      if (delErr) { toast(delErr.message, 'error'); return }
    }
    const { error } = await supabase.from('shifts').insert(newShifts)
    if (error) { toast(error.message, 'error'); return }
    toast(`${newShifts.length} shifts created ✓`)
    reload()
  }

  // Derived data
  const duration = fmtDuration(form.startTime, form.endTime)
  const staffMemberForModal = modal ? staff.find((s) => s.id === modal?.staffMember?.id) : null
  const hourlyRate  = staffMemberForModal?.hourly_rate ?? 0
  const isUnder18   = staffMemberForModal?.is_under_18 ?? false
  const rawHrs      = shiftDurationHours(form.startTime, form.endTime)
  const breakMins   = duration ? unpaidBreakMins(rawHrs, isUnder18, breakDurationMins) : 0
  const paidHrs     = duration ? paidShiftHours(form.startTime, form.endTime, isUnder18, breakDurationMins) : 0
  const shiftWage   = hourlyRate > 0 && duration
    ? fmtGBP(paidHrs * hourlyRate)
    : null

  const pendingSwaps  = swaps.filter((s) => s.status === 'pending')
  const resolvedSwaps = swaps.filter((s) => s.status !== 'pending')

  // Staff that can be swapped with (exclude self)
  const swapCandidates = staff.filter((s) => s.id !== session?.staffId)

  return (
    <div className="flex flex-col gap-6">

      <div className="flex flex-wrap items-start justify-between gap-y-3">
        <h1 className="font-serif text-3xl text-brand">
          {isManager ? 'Rota Manager' : 'Rota'}
        </h1>
        {isManager && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {!closureMode && (
              <>
                <button
                  onClick={() => setShowConfig(true)}
                  className="text-[11px] tracking-widest uppercase text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20 hover:border-charcoal/40"
                >
                  ⚙ Configure
                </button>
                <button
                  onClick={() => setShowAI(true)}
                  className="text-[11px] tracking-widest uppercase text-accent/70 hover:text-accent transition-colors border-b border-accent/30 hover:border-accent/50"
                >
                  ✨ Auto-Fill
                </button>
                <button
                  onClick={emailRota}
                  disabled={emailing || shifts.length === 0}
                  className="text-[11px] tracking-widest uppercase text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {emailing ? 'Sending…' : '✉ Email'}
                </button>
                <button
                  onClick={shareViaWhatsApp}
                  disabled={shifts.length === 0}
                  className="text-[11px] tracking-widest uppercase text-green-600/70 hover:text-green-600 transition-colors border-b border-green-500/30 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  WhatsApp
                </button>
                <button
                  onClick={enterClosureMode}
                  className="text-[11px] tracking-widest uppercase text-danger/60 hover:text-danger transition-colors border-b border-danger/25 hover:border-danger/40"
                >
                  Mark Closed
                </button>
              </>
            )}
            {closureMode && (
              <div className="flex items-center gap-2">
                <button
                  onClick={cancelClosureMode}
                  className="text-[11px] tracking-widest uppercase text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20"
                >
                  Cancel
                </button>
                <button
                  onClick={saveClosures}
                  disabled={savingClosures}
                  className="text-[11px] tracking-widest uppercase bg-brand text-cream border border-brand/80 px-3 py-1.5 rounded-lg hover:bg-brand/90 transition-colors font-medium disabled:opacity-50"
                >
                  {savingClosures ? 'Saving…' : 'Save ✓'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Closure mode banner ── */}
      {closureMode && (
        <div className="rounded-xl border border-danger/25 bg-danger/5 px-5 py-4 flex items-start gap-3">
          <span className="text-lg shrink-0 mt-0.5">🔒</span>
          <div>
            <p className="text-sm font-semibold text-danger">Marking closed days</p>
            <p className="text-xs text-danger/70 mt-0.5">
              Tap any number of days to mark them closed — tap again to unmark.
              No shifts can be added on closed days. Hit <strong>Save ✓</strong> when done, or <strong>Cancel</strong> to discard changes.
            </p>
          </div>
        </div>
      )}

      {/* Availability legend (always visible for managers) */}
      {isManager && (
        <div className="flex items-center gap-4 flex-wrap px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-success/30 border border-success/30" />
            <span className="text-[11px] tracking-wider uppercase text-charcoal/30">Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-charcoal/15 border border-charcoal/20" />
            <span className="text-[11px] tracking-wider uppercase text-charcoal/30">Unavailable</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-danger/20 border border-danger/25" />
            <span className="text-[11px] tracking-wider uppercase text-charcoal/30">Time Off</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-charcoal/8 border border-charcoal/15" />
            <span className="text-[11px] tracking-wider uppercase text-charcoal/30">Closed</span>
          </div>
        </div>
      )}

      {/* ── Manager: pending swap requests banner ── */}
      {isManager && pendingCount > 0 && (
        <button
          onClick={() => setShowSwaps((v) => !v)}
          className="w-full text-left rounded-xl border border-warning/30 bg-warning/8 px-5 py-4 flex items-center justify-between hover:bg-warning/12 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">🔄</span>
            <div>
              <p className="text-sm font-semibold text-warning">
                {pendingCount} shift swap request{pendingCount !== 1 ? 's' : ''} pending
              </p>
              <p className="text-xs text-warning/70 mt-0.5">
                Tap to review and approve or reject
              </p>
            </div>
          </div>
          <span className="text-warning/60 text-lg">{showSwaps ? '▲' : '▼'}</span>
        </button>
      )}

      {/* ── Manager: swap requests panel ── */}
      {isManager && showSwaps && (
        <div className="bg-white rounded-xl border border-charcoal/10 overflow-hidden">
          <div className="px-5 py-4 border-b border-charcoal/8 flex items-center justify-between">
            <p className="text-[11px] tracking-widest uppercase text-charcoal/40">Shift Swap Requests</p>
            <button
              onClick={() => setShowSwaps(false)}
              className="text-xs text-charcoal/30 hover:text-charcoal transition-colors"
            >
              Close ×
            </button>
          </div>

          {swapsLoading ? (
            <div className="flex justify-center py-6"><LoadingSpinner /></div>
          ) : swaps.length === 0 ? (
            <p className="text-sm text-charcoal/35 italic px-5 py-6">No swap requests yet.</p>
          ) : (
            <div className="flex flex-col divide-y divide-charcoal/6">
              {/* Pending first */}
              {pendingSwaps.map((swap) => (
                <div key={swap.id} className="p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-charcoal text-sm">{swap.requester_name}</span>
                        <span className="text-charcoal/30 text-xs">→ swap with</span>
                        <span className="font-semibold text-charcoal text-sm">{swap.target_staff_name}</span>
                        <span className="text-[11px] tracking-widest uppercase px-2 py-0.5 rounded-full bg-warning/15 text-warning font-medium">
                          Pending
                        </span>
                      </div>
                      {swap.shift && (
                        <p className="text-xs text-charcoal/50 mt-1">
                          Shift: {swap.shift.shift_date} · {swap.shift.start_time?.slice(0,5)}–{swap.shift.end_time?.slice(0,5)}
                        </p>
                      )}
                      {swap.message && (
                        <p className="text-xs text-charcoal/60 mt-1 italic">"{swap.message}"</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      placeholder="Optional note for rejection…"
                      value={rejectNote[swap.id] ?? ''}
                      onChange={(e) => setRejectNote((n) => ({ ...n, [swap.id]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-cream/30 text-xs focus:outline-none focus:ring-2 focus:ring-charcoal/20 placeholder-charcoal/25"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => approveSwap(swap)}
                        disabled={resolving === swap.id}
                        className="flex-1 py-2 rounded-lg bg-success text-white text-xs font-medium hover:bg-success/90 transition-colors disabled:opacity-40"
                      >
                        {resolving === swap.id ? '…' : '✓ Approve'}
                      </button>
                      <button
                        onClick={() => rejectSwap(swap)}
                        disabled={resolving === swap.id}
                        className="flex-1 py-2 rounded-lg border border-danger/25 text-danger text-xs font-medium hover:bg-danger/5 transition-colors disabled:opacity-40"
                      >
                        {resolving === swap.id ? '…' : '✗ Reject'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Resolved requests */}
              {resolvedSwaps.length > 0 && (
                <>
                  <div className="px-5 py-2 bg-charcoal/3">
                    <p className="text-[11px] tracking-widest uppercase text-charcoal/30">Resolved</p>
                  </div>
                  {resolvedSwaps.map((swap) => (
                    <div key={swap.id} className="px-5 py-3 flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-charcoal/60">{swap.requester_name} → {swap.target_staff_name}</span>
                          <span className={`text-[11px] tracking-widest uppercase px-2 py-0.5 rounded-full font-medium ${
                            swap.status === 'approved'
                              ? 'bg-success/10 text-success'
                              : 'bg-danger/10 text-danger'
                          }`}>
                            {swap.status}
                          </span>
                        </div>
                        {swap.manager_note && (
                          <p className="text-xs text-charcoal/40 mt-0.5 italic">Note: {swap.manager_note}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Staff: my swap requests status ── */}
      {!isManager && session && (() => {
        const mySwaps = swaps.filter((s) => s.requester_id === session.staffId)
        if (mySwaps.length === 0) return null
        const myPending = mySwaps.filter((s) => s.status === 'pending')
        return (
          <div className={`rounded-xl border px-5 py-4 ${myPending.length > 0 ? 'bg-warning/5 border-warning/20' : 'bg-charcoal/4 border-charcoal/10'}`}>
            <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-2">My Swap Requests</p>
            <div className="flex flex-col gap-2">
              {mySwaps.slice(0, 3).map((swap) => (
                <div key={swap.id} className="flex items-center justify-between text-sm">
                  <span className="text-charcoal/70">
                    Swap with <span className="font-medium text-charcoal">{swap.target_staff_name}</span>
                    {swap.shift && <span className="text-xs text-charcoal/40 ml-1">({swap.shift.shift_date})</span>}
                  </span>
                  <span className={`text-[11px] tracking-widest uppercase px-2 py-0.5 rounded-full font-medium ${
                    swap.status === 'pending'   ? 'bg-warning/15 text-warning' :
                    swap.status === 'approved'  ? 'bg-success/10 text-success' :
                    'bg-danger/10 text-danger'
                  }`}>
                    {swap.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* ── Staff: hint banner ── */}
      {!isManager && (
        <div className="rounded-xl bg-charcoal/4 px-4 py-3 flex items-center gap-2">
          <span className="text-lg">💡</span>
          <p className="text-xs text-charcoal/50">
            Tap one of your shifts in the rota below to request a shift swap with a colleague.
          </p>
        </div>
      )}

      {/* ── Week count selector (manager only) ── */}
      {isManager && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] tracking-widest uppercase text-charcoal/40 font-medium">View</span>
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              onClick={() => setNumWeeks(n)}
              className={[
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                numWeeks === n
                  ? 'bg-charcoal text-cream border-charcoal'
                  : 'bg-white text-charcoal/50 border-charcoal/15 hover:border-charcoal/30 hover:text-charcoal',
              ].join(' ')}
            >
              {n} {n === 1 ? 'week' : 'weeks'}
            </button>
          ))}
        </div>
      )}

      {/* ── Rota grid(s) ── */}
      {Array.from({ length: numWeeks }, (_, wi) => {
        const thisWeekStart = addWeeks(weekStart, wi)
        const thisWeekShifts = shifts.filter(
          (sh) => sh.week_start === format(thisWeekStart, 'yyyy-MM-dd')
        )
        return (
          <div key={format(thisWeekStart, 'yyyy-MM-dd')} className="bg-white rounded-xl border border-charcoal/10 overflow-hidden">
            {/* Week nav header (only on first week) */}
            {wi === 0 && (
              <div className="flex items-center justify-between px-5 py-4 border-b border-charcoal/8">
                <button onClick={prevWeek} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-charcoal/8 text-charcoal/50 hover:text-charcoal transition-colors text-sm">‹</button>
                <span className="text-sm font-medium text-charcoal">
                  {format(weekStart, 'd MMM')} – {format(addWeeks(weekStart, numWeeks), 'd MMM yyyy')}
                </span>
                <button onClick={nextWeek} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-charcoal/8 text-charcoal/50 hover:text-charcoal transition-colors text-sm">›</button>
              </div>
            )}
            {/* Week label for multi-week view */}
            {numWeeks > 1 && (
              <div className="px-5 py-2 bg-charcoal/4 border-b border-charcoal/8">
                <p className="text-[11px] tracking-widest uppercase text-charcoal/50 font-medium">
                  Week {wi + 1} — {format(thisWeekStart, 'd MMM')} – {format(addWeeks(thisWeekStart, 1), 'd MMM')}
                </p>
              </div>
            )}

            {loading || staffLoading ? (
              <div className="flex justify-center py-10"><LoadingSpinner /></div>
            ) : (
              <RotaWeekView
                weekStart={thisWeekStart}
                shifts={thisWeekShifts}
                staff={staff}
                onCellClick={openStaffCell}
                onToggleAvailability={onToggleAvailability}
                currentStaffId={session?.staffId ?? null}
                isManager={isManager}
                unavailability={unavailability}
                closedDays={closedDays}
                closedDates={effectiveClosedDates}
                closureMode={closureMode}
                onToggleClosure={togglePendingClosure}
                breakDurationMins={breakDurationMins}
                crossShifts={crossShifts}
              />
            )}
          </div>
        )
      })}


      {/* ── Manager: shift modal ── */}
      {isManager && (
        <Modal
          open={!!modal}
          onClose={() => setModal(null)}
          title={modal ? `${modal.staffMember?.name} · ${format(modal.date ?? new Date(), 'EEE d MMM')}` : ''}
        >
          {modal && (
            <div className="flex flex-col gap-5">

              {/* Existing shifts for this day */}
              {modal.dayShifts?.length > 0 && (
                <div className="rounded-xl border border-warning/30 bg-warning/6 p-3 flex flex-col gap-2">
                  <p className="text-[11px] tracking-widest uppercase text-warning/80 font-semibold flex items-center gap-1.5">
                    <span>⚠</span> Already scheduled this day
                  </p>
                  {modal.dayShifts.map((sh) => (
                    <div key={sh.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 border border-charcoal/8">
                      <div>
                        <p className="font-semibold text-charcoal text-sm font-mono">
                          {sh.start_time.slice(0,5)} – {sh.end_time.slice(0,5)}
                          <span className="font-sans font-normal text-charcoal/40 text-xs ml-2">
                            {fmtDuration(sh.start_time, sh.end_time)}
                          </span>
                        </p>
                        <p className="text-xs text-charcoal/50 mt-0.5">{sh.role_label}</p>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => openEdit(sh)} className="text-xs px-2.5 py-1.5 rounded-lg border border-charcoal/15 text-charcoal/60 hover:text-charcoal hover:border-charcoal/30 transition-colors">Edit</button>
                        <button onClick={() => deleteShift(sh.id)} className="text-xs px-2.5 py-1.5 rounded-lg border border-danger/20 text-danger/60 hover:text-danger hover:border-danger/40 transition-colors">Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <SectionLabel>{editShift ? 'Edit Shift' : modal.dayShifts?.length > 0 ? 'Add Another Shift' : 'Add a Shift'}</SectionLabel>

              {/* Quick presets */}
              <div>
                <p className="text-[11px] tracking-widest uppercase text-charcoal/30 mb-2">Quick Presets</p>
                <div className="grid grid-cols-2 gap-2">
                  {SHIFT_PRESETS.map((p) => {
                    const active = form.startTime === p.start && form.endTime === p.end
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => applyPreset(p)}
                        className={[
                          'py-2 px-2 rounded-lg border text-xs font-medium transition-all text-center',
                          active
                            ? 'bg-charcoal text-cream border-charcoal'
                            : 'bg-white text-charcoal/60 border-charcoal/15 hover:border-charcoal/35 hover:text-charcoal',
                        ].join(' ')}
                      >
                        <p className="font-semibold">{p.label}</p>
                        <p className={`text-[11px] mt-0.5 ${active ? 'opacity-60' : 'text-charcoal/35'}`}>
                          {p.start}–{p.end}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Time pickers */}
              <div>
                <p className="text-[11px] tracking-widest uppercase text-charcoal/30 mb-2">Custom Times</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] tracking-widest uppercase text-charcoal/40">Start</label>
                    <TimeSelect
                      value={form.startTime}
                      onChange={(v) => setForm((f) => ({ ...f, startTime: v }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] tracking-widest uppercase text-charcoal/40">End</label>
                    <TimeSelect
                      value={form.endTime}
                      onChange={(v) => setForm((f) => ({ ...f, endTime: v }))}
                    />
                  </div>
                </div>

                {/* Duration + wage preview */}
                {duration && (
                  <div className="mt-3 rounded-xl bg-charcoal/4 px-4 py-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">⏱</span>
                        <div>
                          <p className="text-xs text-charcoal/50">Shift duration</p>
                          <p className="font-semibold text-charcoal">{duration}</p>
                        </div>
                      </div>
                      {shiftWage && (
                        <div className="text-right">
                          <p className="text-xs text-charcoal/50">Est. cost (paid hrs)</p>
                          <p className="font-semibold text-charcoal font-mono">{shiftWage}</p>
                        </div>
                      )}
                    </div>
                    {breakMins > 0 && (
                      <p className="text-[11px] text-charcoal/40 border-t border-charcoal/8 pt-2">
                        Includes {breakMins} min unpaid {isUnder18 ? 'break (under-18 rule)' : 'break'} — {paidHrs.toFixed(2)}h paid
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Role selector */}
              <div>
                <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-2">Role</p>
                {venueRoles.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {venueRoles.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, roleLabel: r.name }))}
                        className={[
                          'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                          form.roleLabel === r.name
                            ? 'bg-brand text-cream border-brand'
                            : 'bg-white text-charcoal/50 border-charcoal/15 hover:border-charcoal/30',
                        ].join(' ')}
                      >
                        {r.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <input
                      type="text"
                      value={form.roleLabel}
                      onChange={(e) => setForm((f) => ({ ...f, roleLabel: e.target.value }))}
                      placeholder="e.g. Chef, Barista, FOH…"
                      className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
                    />
                    <p className="text-[11px] text-charcoal/35">Add roles in Settings → Rota Roles to get quick-select chips here.</p>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-1 border-t border-charcoal/8">
                {editShift ? (
                  <button
                    onClick={() => deleteShift(editShift.id)}
                    className="text-xs text-danger/60 hover:text-danger transition-colors"
                  >
                    Delete shift
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex gap-2">
                  {editShift && (
                    <button
                      onClick={() => {
                        const lastRole = localStorage.getItem(`mise_last_role_${modal.staffMember.id}`) || venueRoles[0]?.name || ''
                        setEditShift(null)
                        setForm({ staffId: modal.staffMember.id, startTime: '09:00', endTime: '17:00', roleLabel: lastRole })
                      }}
                      className="px-4 py-2.5 rounded-lg border border-charcoal/15 text-sm text-charcoal/60 hover:text-charcoal hover:border-charcoal/30 transition-colors"
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button
                    onClick={saveShift}
                    disabled={saving || !duration}
                    className="bg-charcoal text-cream px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40"
                  >
                    {saving ? 'Saving…' : editShift ? 'Update Shift' : 'Add Shift →'}
                  </button>
                </div>
              </div>

            </div>
          )}
        </Modal>
      )}

      {/* ── Manager: AI rota builder modal ── */}
      {isManager && (
        <RotaBuilderModal
          open={showBuilder}
          onClose={() => setShowBuilder(false)}
          weekStart={weekStart}
          days={getWeekDays(weekStart)}
          staff={staff}
          shifts={shifts.filter(sh => sh.week_start === format(weekStart, 'yyyy-MM-dd'))}
          unavailability={unavailability}
          onSave={batchSaveShifts}
          customRoles={customRoles}
          closedDays={closedDays}
        />
      )}

      {/* ── AI auto-fill modal ── */}
      <RotaAIModal
        open={showAI}
        onClose={() => setShowAI(false)}
        weekStart={weekStart}
        onSave={batchSaveShifts}
      />

      {/* ── Rota config modal ── */}
      <RotaConfigModal
        open={showConfig}
        onClose={() => setShowConfig(false)}
        closedDayIndices={closedDays}
      />

      {/* ── Staff: swap request modal ── */}
      {!isManager && swapModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-charcoal/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 flex flex-col gap-5 shadow-2xl" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>

            <div>
              <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-1">Request Shift Swap</p>
              <h3 className="font-semibold text-charcoal text-lg">
                {swapModal.shift.start_time.slice(0,5)} – {swapModal.shift.end_time.slice(0,5)}
              </h3>
              <p className="text-sm text-charcoal/50 mt-0.5">
                {format(swapModal.date, 'EEEE d MMMM')} · {swapModal.shift.role_label}
              </p>
            </div>

            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">
                Swap with <span className="text-danger">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {swapCandidates.length === 0 ? (
                  <p className="text-sm text-charcoal/40 italic">No other staff members found.</p>
                ) : (
                  swapCandidates.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSwapForm((f) => ({ ...f, targetStaffId: s.id }))}
                      className={[
                        'px-4 py-2 rounded-lg border text-sm font-medium transition-all',
                        swapForm.targetStaffId === s.id
                          ? 'bg-charcoal text-cream border-charcoal'
                          : 'bg-white text-charcoal/60 border-charcoal/15 hover:border-charcoal/35',
                      ].join(' ')}
                    >
                      {s.name}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">
                Message (optional)
              </label>
              <textarea
                value={swapForm.message}
                onChange={(e) => setSwapForm((f) => ({ ...f, message: e.target.value }))}
                placeholder="e.g. I have a dentist appointment that morning…"
                rows={3}
                className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-cream/30 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={submitSwapRequest}
                disabled={swapSaving || !swapForm.targetStaffId}
                className="flex-1 bg-charcoal text-cream py-2.5 rounded-lg text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40"
              >
                {swapSaving ? 'Sending…' : 'Request Swap →'}
              </button>
              <button
                onClick={() => setSwapModal(null)}
                className="px-4 py-2.5 rounded-lg border border-charcoal/15 text-sm text-charcoal/50 hover:text-charcoal transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
