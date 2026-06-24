import React, { useState, useEffect, useCallback } from 'react'
import { format, addDays } from 'date-fns'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useAllTasks, useTasksForRole } from '../../hooks/useTasks'
import { useTodayDuties } from '../../hooks/useDuties'
import { useToast } from '../../components/ui/Toast'
import { useAppSettings } from '../../hooks/useSettings'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import { SkeletonList } from '../../components/ui/Skeleton'
import DutiesSection from '../settings/DutiesSection'

function usePendingSignOffs(staffId, venueId) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!staffId || !venueId) return
    supabase
      .from('training_sign_offs')
      .select('id', { count: 'exact', head: true })
      .eq('staff_id', staffId)
      .eq('venue_id', venueId)
      .eq('staff_acknowledged', false)
      .then(({ count: c }) => setCount(c ?? 0))
  }, [staffId, venueId])
  return count
}

function SectionLabel({ children }) {
  return <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-3">{children}</p>
}

function RoleBadge({ role, customRoles }) {
  const found = customRoles?.find(r => r.value === role)
  const label = role === 'all' ? 'All Roles' : (found?.label ?? role)
  return (
    <span className={`text-[11px] tracking-widest uppercase font-medium px-2 py-0.5 rounded ${found?.color ?? 'bg-charcoal/8 text-charcoal'}`}>
      {label}
    </span>
  )
}

// ── Staff picker hook ──────────────────────────────────────────────────────────

function useStaffList() {
  const { venueId } = useVenue()
  const [staff, setStaff] = useState([])
  const load = useCallback(async () => {
    if (!venueId) return
    const { data } = await supabase
      .from('staff')
      .select('id, name, job_role')
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .order('name')
    setStaff(data ?? [])
  }, [venueId])
  useEffect(() => { load() }, [load])
  return staff
}

