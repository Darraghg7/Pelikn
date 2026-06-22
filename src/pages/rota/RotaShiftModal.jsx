import React from 'react'
import Modal from '../../components/ui/Modal'
import TimeSelect from '../../components/ui/TimeSelect'
import Toggle from '../../components/ui/Toggle'
import { SHIFT_PRESETS } from '../../lib/constants'
import { format } from 'date-fns'
import { shiftDurationHours, paidShiftHours, unpaidBreakMins } from '../../hooks/useShifts'

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

export default function RotaShiftModal({
  modal,
  setModal,
  editShift,
  setEditShift,
  form,
  setForm,
  saving,
  saveShift,
  deleteShift,
  openEdit,
  applyPreset,
  venueRoles,
  staff,
  breakDurationMins,
  dutyTemplates,
  assignDuty,
  setAssignDuty,
  selectedDutyId,
  setSelectedDutyId,
}) {
  const staffMemberForModal = modal ? staff.find((s) => s.id === modal?.staffMember?.id) : null
  const hourlyRate  = staffMemberForModal?.hourly_rate ?? 0
  const isUnder18   = staffMemberForModal?.is_under_18 ?? false
  const duration    = fmtDuration(form.startTime, form.endTime)
  const rawHrs      = shiftDurationHours(form.startTime, form.endTime)
  const breakMins   = duration ? unpaidBreakMins(rawHrs, isUnder18, breakDurationMins) : 0
  const paidHrs     = duration ? paidShiftHours(form.startTime, form.endTime, isUnder18, breakDurationMins) : 0
  const shiftWage   = hourlyRate > 0 && duration
    ? fmtGBP(paidHrs * hourlyRate)
    : null

  return (
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
                <span className="text-warning"><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span> Already scheduled this day
              </p>
              {modal.dayShifts.map((sh) => (
                <div key={sh.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 border border-charcoal/8">
                  <div>
                    <p className="font-semibold text-charcoal text-sm font-mono">
                      {sh.start_time?.slice(0,5) ?? ''} – {sh.end_time?.slice(0,5) ?? ''}
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
                  placeholder="e.g. Manager, Team Lead…"
                  className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
                />
                <p className="text-[11px] text-charcoal/35">Add roles in Settings → Rota Roles to get quick-select chips here.</p>
              </div>
            )}
          </div>

          {/* Duty assignment */}
          {dutyTemplates.length > 0 && (
            <div className="border-t border-charcoal/8 pt-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium text-charcoal">Assign duty?</p>
                  <p className="text-[11px] text-charcoal/40 mt-0.5">Optional task checklist for this shift</p>
                </div>
                <Toggle
                  checked={assignDuty}
                  onChange={() => { setAssignDuty(v => !v); setSelectedDutyId(null) }}
                />
              </div>
              {assignDuty && (
                <div className="flex flex-col gap-2">
                  {dutyTemplates.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedDutyId(t.id)}
                      className={[
                        'text-left px-3 py-2.5 rounded-xl border text-sm transition-all',
                        selectedDutyId === t.id
                          ? 'border-brand bg-brand/5 text-brand font-medium'
                          : 'border-charcoal/12 text-charcoal hover:border-charcoal/30',
                      ].join(' ')}
                    >
                      {t.title}
                      <span className="text-[11px] text-charcoal/35 font-normal ml-2">
                        {t.items.length} task{t.items.length !== 1 ? 's' : ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Validation message */}
          {!duration && (
            <p className="text-xs text-danger/70 -mt-2">
              End time must be after start time to save this shift.
            </p>
          )}

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
                    setAssignDuty(false)
                    setSelectedDutyId(null)
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
  )
}
