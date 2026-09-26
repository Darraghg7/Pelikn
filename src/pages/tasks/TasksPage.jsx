import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { format, addDays, formatDistanceToNow } from 'date-fns'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useAllTasks, useTasksForRole } from '../../hooks/useTasks'
import { useTodayDuties } from '../../hooks/useDuties'
import { useCleaningTasks } from '../../hooks/useCleaningTasks'
import { useToast } from '../../components/ui/Toast'
import { useVenueRoles } from '../../hooks/useVenueRoles'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
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
  return <p className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 mb-3">{children}</p>
}

function RoleBadge({ role, customRoles }) {
  const found = customRoles?.find(r => r.value === role)
  const label = role === 'all' ? 'All Roles' : (found?.label ?? role)
  return (
    <span className={`text-[11px] tracking-widest uppercase font-medium px-2 py-0.5 rounded ${found?.color ?? 'bg-charcoal/8 dark:bg-white/8 text-charcoal dark:text-white'}`}>
      {label}
    </span>
  )
}

// ── Staff picker hook ──────────────────────────────────────────────────────────

// Only the one-off form needs this, so it isn't fetched until that opens —
// one less request competing with the task list on page load.
function useStaffList(enabled) {
  const { venueId } = useVenue()
  const { data } = useQuery({
    queryKey: ['tasksStaffPicker', venueId],
    queryFn: async () => {
      const { data } = await supabase
        .from('staff')
        .select('id, name, job_role')
        .eq('venue_id', venueId)
        .eq('is_active', true)
        .order('name')
      return data ?? []
    },
    enabled: !!venueId && enabled,
  })
  return data ?? []
}

// Remembers which department cards a manager has collapsed, per venue, so
// the choice survives leaving the page and reopening the app.
function useCollapsedDepts(venueId) {
  const key = `pelikn_tasks_collapsed_${venueId}`
  const [collapsed, setCollapsed] = useState(() => readCollapsed(key))
  useEffect(() => { setCollapsed(readCollapsed(key)) }, [key])
  const toggle = useCallback((roleId) => {
    setCollapsed(prev => {
      const next = prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
      try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* best-effort */ }
      return next
    })
  }, [key])
  return [collapsed, toggle]
}

