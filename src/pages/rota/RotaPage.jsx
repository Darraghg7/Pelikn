import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import RotaMobileGrid from './RotaMobileGrid'
import { useIsDesktop } from '../../hooks/useMediaQuery'
import { format, addDays, addWeeks, parseISO } from 'date-fns'
import {
  deleteVenueClosure, insertVenueClosures,
  insertShift, updateShift, deleteShift as deleteShiftRow, deleteDutyAssignmentsForShift,
  insertDutyAssignment, createSwapRequest, insertShifts, fetchShiftIdsForWeek, deleteShiftsByIds,
} from '../../lib/api/shifts'
import { sendPush } from '../../lib/sendPush'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useShifts, useStaffList } from '../../hooks/useShifts'
import { useCrossVenueShifts } from '../../hooks/useCrossVenueShifts'
import { useShiftSwaps } from '../../hooks/useShiftSwaps'
import { useAvailability } from '../../hooks/useAvailability'
import { useSession } from '../../contexts/SessionContext'
import { getWeekStart, getWeekDays } from '../../lib/utils'
import { useToast } from '../../components/ui/Toast'
import { reportError } from '../../lib/reportError'
import { useAppSettings } from '../../hooks/useSettings'
import { useVenueRoles, loadAllStaffRolesForVenue } from '../../hooks/useVenueRoles'
import RotaWeekView from './RotaWeekView'
import { closureDateSet, publishRota, shiftsVisibleToStaff, approveSwapRequest, declineSwapRequest } from '../../lib/rota'
import { useRotaPublished } from '../../hooks/useRotaPublished'
import { shareRotaImage } from '../../lib/rotaImageExport'
import RotaAutoFillModal from './RotaAutoFillModal'
import RotaConfigModal from './RotaConfigModal'
import RotaToolbar from './RotaToolbar'
import RotaShiftModal from './RotaShiftModal'
import RotaSwapPanel from './RotaSwapPanel'
import { SkeletonList } from '../../components/ui/Skeleton'
import { useDutyTemplates } from '../../hooks/useDuties'
import useVenueClosures from '../../hooks/useVenueClosures'
import { useQuery } from '@tanstack/react-query'
import StaffRotaView from './StaffRotaView'
import LoadError from '../../components/ui/LoadError'
import Button from '../../components/ui/Button'

const EMPTY_ROLES = {}

