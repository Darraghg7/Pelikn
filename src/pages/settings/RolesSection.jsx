import React, { useState } from 'react'
import { useToast } from '../../components/ui/Toast'
import { useVenueRoles, useStaffRoleAssignments } from '../../hooks/useVenueRoles'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

/* ── Rota roles section ─────────────────────────────────────────────────────── */
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

  if (loading) return <div className="py-4 text-center text-sm text-charcoal/30">Loading…</div>

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
      <p className="text-xs text-charcoal/45">
        Define the roles in your business (e.g. Barista, Chef, FOH). These are used by the AI rota builder
        to match staff to shifts based on their skills.
      </p>

      {/* Existing roles */}
      {roles.length > 0 && (
        <div className="flex flex-col gap-2">
          {roles.map(role => (
            <div key={role.id} className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-charcoal/10 bg-charcoal/2">
              {editingId === role.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleRename(role.id)}
                    className="flex-1 px-2 py-1 rounded-lg border border-charcoal/20 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
                    autoFocus
                  />
                  <button onClick={() => handleRename(role.id)} className="text-xs bg-charcoal text-cream px-2.5 py-1.5 rounded-lg">Save</button>
                  <button onClick={() => setEditingId(null)} className="text-xs text-charcoal/40 hover:text-charcoal px-2 py-1.5">Cancel</button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium text-charcoal">{role.name}</span>
                  <button
                    onClick={() => { setEditingId(role.id); setEditName(role.name) }}
                    className="text-[11px] text-charcoal/35 hover:text-charcoal transition-colors px-2 py-1"
                  >Edit</button>
                  <button
                    onClick={() => setDeleteTarget({ id: role.id, name: role.name })}
                    className="text-[11px] text-danger/40 hover:text-danger transition-colors px-2 py-1"
                  >Remove</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {roles.length === 0 && (
        <p className="text-sm text-charcoal/30 italic">No roles yet — add your first role below.</p>
      )}

      {/* Add new role */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Role name (e.g. Barista)"
          className="flex-1 px-3 py-2.5 rounded-xl border border-charcoal/15 bg-white text-sm text-charcoal placeholder-charcoal/25 focus:outline-none focus:ring-2 focus:ring-charcoal/20"
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
      <p className="text-xs text-charcoal/35 italic">
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
                : 'bg-white text-charcoal/55 border-charcoal/15 hover:border-charcoal/30',
            ].join(' ')}
          >
            {active && <svg className="w-3 h-3 inline mr-1" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg>}{role.name}
          </button>
        )
      })}
    </div>
  )
}