function readCollapsed(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// ── Shared task row used in manager columns ─────────────────────────────────
function ManagerTaskRow({ item, isTemplate, completions, onDelete, deleting }) {
  const comp = completions.find((c) =>
    isTemplate ? c.task_template_id === item.id : c.task_one_off_id === item.id
  )
  return (
    <div className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center text-[11px] ${comp ? 'bg-success border-success text-white' : 'border-charcoal/20 dark:border-white/20'}`}>
          {comp ? <svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg> : ''}
        </span>
        <div className="min-w-0">
          <p className={`text-sm truncate ${comp ? 'line-through text-charcoal/30 dark:text-white/30' : 'text-charcoal dark:text-white'}`}>{item.title}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {!isTemplate && item.assigned_to_name && (
              <span className="text-[11px] text-accent font-medium">→ {item.assigned_to_name}</span>
            )}
            {comp && <p className="text-[11px] text-charcoal/30 dark:text-white/30">{comp.completed_by_name}</p>}
          </div>
        </div>
      </div>
      <button
        onClick={() => onDelete(item.id)}
        disabled={deleting === item.id}
        className="text-sm text-charcoal/35 dark:text-white/30 hover:text-danger transition-colors shrink-0 px-2.5 py-1.5 rounded"
        title="Remove task"
      >{deleting === item.id ? '…' : '×'}</button>
    </div>
  )
}

// venue_roles.color is a hex string (e.g. '#1a3c2e'), unlike the old
// customRoles palette of Tailwind class pairs — applied as an inline tint
// rather than a className.
function hexToRgba(hex, alpha) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '')
  if (!m) return `rgba(26,26,24,${alpha})`
  const [r, g, b] = [m[1], m[2], m[3]].map(h => parseInt(h, 16))
  return `rgba(${r},${g},${b},${alpha})`
}

// ── Department column ─────────────────────────────────────────────────────────
function DeptColumn({ role, label, color, templates, oneOffs, completions, onDeleteTemplate, onDeleteOneOff, deleting, collapsed, onToggle }) {
  const deptTemplates = templates.filter(t => t.role_id === role)
  const deptOneOffs   = oneOffs.filter(o => o.role_id === role)
  const deptDone = completions.filter(c =>
    deptTemplates.some(t => t.id === c.task_template_id) ||
    deptOneOffs.some(o => o.id === c.task_one_off_id)
  ).length
  const deptTotal = deptTemplates.length + deptOneOffs.length

  return (
    // w-full is load-bearing: the parent row uses items-start, which stretches
    // children to equal width only once it's flex-row (sm:+). Stacked on
    // mobile, cross-axis alignment is "start" (shrink-to-fit), so each column
    // ends up sized to its own content — w-full forces the full row width
    // regardless of direction.
    <div className="flex-1 w-full min-w-0 bg-white dark:bg-paperDark rounded-2xl border border-charcoal/10 dark:border-white/10 overflow-hidden">
      {/* Column header — tap to collapse */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        style={{ backgroundColor: hexToRgba(color, 0.14) }}
        className="w-full px-4 py-3 border-b border-charcoal/8 dark:border-white/8 flex items-center justify-between gap-2 text-left cursor-pointer border-none text-charcoal dark:text-white"
      >
        <p className="text-sm font-semibold">{label}</p>
        <span className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-medium opacity-70">{deptDone}/{deptTotal}</span>
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-150 ${collapsed ? '-rotate-90' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          ><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </button>

      {!collapsed && (
        <div className="p-4 flex flex-col gap-0 divide-y divide-charcoal/6 dark:divide-white/8">
          {/* Recurring */}
          {deptTemplates.length > 0 && (
            <div className="pb-3">
              <p className="text-[11px] tracking-widest uppercase text-charcoal/30 dark:text-white/30 mb-2">Recurring</p>
              {deptTemplates.map(t => (
                <ManagerTaskRow key={t.id} item={t} isTemplate completions={completions} onDelete={onDeleteTemplate} deleting={deleting} />
              ))}
            </div>
          )}

          {/* One-offs */}
          {deptOneOffs.length > 0 && (
            <div className={deptTemplates.length > 0 ? 'pt-3' : ''}>
              <p className="text-[11px] tracking-widest uppercase text-charcoal/30 dark:text-white/30 mb-2">One-off</p>
              {deptOneOffs.map(o => (
                <ManagerTaskRow key={o.id} item={o} isTemplate={false} completions={completions} onDelete={onDeleteOneOff} deleting={deleting} />
              ))}
            </div>
          )}

          {deptTotal === 0 && (
            <EmptyState icon="clipboard" title="No tasks" description="No tasks set up for this department yet." className="py-4" />
          )}
        </div>
      )}
    </div>
  )
}

// ── Manager View ──────────────────────────────────────────
function ManagerTasksView() {
  const toast = useToast()
  const { venueId } = useVenue()
  const today = new Date()
  const { templates, oneOffs, completions, loading, reload } = useAllTasks(today)
  const { roles = [], loading: rolesLoading } = useVenueRoles()
  const roleIdValues = roles.map(r => r.id)
  const [collapsedDepts, toggleDept] = useCollapsedDepts(venueId)

  const [showAddTemplate, setShowAddTemplate] = useState(false)
  const [showAddOneOff, setShowAddOneOff]     = useState(false)
  const staffList = useStaffList(showAddOneOff)
  const [tForm, setTForm]   = useState({ title: '', role_id: null })
  const [oForm, setOForm]   = useState({
    title: '',
    role_id: null,
    due_date: format(today, 'yyyy-MM-dd'),
    assigned_to_staff_id: '',
  })
  const [saving, setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null) // { id, isTemplate }

  // "All roles" items — untargeted, or targeting a role this venue no longer
  // has (fail-open — same rule as roleMatcher, applied here for the manager's
  // display bucketing rather than a visibility gate).
  const allRolesTemplates = templates.filter(t => !t.role_id || !roleIdValues.includes(t.role_id))
  const allRolesOneOffs   = oneOffs.filter(o => !o.role_id || !roleIdValues.includes(o.role_id))

  const saveTemplate = async () => {
    if (!tForm.title.trim()) return
    setSaving(true)
    const { error } = await supabase.from('task_templates').insert({
      title: tForm.title.trim(), role_id: tForm.role_id, venue_id: venueId,
    })
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Task template added')
    setTForm({ title: '', role_id: null })
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
      role_id:              assignee ? null : oForm.role_id, // assigned-to-person tasks aren't role-targeted
      due_date:             oForm.due_date,
      venue_id:             venueId,
      assigned_to_staff_id: assignee?.id   ?? null,
      assigned_to_name:     assignee?.name ?? null,
    })
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('One-off task added')
    setOForm({ title: '', role_id: null, due_date: format(today, 'yyyy-MM-dd'), assigned_to_staff_id: '' })
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

  // Roles decide which column each task lands in — rendering before they
  // arrive would briefly pile every task into "All Roles".
  if (loading || rolesLoading) return <SkeletonList rows={4} className="py-4" />

  return (
    <div className="flex flex-col gap-6">

      <ConfirmDialog
        open={!!confirmDelete}
        title="Remove task?"
        message="This can't be undone."
        confirmLabel="Remove"
        danger
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          const { id, isTemplate } = confirmDelete
          setConfirmDelete(null)
          isTemplate ? deleteTemplate(id) : deleteOneOff(id)
        }}
      />

      {/* ── Add forms ─────────────────────────────────────────────────────── */}
      <div className="flex gap-2">
        <button
          onClick={() => { setShowAddTemplate(v => !v); setShowAddOneOff(false) }}
          className="text-[11px] tracking-widest uppercase text-charcoal/50 dark:text-white/40 hover:text-charcoal dark:hover:text-white transition-colors border-b border-charcoal/20 dark:border-white/20"
        >
          + Recurring Task
        </button>
        <span className="text-charcoal/20 dark:text-white/20 text-xs self-end pb-0.5">·</span>
        <button
          onClick={() => { setShowAddOneOff(v => !v); setShowAddTemplate(false) }}
          className="text-[11px] tracking-widest uppercase text-charcoal/50 dark:text-white/40 hover:text-charcoal dark:hover:text-white transition-colors border-b border-charcoal/20 dark:border-white/20"
        >
          + One-Off Task
        </button>
      </div>

      {showAddTemplate && (
        <div className="p-4 rounded-2xl bg-white dark:bg-paperDark border border-charcoal/10 dark:border-white/10 flex flex-col gap-3">
          <p className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35">New Recurring Task</p>
          <input
            value={tForm.title}
            onChange={(e) => setTForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Complete daily checklist"
            className="px-4 py-2.5 rounded-lg border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
          />
          <div className="flex gap-2 flex-wrap">
            {[{ id: null, name: 'All Roles' }, ...roles].map((r) => (
              <button key={r.id ?? 'all'} type="button" onClick={() => setTForm(f => ({ ...f, role_id: r.id }))}
                className={['px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                  tForm.role_id === r.id ? 'bg-charcoal text-cream border-charcoal dark:border-white' : 'bg-white dark:bg-paperDark text-charcoal/50 dark:text-white/40 border-charcoal/15 dark:border-white/15',
                ].join(' ')}>
                {r.name}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={saveTemplate} disabled={saving || !tForm.title.trim()}
              className="flex-1 bg-charcoal text-cream py-2 rounded-lg text-sm font-medium disabled:opacity-40">
              {saving ? 'Saving…' : 'Save Template →'}
            </button>
            <button onClick={() => setShowAddTemplate(false)} className="px-4 py-2 rounded-lg border border-charcoal/15 dark:border-white/15 text-sm text-charcoal/50 dark:text-white/40">
              Cancel
            </button>
          </div>
        </div>
      )}

      {showAddOneOff && (
        <div className="p-4 rounded-2xl bg-white dark:bg-paperDark border border-charcoal/10 dark:border-white/10 flex flex-col gap-3">
          <p className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35">New One-Off Task</p>
          <input
            value={oForm.title}
            onChange={(e) => setOForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Check delivery from supplier"
            className="px-4 py-2.5 rounded-lg border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-[11px] text-charcoal/50 dark:text-white/40 whitespace-nowrap">Due date:</label>
            <input type="date" value={oForm.due_date}
              onChange={(e) => setOForm(f => ({ ...f, due_date: e.target.value }))}
              className="px-3 py-2 rounded-lg border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
            />
          </div>
          <div>
            <p className="text-[11px] text-charcoal/50 dark:text-white/40 mb-2">Assign to:</p>
            <div className="flex flex-col gap-2">
              <select value={oForm.assigned_to_staff_id}
                onChange={(e) => setOForm(f => ({ ...f, assigned_to_staff_id: e.target.value }))}
                className="px-3 py-2 rounded-lg border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20">
                <option value="">Specific person (optional)</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {!oForm.assigned_to_staff_id && (
                <div className="flex gap-2 flex-wrap">
                  {[{ id: null, name: 'All Roles' }, ...roles].map((r) => (
                    <button key={r.id ?? 'all'} type="button" onClick={() => setOForm(f => ({ ...f, role_id: r.id }))}
                      className={['px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                        oForm.role_id === r.id ? 'bg-charcoal text-cream border-charcoal dark:border-white' : 'bg-white dark:bg-paperDark text-charcoal/50 dark:text-white/40 border-charcoal/15 dark:border-white/15',
                      ].join(' ')}>
                      {r.name}
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
            <button onClick={() => setShowAddOneOff(false)} className="px-4 py-2 rounded-lg border border-charcoal/15 dark:border-white/15 text-sm text-charcoal/50 dark:text-white/40">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Department columns ─────────────────────────────────────────────── */}
      {roles.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 items-start">
          {roles.map((role) => (
            <DeptColumn
              key={role.id}
              role={role.id}
              label={role.name}
              color={role.color}
              templates={templates}
              oneOffs={oneOffs}
              completions={completions}
              onDeleteTemplate={(id) => setConfirmDelete({ id, isTemplate: true })}
              onDeleteOneOff={(id) => setConfirmDelete({ id, isTemplate: false })}
              deleting={deleting}
              collapsed={collapsedDepts.includes(role.id)}
              onToggle={() => toggleDept(role.id)}
            />
          ))}
        </div>
      )}

      {/* ── All-roles tasks ───────────────────────────────────────────────── */}
      {(allRolesTemplates.length > 0 || allRolesOneOffs.length > 0) && (
        <div className="bg-white dark:bg-paperDark rounded-2xl border-charcoal/10 dark:border-white/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-charcoal/8 dark:border-white/8 bg-charcoal/3 dark:bg-white/5">
            <p className="text-sm font-semibold text-charcoal dark:text-white">All Roles</p>
          </div>
          <div className="p-4 flex flex-col divide-y divide-charcoal/6 dark:divide-white/8">
            {[...allRolesTemplates, ...allRolesOneOffs].map((item) => {
              const isTemplate = !('due_date' in item)
              return (
                <ManagerTaskRow
                  key={item.id}
                  item={item}
                  isTemplate={isTemplate}
                  completions={completions}
                  onDelete={(id) => setConfirmDelete({ id, isTemplate })}
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

// Staff read the same schedule as managers, through the same frequency-aware
// hook. The bespoke version this replaced compared completions against a single
// calendar day, so a weekly task ticked on Monday was pending again on Tuesday
// for everyone else.

function TaskItemRow({ item, assignmentId, toggleItem }) {
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const handleToggle = async () => {
    if (busy) return
    setBusy(true)
    const { error } = await toggleItem(assignmentId, item.id, item.completed)
    if (error) {
      toast("Couldn't update that task, try again", 'error')
      setBusy(false)
    } else {
      setTimeout(() => setBusy(false), 150)
    }
  }
  return (
    <button
      onClick={handleToggle}
      disabled={busy}
      className="min-h-11 flex items-center gap-3 w-full text-left py-2.5 px-4 group disabled:opacity-70 hover:bg-charcoal/3 dark:hover:bg-white/5 transition-colors border-t border-charcoal/5 dark:border-white/5 first:border-t-0"
    >
      <span className={[
        'w-[22px] h-[22px] rounded-md border-[1.5px] shrink-0 flex items-center justify-center transition-all',
        item.completed ? 'bg-success border-success' : 'border-charcoal/25 dark:border-white/25 group-hover:border-charcoal/45 dark:group-hover:border-white/45',
      ].join(' ')}>
        {item.completed && (
          <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2,6 5,9 10,3"/>
          </svg>
        )}
      </span>
      <span className={`text-[13.5px] leading-snug flex-1 font-medium ${item.completed ? 'line-through text-charcoal/35 dark:text-white/30' : 'text-charcoal dark:text-white'}`}>
        {item.title}
      </span>
      {!item.completed && (
        <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-charcoal/25 dark:text-white/25 shrink-0">
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
    <div className="bg-white dark:bg-paperDark rounded-[14px] border border-charcoal/8 dark:border-white/8 overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3.5 pb-3 border-b border-charcoal/6 dark:border-white/8">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[11px] text-charcoal/40 dark:text-white/35 tracking-widest uppercase font-semibold shrink-0">Duty</span>
          <span className="text-charcoal/25 dark:text-white/25 text-xs">·</span>
          <p className="text-[15px] font-semibold text-charcoal dark:text-white truncate">{duty.title}</p>
        </div>
        <span className={`text-[11px] font-mono font-semibold shrink-0 ml-2 ${allDone ? 'text-success' : 'text-charcoal/35 dark:text-white/30'}`}>
          {done}/{total}
        </span>
      </div>
      {total > 0 && (
        <div className="h-[3px] bg-charcoal/6 dark:bg-white/8">
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
    <div className="bg-white dark:bg-paperDark rounded-[14px] border border-charcoal/8 dark:border-white/8 p-8 text-center">
      <p className="text-sm text-charcoal/40 dark:text-white/35">No duties assigned for today</p>
    </div>
  )
  return (
    <div className="flex flex-col gap-2.5">
      {duties.map(d => <StaffDutyCard key={d.assignmentId} duty={d} toggleItem={toggleItem} />)}
    </div>
  )
}

const DUE_TONE = {
  danger:  'text-danger',
  warning: 'text-warning',
  muted:   'text-charcoal/40 dark:text-white/35',
}

/** "3d overdue" / "Due today" / "Due Fri" — see cleaningDueLabel(). */
function DueLabel({ due, className = '' }) {
  return (
    <span className={`font-mono text-[11px] font-bold tracking-wide uppercase ${DUE_TONE[due.tone]} ${className}`}>
      {due.text}
    </span>
  )
}

function CleaningTaskRow({ task, onComplete, isFirst }) {
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const handleTap = async () => {
    if (busy) return
    setBusy(true)
    const { error } = await onComplete(task.id)
    if (error) {
      toast(error.message, 'error')
      setBusy(false)
    } else {
      setBusy(false)
    }
  }
  return (
    <div className={`px-4 py-3 flex items-center gap-3 ${!isFirst ? 'border-t border-charcoal/5 dark:border-white/5' : ''}`}>
      <button
        onClick={handleTap}
        disabled={busy}
        aria-label="Mark done"
        className="w-[22px] h-[22px] rounded-md border-[1.5px] border-charcoal/25 dark:border-white/25 shrink-0 grid place-items-center hover:border-success hover:bg-success/10 transition-colors disabled:opacity-50"
      >
        {busy && <span className="w-2.5 h-2.5 rounded-full border-2 border-success/25 border-t-success animate-spin" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-medium text-charcoal dark:text-white">{task.title}</p>
        {task.due && <DueLabel due={task.due} className="mt-0.5 block" />}
      </div>
      <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-charcoal/6 dark:bg-white/8 text-charcoal/40 dark:text-white/35 uppercase tracking-wide">
        {task.frequency}
      </span>
    </div>
  )
}

function DoneCleaningRow({ task, isFirst }) {
  return (
    <div className={`px-4 py-3 flex items-center gap-3 ${!isFirst ? 'border-t border-charcoal/5 dark:border-white/5' : ''}`}>
      <span className="w-[22px] h-[22px] rounded-md bg-success border-success border-[1.5px] flex items-center justify-center shrink-0">
        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg>
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] text-charcoal/40 dark:text-white/35 line-through">{task.title}</p>
        {/* Says who cleared it, so nobody wonders why it's gone. */}
        {(task.lastCompletion?.completed_by_name || task.due) && (
          <p className="text-[11px] text-charcoal/35 dark:text-white/30 mt-0.5 no-underline">
            {task.lastCompletion?.completed_by_name && (
              <>{task.lastCompletion.completed_by_name} · {formatDistanceToNow(new Date(task.lastCompletion.completed_at), { addSuffix: true })}</>
            )}
            {/* When it comes back round, so nobody has to work it out. */}
            {task.lastCompletion?.completed_by_name && task.due && ' · '}
            {task.due && <DueLabel due={task.due} />}
          </p>
        )}
      </div>
    </div>
  )
}

function CleaningTab({ tasks, loading, error, session, reload }) {
  // Tasks ticked during this visit keep their place in Pending, shown as done,
  // instead of jumping to Completed: the next task used to slide under the
  // finger that had just tapped, so a double-tap ticked one nobody cleaned.
  // They move down on the next visit. (Declared before the early returns.)
  const [tickedThisVisit, setTickedThisVisit] = useState(() => new Set())

  if (loading) return <SkeletonList rows={4} />
  if (error) return (
    <div className="bg-white dark:bg-paperDark rounded-[14px] border border-danger/20 p-8 text-center">
      <p className="text-sm text-danger/80">Could not load the cleaning schedule</p>
      <p className="text-[11px] text-charcoal/40 dark:text-white/35 mt-1">Pull to refresh, or tell your manager if it keeps happening.</p>
    </div>
  )
  if (!tasks.length) return (
    <div className="bg-white dark:bg-paperDark rounded-[14px] border border-charcoal/8 dark:border-white/8 p-8 text-center">
      <p className="text-sm text-charcoal/40 dark:text-white/35">No cleaning tasks configured</p>
    </div>
  )
  // A task drops off everyone's list once it's ticked, and comes back only when
  // its frequency brings it round again — a weekly task done on Monday is
  // nobody's job until the next Monday, whoever ticked it.
  //
  // A task nobody has ever done stays in Pending even while it's in its first
  // cycle ('due_soon' with no completion) — otherwise a brand-new task showed
  // struck through under Completed, as if someone had cleaned it.
  const isPending = t => t.status === 'overdue' || !t.lastCompletion || tickedThisVisit.has(t.id)
  const pending = tasks.filter(isPending)
  const done    = tasks.filter(t => !isPending(t))
  const pct     = tasks.length > 0 ? Math.round((done.length / tasks.length) * 100) : 0

  const completeTask = async (taskId) => {
    const { error } = await supabase.rpc('complete_cleaning_task', {
      p_token: session?.token,
      p_cleaning_task_id: taskId,
      p_notes: null,
    })
    if (!error) {
      setTickedThisVisit(prev => new Set(prev).add(taskId))
      reload?.()
    }
    return { error }
  }

  return (
    <div className="flex flex-col gap-2.5">
      {pending.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between px-1 mb-2">
            <span className="text-[11px] font-mono tracking-widest uppercase text-charcoal/40 dark:text-white/35 font-semibold">Pending</span>
            <span className="text-[11px] font-mono text-charcoal/35 dark:text-white/30">{done.length} / {tasks.length}</span>
          </div>
          <div className="bg-white dark:bg-paperDark rounded-[14px] border border-charcoal/8 dark:border-white/8 overflow-hidden">
            <div className="h-[3px] bg-charcoal/6 dark:bg-white/8">
              <div className="h-full bg-warning transition-all" style={{ width: `${Math.max(pct, 2)}%` }} />
            </div>
            {pending.map((t, i) => (
              tickedThisVisit.has(t.id) && t.status !== 'overdue'
                ? <DoneCleaningRow key={t.id} task={t} isFirst={i === 0} />
                : <CleaningTaskRow key={t.id} task={t} onComplete={completeTask} isFirst={i === 0} />
            ))}
          </div>
        </div>
      )}
      {done.length > 0 && (
        <div>
          <span className="text-[11px] font-mono tracking-widest uppercase text-charcoal/35 dark:text-white/30 font-semibold px-1 mb-2 block">Completed</span>
          <div className="bg-white dark:bg-paperDark rounded-[14px] border border-charcoal/8 dark:border-white/8 overflow-hidden">
            {done.map((t, i) => <DoneCleaningRow key={t.id} task={t} isFirst={i === 0} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function AllergensTab({ venueSlug }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="bg-white dark:bg-paperDark rounded-[14px] border border-charcoal/8 dark:border-white/8 overflow-hidden">
        <div className="px-4 pt-3.5 pb-3 border-b border-charcoal/6 dark:border-white/8">
          <p className="text-[11px] font-mono tracking-widest uppercase text-charcoal/40 dark:text-white/35 font-semibold">Today's acknowledgement</p>
        </div>
        <Link
          to={`/v/${venueSlug}/allergens`}
          className="flex items-center gap-3 px-4 py-3.5 hover:bg-charcoal/3 dark:hover:bg-white/5 transition-colors"
        >
          <span className="w-[22px] h-[22px] rounded-md border-[1.5px] border-charcoal/25 dark:border-white/25 shrink-0" />
          <p className="text-[13.5px] font-medium text-charcoal dark:text-white flex-1">View and confirm today's allergen sheet</p>
          <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-charcoal/25 dark:text-white/25 shrink-0">
            <path d="M1 1l4 4-4 4"/>
          </svg>
        </Link>
      </div>

      <div className="bg-white dark:bg-paperDark rounded-[14px] border border-charcoal/8 dark:border-white/8 overflow-hidden">
        <div className="px-4 pt-3.5 pb-3 border-b border-charcoal/6 dark:border-white/8">
          <p className="text-[11px] font-mono tracking-widest uppercase text-charcoal/40 dark:text-white/35 font-semibold">Reference</p>
        </div>
        <Link
          to={`/v/${venueSlug}/allergens`}
          className="flex items-center gap-3 px-4 py-3 hover:bg-charcoal/3 dark:hover:bg-white/5 transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-charcoal/35 dark:text-white/30 shrink-0">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
          </svg>
          <span className="text-[13.5px] font-medium text-charcoal dark:text-white flex-1">Full allergen matrix</span>
          <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-charcoal/25 dark:text-white/25 shrink-0">
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
  const { roles = [] } = useVenueRoles()
  const pendingSignOffs = usePendingSignOffs(session?.staffId, venueId)

  const [activeTab, setActiveTab] = useState('duties')
  const [dayOffset, setDayOffset] = useState(0)

  const targetDate = addDays(new Date(), dayOffset)

  const dayLabel = (offset) => offset === 0 ? 'Today' : format(addDays(new Date(), offset), 'EEE')

  const dutiesData   = useTodayDuties(session?.staffId)
  // Same role targeting as /cleaning, so a task assigned to one role doesn't
  // appear here and then vanish on the page where it gets ticked off. Unknown
  // roles fail open — see lib/roleFilter.
  const knownRoleIds = useMemo(() => roles.map(r => r.id), [roles])
  const cleaningData = useCleaningTasks(session?.roleIds ?? null, knownRoleIds, targetDate)
  const cleaningDue  = cleaningData.tasks.filter(t => t.status === 'overdue').length

  const TAB_TITLE = { duties: 'Duties', cleaning: 'Cleaning', allergens: 'Allergens' }

  const TABS = [
    { id: 'duties',   label: 'Duties',   count: dutiesData.duties.length },
    // Outstanding, not total — the badge is "what's left to do".
    { id: 'cleaning', label: 'Cleaning', count: cleaningDue },
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
          <span className="text-[11px] font-mono tracking-widest uppercase text-charcoal/40 dark:text-white/35 font-semibold block">Tasks</span>
          <h1 className="text-[28px] font-bold text-charcoal dark:text-white leading-tight mt-0.5">{TAB_TITLE[activeTab]}</h1>
        </div>
        {/* Day selector */}
        <div className="flex p-[3px] bg-white dark:bg-paperDark border border-charcoal/10 dark:border-white/10 rounded-xl mt-1 shrink-0">
          {[-1, 0, 1].map((offset) => (
            <button
              key={offset}
              onClick={() => setDayOffset(offset)}
              className={[
                'px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all',
                dayOffset === offset
                  ? 'bg-charcoal text-cream shadow-sm'
                  : 'text-charcoal/50 dark:text-white/40 hover:text-charcoal/75 dark:hover:text-white/60',
              ].join(' ')}
            >
              {dayLabel(offset)}
            </button>
          ))}
        </div>
      </div>

      {/* Tab switcher with counts */}
      <div className="flex gap-1 p-[3px] bg-white dark:bg-paperDark border border-charcoal/10 dark:border-white/10 rounded-[12px]">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={[
              'flex-1 py-2 rounded-[9px] text-[13px] font-semibold transition-all flex items-center justify-center gap-1.5',
              activeTab === t.id
                ? 'bg-charcoal text-cream shadow-sm'
                : 'text-charcoal/55 dark:text-white/45 hover:text-charcoal/80 dark:hover:text-white/68',
            ].join(' ')}
          >
            {t.label}
            <span className={`text-[11px] font-mono tabular-nums ${activeTab === t.id ? 'text-cream/60' : 'text-charcoal/35 dark:text-white/30'}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'duties'    && <DutiesTab duties={dutiesData.duties} loading={dutiesData.loading} toggleItem={dutiesData.toggleItem} />}
      {activeTab === 'cleaning'  && <CleaningTab tasks={cleaningData.tasks} loading={cleaningData.loading} error={cleaningData.error} session={session} reload={cleaningData.reload} />}
      {activeTab === 'allergens' && <AllergensTab venueSlug={venueSlug} />}

    </div>
  )
}

export default function TasksPage() {
  const { session, isManager } = useSession()
  const [tab, setTab] = useState('tasks')

  return (
    <div className="flex flex-col gap-6">
      {isManager && <h1 className="text-2xl font-bold text-charcoal dark:text-white">Task Manager</h1>}
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
                  : 'bg-charcoal/8 dark:bg-white/8 text-charcoal/50 dark:text-white/40 hover:bg-charcoal/12 dark:hover:bg-white/15 hover:text-charcoal/70 dark:hover:text-white/60',
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
