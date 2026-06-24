import React, { useState } from 'react'
import Modal from '../../components/ui/Modal'
import TimeSelect from '../../components/ui/TimeSelect'
import { useVenueRoles } from '../../hooks/useVenueRoles'
import { useRotaRequirements, DAY_NAMES, DAY_SHORT } from '../../hooks/useRotaRequirements'
import { useToast } from '../../components/ui/Toast'

function SectionLabel({ children }) {
  return <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-2">{children}</p>
}

const EMPTY_SLOT = { role_id: '', role_name: '', staff_count: 1, start_time: '09:00', end_time: '17:00', label: '' }

// ── Single slot row ───────────────────────────────────────────────────────────
function SlotRow({ slot, roles, onDelete, onSave, isNew = false }) {
  const [form, setForm]     = useState({ ...EMPTY_SLOT, ...slot })
  const [saving, setSaving] = useState(false)
  const toast               = useToast()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleRoleChange = (roleId) => {
    const role = roles.find(r => r.id === roleId)
    set('role_id', roleId)
    set('role_name', role?.name ?? '')
  }

  const handleSave = async () => {
    if (!form.role_id) { toast('Please select a role', 'error'); return }
    if (!form.start_time || !form.end_time) { toast('Please set shift times', 'error'); return }
    setSaving(true)
    await onSave(form)
    setSaving(false)
    if (isNew) setForm({ ...EMPTY_SLOT })
  }

  const changed = JSON.stringify(form) !== JSON.stringify({ ...EMPTY_SLOT, ...slot })

  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl border border-charcoal/10 bg-charcoal/[0.02]">
      {/* Row 1: Role + Count */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={form.role_id}
          onChange={e => handleRoleChange(e.target.value)}
          className="flex-1 min-w-[130px] px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20"
        >
          <option value="">Select role…</option>
          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-charcoal/40 whitespace-nowrap">× staff</span>
          <input
            type="number" min={1} max={20} value={form.staff_count}
            onChange={e => set('staff_count', Math.max(1, parseInt(e.target.value) || 1))}
            className="w-14 px-2 py-2 rounded-lg border border-charcoal/15 bg-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-charcoal/20"
          />
        </div>
      </div>

      {/* Row 2: Times + Label */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <TimeSelect value={form.start_time} onChange={v => set('start_time', v)} />
          <span className="text-charcoal/30 text-sm">–</span>
          <TimeSelect value={form.end_time} onChange={v => set('end_time', v)} />
        </div>

        <input
          type="text" value={form.label} placeholder="Label (optional, e.g. Closer)"
          onChange={e => set('label', e.target.value)}
          className="flex-1 min-w-[120px] px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm text-charcoal placeholder-charcoal/25 focus:outline-none focus:ring-2 focus:ring-charcoal/20"
        />
      </div>

      {/* Row 3: Actions */}
      <div className="flex items-center justify-between gap-2">
        {!isNew ? (
          <button
            onClick={onDelete}
            className="text-[11px] text-danger/50 hover:text-danger transition-colors px-2 py-1"
          >
            Remove
          </button>
        ) : <span />}

        {(isNew || changed) && (
          <button
            onClick={handleSave}
            disabled={saving || !form.role_id}
            className="text-[11px] bg-charcoal text-cream px-3 py-1.5 rounded-lg hover:bg-charcoal/90 transition-colors disabled:opacity-40"
          >
            {saving ? 'Saving…' : isNew ? '+ Add slot' : 'Save'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function RotaConfigModal({ open, onClose, closedDayIndices = [] }) {
  const toast                              = useToast()
  const { roles, loading: rolesLoading }  = useVenueRoles()
  const {
    byDay, requirements, totalSlots,
    loading: reqLoading,
    addRequirement, updateRequirement, deleteRequirement,
  } = useRotaRequirements()

  // closedDayIndices: 0-based (0=Mon). Convert to 1-based for DB.
  const closedDays1Based = new Set(closedDayIndices.map(d => d + 1))

  const [activeDay, setActiveDay] = useState(1) // 1=Mon

  const loading = rolesLoading || reqLoading

  const handleAddSlot = async (dayOfWeek, form) => {
    const { error } = await addRequirement({
      day_of_week: dayOfWeek,
      role_id:     form.role_id || null,
      role_name:   form.role_name,
      staff_count: form.staff_count,
      start_time:  form.start_time,
      end_time:    form.end_time,
      label:       form.label || null,
      sort_order:  byDay[dayOfWeek]?.length ?? 0,
    })
    if (error) toast(error.message, 'error')
  }

  const handleUpdateSlot = async (id, form) => {
    const { error } = await updateRequirement(id, {
      role_id:    form.role_id || null,
      role_name:  form.role_name,
      staff_count: form.staff_count,
      start_time: form.start_time,
      end_time:   form.end_time,
      label:      form.label || null,
    })
    if (error) toast(error.message, 'error')
  }

  const handleDeleteSlot = async (id) => {
    const { error } = await deleteRequirement(id)
    if (error) toast(error.message, 'error')
  }

  return (
    <Modal open={open} onClose={onClose} title="Configure Auto-Fill">
      <div className="flex flex-col gap-4 max-h-[80vh]">

        {/* Summary strip */}
        <div className="rounded-xl bg-brand/6 border border-brand/12 px-4 py-3 flex items-center justify-between">
          <p className="text-xs text-charcoal/60">
            {requirements.length === 0
              ? 'No requirements set — add slots below for each day you are open.'
              : `${totalSlots} total staff slot${totalSlots !== 1 ? 's' : ''} across ${Object.values(byDay).filter(d => d.length > 0).length} days`}
          </p>
          {roles.length === 0 && (
            <p className="text-[11px] text-warning font-medium">
              <span className="inline-flex items-center gap-1"><svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Add roles in Settings first</span>
            </p>
          )}
        </div>

        {/* Day tabs */}
        <div className="flex gap-1 flex-wrap">
          {[1,2,3,4,5,6,7].map(d => {
            const isClosed  = closedDays1Based.has(d)
            const slotCount = byDay[d]?.length ?? 0
            return (
              <button
                key={d}
                onClick={() => !isClosed && setActiveDay(d)}
                disabled={isClosed}
                className={[
                  'flex flex-col items-center px-3 py-1.5 rounded-lg border text-[11px] font-medium transition-all',
                  isClosed
                    ? 'bg-charcoal/4 border-charcoal/8 text-charcoal/20 cursor-not-allowed line-through'
                    : activeDay === d
                      ? 'bg-charcoal text-cream border-charcoal'
                      : slotCount > 0
                        ? 'bg-brand/8 border-brand/20 text-brand'
                        : 'bg-white border-charcoal/12 text-charcoal/50 hover:border-charcoal/25',
                ].join(' ')}
              >
                <span className="tracking-widest uppercase">{DAY_SHORT[d - 1]}</span>
                {!isClosed && slotCount > 0 && (
                  <span className={`text-[9px] mt-0.5 ${activeDay === d ? 'text-cream/60' : 'text-brand/60'}`}>
                    {slotCount} slot{slotCount !== 1 ? 's' : ''}
                  </span>
                )}
                {isClosed && <span className="text-[9px] mt-0.5">Closed</span>}
              </button>
            )
          })}
        </div>

        {/* Day content */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="font-medium text-charcoal text-sm">{DAY_NAMES[activeDay - 1]}</p>
            <p className="text-[11px] text-charcoal/35">
              {byDay[activeDay]?.length > 0
                ? `${byDay[activeDay].reduce((a, r) => a + r.staff_count, 0)} staff needed`
                : 'No slots yet'}
            </p>
          </div>

          {loading ? (
            <p className="text-sm text-charcoal/30 italic py-4 text-center">Loading…</p>
          ) : (
            <>
              {/* Existing slots */}
              {(byDay[activeDay] ?? []).map(slot => (
                <SlotRow
                  key={slot.id}
                  slot={slot}
                  roles={roles}
                  onDelete={() => handleDeleteSlot(slot.id)}
                  onSave={(form) => handleUpdateSlot(slot.id, form)}
                />
              ))}

              {/* New slot form */}
              {roles.length > 0 ? (
                <div>
                  <SectionLabel>Add new slot</SectionLabel>
                  <SlotRow
                    slot={EMPTY_SLOT}
                    roles={roles}
                    isNew
                    onSave={(form) => handleAddSlot(activeDay, form)}
                    onDelete={() => {}}
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-charcoal/10 px-4 py-6 text-center">
                  <p className="text-sm text-charcoal/40">No roles configured yet.</p>
                  <p className="text-xs text-charcoal/30 mt-1">
                    Go to <strong>Settings → Roles</strong> to add your business roles first.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer hint */}
        <p className="text-[11px] text-charcoal/30 text-center border-t border-charcoal/8 pt-3">
          Changes save instantly. Once configured, use <strong>Auto-Fill</strong> on the rota to generate shifts.
        </p>
      </div>
    </Modal>
  )
}
