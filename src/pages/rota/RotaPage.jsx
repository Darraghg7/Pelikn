import React, { useState } from 'react'
import { format, addWeeks } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useShifts, useStaffList, shiftDurationHours } from '../../hooks/useShifts'
import { useShiftSwaps } from '../../hooks/useShiftSwaps'
import { useSession } from '../../contexts/SessionContext'
import { getWeekStart } from '../../lib/utils'
import { useToast } from '../../components/ui/Toast'
import RotaWeekView from './RotaWeekView'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'

const ROLE_OPTIONS = [
  { label: 'Chef',            color: 'bg-orange-100 text-orange-800' },
  { label: 'Sous Chef',       color: 'bg-amber-100 text-amber-800' },
  { label: 'Kitchen Porter',  color: 'bg-yellow-100 text-yellow-800' },
  { label: 'Front of House',  color: 'bg-blue-100 text-blue-800' },
  { label: 'Bartender',       color: 'bg-purple-100 text-purple-800' },
  { label: 'Barista',         color: 'bg-teal-100 text-teal-800' },
  { label: 'Supervisor',      color: 'bg-indigo-100 text-indigo-800' },
  { label: 'Manager',         color: 'bg-rose-100 text-rose-800' },
]

const SHIFT_PRESETS = [
  { label: 'Morning', start: '07:00', end: '12:00' },
  { label: 'Day',     start: '08:00', end: '15:00' },
]