export default function RotaPage() {
  const toast = useToast()
  const { venueId, venueName } = useVenue()
  const { session, isManager, isRestricted } = useSession()
  const [searchParams] = useSearchParams()
  const personalView = searchParams.get('personal') === '1'
  const isDesktop = useIsDesktop()

  const [weekStart, setWeekStart] = useState(() => getWeekStart())
  const [numWeeks, setNumWeeks]   = useState(1)
  const { shifts, loading, isError: shiftsFailed, reload } = useShifts(weekStart, (isManager && !personalView) ? numWeeks : 2)
  const { staff, loading: staffLoading, isError: staffFailed, reload: reloadStaff } = useStaffList()
  // Staff only see weeks a manager has published (this week and next are loaded).
  const thisWeekPub = useRotaPublished(weekStart)
  const nextWeekPub = useRotaPublished(addWeeks(weekStart, 1))
  const crossShifts = useCrossVenueShifts(staff, weekStart, numWeeks, venueId)
  const { swaps, loading: swapsLoading, reload: reloadSwaps, pendingCount } = useShiftSwaps()
  const { unavailability, toggleAvailability } = useAvailability(weekStart, numWeeks)
  const { closedDays, breakDurationMins } = useAppSettings()
  const { roles: venueRoles } = useVenueRoles()

  // ── Staff roles map (for auto-fill) ──
  // Only the auto-fill reads this, so it loads when that modal opens.
  // Keyed on the cross-venue ids, not the staff array: that array is rebuilt
  // on most renders, and depending on it re-ran these queries in a loop.
  const crossVenueKey = staff.filter(s => s._crossVenue).map(s => s.id).sort().join(',')
  const [showAutoFill, setShowAutoFill] = useState(false)
  const { data: staffRoles = EMPTY_ROLES } = useQuery({
    queryKey: ['staff_roles_for_autofill', venueId, crossVenueKey],
    queryFn: () => loadAllStaffRolesForVenue(venueId, crossVenueKey ? crossVenueKey.split(',') : []),
    enabled: !!venueId && showAutoFill,
    staleTime: 5 * 60_000,
  })

  // ── Venue closures ──
  // Shared cache with the rest of the app, so this isn't fetched twice.
  const { closures, reload: loadClosures } = useVenueClosures()

  const closedDates = React.useMemo(() => closureDateSet(closures), [closures])

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
      if (existing) await deleteVenueClosure(existing.id)
    }
    if (toAdd.length > 0) {
      await insertVenueClosures(
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

  const [showConfig, setShowConfig]   = useState(false)

  // Shift modal state
  const [modal, setModal]         = useState(null)
  const [editShift, setEditShift] = useState(null)
  const [form, setForm]           = useState({ staffId: '', startTime: '09:00', endTime: '17:00', roleLabel: 'Chef', isClosing: false })
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
    const lastRole = localStorage.getItem(`mise_last_role_${staffMember.id}`)
      || staffMember.job_title
      || venueRoles[0]?.name || ''
    setForm({ staffId: staffMember.id, startTime: '09:00', endTime: '17:00', roleLabel: lastRole, isClosing: false })
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
      isClosing: sh.is_closing ?? false,
    })
    const { data, error } = await supabase
      .from('duty_assignments')
      .select('duty_template_id')
      .eq('shift_id', sh.id)
      .maybeSingle()
    // Saving rewrites the shift's duty from this form, so editing on a failed
    // read would silently remove the duty — close the editor instead.
    if (error) {
      reportError(error, 'RotaPage:shift-duty')
      toast("Couldn't load this shift — please try again", 'error')
      setEditShift(null)
      setModal(null)
      return
    }
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
      is_closing: !!form.isClosing,
      venue_id:   venueId,
    }
    let shiftId = editShift?.id
    if (editShift) {
      const { error } = await updateShift(editShift.id, payload)
      if (error) { toast(error.message, 'error'); setSaving(false); return }
    } else {
      const { data, error } = await insertShift(payload)
      if (error) { toast(error.message, 'error'); setSaving(false); return }
      shiftId = data.id
    }
    if (shiftId) {
      await deleteDutyAssignmentsForShift(shiftId)
      if (assignDuty && selectedDutyId) {
        await insertDutyAssignment({
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
    const { error } = await deleteShiftRow(shiftId)
    if (error) { toast(error.message, 'error'); return }
    toast('Shift removed')
    setModal(null)
    reload()
  }

  const emailRota = async () => {
    setEmailing(true)
    const { error: saveErr } = await publishRota({ venueId, weekStartStr: format(weekStart, 'yyyy-MM-dd'), shifts })
    setEmailing(false)
    if (saveErr) { toast('Failed to publish: ' + saveErr.message, 'error'); return }
    toast('Rota published ✓')
  }

  const submitSwapRequest = async () => {
    if (!swapForm.targetStaffId) { toast('Please select a colleague to swap with', 'error'); return }
    setSwapSaving(true)
    const targetStaff = staff.find((s) => s.id === swapForm.targetStaffId)
    const { error } = await createSwapRequest({
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
    })
  }

  const approveSwap = async (swap) => {
    setResolving(swap.id)
    const { error } = await approveSwapRequest(swap, venueId)
    setResolving(null)
    if (error) { toast(error.message, 'error'); return }
    toast('Swap approved — shift reassigned ✓')
    reloadSwaps()
    reload()
  }

  // `presetNote` is used when dismissing a swap for a shift that has already
  // passed, so the requester is told why rather than just "not approved".
  const rejectSwap = async (swap, presetNote) => {
    const note = presetNote ?? rejectNote[swap.id]?.trim() ?? ''
    setResolving(swap.id)
    const { error } = await declineSwapRequest(swap, venueId, note)
    setResolving(null)
    if (error) { toast(error.message, 'error'); return }
    toast(presetNote ? 'Expired swap request dismissed' : 'Swap request rejected')
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

  const [copyingWeek, setCopyingWeek] = useState(false)
  // State alone lets a quick second press through before the first re-renders.
  const copyingRef = useRef(false)

  const copyWeek = async () => {
    if (copyingRef.current) return
    copyingRef.current = true
    setCopyingWeek(true)
    try { await copyWeekInner() } finally { copyingRef.current = false; setCopyingWeek(false) }
  }

  const copyWeekInner = async () => {
    const targetWeekStr = format(weekStart, 'yyyy-MM-dd')
    const sourceWeekStart = addWeeks(weekStart, -1)
    const sourceWeekStr   = format(sourceWeekStart, 'yyyy-MM-dd')

    // Fetch shifts from previous week
    const { data: sourceShifts, error: fetchErr } = await supabase
      .from('shifts')
      .select('staff_id, shift_date, start_time, end_time, role_label, is_closing')
      .eq('venue_id', venueId)
      .eq('week_start', sourceWeekStr)
    if (fetchErr) { toast(fetchErr.message, 'error'); return }
    if (!sourceShifts?.length) { toast('No shifts in previous week to copy', 'error'); return }

    // Shifts already in this week are left alone, so pressing Copy twice (or
    // copying onto a part-built week) never doubles anything up.
    const { data: already, error: alreadyErr } = await supabase
      .from('shifts')
      .select('staff_id, shift_date, start_time, end_time')
      .eq('venue_id', venueId)
      .eq('week_start', targetWeekStr)
    if (alreadyErr) { toast(alreadyErr.message, 'error'); return }
    const shiftKey = (sh) => [sh.staff_id, sh.shift_date, (sh.start_time ?? '').slice(0, 5), (sh.end_time ?? '').slice(0, 5)].join('|')
    const alreadyThere = new Set((already ?? []).map(shiftKey))

    const closedDateSet = closedDates

    // Map each shift forward by 7 days, skipping closed dates
    const newShifts = sourceShifts
      .map(sh => {
        const newDate = format(addWeeks(parseISO(sh.shift_date), 1), 'yyyy-MM-dd')
        if (closedDateSet.has(newDate)) return null
        if (alreadyThere.has(shiftKey({ ...sh, shift_date: newDate }))) return null
        return {
          venue_id:   venueId,
          staff_id:   sh.staff_id,
          shift_date: newDate,
          week_start: targetWeekStr,
          start_time: sh.start_time,
          end_time:   sh.end_time,
          role_label: sh.role_label,
          // Dropped before, so a copied closing shift lost its closing checklist.
          is_closing: !!sh.is_closing,
        }
      })
      .filter(Boolean)

    if (!newShifts.length) { toast('Nothing to copy — the shifts are already here or land on closed days', 'error'); return }

    const { error: insertErr } = await insertShifts(newShifts)
    if (insertErr) { toast(insertErr.message, 'error'); return }
    toast(`${newShifts.length} shift${newShifts.length !== 1 ? 's' : ''} copied from previous week ✓`)
    reload()
  }

  const batchSaveShifts = async (newShifts, isRebuild) => {
    // A rebuild adds the new shifts first and removes the old ones after: it
    // used to delete the week and then insert, so a failed insert left the week
    // empty, with its swap requests and duties gone too.
    let oldIds = []
    if (isRebuild) {
      const { data, error: readErr } = await fetchShiftIdsForWeek(venueId, format(weekStart, 'yyyy-MM-dd'))
      if (readErr) { toast(readErr.message, 'error'); return }
      oldIds = (data ?? []).map((r) => r.id)
    }
    const { error } = await insertShifts(newShifts)
    if (error) { toast(error.message, 'error'); return }
    if (oldIds.length) {
      const { error: delErr } = await deleteShiftsByIds(oldIds)
      if (delErr) {
        toast('New shifts added, but the old ones could not be removed: ' + delErr.message, 'error')
        reload()
        return
      }
    }
    toast(`${newShifts.length} shifts created ✓`)
    reload()
  }

  const pendingSwaps  = swaps.filter((s) => s.status === 'pending')
  const resolvedSwaps = swaps.filter((s) => s.status !== 'pending')
  const swapCandidates = staff.filter((s) => s.id !== session?.staffId)

  if (!isManager || personalView) {
    // Managers viewing their own shifts see drafts too; staff do not.
    const publishKnown = (p) => p.published !== null || p.isError
    const visibleShifts = isManager
      ? shifts
      : shiftsVisibleToStaff(
          shifts,
          {
            [format(weekStart, 'yyyy-MM-dd')]: thisWeekPub.published === true,
            [format(addWeeks(weekStart, 1), 'yyyy-MM-dd')]: nextWeekPub.published === true,
          },
          format(getWeekStart(), 'yyyy-MM-dd'),
        )
    return (
      <StaffRotaView
        shifts={visibleShifts}
        staff={staff}
        loading={loading || staffLoading || (!isManager && !(publishKnown(thisWeekPub) && publishKnown(nextWeekPub)))}
        weekStart={weekStart}
        prevWeek={prevWeek}
        nextWeek={nextWeek}
        session={session}
        swapModal={swapModal}
        setSwapModal={setSwapModal}
        swapForm={swapForm}
        setSwapForm={setSwapForm}
        swapSaving={swapSaving}
        submitSwapRequest={submitSwapRequest}
        swapCandidates={swapCandidates}
        swaps={swaps}
        readOnly={isRestricted}
      />
    )
  }

  // Phones and narrow windows get the purpose-built mobile grid; it swaps live
  // if the window is resized across the breakpoint.
  if (!isDesktop) {
    return <RotaMobileGrid />
  }

  return (
    <div className="flex flex-col gap-6">

      <div className="hidden lg:block">
        <RotaToolbar
          isManager={isManager}
          closureMode={closureMode}
          showConfig={showConfig}
          setShowConfig={setShowConfig}
          setShowAutoFill={setShowAutoFill}
          emailRota={emailRota}
          emailing={emailing}
          shiftsCount={shifts.length}
          shareViaWhatsApp={shareViaWhatsApp}
          sharing={sharing}
          enterClosureMode={enterClosureMode}
          cancelClosureMode={cancelClosureMode}
          saveClosures={saveClosures}
          savingClosures={savingClosures}
          copyWeek={copyWeek}
          copyingWeek={copyingWeek}
        />
      </div>

      {/* ── Closure mode banner ── */}
      {closureMode && (
        <div className="rounded-card border border-danger/25 bg-danger/5 px-5 py-4 flex items-start gap-3">
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
        <div className="hidden lg:flex items-center gap-4 flex-wrap px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-tag bg-success/30 border border-success/30" />
            <span className="text-micro tracking-wider uppercase text-charcoal/30 dark:text-white/30">Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-tag bg-charcoal/15 dark:bg-white/15 border border-charcoal/20 dark:border-white/20" />
            <span className="text-micro tracking-wider uppercase text-charcoal/30 dark:text-white/30">Unavailable</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-tag bg-danger/20 border border-danger/25" />
            <span className="text-micro tracking-wider uppercase text-charcoal/30 dark:text-white/30">Time Off</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-tag bg-charcoal/8 dark:bg-white/8 border border-charcoal/15 dark:border-white/15" />
            <span className="text-micro tracking-wider uppercase text-charcoal/30 dark:text-white/30">Closed</span>
          </div>
        </div>
      )}

      {/* ── Manager: pending swap requests banner ── */}
      {isManager && pendingCount > 0 && (
        <button
          onClick={() => setShowSwaps((v) => !v)}
          className="w-full text-left rounded-card border border-warning/30 bg-warning/8 px-5 py-4 flex items-center justify-between hover:bg-warning/12 transition-colors"
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


      {/* ── Week count selector ── */}
      {isManager && (
        <div className="hidden lg:flex flex-wrap items-center gap-2">
          <span className="text-micro tracking-widest uppercase text-charcoal/40 dark:text-white/35 font-medium">View</span>
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              onClick={() => setNumWeeks(n)}
              className={[
                'px-3 py-1.5 rounded-control text-xs font-medium border transition-all',
                numWeeks === n
                  ? 'bg-charcoal text-cream border-charcoal dark:border-white'
                  : 'bg-white dark:bg-paperDark text-charcoal/50 dark:text-white/40 border-charcoal/15 dark:border-white/15 hover:border-charcoal/30 dark:hover:border-white/30 hover:text-charcoal dark:hover:text-white',
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
          <div key={format(thisWeekStart, 'yyyy-MM-dd')} className="bg-white dark:bg-paperDark rounded-card border-charcoal/10 dark:border-white/10 overflow-hidden">
            {wi === 0 && (
              <div className="flex items-center justify-between px-5 py-4 border-b border-charcoal/8 dark:border-white/8">
                <Button variant="secondary" size="sm" iconOnly aria-label="Previous week" onClick={prevWeek}>‹</Button>
                <span className="text-sm font-medium text-charcoal dark:text-white">
                  {/* Last day shown is the Sunday before the next Monday */}
                  {format(weekStart, 'd MMM')} – {format(addDays(addWeeks(weekStart, numWeeks), -1), 'd MMM yyyy')}
                </span>
                <Button variant="secondary" size="sm" iconOnly aria-label="Next week" onClick={nextWeek}>›</Button>
              </div>
            )}
            {numWeeks > 1 && (
              <div className="px-5 py-2 bg-charcoal/4 dark:bg-white/5 border-b border-charcoal/8 dark:border-white/8">
                <p className="text-micro tracking-widest uppercase text-charcoal/50 dark:text-white/40 font-medium">
                  Week {wi + 1} — {format(thisWeekStart, 'd MMM')} – {format(addWeeks(thisWeekStart, 1), 'd MMM')}
                </p>
              </div>
            )}
            {loading || staffLoading ? (
              <SkeletonList rows={4} />
            ) : shiftsFailed || staffFailed ? (
              // An empty grid from a failed read looks like a week with no shifts.
              <LoadError what="the rota" onRetry={() => { reload(); reloadStaff() }} />
            ) : (
              <RotaWeekView
                weekStart={thisWeekStart}
                shifts={thisWeekShifts}
                staff={staff}
                onCellClick={openStaffCell}
                onToggleAvailability={(staffId, date) => toggleAvailability(staffId, date).catch((e) => {
                  reportError(e, 'RotaPage:toggle-availability')
                  toast("Couldn't update availability. Please try again.", 'error')
                })}
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

      {/* ── Auto-fill modal ── */}
      <RotaAutoFillModal
        open={showAutoFill}
        onClose={() => setShowAutoFill(false)}
        weekStart={weekStart}
        onSave={batchSaveShifts}
        staff={staff}
        staffRoles={staffRoles}
        unavailability={unavailability}
        closedDays={closedDays}
        crossVenueShifts={crossShifts}
        existingShifts={shifts.filter((sh) => sh.week_start === format(weekStart, 'yyyy-MM-dd'))}
      />

      {/* ── Rota config modal ── */}
      <RotaConfigModal
        open={showConfig}
        onClose={() => setShowConfig(false)}
        closedDayIndices={closedDays}
      />

    </div>
  )
}
