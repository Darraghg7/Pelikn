import React, { useState, useEffect, useCallback } from 'react'
import { format, addWeeks, eachDayOfInterval, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { sendPush } from '../../lib/sendPush'
import { useVenue } from '../../contexts/VenueContext'
import { useShifts, useStaffList, shiftDurationHours, paidShiftHours, unpaidBreakMins } from '../../hooks/useShifts'
import { useCrossVenueShifts } from '../../hooks/useCrossVenueShifts'
import { useShiftSwaps } from '../../hooks/useShiftSwaps'
import { useAvailability } from '../../hooks/useAvailability'
import { useSession } from '../../contexts/SessionContext'
import { getWeekStart, getWeekDays } from '../../lib/utils'
import { useToast } from '../../components/ui/Toast'
import { useAppSettings } from '../../hooks/useSettings'
import { useVenueRoles } from '../../hooks/useVenueRoles'
import RotaWeekView from './RotaWeekView'
import { shareRotaImage } from '../../lib/rotaImageExport'
import RotaBuilderModal from './RotaBuilderModal'
import RotaAIModal from './RotaAIModal'
import RotaConfigModal from './RotaConfigModal'
import RotaToolbar from './RotaToolbar'
import RotaShiftModal from './RotaShiftModal'
import RotaSwapPanel from './RotaSwapPanel'
import RotaSwapRequestModal from './RotaSwapRequestModal'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useDutyTemplates } from '../../hooks/useDuties'