function SectionLabel({ children }) {
  return <p className="text-[10px] tracking-widest uppercase text-charcoal/40 mb-1">{children}</p>
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
  const { session, isManager } = useSession()

  const [weekStart, setWeekStart] = useState(() => getWeekStart())
  const { shifts, loading, reload } = useShifts(weekStart)
  const { staff, loading: staffLoading } = useStaffList()
  const { swaps, loading: swapsLoading, reload: reloadSwaps, pendingCount } = useShiftSwaps()

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

  const prevWeek = () => setWeekStart((w) => addWeeks(w, -1))
  const nextWeek = () => setWeekStart((w) => addWeeks(w, 1))

  // ── Manager: shift cell click ──
  const openCell = (staffMember, date, dayShifts) => {
    if (!isManager) return // staff handled separately via RotaWeekView callback
    setModal({ staffMember, date, dayShifts })
    setForm({ staffId: staffMember.id, startTime: '09:00', endTime: '17:00', roleLabel: 'Chef' })
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
      week_start: format(weekStart, 'yyyy-MM-dd'),
      start_time: form.startTime,
      end_time:   form.endTime,
      role_label: form.roleLabel,
    }
    const { error } = editShift
      ? await supabase.from('shifts').update(payload).eq('id', editShift.id)
      : await supabase.from('shifts').insert(payload)
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
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

  // Derived data
  const duration = fmtDuration(form.startTime, form.endTime)
  const staffMemberForModal = modal ? staff.find((s) => s.id === modal?.staffMember?.id) : null
  const hourlyRate = staffMemberForModal?.hourly_rate ?? 0
  const shiftWage  = hourlyRate > 0 && duration
    ? fmtGBP(shiftDurationHours(form.startTime, form.endTime) * hourlyRate)
    : null

  const selectedRole = ROLE_OPTIONS.find((r) => r.label === form.roleLabel)

  const pendingSwaps  = swaps.filter((s) => s.status === 'pending')
  const resolvedSwaps = swaps.filter((s) => s.status !== 'pending')

  // Staff that can be swapped with (exclude self)
  const swapCandidates = staff.filter((s) => s.id !== session?.staffId)

  return (
    <div className="flex flex-col gap-6">

      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl text-charcoal">
          {isManager ? 'Rota Manager' : 'Rota'}
        </h1>
        {isManager && (
          <button
            onClick={emailRota}
            disabled={emailing || shifts.length === 0}
            className="text-[11px] tracking-widest uppercase text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {emailing ? 'Sending…' : '✉ Email Rota'}
          </button>
        )}
      </div>

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
            <p className="text-[10px] tracking-widest uppercase text-charcoal/40">Shift Swap Requests</p>
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
                        <span className="text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-full bg-warning/15 text-warning font-medium">
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
                    <p className="text-[10px] tracking-widest uppercase text-charcoal/30">Resolved</p>
                  </div>
                  {resolvedSwaps.map((swap) => (
                    <div key={swap.id} className="px-5 py-3 flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-charcoal/60">{swap.requester_name} → {swap.target_staff_name}</span>
                          <span className={`text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-full font-medium ${
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
            <p className="text-[10px] tracking-widest uppercase text-charcoal/40 mb-2">My Swap Requests</p>
            <div className="flex flex-col gap-2">
              {mySwaps.slice(0, 3).map((swap) => (
                <div key={swap.id} className="flex items-center justify-between text-sm">
                  <span className="text-charcoal/70">
                    Swap with <span className="font-medium text-charcoal">{swap.target_staff_name}</span>
                    {swap.shift && <span className="text-xs text-charcoal/40 ml-1">({swap.shift.shift_date})</span>}
                  </span>
                  <span className={`text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-full font-medium ${
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

      {/* ── Rota grid ── */}
      <div className="bg-white rounded-xl border border-charcoal/10 overflow-hidden">
        {/* Week nav header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-charcoal/8">
          <button onClick={prevWeek} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-charcoal/8 text-charcoal/50 hover:text-charcoal transition-colors text-sm">‹</button>
          <span className="text-sm font-medium text-charcoal">
            {format(weekStart, 'd MMM')} – {format(addWeeks(weekStart, 1), 'd MMM yyyy')}
          </span>
          <button onClick={nextWeek} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-charcoal/8 text-charcoal/50 hover:text-charcoal transition-colors text-sm">›</button>
        </div>

        {loading || staffLoading ? (
          <div className="flex justify-center py-10"><LoadingSpinner /></div>
        ) : (
          <RotaWeekView
            weekStart={weekStart}
            shifts={shifts}
            staff={staff}
            onCellClick={openStaffCell}
            currentStaffId={session?.staffId ?? null}
            isManager={isManager}
          />
        )}
      </div>

      {/* ── Manager: shift modal ── */}
      {isManager && (
        <Modal
          open={!!modal}
          onClose={() => setModal(null)}
          title={modal ? `${modal.staffMember?.name} — ${format(modal.date ?? new Date(), 'EEE d MMM')}` : ''}
        >
          {modal && (
            <div className="flex flex-col gap-5">

              {/* Existing shifts for this day */}
              {modal.dayShifts?.length > 0 && (
                <div className="flex flex-col gap-2">
                  <SectionLabel>Existing Shifts</SectionLabel>
                  {modal.dayShifts.map((sh) => (
                    <div key={sh.id} className="flex items-center justify-between bg-charcoal/4 rounded-xl px-4 py-3 border border-charcoal/8">
                      <div>
                        <p className="font-semibold text-charcoal text-sm font-mono">
                          {sh.start_time.slice(0,5)} – {sh.end_time.slice(0,5)}
                          <span className="font-sans font-normal text-charcoal/40 text-xs ml-2">
                            · {fmtDuration(sh.start_time, sh.end_time)}
                          </span>
                        </p>
                        <p className="text-xs text-charcoal/50 mt-0.5">{sh.role_label}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(sh)} className="text-xs px-3 py-1.5 rounded-lg border border-charcoal/15 text-charcoal/60 hover:text-charcoal hover:border-charcoal/30 transition-colors">Edit</button>
                        <button onClick={() => deleteShift(sh.id)} className="text-xs px-3 py-1.5 rounded-lg border border-danger/20 text-danger/60 hover:text-danger hover:border-danger/40 transition-colors">Remove</button>
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-charcoal/8 pt-1" />
                </div>
              )}

              <SectionLabel>{editShift ? 'Edit Shift' : 'Add a Shift'}</SectionLabel>

              {/* Quick presets */}
              <div>
                <p className="text-[10px] tracking-widest uppercase text-charcoal/30 mb-2">Quick Presets</p>
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
                        <p className={`text-[10px] mt-0.5 ${active ? 'opacity-60' : 'text-charcoal/35'}`}>
                          {p.start}–{p.end}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Time pickers */}
              <div>
                <p className="text-[10px] tracking-widest uppercase text-charcoal/30 mb-2">Custom Times</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] tracking-widest uppercase text-charcoal/40">Start</label>
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                      className="px-3 py-3 rounded-xl border border-charcoal/15 bg-cream/40 focus:outline-none focus:ring-2 focus:ring-charcoal/20 text-sm font-mono text-center"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] tracking-widest uppercase text-charcoal/40">End</label>
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                      className="px-3 py-3 rounded-xl border border-charcoal/15 bg-cream/40 focus:outline-none focus:ring-2 focus:ring-charcoal/20 text-sm font-mono text-center"
                    />
                  </div>
                </div>

                {/* Duration + wage preview */}
                {duration && (
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-charcoal/4 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">⏱</span>
                      <div>
                        <p className="text-xs text-charcoal/50">Shift duration</p>
                        <p className="font-semibold text-charcoal">{duration}</p>
                      </div>
                    </div>
                    {shiftWage && (
                      <div className="text-right">
                        <p className="text-xs text-charcoal/50">Est. cost</p>
                        <p className="font-semibold text-charcoal font-mono">{shiftWage}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Role selector — coloured chips */}
              <div>
                <p className="text-[10px] tracking-widest uppercase text-charcoal/40 mb-2">Role</p>
                <div className="flex flex-wrap gap-2">
                  {ROLE_OPTIONS.map((r) => (
                    <button
                      key={r.label}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, roleLabel: r.label }))}
                      className={[
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                        form.roleLabel === r.label
                          ? `${r.color} border-transparent ring-2 ring-offset-1 ring-charcoal/30`
                          : 'bg-white text-charcoal/50 border-charcoal/15 hover:border-charcoal/30',
                      ].join(' ')}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
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
                      onClick={() => { setEditShift(null); setForm({ staffId: modal.staffMember.id, startTime: '09:00', endTime: '17:00', roleLabel: 'Chef' }) }}
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

      {/* ── Staff: swap request modal ── */}
      {!isManager && swapModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-charcoal/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 flex flex-col gap-5 shadow-2xl">

            <div>
              <p className="text-[10px] tracking-widest uppercase text-charcoal/40 mb-1">Request Shift Swap</p>
              <h3 className="font-semibold text-charcoal text-lg">
                {swapModal.shift.start_time.slice(0,5)} – {swapModal.shift.end_time.slice(0,5)}
              </h3>
              <p className="text-sm text-charcoal/50 mt-0.5">
                {format(swapModal.date, 'EEEE d MMMM')} · {swapModal.shift.role_label}
              </p>
            </div>

            <div>
              <label className="text-[10px] tracking-widests uppercase text-charcoal/40 block mb-2">
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
              <label className="text-[10px] tracking-widests uppercase text-charcoal/40 block mb-2">
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
