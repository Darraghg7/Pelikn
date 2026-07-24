import React, { useState } from 'react'
import { format, formatDistanceToNow, differenceInCalendarDays } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { capitalize } from '../../lib/utils'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useCleaningTasks } from '../../hooks/useCleaningTasks'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import CleaningExportModal from './CleaningExportModal'
import { useAppSettings } from '../../hooks/useSettings'

const FREQ_OPTIONS = ['daily', 'weekly', 'fortnightly', 'monthly', 'quarterly']
const FREQ_DAYS = { daily: 1, weekly: 7, fortnightly: 14, monthly: 30, quarterly: 90 }

function SectionLabel({ children }) {
  return <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-3">{children}</p>
}

/** Bold, coloured urgency chip for the meta line — "3d overdue" / "Due in 2d" / null when on-schedule. */
function urgencyLabel(t) {
  if (!t.lastCompletion) return t.status === 'overdue' ? 'Never done' : null
  const daysSince = differenceInCalendarDays(new Date(), new Date(t.lastCompletion.completed_at))
  const threshold = FREQ_DAYS[t.frequency] ?? 1
  if (t.status === 'overdue') {
    const overdueBy = t.frequency === 'daily' ? daysSince : daysSince - threshold
    return `${Math.max(overdueBy, 1)}d overdue`
  }
  if (t.status === 'due_soon') {
    return `Due in ${Math.max(threshold - daysSince, 0)}d`
  }
  return null
}

/** Leading tap-to-complete circle — this IS the action, no separate button. */
function CheckCircle({ status, onTap }) {
  if (status === 'done') {
    return (
      <span
        aria-label="Done"
        className="w-[26px] h-[26px] rounded-full shrink-0 bg-success text-white grid place-items-center"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    )
  }
  const overdue = status === 'overdue'
  return (
    <button
      onClick={onTap}
      aria-label="Mark done"
      className={[
        'w-[26px] h-[26px] rounded-full shrink-0 p-0 grid place-items-center border-2 cursor-pointer',
        'text-transparent hover:bg-success hover:border-success hover:text-white transition-colors',
        overdue ? 'border-danger bg-danger/8' : 'border-charcoal/20 bg-transparent',
      ].join(' ')}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </button>
  )
}

