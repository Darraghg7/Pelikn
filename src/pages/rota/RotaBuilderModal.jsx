import React, { useState } from 'react'
import { format } from 'date-fns'
import Modal from '../../components/ui/Modal'
import { buildRota } from '../../lib/rotaBuilder'
import TimeSelect from '../../components/ui/TimeSelect'

function SectionLabel({ children }) {
  return <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-2">{children}</p>
}

export default function RotaBuilderModal({
  open,
  onClose,
  weekStart,
  days,
  staff,
  shifts,
  unavailability,
  onSave,
  customRoles = [],
  closedDays = [],
  breakDurationMins = 30,
}) {
  const [mode, setMode] = useState('fill_gaps')
  const [minStaff, setMinStaff] = useState(2)
  const [maxStaff, setMaxStaff] = useState(staff.length || 10)
  const [defaultStart, setDefaultStart] = useState('09:00')
  const [defaultEnd, setDefaultEnd] = useState('17:00')
  const [requiredRoles, setRequiredRoles] = useState(
    customRoles.map(r => ({ role: r.label, min: 0 }))
  )

  // Preview state
  const [result, setResult] = useState(null)
  const [saving, setSaving] = useState(false)

  // Sync roles when customRoles change (e.g. on first load)
  const syncedRoles = customRoles.map(r => {
    const existing = requiredRoles.find(rr => rr.role === r.label)
    return { role: r.label, min: existing?.min ?? 0 }
  })

  const updateRoleMin = (role, val) => {
    setRequiredRoles(prev =>
      prev.map(r => r.role === role ? { ...r, min: Math.max(0, parseInt(val) || 0) } : r)
    )
  }

  const generate = () => {
    const output = buildRota({
      staff,
      days,
      unavailability,
      existingShifts: shifts,
      weekStart: format(weekStart, 'yyyy-MM-dd'),
      breakDurationMins,
      preferences: {
        mode,
        minStaffPerDay: minStaff,
        maxStaffPerDay: maxStaff,
        requiredRoles: syncedRoles.filter(r => r.min > 0),
        requiredSkills: [],
        defaultStart,
        defaultEnd,
        closedDays,
      },
    })
    setResult(output)
  }

  const removeShift = (idx) => {
    if (!result) return
    const updated = [...result.generatedShifts]
    updated.splice(idx, 1)
    setResult({ ...result, generatedShifts: updated })
  }

  const handleSave = async () => {
    if (!result || result.generatedShifts.length === 0) return
    setSaving(true)
    // Strip _staffName before saving
    const cleanShifts = result.generatedShifts.map(({ _staffName, ...rest }) => rest)
    await onSave(cleanShifts, mode === 'rebuild')
    setSaving(false)
    setResult(null)
    onClose()
  }

  const handleClose = () => {
    setResult(null)
    onClose()
  }

  const closedDayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <Modal open={open} onClose={handleClose} title="Auto-Fill Rota">
      <div className="flex flex-col gap-5 max-h-[70vh] overflow-y-auto">

        {!result ? (
          <>
            {/* Mode */}
            <div>
              <SectionLabel>Mode</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'fill_gaps', label: 'Fill Gaps', desc: 'Keep existing shifts, fill empty slots' },
                  { value: 'rebuild', label: 'Rebuild', desc: 'Clear week and build from scratch' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setMode(opt.value)}
                    className={[
                      'p-3 rounded-xl border text-left transition-all',
                      mode === opt.value
                        ? 'bg-charcoal text-cream border-charcoal'
                        : 'bg-white text-charcoal/60 border-charcoal/15 hover:border-charcoal/30',
                    ].join(' ')}
                  >
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className={`text-[11px] mt-0.5 ${mode === opt.value ? 'text-cream/60' : 'text-charcoal/35'}`}>
                      {opt.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Closed days info */}
            {closedDays.length > 0 && (
              <div className="rounded-lg bg-charcoal/4 border border-charcoal/10 px-3 py-2">
                <p className="text-[11px] tracking-widest uppercase text-charcoal/35 mb-1">Closed Days (skipped)</p>
                <div className="flex gap-1.5 flex-wrap">
                  {closedDays.sort((a, b) => a - b).map(d => (
                    <span key={d} className="text-xs text-charcoal/40 bg-charcoal/8 px-2 py-0.5 rounded line-through">
                      {closedDayNames[d]}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Staffing */}
            <div>
              <SectionLabel>Staffing per Day</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] tracking-widest uppercase text-charcoal/30 block mb-1">Minimum</label>
                  <input
                    type="number"
                    min={1}
                    max={staff.length}
                    value={minStaff}
                    onChange={e => setMinStaff(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 bg-cream/30 text-sm text-center focus:outline-none focus:ring-2 focus:ring-charcoal/20"
                  />
                </div>
                <div>
                  <label className="text-[11px] tracking-widest uppercase text-charcoal/30 block mb-1">Maximum</label>
                  <input
                    type="number"
                    min={minStaff}
                    max={staff.length}
                    value={maxStaff}
                    onChange={e => setMaxStaff(parseInt(e.target.value) || staff.length)}
                    className="w-full px-3 py-2.5 rounded-xl border border-charcoal/15 bg-cream/30 text-sm text-center focus:outline-none focus:ring-2 focus:ring-charcoal/20"
                  />
                </div>
              </div>
            </div>

            {/* Default Shift Times */}
            <div>
              <SectionLabel>Default Shift Times</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] tracking-widest uppercase text-charcoal/30 block mb-1">Start</label>
                  <TimeSelect value={defaultStart} onChange={setDefaultStart} />
                </div>
                <div>
                  <label className="text-[11px] tracking-widest uppercase text-charcoal/30 block mb-1">End</label>
                  <TimeSelect value={defaultEnd} onChange={setDefaultEnd} />
                </div>
              </div>
            </div>

            {/* Required Roles per Day */}
            <div>
              <SectionLabel>Required Roles per Day</SectionLabel>
              <p className="text-[11px] text-charcoal/30 mb-2">
                Set minimum count for each role needed daily. Leave 0 to skip.
              </p>
              {customRoles.length === 0 ? (
                <p className="text-xs text-charcoal/30 italic">No roles configured. Add roles in Settings.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {customRoles.map(r => {
                    const current = syncedRoles.find(sr => sr.role === r.label)
                    return (
                      <div key={r.value} className="flex items-center gap-2 rounded-lg border border-charcoal/10 px-3 py-2">
                        <span className={`w-2 h-2 rounded-full ${r.color?.split(' ')[0] ?? 'bg-charcoal/20'}`} />
                        <span className="text-xs text-charcoal/70 flex-1 truncate">{r.label}</span>
                        <input
                          type="number"
                          min={0}
                          max={staff.length}
                          value={current?.min ?? 0}
                          onChange={e => updateRoleMin(r.label, e.target.value)}
                          className="w-12 px-1 py-1 rounded border border-charcoal/15 text-xs text-center focus:outline-none focus:ring-1 focus:ring-charcoal/20"
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Generate */}
            <button
              onClick={generate}
              className="bg-charcoal text-cream py-3 rounded-xl text-sm font-medium hover:bg-charcoal/90 transition-colors flex items-center justify-center gap-2"
            >
              <span>✨</span>
              Generate Rota
            </button>
          </>
        ) : (
          /* ── Preview ── */
          <>
            {/* Stats */}
            <div className="bg-accent/8 rounded-xl p-4 border border-accent/15">
              <p className="text-[11px] tracking-widest uppercase text-accent/60 mb-2">Generation Summary</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="font-serif text-2xl text-charcoal">{result.stats.totalShiftsCreated}</p>
                  <p className="text-[11px] text-charcoal/40">Shifts</p>
                </div>
                <div>
                  <p className="font-serif text-2xl text-charcoal">{result.stats.totalHours.toFixed(0)}h</p>
                  <p className="text-[11px] text-charcoal/40">Paid Hours</p>
                </div>
                <div>
                  <p className="font-serif text-2xl text-charcoal">£{result.stats.estimatedCost.toFixed(0)}</p>
                  <p className="text-[11px] text-charcoal/40">Est. Cost</p>
                </div>
              </div>
            </div>

            {/* Staff breakdown */}
            {result.stats.staffHoursBreakdown.length > 0 && (
              <div>
                <SectionLabel>Staff Hours Breakdown</SectionLabel>
                <div className="flex flex-col gap-1">
                  {result.stats.staffHoursBreakdown.map(s => (
                    <div key={s.staffId} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-charcoal/3">
                      <span className="text-charcoal/70">{s.name}</span>
                      <span className="font-mono text-charcoal">
                        {s.existingHours > 0 && (
                          <span className="text-charcoal/30">{s.existingHours.toFixed(1)}h existing + </span>
                        )}
                        {s.newHours.toFixed(1)}h new
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div>
                <SectionLabel>Warnings</SectionLabel>
                <div className="flex flex-col gap-1">
                  {result.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs px-3 py-2 rounded-lg bg-warning/8 border border-warning/15">
                      <span className="text-warning mt-0.5">⚠</span>
                      <span className="text-charcoal/70">{w.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Generated shifts list */}
            <div>
              <SectionLabel>Generated Shifts ({result.generatedShifts.length})</SectionLabel>
              {result.generatedShifts.length === 0 ? (
                <p className="text-sm text-charcoal/30 italic">No shifts generated. Adjust your settings and try again.</p>
              ) : (
                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                  {result.generatedShifts.map((sh, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-charcoal/3 border border-charcoal/6">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="text-xs font-medium text-charcoal">{sh._staffName}</p>
                          <p className="text-[11px] text-charcoal/40">
                            {sh.shift_date} · {sh.start_time}–{sh.end_time} · {sh.role_label}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeShift(i)}
                        className="text-danger/40 hover:text-danger text-xs transition-colors px-2"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving || result.generatedShifts.length === 0}
                className="flex-1 bg-charcoal text-cream py-3 rounded-xl text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40"
              >
                {saving ? 'Saving…' : `Accept & Save (${result.generatedShifts.length} shifts)`}
              </button>
              <button
                onClick={() => setResult(null)}
                className="px-4 py-3 rounded-xl border border-charcoal/15 text-sm text-charcoal/50 hover:text-charcoal transition-colors"
              >
                Back
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
