import React, { useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../contexts/SessionContext'
import { useCleaningTasks } from '../../hooks/useCleaningTasks'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const FREQ_OPTIONS = ['daily', 'weekly', 'fortnightly', 'monthly', 'quarterly']
const ROLE_OPTIONS = ['all', 'kitchen', 'foh']
const ROLE_LABELS  = { all: 'All Roles', kitchen: 'Kitchen', foh: 'Front of House' }

const STATUS_CONFIG = {
  done:     { label: 'Done',     bg: 'bg-success/10',  text: 'text-success',  dot: 'bg-success' },
  due_soon: { label: 'Due Soon', bg: 'bg-warning/10',  text: 'text-warning',  dot: 'bg-warning' },
  overdue:  { label: 'Overdue',  bg: 'bg-danger/10',   text: 'text-danger',   dot: 'bg-danger'  },
}

function SectionLabel({ children }) {
  return <p className="text-[10px] tracking-widest uppercase text-charcoal/40 mb-3">{children}</p>
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1) }

export default function CleaningPage() {
  const toast = useToast()
  const { session, isManager } = useSession()
  const jobRole = isManager ? null : (session?.jobRole ?? 'kitchen')

  const { tasks, loading, reload } = useCleaningTasks(jobRole)

  const [showAdd, setShowAdd]   = useState(false)
  const [form, setForm]         = useState({ title: '', frequency: 'daily', assigned_role: 'all' })
  const [saving, setSaving]     = useState(false)
  const [completing, setCompleting] = useState(null)
  const [completeModal, setCompleteModal] = useState(null) // { task }
  const [notes, setNotes]       = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  const saveTask = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    const { error } = await supabase.from('cleaning_tasks').insert({
      title: form.title.trim(),
      frequency: form.frequency,
      assigned_role: form.assigned_role,
    })
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Cleaning task added')
    setForm({ title: '', frequency: 'daily', assigned_role: 'all' })
    setShowAdd(false)
    reload()
  }

  const deactivateTask = async (id) => {
    await supabase.from('cleaning_tasks').update({ is_active: false }).eq('id', id)
    reload()
    toast('Task removed')
  }

  const openComplete = (task) => {
    setCompleteModal(task)
    setNotes('')
  }

  const submitComplete = async () => {
    if (!completeModal) return
    setCompleting(completeModal.id)

    const { error } = await supabase.rpc('complete_cleaning_task', {
      p_token:            session?.token,
      p_cleaning_task_id: completeModal.id,
      p_notes:            notes.trim() || null,
    })
    if (error) { toast(error.message, 'error') }

    setCompleting(null)
    setCompleteModal(null)
    reload()
    toast('Cleaning task marked complete ✓')
  }

  const filtered = filterStatus === 'all'
    ? tasks
    : tasks.filter((t) => t.status === filterStatus)

  if (loading) return <div className="flex justify-center py-10"><LoadingSpinner /></div>

  const overdueCount  = tasks.filter((t) => t.status === 'overdue').length
  const dueSoonCount  = tasks.filter((t) => t.status === 'due_soon').length

  return (
    <div className="flex flex-col gap-6">

      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl text-charcoal">Cleaning Schedule</h1>
        {isManager && (
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="text-[11px] tracking-widest uppercase text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20"
          >
            + Add Task
          </button>
        )}
      </div>

      {/* Summary banner */}
      {(overdueCount > 0 || dueSoonCount > 0) && (
        <div className={`rounded-xl border p-4 flex items-center gap-3 ${overdueCount > 0 ? 'bg-danger/5 border-danger/20' : 'bg-warning/5 border-warning/20'}`}>
          <span className="text-xl">{overdueCount > 0 ? '🔴' : '🟡'}</span>
          <div>
            {overdueCount > 0 && <p className="text-sm font-semibold text-danger">{overdueCount} task{overdueCount !== 1 ? 's' : ''} overdue</p>}
            {dueSoonCount > 0 && <p className="text-sm text-warning">{dueSoonCount} task{dueSoonCount !== 1 ? 's' : ''} due soon</p>}
          </div>
        </div>
      )}

      {/* Add task form (isManager only) */}
      {showAdd && isManager && (
        <div className="bg-white rounded-xl border border-charcoal/10 p-5 flex flex-col gap-4">
          <SectionLabel>New Cleaning Task</SectionLabel>
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Task title e.g. Deep clean walk-in cooler"
            className="px-4 py-2.5 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-2">Frequency</label>
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
              <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-2">Assigned To</label>
              <div className="flex flex-wrap gap-2">
                {ROLE_OPTIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, assigned_role: r }))}
                    className={[
                      'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                      form.assigned_role === r ? 'bg-charcoal text-cream border-charcoal' : 'bg-white text-charcoal/50 border-charcoal/15',
                    ].join(' ')}
                  >
                    {ROLE_LABELS[r]}
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
              'px-4 py-1.5 rounded-full text-xs font-medium border transition-all',
              filterStatus === s
                ? 'bg-charcoal text-cream border-charcoal'
                : 'bg-white text-charcoal/50 border-charcoal/15 hover:border-charcoal/30',
            ].join(' ')}
          >
            {s === 'all' ? 'All' : s === 'due_soon' ? 'Due Soon' : capitalize(s)}
            {s === 'overdue' && overdueCount > 0 && <span className="ml-1.5 bg-danger/20 text-danger px-1.5 rounded-full text-[10px]">{overdueCount}</span>}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="bg-white rounded-xl border border-charcoal/10 overflow-hidden">
        <div className="flex flex-col divide-y divide-charcoal/6">
          {filtered.map((t) => {
            const cfg = STATUS_CONFIG[t.status]
            return (
              <div key={t.id} className="p-4 flex items-center gap-4">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-charcoal">{t.title}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] tracking-widest uppercase text-charcoal/35">{capitalize(t.frequency)}</span>
                    <span className="text-charcoal/20">·</span>
                    <span className="text-[10px] tracking-widest uppercase text-charcoal/35">{ROLE_LABELS[t.assigned_role]}</span>
                    {t.lastCompletion && (
                      <>
                        <span className="text-charcoal/20">·</span>
                        <span className="text-xs text-charcoal/35">
                          Last done {formatDistanceToNow(new Date(t.lastCompletion.completed_at), { addSuffix: true })} by {t.lastCompletion.completed_by_name}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] tracking-widest uppercase font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
                    {cfg.label}
                  </span>
                  <button
                    onClick={() => openComplete(t)}
                    className="px-3 py-1.5 rounded-lg bg-charcoal text-cream text-xs font-medium hover:bg-charcoal/80 transition-colors"
                  >
                    Mark Done
                  </button>
                  {isManager && (
                    <button
                      onClick={() => deactivateTask(t.id)}
                      className="text-xs text-charcoal/25 hover:text-danger transition-colors px-1"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-charcoal/35 italic p-6 text-center">
              {tasks.length === 0 ? 'No cleaning tasks set up yet.' : 'No tasks match this filter.'}
            </p>
          )}
        </div>
      </div>

      {/* Complete modal */}
      {completeModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-charcoal/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl">
            <div>
              <p className="text-[10px] tracking-widest uppercase text-charcoal/40 mb-1">Mark Complete</p>
              <h3 className="font-semibold text-charcoal text-lg">{completeModal.title}</h3>
            </div>
            <div>
              <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-2">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any notes about this cleaning task…"
                rows={3}
                className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-cream/30 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={submitComplete}
                disabled={!!completing}
                className="flex-1 bg-charcoal text-cream py-2.5 rounded-lg text-sm font-medium disabled:opacity-40"
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
