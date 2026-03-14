import React, { useState } from 'react'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../contexts/SessionContext'
import { useAllTasks, useTasksForRole } from '../../hooks/useTasks'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const JOB_ROLES = ['kitchen', 'foh', 'bar', 'all']
const ROLE_LABELS = { kitchen: 'Kitchen', foh: 'Front of House', bar: 'Bar', all: 'All Roles' }
const ROLE_COLORS = {
  kitchen: 'bg-orange-100 text-orange-700',
  foh:     'bg-blue-100 text-blue-700',
  bar:     'bg-purple-100 text-purple-700',
  all:     'bg-charcoal/10 text-charcoal',
}

function SectionLabel({ children }) {
  return <p className="text-[10px] tracking-widest uppercase text-charcoal/40 mb-3">{children}</p>
}

function RoleBadge({ role }) {
  return (
    <span className={`text-[10px] tracking-widest uppercase font-medium px-2 py-0.5 rounded ${ROLE_COLORS[role] ?? 'bg-charcoal/8 text-charcoal'}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  )
}

// ── Manager View ──────────────────────────────────────────
function ManagerTasksView() {
  const toast = useToast()
  const today = new Date()
  const { templates, oneOffs, completions, loading, reload } = useAllTasks(today)

  const [activeRoleTab, setActiveRoleTab] = useState('all')
  const [showAddTemplate, setShowAddTemplate] = useState(false)
  const [showAddOneOff, setShowAddOneOff]     = useState(false)
  const [tForm, setTForm]   = useState({ title: '', job_role: 'kitchen' })
  const [oForm, setOForm]   = useState({ title: '', job_role: 'kitchen', due_date: format(today, 'yyyy-MM-dd') })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const filteredTemplates = activeRoleTab === 'all'
    ? templates
    : templates.filter((t) => t.job_role === activeRoleTab)

  const filteredOneOffs = activeRoleTab === 'all'
    ? oneOffs
    : oneOffs.filter((o) => o.job_role === activeRoleTab)

  const saveTemplate = async () => {
    if (!tForm.title.trim()) return
    setSaving(true)
    const { error } = await supabase.from('task_templates').insert({
      title: tForm.title.trim(), job_role: tForm.job_role,
    })
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Task template added')
    setTForm({ title: '', job_role: 'kitchen' })
    setShowAddTemplate(false)
    reload()
  }

  const saveOneOff = async () => {
    if (!oForm.title.trim()) return
    setSaving(true)
    const { error } = await supabase.from('task_one_offs').insert({
      title: oForm.title.trim(), job_role: oForm.job_role, due_date: oForm.due_date,
    })
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('One-off task added')
    setOForm({ title: '', job_role: 'kitchen', due_date: format(today, 'yyyy-MM-dd') })
    setShowAddOneOff(false)
    reload()
  }

  const deleteTemplate = async (id) => {
    setDeleting(id)
    await supabase.from('task_templates').update({ is_active: false }).eq('id', id)
    setDeleting(null)
    reload()
    toast('Task removed')
  }

  const deleteOneOff = async (id) => {
    setDeleting(id)
    await supabase.from('task_one_offs').delete().eq('id', id)
    setDeleting(null)
    reload()
    toast('Task removed')
  }

  if (loading) return <div className="flex justify-center py-10"><LoadingSpinner /></div>

  return (
    <div className="flex flex-col gap-6">
      {/* Role filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'kitchen', 'foh', 'bar'].map((r) => (
          <button
            key={r}
            onClick={() => setActiveRoleTab(r)}
            className={[
              'px-4 py-1.5 rounded-full text-xs font-medium border transition-all',
              activeRoleTab === r
                ? 'bg-charcoal text-cream border-charcoal'
                : 'bg-white text-charcoal/50 border-charcoal/15 hover:border-charcoal/30',
            ].join(' ')}
          >
            {ROLE_LABELS[r]}
          </button>
        ))}
      </div>

      {/* Recurring task templates */}
      <div className="bg-white rounded-xl border border-charcoal/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionLabel>Recurring Daily Tasks</SectionLabel>
          <button
            onClick={() => setShowAddTemplate((v) => !v)}
            className="text-[11px] tracking-widest uppercase text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20"
          >
            + Add Template
          </button>
        </div>

        {showAddTemplate && (
          <div className="mb-4 p-4 rounded-xl bg-cream/50 border border-charcoal/10 flex flex-col gap-3">
            <input
              value={tForm.title}
              onChange={(e) => setTForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Task title e.g. Clean prep surfaces"
              className="px-4 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
            <div className="flex gap-2 flex-wrap">
              {JOB_ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setTForm((f) => ({ ...f, job_role: r }))}
                  className={[
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                    tForm.job_role === r ? 'bg-charcoal text-cream border-charcoal' : 'bg-white text-charcoal/50 border-charcoal/15',
                  ].join(' ')}
                >
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveTemplate}
                disabled={saving || !tForm.title.trim()}
                className="flex-1 bg-charcoal text-cream py-2 rounded-lg text-sm font-medium disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save Template →'}
              </button>
              <button onClick={() => setShowAddTemplate(false)} className="px-4 py-2 rounded-lg border border-charcoal/15 text-sm text-charcoal/50">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col divide-y divide-charcoal/6">
          {filteredTemplates.map((t) => {
            const comp = completions.find((c) => c.task_template_id === t.id)
            return (
              <div key={t.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center text-[10px] ${comp ? 'bg-success border-success text-white' : 'border-charcoal/20'}`}>
                    {comp ? '✓' : ''}
                  </span>
                  <div>
                    <p className={`text-sm ${comp ? 'line-through text-charcoal/30' : 'text-charcoal'}`}>{t.title}</p>
                    {comp && <p className="text-xs text-charcoal/30">{comp.completed_by_name}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <RoleBadge role={t.job_role} />
                  <button
                    onClick={() => deleteTemplate(t.id)}
                    disabled={deleting === t.id}
                    className="text-xs text-charcoal/25 hover:text-danger transition-colors"
                  >
                    ×
                  </button>
                </div>
              </div>
            )
          })}
          {filteredTemplates.length === 0 && (
            <p className="text-sm text-charcoal/35 italic py-3">No recurring tasks for this role.</p>
          )}
        </div>
      </div>

      {/* One-off tasks for today */}
      <div className="bg-white rounded-xl border border-charcoal/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionLabel>One-Off Tasks — Today</SectionLabel>
          <button
            onClick={() => setShowAddOneOff((v) => !v)}
            className="text-[11px] tracking-widest uppercase text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20"
          >
            + Add One-Off
          </button>
        </div>

        {showAddOneOff && (
          <div className="mb-4 p-4 rounded-xl bg-cream/50 border border-charcoal/10 flex flex-col gap-3">
            <input
              value={oForm.title}
              onChange={(e) => setOForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="One-off task e.g. Check delivery from supplier"
              className="px-4 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
            <div className="flex gap-2 items-center flex-wrap">
              <input
                type="date"
                value={oForm.due_date}
                onChange={(e) => setOForm((f) => ({ ...f, due_date: e.target.value }))}
                className="px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
              {JOB_ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setOForm((f) => ({ ...f, job_role: r }))}
                  className={[
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                    oForm.job_role === r ? 'bg-charcoal text-cream border-charcoal' : 'bg-white text-charcoal/50 border-charcoal/15',
                  ].join(' ')}
                >
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveOneOff}
                disabled={saving || !oForm.title.trim()}
                className="flex-1 bg-charcoal text-cream py-2 rounded-lg text-sm font-medium disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Add Task →'}
              </button>
              <button onClick={() => setShowAddOneOff(false)} className="px-4 py-2 rounded-lg border border-charcoal/15 text-sm text-charcoal/50">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col divide-y divide-charcoal/6">
          {filteredOneOffs.map((o) => {
            const comp = completions.find((c) => c.task_one_off_id === o.id)
            return (
              <div key={o.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center text-[10px] ${comp ? 'bg-success border-success text-white' : 'border-charcoal/20'}`}>
                    {comp ? '✓' : ''}
                  </span>
                  <div>
                    <p className={`text-sm ${comp ? 'line-through text-charcoal/30' : 'text-charcoal'}`}>{o.title}</p>
                    {comp && <p className="text-xs text-charcoal/30">{comp.completed_by_name}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <RoleBadge role={o.job_role} />
                  <button
                    onClick={() => deleteOneOff(o.id)}
                    disabled={deleting === o.id}
                    className="text-xs text-charcoal/25 hover:text-danger transition-colors"
                  >
                    ×
                  </button>
                </div>
              </div>
            )
          })}
          {filteredOneOffs.length === 0 && (
            <p className="text-sm text-charcoal/35 italic py-3">No one-off tasks for today.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Staff View ────────────────────────────────────────────
function StaffTasksView({ session }) {
  const toast = useToast()
  const jobRole = session?.jobRole ?? 'kitchen'
  const { templates, oneOffs, completions, loading, reload } = useTasksForRole(jobRole)
  const [completing, setCompleting] = useState(null)

  const completeTask = async (templateId, oneOffId) => {
    const key = templateId ?? oneOffId
    setCompleting(key)
    const { error } = await supabase.rpc('complete_task', {
      p_token:       session?.token,
      p_template_id: templateId ?? null,
      p_one_off_id:  oneOffId ?? null,
    })
    setCompleting(null)
    if (error) { toast(error.message, 'error'); return }
    toast('Task marked complete ✓')
    reload()
  }

  const allTasks = [...templates, ...oneOffs]
  const done = completions.filter((c) =>
    templates.some((t) => t.id === c.task_template_id) ||
    oneOffs.some((o) => o.id === c.task_one_off_id)
  ).length

  if (loading) return <div className="flex justify-center py-10"><LoadingSpinner /></div>

  return (
    <div className="flex flex-col gap-6">

      {/* Progress summary */}
      <div className="bg-white rounded-xl border border-charcoal/10 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] tracking-widest uppercase text-charcoal/40 mb-1">Today's Progress</p>
            <p className="font-serif text-2xl text-charcoal">{done} / {allTasks.length} tasks done</p>
          </div>
          {done === allTasks.length && allTasks.length > 0 && (
            <span className="text-2xl">🎉</span>
          )}
        </div>
        <div className="h-2 bg-charcoal/8 rounded-full overflow-hidden">
          <div
            className="h-full bg-success rounded-full transition-all"
            style={{ width: allTasks.length > 0 ? `${(done / allTasks.length) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Task checklist */}
      <div className="bg-white rounded-xl border border-charcoal/10 p-5">
        <SectionLabel>Your Tasks — {format(new Date(), 'd MMMM')}</SectionLabel>
        <div className="flex flex-col gap-2">
          {allTasks.map((t) => {
            const isTemplate = 'job_role' in t && !('due_date' in t)
            const comp = completions.find((c) =>
              (isTemplate && c.task_template_id === t.id) ||
              (!isTemplate && c.task_one_off_id === t.id)
            )
            const key = t.id
            return (
              <button
                key={key}
                onClick={() => !comp && completeTask(isTemplate ? t.id : null, !isTemplate ? t.id : null)}
                disabled={!!comp || completing === key}
                className={[
                  'flex items-center gap-4 p-4 rounded-xl border text-left transition-all w-full',
                  comp
                    ? 'bg-success/5 border-success/20 cursor-default'
                    : 'bg-white border-charcoal/10 hover:bg-charcoal/4 hover:border-charcoal/20 active:scale-[0.99]',
                ].join(' ')}
              >
                <span className={[
                  'w-5 h-5 rounded border flex items-center justify-center text-xs shrink-0 transition-all',
                  comp ? 'bg-success border-success text-white' : 'border-charcoal/20',
                ].join(' ')}>
                  {comp ? '✓' : completing === key ? '…' : ''}
                </span>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${comp ? 'line-through text-charcoal/30' : 'text-charcoal'}`}>
                    {t.title}
                  </p>
                  {!isTemplate && (
                    <p className="text-xs text-charcoal/30 mt-0.5">One-off task</p>
                  )}
                  {comp && (
                    <p className="text-xs text-charcoal/30 mt-0.5">
                      Done by {comp.completed_by_name} · {format(new Date(comp.completed_at), 'HH:mm')}
                    </p>
                  )}
                </div>
              </button>
            )
          })}
          {allTasks.length === 0 && (
            <p className="text-sm text-charcoal/35 italic py-4 text-center">No tasks assigned for today.</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TasksPage() {
  const { session, isManager } = useSession()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif text-3xl text-charcoal">
        {isManager ? 'Task Manager' : "Today's Tasks"}
      </h1>
      {isManager
        ? <ManagerTasksView />
        : <StaffTasksView session={session} />
      }
    </div>
  )
}
