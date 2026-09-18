import React, { useState } from 'react'
import { useToast } from '../../components/ui/Toast'
import { useVenueRoles, useStaffRoleAssignments } from '../../hooks/useVenueRoles'
import { useDepartments } from '../../hooks/useDepartments'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

/* ── Departments: group roles for check/task visibility ────────────────────── */
function DepartmentsSection({ roles, setRoleDepartment }) {
  const toast = useToast()
  const { departments, loading, addDepartment, deleteDepartment } = useDepartments()
  const [newName, setNewName]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [pickerFor, setPickerFor] = useState(null) // department id currently showing its role picker

  const handleAdd = async () => {
    if (!newName.trim()) return
    setSaving(true)
    const { error } = await addDepartment(newName)
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    setNewName('')
  }

  const confirmDelete = async () => {
    const { error } = await deleteDepartment(deleteTarget.id)
    setDeleteTarget(null)
    if (error) toast(error.message, 'error')
  }

  const unassignedRoles = roles.filter(r => !r.department_id)

  if (loading) return null

  return (
    <div className="flex flex-col gap-3">
      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove department?"
        message={`Remove "${deleteTarget?.name}"? Its roles and checks stay put, just ungrouped — nothing gets hidden or deleted.`}
        confirmLabel="Remove"
        danger
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />

      {departments.map(dept => {
        const deptRoles = roles.filter(r => r.department_id === dept.id)
        const pickerOpen = pickerFor === dept.id
        return (
          <div key={dept.id} className="bg-white dark:bg-paperDark rounded-xl border border-charcoal/8 dark:border-white/8 p-3 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-charcoal dark:text-white">{dept.name}</span>
              <button
                onClick={() => setDeleteTarget({ id: dept.id, name: dept.name })}
                className="text-xs text-charcoal/40 dark:text-white/35 hover:text-danger transition-colors"
              >Remove</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {deptRoles.map(role => (
                <span key={role.id} className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-charcoal/[0.06] dark:bg-white/[0.08] text-xs font-medium text-charcoal dark:text-white">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: role.color || '#1a3c2e' }} />
                  {role.name}
                  <button
                    onClick={() => setRoleDepartment(role.id, null)}
                    aria-label={`Remove ${role.name} from ${dept.name}`}
                    className="text-charcoal/35 dark:text-white/30 hover:text-danger px-0.5"
                  >×</button>
                </span>
              ))}
              <button
                onClick={() => setPickerFor(pickerOpen ? null : dept.id)}
                className="px-2.5 py-1 rounded-full text-xs font-semibold border border-dashed border-charcoal/20 dark:border-white/20 text-charcoal/45 dark:text-white/40 hover:border-charcoal/40 dark:hover:border-white/40 transition-colors"
              >+ Add role</button>
            </div>
            {pickerOpen && (
              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-charcoal/6 dark:border-white/8">
                {unassignedRoles.length === 0 ? (
                  <p className="text-xs text-charcoal/35 dark:text-white/30 italic py-1">Every role is already in a department.</p>
                ) : unassignedRoles.map(role => (
                  <button
                    key={role.id}
                    onClick={() => { setRoleDepartment(role.id, dept.id); setPickerFor(null) }}
                    className="px-2.5 py-1 rounded-full text-xs font-medium border border-charcoal/15 dark:border-white/15 text-charcoal/60 dark:text-white/50 hover:border-charcoal/30 dark:hover:border-white/30 transition-colors"
                  >{role.name}</button>
                ))}
              </div>
            )}
          </div>
        )
      })}

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

      {unassignedRoles.length > 0 && departments.length > 0 && (
        <p className="text-[11px] text-charcoal/35 dark:text-white/30 italic">
          {unassignedRoles.length} role{unassignedRoles.length === 1 ? '' : 's'} not in a department yet — visible to everyone until sorted.
        </p>
      )}
    </div>
  )
}

/* ── Rota roles section ─────────────────────────────────────────────────────── */
export default function RolesSection() {
  const toast = useToast()
  const { roles, loading, addRole, renameRole, deleteRole, setRoleDepartment } = useVenueRoles()
  const { departments } = useDepartments()
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
        title="Remove role?"
        message={`Remove "${deleteTarget?.name}"? This will unassign it from all staff.`}
        confirmLabel="Remove"
        danger
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
      <p className="text-xs text-charcoal/45 dark:text-white/40">
        Define the roles in your business (e.g. Manager, Team Lead, Assistant). This is the one role list Pelikn
        uses everywhere — the AI rota builder's skill-matching, and which staff see which Tasks, Cleaning items and Checks.
      </p>

      <p className="text-[11px] font-bold tracking-widest uppercase text-charcoal/40 dark:text-white/35">Departments</p>
      <DepartmentsSection roles={roles} setRoleDepartment={setRoleDepartment} />

      <p className="text-[11px] font-bold tracking-widest uppercase text-charcoal/40 dark:text-white/35 mt-1">All roles</p>

      {/* Existing roles */}
      {roles.length > 0 && (
        <div className="bg-white dark:bg-paperDark rounded-xl border border-charcoal/8 dark:border-white/8 overflow-hidden divide-y divide-charcoal/5 dark:divide-white/5">
          {roles.map(role => {
            const dept = departments.find(d => d.id === role.department_id)
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
                    <span className={`text-[10.5px] font-semibold tracking-wide uppercase shrink-0 ${dept ? 'text-charcoal/40 dark:text-white/35' : 'text-warning italic'}`}>
                      {dept ? dept.name : 'No department'}
                    </span>
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
        <p className="text-sm text-charcoal/30 dark:text-white/30 italic">No roles yet — add your first role below.</p>
      )}

      {/* Add new role */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Role name (e.g. Manager)"
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

/* ── Staff role assignment (shown in staff edit form) ───────────────────────── */
export function StaffRolesAssignment({ staffId }) {
  const { roles } = useVenueRoles()
  const { roleIds, toggleRole } = useStaffRoleAssignments(staffId)

  if (roles.length === 0) {
    return (
      <p className="text-xs text-charcoal/35 dark:text-white/30 italic">
        No roles configured yet. Add roles in the Roles &amp; Skills section first.
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
            onClick={() => toggleRole(role.id)}
            className={[
              'px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
              active
                ? 'bg-brand text-cream border-brand'
                : 'bg-white dark:bg-paperDark text-charcoal/55 dark:text-white/45 border-charcoal/15 dark:border-white/15 hover:border-charcoal/30 dark:hover:border-white/30',
            ].join(' ')}
          >
            {active && <svg className="w-3 h-3 inline mr-1" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg>}{role.name}
          </button>
        )
      })}
    </div>
  )
}