// ── Shared task row used in manager columns ─────────────────────────────────
function ManagerTaskRow({ item, isTemplate, completions, onDelete, deleting }) {
  const comp = completions.find((c) =>
    isTemplate ? c.task_template_id === item.id : c.task_one_off_id === item.id
  )
  return (
    <div className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center text-[11px] ${comp ? 'bg-success border-success text-white' : 'border-charcoal/20'}`}>
          {comp ? <svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg> : ''}
        </span>
        <div className="min-w-0">
          <p className={`text-sm truncate ${comp ? 'line-through text-charcoal/30' : 'text-charcoal'}`}>{item.title}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {!isTemplate && item.assigned_to_name && (
              <span className="text-[11px] text-accent font-medium">→ {item.assigned_to_name}</span>
            )}
            {comp && <p className="text-[11px] text-charcoal/30">{comp.completed_by_name}</p>}
          </div>
        </div>
      </div>
      <button
        onClick={() => onDelete(item.id)}
        disabled={deleting === item.id}
        className="text-sm text-charcoal/35 hover:text-danger transition-colors shrink-0 px-2.5 py-1.5 rounded"
        title="Remove task"
      >{deleting === item.id ? '…' : '×'}</button>
    </div>
  )
}

// ── Department column ─────────────────────────────────────────────────────────
function DeptColumn({ role, label, color, templates, oneOffs, completions, onDeleteTemplate, onDeleteOneOff, deleting }) {
  const deptTemplates = templates.filter(t => t.job_role === role)
  const deptOneOffs   = oneOffs.filter(o => o.job_role === role)
  const deptDone = completions.filter(c =>
    deptTemplates.some(t => t.id === c.task_template_id) ||
    deptOneOffs.some(o => o.id === c.task_one_off_id)
  ).length
  const deptTotal = deptTemplates.length + deptOneOffs.length

  return (
    <div className="flex-1 min-w-0 bg-white rounded-2xl border-charcoal/10 overflow-hidden">
      {/* Column header */}
      <div className={`px-4 py-3 border-b border-charcoal/8 flex items-center justify-between ${color}`}>
        <p className="text-sm font-semibold">{label}</p>
        <span className="text-xs font-medium opacity-70">{deptDone}/{deptTotal}</span>
      </div>

      <div className="p-4 flex flex-col gap-0 divide-y divide-charcoal/6">
        {/* Recurring */}
        {deptTemplates.length > 0 && (
          <div className="pb-3">
            <p className="text-[11px] tracking-widest uppercase text-charcoal/30 mb-2">Recurring</p>
            {deptTemplates.map(t => (
              <ManagerTaskRow key={t.id} item={t} isTemplate completions={completions} onDelete={onDeleteTemplate} deleting={deleting} />
            ))}
          </div>
        )}

        {/* One-offs */}
        {deptOneOffs.length > 0 && (
          <div className={deptTemplates.length > 0 ? 'pt-3' : ''}>
            <p className="text-[11px] tracking-widest uppercase text-charcoal/30 mb-2">One-off</p>
            {deptOneOffs.map(o => (
              <ManagerTaskRow key={o.id} item={o} isTemplate={false} completions={completions} onDelete={onDeleteOneOff} deleting={deleting} />
            ))}
          </div>
        )}

        {deptTotal === 0 && (
          <EmptyState icon="clipboard" title="No tasks" description="No tasks set up for this department yet." className="py-4" />
        )}
      </div>
    </div>
  )
}

// ── Manager View ──────────────────────────────────────────
function ManagerTasksView() {
  const toast = useToast()
  const { venueId } = useVenue()
  const today = new Date()
  const { templates, oneOffs, completions, loading, reload } = useAllTasks(today)
  const staffList = useStaffList()
  const { customRoles = [] } = useAppSettings()
  const jobRoleValues = customRoles.map(r => r.value)

  const [showAddTemplate, setShowAddTemplate] = useState(false)
  const [showAddOneOff, setShowAddOneOff]     = useState(false)
  const [tForm, setTForm]   = useState({ title: '', job_role: 'all' })
  const [oForm, setOForm]   = useState({
    title: '',
    job_role: 'all',
    due_date: format(today, 'yyyy-MM-dd'),
    assigned_to_staff_id: '',
  })
  const [saving, setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(null)

  // "All roles" items — tasks tagged 'all' or whose role doesn't match any configured role
  const allRolesTemplates = templates.filter(t => t.job_role === 'all' || !jobRoleValues.includes(t.job_role))
  const allRolesOneOffs   = oneOffs.filter(o => o.job_role === 'all' || !jobRoleValues.includes(o.job_role))

  const saveTemplate = async () => {
    if (!tForm.title.trim()) return
    setSaving(true)
    const { error } = await supabase.from('task_templates').insert({
      title: tForm.title.trim(), job_role: tForm.job_role, venue_id: venueId,
    })
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Task template added')
    setTForm({ title: '', job_role: 'all' })
    setShowAddTemplate(false)
    reload()
  }

  const saveOneOff = async () => {
    if (!oForm.title.trim()) return
    setSaving(true)
    const assignee = oForm.assigned_to_staff_id
      ? staffList.find(s => s.id === oForm.assigned_to_staff_id)
      : null
    const { error } = await supabase.from('task_one_offs').insert({
      title:                oForm.title.trim(),
      job_role:             assignee ? assignee.job_role : oForm.job_role,
      due_date:             oForm.due_date,
      venue_id:             venueId,
      assigned_to_staff_id: assignee?.id   ?? null,
      assigned_to_name:     assignee?.name ?? null,
    })
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('One-off task added')
    setOForm({ title: '', job_role: 'all', due_date: format(today, 'yyyy-MM-dd'), assigned_to_staff_id: '' })
    setShowAddOneOff(false)
    reload()
  }

  const deleteTemplate = async (id) => {
    setDeleting(id)
    const { error } = await supabase.from('task_templates').update({ is_active: false }).eq('id', id)
    setDeleting(null)
    if (error) { toast(error.message, 'error'); return }
    toast('Task removed')
    reload()
  }

  const deleteOneOff = async (id) => {
    setDeleting(id)
    const { error } = await supabase.from('task_one_offs').delete().eq('id', id)
    setDeleting(null)
    if (error) { toast(error.message, 'error'); return }
    toast('Task removed')
    reload()
  }

  if (loading) return <SkeletonList rows={4} className="py-4" />

  return (
    <div className="flex flex-col gap-6">

      {/* ── Add forms ─────────────────────────────────────────────────────── */}
      <div className="flex gap-2">
        <button
          onClick={() => { setShowAddTemplate(v => !v); setShowAddOneOff(false) }}
          className="text-[11px] tracking-widest uppercase text-charcoal/50 hover:text-charcoal transition-colors border-b border-charcoal/20"
        >
          + Recurring Task
        </button>
        <span className="text-charcoal/20 text-xs self-end pb-0.5">·</span>
        <button
          onClick={() => { setShowAddOneOff(v => !v); setShowAddTemplate(false) }}
          className="text-[11px] tracking-widest uppercase text-charcoal/50 hover:text-charcoal transition-colors border-b border-charcoal/20"
        >
          + One-Off Task
        </button>
      </div>

      {showAddTemplate && (
        <div className="p-4 rounded-2xl bg-white border border-charcoal/10 flex flex-col gap-3">
          <p className="text-[11px] tracking-widest uppercase text-charcoal/40">New Recurring Task</p>
          <input
            value={tForm.title}
            onChange={(e) => setTForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Complete daily checklist"
            className="px-4 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
          />
          <div className="flex gap-2 flex-wrap">
            {[{ value: 'all', label: 'All Roles' }, ...customRoles].map((r) => (
              <button key={r.value} type="button" onClick={() => setTForm(f => ({ ...f, job_role: r.value }))}
                className={['px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                  tForm.job_role === r.value ? 'bg-charcoal text-cream border-charcoal' : 'bg-white text-charcoal/50 border-charcoal/15',
                ].join(' ')}>
                {r.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={saveTemplate} disabled={saving || !tForm.title.trim()}
              className="flex-1 bg-charcoal text-cream py-2 rounded-lg text-sm font-medium disabled:opacity-40">
              {saving ? 'Saving…' : 'Save Template →'}
            </button>
            <button onClick={() => setShowAddTemplate(false)} className="px-4 py-2 rounded-lg border border-charcoal/15 text-sm text-charcoal/50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {showAddOneOff && (
        <div className="p-4 rounded-2xl bg-white border border-charcoal/10 flex flex-col gap-3">
          <p className="text-[11px] tracking-widest uppercase text-charcoal/40">New One-Off Task</p>
          <input
            value={oForm.title}
            onChange={(e) => setOForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Check delivery from supplier"
            className="px-4 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-[11px] text-charcoal/50 whitespace-nowrap">Due date:</label>
            <input type="date" value={oForm.due_date}
              onChange={(e) => setOForm(f => ({ ...f, due_date: e.target.value }))}
              className="px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>
          <div>
            <p className="text-[11px] text-charcoal/50 mb-2">Assign to:</p>
            <div className="flex flex-col gap-2">
              <select value={oForm.assigned_to_staff_id}
                onChange={(e) => setOForm(f => ({ ...f, assigned_to_staff_id: e.target.value }))}
                className="px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20">
                <option value="">Specific person (optional)</option>
                {staffList.map((s) => {
                  const roleLabel = customRoles.find(r => r.value === s.job_role)?.label ?? s.job_role
                  return <option key={s.id} value={s.id}>{s.name}{s.job_role ? ` (${roleLabel})` : ''}</option>
                })}
              </select>
              {!oForm.assigned_to_staff_id && (
                <div className="flex gap-2 flex-wrap">
                  {[{ value: 'all', label: 'All Roles' }, ...customRoles].map((r) => (
                    <button key={r.value} type="button" onClick={() => setOForm(f => ({ ...f, job_role: r.value }))}
                      className={['px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                        oForm.job_role === r.value ? 'bg-charcoal text-cream border-charcoal' : 'bg-white text-charcoal/50 border-charcoal/15',
                      ].join(' ')}>
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={saveOneOff} disabled={saving || !oForm.title.trim()}
              className="flex-1 bg-charcoal text-cream py-2 rounded-lg text-sm font-medium disabled:opacity-40">
              {saving ? 'Saving…' : 'Assign Task →'}
            </button>
            <button onClick={() => setShowAddOneOff(false)} className="px-4 py-2 rounded-lg border border-charcoal/15 text-sm text-charcoal/50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Department columns ─────────────────────────────────────────────── */}
      {customRoles.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 items-start">
          {customRoles.map((r, i) => {
            const role = typeof r === 'string' ? { value: r.toLowerCase().replace(/\s+/g, '_'), label: r, color: null } : r
            return (
            <DeptColumn
              key={role.value ?? i}
              role={role.value}
              label={role.label}
              color={role.color?.replace('text-', 'text-').replace('bg-', 'bg-') ?? 'bg-charcoal/5 text-charcoal'}
              templates={templates}
              oneOffs={oneOffs}
              completions={completions}
              onDeleteTemplate={deleteTemplate}
              onDeleteOneOff={deleteOneOff}
              deleting={deleting}
            />
            )
          })}
        </div>
      )}

      {/* ── All-roles tasks ───────────────────────────────────────────────── */}
      {(allRolesTemplates.length > 0 || allRolesOneOffs.length > 0) && (
        <div className="bg-white rounded-2xl border-charcoal/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-charcoal/8 bg-charcoal/3">
            <p className="text-sm font-semibold text-charcoal">All Roles</p>
          </div>
          <div className="p-4 flex flex-col divide-y divide-charcoal/6">
            {[...allRolesTemplates, ...allRolesOneOffs].map((item) => {
              const isTemplate = !('due_date' in item)
              return (
                <ManagerTaskRow
                  key={item.id}
                  item={item}
                  isTemplate={isTemplate}
                  completions={completions}
                  onDelete={isTemplate ? deleteTemplate : deleteOneOff}
                  deleting={deleting}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Staff view helpers ─────────────────────────────────────

function useStaffCleaning(venueId, dateStr) {
  const [data, setData] = useState({ tasks: [], completions: [], loading: true })
  useEffect(() => {
    if (!venueId) return
    let cancelled = false
    Promise.all([
      supabase.from('cleaning_tasks').select('id, title, frequency, area').eq('venue_id', venueId).eq('is_active', true).order('title'),
      supabase.from('cleaning_completions').select('cleaning_task_id, completed_at').eq('venue_id', venueId).gte('completed_at', dateStr + 'T00:00:00').lte('completed_at', dateStr + 'T23:59:59'),
    ]).then(([tasksRes, compsRes]) => {
      if (cancelled) return
      setData({ tasks: tasksRes.data ?? [], completions: compsRes.data ?? [], loading: false })
    })
    return () => { cancelled = true }
  }, [venueId, dateStr])
  return data
}

function TaskItemRow({ item, assignmentId, toggleItem }) {
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const handleToggle = async () => {
    if (busy) return
    setBusy(true)
    const { error } = await toggleItem(assignmentId, item.id, item.completed)
    if (error) {
      toast('Could not save — please try again', 'error')
      setBusy(false)
    } else {
      setTimeout(() => setBusy(false), 150)
    }
  }
  return (
    <button
      onClick={handleToggle}
      disabled={busy}
      className="min-h-11 flex items-center gap-3 w-full text-left py-2.5 px-4 group disabled:opacity-70 hover:bg-charcoal/3 transition-colors border-t border-charcoal/5 first:border-t-0"
    >
      <span className={[
        'w-[22px] h-[22px] rounded-md border-[1.5px] shrink-0 flex items-center justify-center transition-all',
        item.completed ? 'bg-success border-success' : 'border-charcoal/25 group-hover:border-charcoal/45',
      ].join(' ')}>
        {item.completed && (
          <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2,6 5,9 10,3"/>
          </svg>
        )}
      </span>
      <span className={`text-[13.5px] leading-snug flex-1 font-medium ${item.completed ? 'line-through text-charcoal/35' : 'text-charcoal'}`}>
        {item.title}
      </span>
      {!item.completed && (
        <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-charcoal/25 shrink-0">
          <path d="M1 1l4 4-4 4"/>
        </svg>
      )}
    </button>
  )
}

function StaffDutyCard({ duty, toggleItem }) {
  const done    = duty.items.filter(i => i.completed).length
  const total   = duty.items.length
  const pct     = total > 0 ? Math.round((done / total) * 100) : 0
  const allDone = done === total && total > 0
  return (
    <div className="bg-white rounded-[14px] border border-charcoal/8 overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3.5 pb-3 border-b border-charcoal/6">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[11px] text-charcoal/40 tracking-widest uppercase font-semibold shrink-0">Duty</span>
          <span className="text-charcoal/25 text-xs">·</span>
          <p className="text-[15px] font-semibold text-charcoal truncate">{duty.title}</p>
        </div>
        <span className={`text-[11px] font-mono font-semibold shrink-0 ml-2 ${allDone ? 'text-success' : 'text-charcoal/35'}`}>
          {done}/{total}
        </span>
      </div>
      {total > 0 && (
        <div className="h-[3px] bg-charcoal/6">
          <div className={`h-full transition-all ${allDone ? 'bg-success' : 'bg-warning'}`} style={{ width: `${Math.max(pct, 2)}%` }} />
        </div>
      )}
      <div>
        {duty.items.map(item => (
          <TaskItemRow key={item.id} item={item} assignmentId={duty.assignmentId} toggleItem={toggleItem} />
        ))}
      </div>
    </div>
  )
}

function DutiesTab({ duties, loading, toggleItem }) {
  if (loading) return <SkeletonList rows={3} />
  if (!duties.length) return (
    <div className="bg-white rounded-[14px] border border-charcoal/8 p-8 text-center">
      <p className="text-sm text-charcoal/40">No duties assigned for today</p>
    </div>
  )
  return (
    <div className="flex flex-col gap-2.5">
      {duties.map(d => <StaffDutyCard key={d.assignmentId} duty={d} toggleItem={toggleItem} />)}
    </div>
  )
}

function CleaningTab({ tasks, completions, loading }) {
  if (loading) return <SkeletonList rows={4} />
  if (!tasks.length) return (
    <div className="bg-white rounded-[14px] border border-charcoal/8 p-8 text-center">
      <p className="text-sm text-charcoal/40">No cleaning tasks configured</p>
    </div>
  )
  const doneIds = new Set(completions.map(c => c.cleaning_task_id))
  const pending = tasks.filter(t => !doneIds.has(t.id))
  const done    = tasks.filter(t => doneIds.has(t.id))
  const pct     = tasks.length > 0 ? Math.round((done.length / tasks.length) * 100) : 0

  return (
    <div className="flex flex-col gap-2.5">
      {pending.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between px-1 mb-2">
            <span className="text-[11px] font-mono tracking-widest uppercase text-charcoal/40 font-semibold">Pending</span>
            <span className="text-[11px] font-mono text-charcoal/35">{done.length} / {tasks.length}</span>
          </div>
          <div className="bg-white rounded-[14px] border border-charcoal/8 overflow-hidden">
            <div className="h-[3px] bg-charcoal/6">
              <div className="h-full bg-warning transition-all" style={{ width: `${Math.max(pct, 2)}%` }} />
            </div>
            {pending.map((t, i) => (
              <div key={t.id} className={`px-4 py-3 flex items-center gap-3 ${i > 0 ? 'border-t border-charcoal/5' : ''}`}>
                <span className="w-[22px] h-[22px] rounded-md border-[1.5px] border-charcoal/25 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-medium text-charcoal">{t.title}</p>
                  {t.area && <p className="text-[11px] text-charcoal/40 mt-0.5">{t.area}</p>}
                </div>
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-charcoal/6 text-charcoal/40 uppercase tracking-wide">
                  {t.frequency}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {done.length > 0 && (
        <div>
          <span className="text-[11px] font-mono tracking-widest uppercase text-charcoal/35 font-semibold px-1 mb-2 block">Completed</span>
          <div className="bg-white rounded-[14px] border border-charcoal/8 overflow-hidden">
            {done.map((t, i) => (
              <div key={t.id} className={`px-4 py-3 flex items-center gap-3 ${i > 0 ? 'border-t border-charcoal/5' : ''}`}>
                <span className="w-[22px] h-[22px] rounded-md bg-success border-success border-[1.5px] flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg>
                </span>
                <p className="text-[13.5px] text-charcoal/40 line-through flex-1">{t.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AllergensTab({ venueSlug }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="bg-white rounded-[14px] border border-charcoal/8 overflow-hidden">
        <div className="px-4 pt-3.5 pb-3 border-b border-charcoal/6">
          <p className="text-[11px] font-mono tracking-widest uppercase text-charcoal/40 font-semibold">Today's acknowledgement</p>
        </div>
        <Link
          to={`/v/${venueSlug}/allergens`}
          className="flex items-center gap-3 px-4 py-3.5 hover:bg-charcoal/3 transition-colors"
        >
          <span className="w-[22px] h-[22px] rounded-md border-[1.5px] border-charcoal/25 shrink-0" />
          <p className="text-[13.5px] font-medium text-charcoal flex-1">View and confirm today's allergen sheet</p>
          <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-charcoal/25 shrink-0">
            <path d="M1 1l4 4-4 4"/>
          </svg>
        </Link>
      </div>

      <div className="bg-white rounded-[14px] border border-charcoal/8 overflow-hidden">
        <div className="px-4 pt-3.5 pb-3 border-b border-charcoal/6">
          <p className="text-[11px] font-mono tracking-widest uppercase text-charcoal/40 font-semibold">Reference</p>
        </div>
        <Link
          to={`/v/${venueSlug}/allergens`}
          className="flex items-center gap-3 px-4 py-3 hover:bg-charcoal/3 transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-charcoal/35 shrink-0">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
          </svg>
          <span className="text-[13.5px] font-medium text-charcoal flex-1">Full allergen matrix</span>
          <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-charcoal/25 shrink-0">
            <path d="M1 1l4 4-4 4"/>
          </svg>
        </Link>
      </div>
    </div>
  )
}

// ── Staff View ─────────────────────────────────────────────
function StaffTasksView({ session }) {
  const { venueId, venueSlug } = useVenue()
  const pendingSignOffs = usePendingSignOffs(session?.staffId, venueId)

  const [activeTab, setActiveTab] = useState('duties')
  const [dayOffset, setDayOffset] = useState(0)

  const targetDate = addDays(new Date(), dayOffset)
  const dateStr    = format(targetDate, 'yyyy-MM-dd')

  const dayLabel = (offset) => offset === 0 ? 'Today' : format(addDays(new Date(), offset), 'EEE')

  const dutiesData   = useTodayDuties(session?.staffId)
  const cleaningData = useStaffCleaning(venueId, dateStr)

  const TAB_TITLE = { duties: 'Duties', cleaning: 'Cleaning', allergens: 'Allergens' }

  const TABS = [
    { id: 'duties',   label: 'Duties',   count: dutiesData.duties.length },
    { id: 'cleaning', label: 'Cleaning', count: cleaningData.tasks.length },
    { id: 'allergens', label: 'Allergens', count: 1 },
  ]

  return (
    <div className="flex flex-col gap-3">

      {/* Training sign-off notification */}
      {pendingSignOffs > 0 && (
        <Link
          to={`/v/${venueSlug}/training`}
          className="flex items-center justify-between gap-4 bg-accent/10 border border-accent/20 rounded-xl px-4 py-3"
        >
          <div>
            <p className="text-sm font-semibold text-accent">Training record awaiting your signature</p>
            <p className="text-xs text-accent/70 mt-0.5">Tap to view and sign</p>
          </div>
          <span className="text-accent text-lg shrink-0">→</span>
        </Link>
      )}

      {/* Page header: mono label + large title + date picker */}
      <div className="flex items-start justify-between gap-3 px-0.5">
        <div>
          <span className="text-[11px] font-mono tracking-widest uppercase text-charcoal/40 font-semibold block">Tasks</span>
          <h1 className="text-[28px] font-bold text-charcoal leading-tight mt-0.5">{TAB_TITLE[activeTab]}</h1>
        </div>
        {/* Day selector */}
        <div className="flex p-[3px] bg-white border border-charcoal/10 rounded-xl mt-1 shrink-0">
          {[-1, 0, 1].map((offset) => (
            <button
              key={offset}
              onClick={() => setDayOffset(offset)}
              className={[
                'px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all',
                dayOffset === offset
                  ? 'bg-charcoal text-cream shadow-sm'
                  : 'text-charcoal/50 hover:text-charcoal/75',
              ].join(' ')}
            >
              {dayLabel(offset)}
            </button>
          ))}
        </div>
      </div>

      {/* Tab switcher with counts */}
      <div className="flex gap-1 p-[3px] bg-white border border-charcoal/10 rounded-[12px]">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={[
              'flex-1 py-2 rounded-[9px] text-[13px] font-semibold transition-all flex items-center justify-center gap-1.5',
              activeTab === t.id
                ? 'bg-charcoal text-cream shadow-sm'
                : 'text-charcoal/55 hover:text-charcoal/80',
            ].join(' ')}
          >
            {t.label}
            <span className={`text-[11px] font-mono tabular-nums ${activeTab === t.id ? 'text-cream/60' : 'text-charcoal/35'}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'duties'    && <DutiesTab duties={dutiesData.duties} loading={dutiesData.loading} toggleItem={dutiesData.toggleItem} />}
      {activeTab === 'cleaning'  && <CleaningTab tasks={cleaningData.tasks} completions={cleaningData.completions} loading={cleaningData.loading} />}
      {activeTab === 'allergens' && <AllergensTab venueSlug={venueSlug} />}

    </div>
  )
}

export default function TasksPage() {
  const { session, isManager } = useSession()
  const [tab, setTab] = useState('tasks')

  return (
    <div className="flex flex-col gap-6">
      {isManager && <h1 className="text-2xl font-bold text-charcoal">Task Manager</h1>}
      {isManager && (
        <div className="flex gap-1.5">
          {['tasks', 'duties'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                'px-4 py-1.5 rounded-full text-sm font-medium transition-all',
                tab === t
                  ? 'bg-charcoal text-cream'
                  : 'bg-charcoal/8 text-charcoal/50 hover:bg-charcoal/12 hover:text-charcoal/70',
              ].join(' ')}
            >
              {t === 'tasks' ? 'Tasks' : 'Duties'}
            </button>
          ))}
        </div>
      )}
      {isManager
        ? tab === 'tasks' ? <ManagerTasksView /> : <DutiesSection />
        : <StaffTasksView session={session} />
      }
    </div>
  )
}