export default function CleaningPage() {
  const toast = useToast()
  const { venueId } = useVenue()
  const { session, isManager } = useSession()
  const { customRoles = [] } = useAppSettings()
  const roleOptions = [{ value: 'all', label: 'All Roles' }, ...customRoles.map(r => ({ value: r.value, label: r.label }))]
  const jobRole = isManager ? null : (session?.jobRole ?? null)

  const { tasks, loading, reload } = useCleaningTasks(jobRole)

  const [showAdd, setShowAdd]   = useState(false)
  const [form, setForm]         = useState({ title: '', frequency: 'daily', assigned_role: 'all' })
  const [saving, setSaving]     = useState(false)
  const [completing, setCompleting] = useState(null)
  const [completeModal, setCompleteModal] = useState(null) // { task }
  const [notes, setNotes]       = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showExport, setShowExport] = useState(false)

  const saveTask = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    const { error } = await supabase.from('cleaning_tasks').insert({
      title: form.title.trim(),
      frequency: form.frequency,
      assigned_role: form.assigned_role,
      venue_id: venueId,
    })
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Cleaning task added')
    setForm({ title: '', frequency: 'daily', assigned_role: 'all' })
    setShowAdd(false)
    reload()
  }

  const deactivateTask = async (id) => {
    const { error } = await supabase.from('cleaning_tasks').update({ is_active: false }).eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    toast('Task removed')
    reload()
  }

  const openComplete = (task) => {
    if (completing) return
    setCompleteModal(task)
    setNotes('')
  }

  const submitComplete = async () => {
    if (!completeModal || completing) return
    setCompleting(completeModal.id)

    const { error } = await supabase.rpc('complete_cleaning_task', {
      p_token:            session?.token,
      p_cleaning_task_id: completeModal.id,
      p_notes:            notes.trim() || null,
    })
    setCompleting(null)
    setCompleteModal(null)
    if (error) { toast(error.message, 'error'); return }
    toast('Cleaning task marked complete ✓')
    reload()
  }

  const filtered = (filterStatus === 'all'
    ? tasks
    : tasks.filter((t) => t.status === filterStatus)
  ).slice().sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0))

  if (loading) return <div className="flex justify-center py-10"><LoadingSpinner /></div>

  const overdueCount  = tasks.filter((t) => t.status === 'overdue').length
  const dueSoonCount  = tasks.filter((t) => t.status === 'due_soon').length

  return (
    <div className="flex flex-col gap-6">

      <CleaningExportModal open={showExport} onClose={() => setShowExport(false)} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-charcoal">Cleaning Schedule</h1>
        <div className="flex items-center gap-3">
          {isManager && (
            <button
              onClick={() => setShowExport(true)}
              className="text-[11px] tracking-widest uppercase text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20"
            >
              Export PDF
            </button>
          )}
          {isManager && (
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="text-[11px] tracking-widest uppercase text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20"
          >
            + Add Task
          </button>
          )}
        </div>
      </div>

      {/* Summary banner */}
      {(overdueCount > 0 || dueSoonCount > 0) && (
        <div className={[
          'rounded-xl p-[10px_12px] flex items-center gap-[9px] border',
          overdueCount > 0 ? 'bg-danger/8 border-danger/20' : 'bg-warning/8 border-warning/20',
        ].join(' ')}>
          <span className={[
            'w-6 h-6 rounded-[7px] shrink-0 grid place-items-center text-white',
            overdueCount > 0 ? 'bg-danger' : 'bg-warning',
          ].join(' ')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" />
            </svg>
          </span>
          <div className="flex-1 min-w-0">
            {overdueCount > 0 && <p className="text-[13.5px] font-bold text-danger">{overdueCount} task{overdueCount !== 1 ? 's' : ''} overdue</p>}
            {dueSoonCount > 0 && <p className={`text-xs ${overdueCount > 0 ? 'text-charcoal/60' : 'text-warning'}`}>{dueSoonCount} task{dueSoonCount !== 1 ? 's' : ''} due soon</p>}
          </div>
        </div>
      )}

      {/* Add task form (isManager only) */}
      {showAdd && isManager && (
        <div className="bg-white rounded-2xl border border-charcoal/10 p-5 flex flex-col gap-4">
          <SectionLabel>New Cleaning Task</SectionLabel>
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Task title e.g. Deep clean storage room"
            className="px-4 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">Frequency</label>
              <div className="flex flex-wrap gap-2">
                {FREQ_OPTIONS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, frequency: f }))}
                    className={[
                      'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                      form.frequency === f ? 'bg-charcoal text-cream border-charcoal' : 'bg-white text-charcoal/50 border-charcoal/15',
                    ].join(' ')}
                  >
                    {capitalize(f)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">Assigned To</label>
              <div className="flex flex-wrap gap-2">
                {roleOptions.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, assigned_role: r.value }))}
                    className={[
                      'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                      form.assigned_role === r.value ? 'bg-charcoal text-cream border-charcoal' : 'bg-white text-charcoal/50 border-charcoal/15',
                    ].join(' ')}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={saveTask}
              disabled={saving || !form.title.trim()}
              className="flex-1 bg-charcoal text-cream py-2.5 rounded-lg text-sm font-medium disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save Task →'}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2.5 rounded-lg border border-charcoal/15 text-sm text-charcoal/50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'overdue', 'due_soon', 'done'].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={[
              'px-[14px] py-[7px] rounded-full text-[13px] font-medium border transition-all inline-flex items-center gap-1.5',
              filterStatus === s
                ? 'bg-charcoal text-cream border-charcoal'
                : 'bg-white text-charcoal/50 border-charcoal/15 hover:border-charcoal/30',
            ].join(' ')}
          >
            {s === 'all' ? 'All' : s === 'due_soon' ? 'Due Soon' : capitalize(s)}
            {s === 'overdue' && overdueCount > 0 && (
              <span className={[
                'font-mono text-[11px] font-bold rounded-full px-1.5',
                filterStatus === s ? 'bg-white/20 text-cream' : 'bg-danger/15 text-danger',
              ].join(' ')}>{overdueCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="bg-white rounded-2xl border border-charcoal/10 overflow-hidden px-[14px]">
        <div className="flex flex-col divide-y divide-charcoal/6">
          {filtered.map((t) => {
            const done = t.status === 'done'
            const overdue = t.status === 'overdue'
            const urgency = urgencyLabel(t)
            const roleLabel = roleOptions.find(r => r.value === t.assigned_role)?.label ?? t.assigned_role
            return (
              <div key={t.id} className="flex items-center gap-[13px] py-3">
                <CheckCircle status={t.status} onTap={() => openComplete(t)} />

                <div className="flex-1 min-w-0">
                  <div className={`text-[15px] font-medium tracking-[-0.01em] whitespace-nowrap overflow-hidden text-ellipsis ${done ? 'text-charcoal/60' : 'text-charcoal'}`}>
                    {t.title}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 min-w-0 whitespace-nowrap overflow-hidden">
                    {urgency && (
                      <span className={`font-mono text-[10px] font-bold tracking-wide uppercase shrink-0 ${overdue ? 'text-danger' : 'text-warning'}`}>
                        {urgency}
                      </span>
                    )}
                    {urgency && <span className="text-charcoal/20 text-[10px] shrink-0">·</span>}
                    <span className="font-mono text-[10px] font-medium tracking-wide uppercase text-charcoal/40 shrink-0">{capitalize(t.frequency)}</span>
                    <span className="text-charcoal/20 text-[10px] shrink-0">·</span>
                    <span className="font-mono text-[10px] font-medium tracking-wide uppercase text-charcoal/40 shrink-0">{roleLabel}</span>
                    <span className="text-charcoal/20 text-[10px] shrink-0">·</span>
                    <span className="text-[11.5px] text-charcoal/35 overflow-hidden text-ellipsis min-w-0">
                      {t.lastCompletion
                        ? done
                          ? `${formatDistanceToNow(new Date(t.lastCompletion.completed_at), { addSuffix: true })} · ${t.lastCompletion.completed_by_name}`
                          : `last ${formatDistanceToNow(new Date(t.lastCompletion.completed_at), { addSuffix: true })}`
                        : 'never completed'}
                    </span>
                  </div>
                </div>

                {isManager && (
                  <button
                    onClick={() => deactivateTask(t.id)}
                    aria-label="Remove task"
                    className="shrink-0 w-7 h-7 rounded-lg grid place-items-center text-charcoal/30 hover:text-danger hover:bg-danger/8 transition-colors"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-charcoal/35 italic py-6 text-center">
              {tasks.length === 0 ? 'No cleaning tasks set up yet.' : 'No tasks match this filter.'}
            </p>
          )}
        </div>
      </div>

      {/* Complete modal */}
      {completeModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-charcoal/40 backdrop-blur-sm" onClick={() => setCompleteModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }} onClick={e => e.stopPropagation()}>
            <div>
              <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-1">Mark Complete</p>
              <h3 className="font-semibold text-charcoal text-lg">{completeModal.title}</h3>
            </div>
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any notes about this cleaning task…"
                rows={3}
                className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={submitComplete}
                disabled={!!completing}
                className="min-h-12 flex-1 bg-charcoal text-cream py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
              >
                {completing ? 'Saving…' : 'Confirm Complete →'}
              </button>
              <button
                onClick={() => setCompleteModal(null)}
                className="px-4 py-2.5 rounded-lg border border-charcoal/15 text-sm text-charcoal/50"
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
