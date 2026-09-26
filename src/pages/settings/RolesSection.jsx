import React, { useState } from 'react'
import { useToast } from '../../components/ui/Toast'
import { useVenueRoles, useStaffRoleAssignments } from '../../hooks/useVenueRoles'
import { useDepartments, useStaffDepartments } from '../../hooks/useDepartments'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

/* ── Departments: where people work ─────────────────────────────────────────── */
// People are ticked into departments on their staff page; cleaning tasks,
// Tasks and checks are assigned to one. New departments show up in both
// places straight away (they read the same query).
function DepartmentsSection() {
  const toast = useToast()
  const { departments, loading, addDepartment, renameDepartment, deleteDepartment } = useDepartments()
  const [newName, setNewName]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName]   = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)

  const handleAdd = async () => {
    if (!newName.trim()) return
    setSaving(true)
    const { error } = await addDepartment(newName)
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    setNewName('')
  }

  const handleRename = async (id) => {
    if (!editName.trim()) return
    const { error } = await renameDepartment(id, editName)
    if (error) { toast(error.message, 'error'); return }
    setEditingId(null)
  }

  const confirmDelete = async () => {
    const { error } = await deleteDepartment(deleteTarget.id)
    setDeleteTarget(null)
    if (error) toast(error.message, 'error')
  }

  if (loading) return null

  return (
    <div className="flex flex-col gap-3">
      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove department?"
        message={`Remove "${deleteTarget?.name}"? Its cleaning tasks, Tasks and checks switch to Everyone, and nobody is in it any more. Nothing gets deleted.`}
        confirmLabel="Remove"
        danger
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />

      {departments.length > 0 && (
        <div className="bg-white dark:bg-paperDark rounded-xl border border-charcoal/8 dark:border-white/8 overflow-hidden divide-y divide-charcoal/5 dark:divide-white/5">
          {departments.map(dept => (
            <div key={dept.id} className="grid items-center gap-3 py-2 px-3 grid-cols-[1fr_auto] hover:bg-charcoal/[0.025] transition-colors group">
              {editingId === dept.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleRename(dept.id)}
                    className="px-2 py-1 rounded-md border border-charcoal/20 dark:border-white/20 bg-white dark:bg-paperDark text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <button onClick={() => handleRename(dept.id)} className="h-7 px-2.5 rounded-md bg-charcoal text-cream text-xs font-medium">Save</button>
                    <button onClick={() => setEditingId(null)}     className="h-7 px-2.5 rounded-md text-xs text-charcoal/50 dark:text-white/40">Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium text-charcoal dark:text-white truncate">{dept.name}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingId(dept.id); setEditName(dept.name) }}
                            className="h-7 px-2.5 rounded-md border border-charcoal/12 dark:border-white/15 text-xs font-medium text-charcoal/60 dark:text-white/50 hover:text-charcoal dark:hover:text-white hover:border-charcoal/30 dark:hover:border-white/30 transition-colors">Rename</button>
                    <button onClick={() => setDeleteTarget({ id: dept.id, name: dept.name })}
                            className="h-7 px-2.5 rounded-md border border-charcoal/12 dark:border-white/15 text-xs font-medium text-charcoal/60 dark:text-white/50 hover:text-danger hover:border-danger/30 transition-colors">Remove</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {departments.length === 0 && (
        <p className="text-sm text-charcoal/30 dark:text-white/30 italic">No departments yet. Until you add some, everyone sees everything.</p>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Department name (e.g. Kitchen)"
          className="flex-1 px-3 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm text-charcoal dark:text-white placeholder-charcoal/25 dark:placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
        />
        <button
          onClick={handleAdd}
          disabled={saving || !newName.trim()}
          className="px-4 py-2.5 rounded-xl bg-charcoal text-cream text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40"
        >
          {saving ? '…' : '+ Add'}
        </button>
      </div>
    </div>
  )
}

/* ── Departments + job titles ─────────────────────────────────────────────── */
export default function RolesSection() {
  const toast = useToast()
  const { roles, loading, addRole, renameRole, deleteRole } = useVenueRoles()
  const [newName, setNewName]         = useState('')
  const [editingId, setEditingId]     = useState(null)
  const [editName, setEditName]       = useState('')
  const [saving, setSaving]           = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const handleAdd = async () => {
    if (!newName.trim()) return
    setSaving(true)
    const { error } = await addRole(newName)
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    setNewName('')
  }

  const handleRename = async (id) => {
    if (!editName.trim()) return
    const { error } = await renameRole(id, editName)
    if (error) { toast(error.message, 'error'); return }
    setEditingId(null)
  }

  const confirmDelete = async () => {
    const { error } = await deleteRole(deleteTarget.id)
    setDeleteTarget(null)
    if (error) toast(error.message, 'error')
  }

  if (loading) return <div className="py-4 text-center text-sm text-charcoal/30 dark:text-white/30">Loading…</div>

  return (
    <div className="flex flex-col gap-4">
      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove job title?"
        message={`Remove "${deleteTarget?.name}"? Anyone with it loses it, and the rota builder stops using it.`}
        confirmLabel="Remove"
        danger
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
      <p className="text-[11px] font-bold tracking-widest uppercase text-charcoal/40 dark:text-white/35">Departments</p>
      <p className="text-xs text-charcoal/45 dark:text-white/40 -mt-2">
        Where people work. Tick each person into their departments on their staff page. Cleaning, Tasks and Checks are
        assigned to a department, so people only see their own. Managers can switch between departments or view all.
        Anyone who should see everything, like a general manager, shouldn't be given a department.
      </p>
      <DepartmentsSection />

      <p className="text-[11px] font-bold tracking-widest uppercase text-charcoal/40 dark:text-white/35 mt-1">Job titles</p>
      <p className="text-xs text-charcoal/45 dark:text-white/40 -mt-2">
        What people do (e.g. Barista, Chef). Used by the rota builder to fill shifts. Job titles don't change what anyone sees.
      </p>

      {/* Existing roles */}
      {roles.length > 0 && (
        <div className="bg-white dark:bg-paperDark rounded-xl border border-charcoal/8 dark:border-white/8 overflow-hidden divide-y divide-charcoal/5 dark:divide-white/5">
          {roles.map(role => {
            return (
            <div key={role.id} className="grid items-center gap-3 py-2 px-3 grid-cols-[1fr_auto] hover:bg-charcoal/[0.025] transition-colors group">
              {editingId === role.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleRename(role.id)}
                    className="px-2 py-1 rounded-md border border-charcoal/20 dark:border-white/20 bg-white dark:bg-paperDark text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <button onClick={() => handleRename(role.id)}  className="h-7 px-2.5 rounded-md bg-charcoal text-cream text-xs font-medium">Save</button>
                    <button onClick={() => setEditingId(null)}      className="h-7 px-2.5 rounded-md text-xs text-charcoal/50 dark:text-white/40">Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: role.color || '#1a3c2e' }} />
                    <span className="text-sm font-medium text-charcoal dark:text-white truncate">{role.name}</span>
                  </span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingId(role.id); setEditName(role.name) }}
                            className="h-7 px-2.5 rounded-md border border-charcoal/12 dark:border-white/15 text-xs font-medium text-charcoal/60 dark:text-white/50 hover:text-charcoal dark:hover:text-white hover:border-charcoal/30 dark:hover:border-white/30 transition-colors">Rename</button>
                    <button onClick={() => setDeleteTarget({ id: role.id, name: role.name })}
                            className="h-7 px-2.5 rounded-md border border-charcoal/12 dark:border-white/15 text-xs font-medium text-charcoal/60 dark:text-white/50 hover:text-danger hover:border-danger/30 transition-colors">Remove</button>
                  </div>
                </>
              )}
            </div>
            )
          })}
        </div>
      )}

      {roles.length === 0 && (
        <p className="text-sm text-charcoal/30 dark:text-white/30 italic">No job titles yet — add your first below.</p>
      )}

      {/* Add new role */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Job title (e.g. Barista)"
          className="flex-1 px-3 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm text-charcoal dark:text-white placeholder-charcoal/25 dark:placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
        />
        <button
          onClick={handleAdd}
          disabled={saving || !newName.trim()}
          className="px-4 py-2.5 rounded-xl bg-charcoal text-cream text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40"
        >
          {saving ? '…' : '+ Add'}
        </button>
      </div>
    </div>
  )
}

/* ── Staff department ticks (shown in staff edit form) ─────────────────────── */
export function StaffDepartmentsAssignment({ staffId }) {
  const { departments } = useDepartments()
  const { departmentIds, toggleDepartment } = useStaffDepartments(staffId)
  const toast = useToast()

  const onToggle = async (departmentId) => {
    const { error } = await toggleDepartment(departmentId)
    if (error) toast('Could not update department: ' + (error.message ?? 'unknown error'), 'error')
  }

  if (departments.length === 0) {
    return (
      <p className="text-[13px] text-ink3 dark:text-white/45">
        No departments set up yet. Add them under the Departments tab first.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {departments.map(dept => {
        const active = departmentIds.includes(dept.id)
        return (
          <button
            key={dept.id}
            type="button"
            onClick={() => onToggle(dept.id)}
            aria-pressed={active}
            className={[
              'h-8 px-3.5 rounded-full border text-[13px] font-semibold transition-colors',
              active
                ? 'bg-brand border-brand text-white'
                : 'bg-white dark:bg-paperDark border-line dark:border-white/10 text-ink2 dark:text-white/75 hover:border-ink4',
            ].join(' ')}
          >
            {dept.name}
          </button>
        )
      })}
    </div>
  )
}

/* ── Staff job titles (shown in staff edit form) ───────────────────────────── */
export function StaffRolesAssignment({ staffId }) {
  const { roles } = useVenueRoles()
  const { roleIds, toggleRole } = useStaffRoleAssignments(staffId)
  const toast = useToast()

  const onToggle = async (roleId) => {
    const { error } = await toggleRole(roleId)
    if (error) toast('Could not update role: ' + (error.message ?? 'unknown error'), 'error')
  }

  if (roles.length === 0) {
    return (
      <p className="text-[13px] text-ink3 dark:text-white/45">
        No job titles set up yet. Add them under the Departments tab first.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {roles.map(role => {
        const active = roleIds.includes(role.id)
        return (
          <button
            key={role.id}
            type="button"
            onClick={() => onToggle(role.id)}
            aria-pressed={active}
            className={[
              'h-8 px-3.5 rounded-full border text-[13px] font-semibold transition-colors',
              active
                ? 'bg-brand border-brand text-white'
                : 'bg-white dark:bg-paperDark border-line dark:border-white/10 text-ink2 dark:text-white/75 hover:border-ink4',
            ].join(' ')}
          >
            {role.name}
          </button>
        )
      })}
    </div>
  )
}