export default function RotaPage() {
  const toast = useToast()
  const { venueId, venueName } = useVenue()
  const { session, isManager } = useSession()

  const [weekStart, setWeekStart] = useState(() => getWeekStart())
  const [numWeeks, setNumWeeks]   = useState(1)
  const { shifts, loading, reload } = useShifts(weekStart, numWeeks)
  const { staff, loading: staffLoading } = useStaffList()
  const crossShifts = useCrossVenueShifts(staff, weekStart, numWeeks, venueId)
  const { swaps, loading: swapsLoading, reload: reloadSwaps, pendingCount } = useShiftSwaps()
  const { unavailability, toggleAvailability } = useAvailability(weekStart, numWeeks)
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

  // ── Closure mode ──
  const [closureMode, setClosureMode]       = useState(false)
  const [pendingClosed, setPendingClosed]   = useState(null)
  const [savingClosures, setSavingClosures] = useState(false)

  const enterClosureMode = () => {
    setPendingClosed(new Set(closedDates))
    setClosureMode(true)
  }

  const cancelClosureMode = () => {
    setPendingClosed(null)
    setClosureMode(false)
  }

  const togglePendingClosure = (dateStr) => {
    setPendingClosed(prev => {
      const next = new Set(prev)
      if (next.has(dateStr)) next.delete(dateStr)
      else next.add(dateStr)
      return next
    })
  }

  const saveClosures = async () => {
    if (!pendingClosed || savingClosures) return
    setSavingClosures(true)
    const toAdd    = [...pendingClosed].filter(d => !closedDates.has(d))
    const toDelete = [...closedDates].filter(d => !pendingClosed.has(d))
    for (const dateStr of toDelete) {
      const existing = closures.find(c => c.start_date === dateStr && c.end_date === dateStr)
      if (existing) await supabase.from('venue_closures').delete().eq('id', existing.id)
    }
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

  const effectiveClosedDates = closureMode && pendingClosed != null ? pendingClosed : closedDates

  const [showBuilder, setShowBuilder] = useState(false)
  const [showAI, setShowAI]           = useState(false)
  const [showConfig, setShowConfig]   = useState(false)

  // Shift modal state
  const [modal, setModal]         = useState(null)
  const [editShift, setEditShift] = useState(null)
  const [form, setForm]           = useState({ staffId: '', startTime: '09:00', endTime: '17:00', roleLabel: 'Chef' })
  const [saving, setSaving]       = useState(false)

  const { templates: dutyTemplates } = useDutyTemplates()
  const [assignDuty, setAssignDuty]         = useState(false)
  const [selectedDutyId, setSelectedDutyId] = useState(null)
  const [emailing, setEmailing] = useState(false)
  const [sharing, setSharing]   = useState(false)

  // Swap state
  const [swapModal, setSwapModal]   = useState(null)
  const [swapForm, setSwapForm]     = useState({ targetStaffId: '', message: '' })
  const [swapSaving, setSwapSaving] = useState(false)
  const [showSwaps, setShowSwaps]   = useState(false)
  const [rejectNote, setRejectNote] = useState({})
  const [resolving, setResolving]   = useState(null)

  const prevWeek = () => setWeekStart((w) => addWeeks(w, -numWeeks))
  const nextWeek = () => setWeekStart((w) => addWeeks(w, numWeeks))

  const openCell = (staffMember, date, dayShifts) => {
    if (!isManager) return
    if (closureMode) return
    const dateStr = format(date, 'yyyy-MM-dd')
    if (effectiveClosedDates.has(dateStr)) return
    setModal({ staffMember, date, dayShifts })
    const lastRole = localStorage.getItem(`mise_last_role_${staffMember.id}`) || venueRoles[0]?.name || ''
    setForm({ staffId: staffMember.id, startTime: '09:00', endTime: '17:00', roleLabel: lastRole })
    setEditShift(null)
    setAssignDuty(false)
    setSelectedDutyId(null)
  }

  const openStaffCell = (staffMember, date, dayShifts) => {
    if (isManager) return openCell(staffMember, date, dayShifts)
    if (staffMember.id !== session?.staffId) return
    if (dayShifts.length === 0) return
    setSwapModal({ staffMember, date, shift: dayShifts[0] })
    setSwapForm({ targetStaffId: '', message: '' })
  }

  const openEdit = async (sh) => {
    setEditShift(sh)
    setForm({
      staffId:   sh.staff_id,
      startTime: sh.start_time?.slice(0, 5) ?? '09:00',
      endTime:   sh.end_time?.slice(0, 5) ?? '17:00',
      roleLabel: sh.role_label,
    })
    const { data } = await supabase
      .from('duty_assignments')
      .select('duty_template_id')
      .eq('shift_id', sh.id)
      .maybeSingle()
    if (data) {
      setAssignDuty(true)
      setSelectedDutyId(data.duty_template_id)
    } else {
      setAssignDuty(false)
      setSelectedDutyId(null)
    }
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
    let shiftId = editShift?.id
    if (editShift) {
      const { error } = await supabase.from('shifts').update(payload).eq('id', editShift.id)
      if (error) { toast(error.message, 'error'); setSaving(false); return }
    } else {
      const { data, error } = await supabase.from('shifts').insert(payload).select('id').single()
      if (error) { toast(error.message, 'error'); setSaving(false); return }
      shiftId = data.id
    }
    if (shiftId) {
      await supabase.from('duty_assignments').delete().eq('shift_id', shiftId)
      if (assignDuty && selectedDutyId) {
        await supabase.from('duty_assignments').insert({
          venue_id:             venueId,
          shift_id:             shiftId,
          duty_template_id:     selectedDutyId,
          assigned_by_staff_id: session?.staffId ?? null,
        })
      }
    }
    setSaving(false)
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
    const weekStartStr = format(weekStart, 'yyyy-MM-dd')
    const { error: saveErr } = await supabase.from('app_settings').upsert({
      venue_id: venueId,
      key: `rota_published_${weekStartStr}`,
      value: new Date().toISOString(),
    })
    if (saveErr) { toast('Failed to publish: ' + saveErr.message, 'error'); setEmailing(false); return }
    const staffIds = [...new Set(shifts.map(s => s.staff_id).filter(Boolean))]
    if (staffIds.length) {
      sendPush({
        venueId,
        notificationType: 'rota_published',
        title: 'Rota Published',
        body:  `Your rota for the week of ${weekStartStr} is now available.`,
        url:   '/rota',
        staffIds,
      }).catch(() => {})
    }
    setEmailing(false)
    toast('Rota published ✓')
  }

  const submitSwapRequest = async () => {
    if (!swapForm.targetStaffId) { toast('Please select a colleague to swap with', 'error'); return }
    setSwapSaving(true)
    const targetStaff = staff.find((s) => s.id === swapForm.targetStaffId)
    const { error } = await supabase.rpc('create_swap_request', {
      p_token:           session?.token,
      p_shift_id:        swapModal.shift.id,
      p_target_staff_id: swapForm.targetStaffId,
      p_message:         swapForm.message.trim() || null,
    })
    setSwapSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast(`Swap request sent to ${targetStaff?.name ?? 'colleague'} ✓`)
    setSwapModal(null)
    reloadSwaps()
    sendPush({
      venueId,
      notificationType: 'shift_swap_request',
      title: 'Shift Swap Request',
      body:  `${session?.staffName ?? 'A staff member'} has requested a shift swap`,
      url:   '/rota',
      roles: ['manager', 'owner'],
    }).catch(() => {})
  }

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
    const staffIds = [swap.requester_id, swap.target_staff_id].filter(Boolean)
    if (staffIds.length) {
      sendPush({
        venueId,
        notificationType: 'shift_swap_decision',
        title: 'Shift Swap Approved',
        body:  'Your shift swap request has been approved. Check the rota for updates.',
        url:   '/rota',
        staffIds,
      }).catch(() => {})
    }
    reloadSwaps()
    reload()
  }

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
    if (swap.requester_id) {
      sendPush({
        venueId,
        notificationType: 'shift_swap_decision',
        title: 'Shift Swap Rejected',
        body:  `Your shift swap request was not approved.${rejectNote[swap.id]?.trim() ? ' Note: ' + rejectNote[swap.id].trim() : ''}`,
        url:   '/rota',
        staffIds: [swap.requester_id],
      }).catch(() => {})
    }
    reloadSwaps()
  }

  const shareViaWhatsApp = async () => {
    if (sharing) return
    setSharing(true)
    try {
      const days = getWeekDays(weekStart)
      const currentShifts = shifts.filter((sh) => sh.week_start === format(weekStart, 'yyyy-MM-dd'))
      const result = await shareRotaImage({ venueName, weekStart, days, shifts: currentShifts, staff, closedDays, closedDates })
      if (result === 'downloaded') toast('Rota image saved — share it on WhatsApp from your downloads')
    } catch {
      toast('Could not export rota image', 'error')
    } finally {
      setSharing(false)
    }
  }

  const batchSaveShifts = async (newShifts, isRebuild) => {
    if (isRebuild) {
      const wsStr = format(weekStart, 'yyyy-MM-dd')
      const { error: delErr } = await supabase
        .from('shifts')
        .delete()
        .eq('venue_id', venueId)
        .eq('week_start', wsStr)
      if (delErr) { toast(delErr.message, 'error'); return }
    }
    const { error } = await supabase.from('shifts').insert(newShifts)
    if (error) { toast(error.message, 'error'); return }
    toast(`${newShifts.length} shifts created ✓`)
    reload()
  }

  const pendingSwaps  = swaps.filter((s) => s.status === 'pending')
  const resolvedSwaps = swaps.filter((s) => s.status !== 'pending')
  const swapCandidates = staff.filter((s) => s.id !== session?.staffId)

  return (
    <div className="flex flex-col gap-6">

      <RotaToolbar
        isManager={isManager}
        closureMode={closureMode}
        showConfig={showConfig}
        setShowConfig={setShowConfig}
        setShowAI={setShowAI}
        emailRota={emailRota}
        emailing={emailing}
        shiftsCount={shifts.length}
        shareViaWhatsApp={shareViaWhatsApp}
        sharing={sharing}
        enterClosureMode={enterClosureMode}
        cancelClosureMode={cancelClosureMode}
        saveClosures={saveClosures}
        savingClosures={savingClosures}
      />

      {/* ── Closure mode banner ── */}
      {closureMode && (
        <div className="rounded-2xl border border-danger/25 bg-danger/5 px-5 py-4 flex items-start gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-danger shrink-0 mt-0.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <div>
            <p className="text-sm font-semibold text-danger">Marking closed days</p>
            <p className="text-xs text-danger/70 mt-0.5">
              Tap any number of days to mark them closed — tap again to unmark.
              No shifts can be added on closed days. Hit <strong>Save</strong> when done, or <strong>Cancel</strong> to discard changes.
            </p>
          </div>
        </div>
      )}

      {/* Availability legend */}
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
          className="w-full text-left rounded-2xl border border-warning/30 bg-warning/8 px-5 py-4 flex items-center justify-between hover:bg-warning/12 transition-colors"
        >
          <div className="flex items-center gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-warning shrink-0"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
            <div>
              <p className="text-sm font-semibold text-warning">
                {pendingCount} shift swap request{pendingCount !== 1 ? 's' : ''} pending
              </p>
              <p className="text-xs text-warning/70 mt-0.5">Tap to review and approve or reject</p>
            </div>
          </div>
          <span className="text-warning/60 text-lg">{showSwaps ? '▲' : '▼'}</span>
        </button>
      )}

      {/* ── Manager: swap panel ── */}
      {isManager && (
        <RotaSwapPanel
          showSwaps={showSwaps}
          setShowSwaps={setShowSwaps}
          swapsLoading={swapsLoading}
          swaps={swaps}
          pendingSwaps={pendingSwaps}
          resolvedSwaps={resolvedSwaps}
          rejectNote={rejectNote}
          setRejectNote={setRejectNote}
          resolving={resolving}
          approveSwap={approveSwap}
          rejectSwap={rejectSwap}
        />
      )}

      {/* ── Staff: my swap requests status ── */}
      {!isManager && session && (() => {
        const mySwaps = swaps.filter((s) => s.requester_id === session.staffId)
        if (mySwaps.length === 0) return null
        const myPending = mySwaps.filter((s) => s.status === 'pending')
        return (
          <div className={`rounded-2xl border px-5 py-4 ${myPending.length > 0 ? 'bg-warning/5 border-warning/20' : 'bg-charcoal/4 border-charcoal/10'}`}>
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
        <div className="rounded-2xl bg-charcoal/4 px-4 py-3 flex items-center gap-2">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-charcoal/30 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p className="text-xs text-charcoal/50">
            Tap one of your shifts in the rota below to request a shift swap with a colleague.
          </p>
        </div>
      )}

      {/* ── Week count selector ── */}
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
          <div key={format(thisWeekStart, 'yyyy-MM-dd')} className="bg-white rounded-2xl border-charcoal/10 overflow-hidden">
            {wi === 0 && (
              <div className="flex items-center justify-between px-5 py-4 border-b border-charcoal/8">
                <button onClick={prevWeek} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-charcoal/8 text-charcoal/50 hover:text-charcoal transition-colors text-sm">‹</button>
                <span className="text-sm font-medium text-charcoal">
                  {format(weekStart, 'd MMM')} – {format(addWeeks(weekStart, numWeeks), 'd MMM yyyy')}
                </span>
                <button onClick={nextWeek} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-charcoal/8 text-charcoal/50 hover:text-charcoal transition-colors text-sm">›</button>
              </div>
            )}
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
                onToggleAvailability={(staffId, date) => toggleAvailability(staffId, date)}
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
        <RotaShiftModal
          modal={modal}
          setModal={setModal}
          editShift={editShift}
          setEditShift={setEditShift}
          form={form}
          setForm={setForm}
          saving={saving}
          saveShift={saveShift}
          deleteShift={deleteShift}
          openEdit={openEdit}
          applyPreset={applyPreset}
          venueRoles={venueRoles}
          staff={staff}
          breakDurationMins={breakDurationMins}
          dutyTemplates={dutyTemplates}
          assignDuty={assignDuty}
          setAssignDuty={setAssignDuty}
          selectedDutyId={selectedDutyId}
          setSelectedDutyId={setSelectedDutyId}
        />
      )}

      {/* ── Manager: rota builder modal ── */}
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
          breakDurationMins={breakDurationMins}
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
      {!isManager && (
        <RotaSwapRequestModal
          swapModal={swapModal}
          setSwapModal={setSwapModal}
          swapForm={swapForm}
          setSwapForm={setSwapForm}
          swapSaving={swapSaving}
          submitSwapRequest={submitSwapRequest}
          swapCandidates={swapCandidates}
        />
      )}
    </div>
  )
}
