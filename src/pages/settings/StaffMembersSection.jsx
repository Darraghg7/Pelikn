import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../contexts/SessionContext'
import { useVenue } from '../../contexts/VenueContext'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useVenueFeatures } from '../../hooks/useVenueFeatures'
import { useVenueRoles } from '../../hooks/useVenueRoles'
import Toggle from '../../components/ui/Toggle'
import useStaffManagement from '../../hooks/useStaffManagement'
import SettingsSection from './SettingsSection'
import { StaffRolesAssignment } from './RolesSection'
import TrainingSection from './TrainingSection'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { PLANS, STAFF_COLOUR_PALETTE, STAFF_PERMISSIONS, PERMISSION_PRESETS, DEFAULT_STAFF_PERMISSIONS } from '../../lib/constants'
import { saveStaffPermissions } from '../../hooks/useStaffPermissions'

const PERMISSION_ROLES  = ['staff', 'manager', 'owner']
const PERMISSION_LABELS = { staff: 'Staff', manager: 'Manager', owner: 'Owner' }
const JOB_ROLES  = ['kitchen', 'foh']
const JOB_LABELS = { kitchen: 'Kitchen', foh: 'Front of House' }
const EMPTY_FORM = {
  name: '', role: 'staff', job_role: 'kitchen', pin: '', email: '', hourly_rate: '',
  show_temp_logs: false, show_allergens: false, skills: [], is_under_18: false,
  working_days: [], colour: '',
}
const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function StaffMembersSection() {
  const { staff, loading: staffLoading, reload: reloadStaff } = useStaffManagement()
  const { venuePlan } = useVenueFeatures()
  const { roles: venueRoles } = useVenueRoles()
  const { session } = useSession()
  const [deleteTarget, setDeleteTarget] = useState(null)
  const { venueId } = useVenue()
  const { venues } = useAuth()
  const toast = useToast()

  // Cross-venue links: { staffId -> [venueId, ...] }
  const [venueLinks, setVenueLinks] = useState({})
  const [savingLinks, setSavingLinks] = useState(false)

  const [showForm, setShowForm]             = useState(false)
  const [editingId, setEditingId]           = useState(null)
  const [staffForm, setStaffForm]           = useState(EMPTY_FORM)
  const [savingStaff, setSavingStaff]       = useState(false)
  const [photoFile, setPhotoFile]           = useState(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [staffRoleMap, setStaffRoleMap]     = useState({})
  const [permForm, setPermForm]             = useState(new Set(DEFAULT_STAFF_PERMISSIONS))

  // Build { staffId -> [venueId, ...] } map from raw rows
  const buildLinkMap = (rows) => {
    const map = {}
    for (const row of rows) {
      if (!map[row.staff_id]) map[row.staff_id] = []
      map[row.staff_id].push(row.venue_id)
    }
    return map
  }

  // Reload cross-venue links for all current staff
  const refreshVenueLinks = async () => {
    if (!staff.length || venues.length <= 1) { setVenueLinks({}); return }
    const { data, error } = await supabase
      .from('staff_venue_links')
      .select('staff_id, venue_id')
      .in('staff_id', staff.map(s => s.id))
    if (!error && data) setVenueLinks(buildLinkMap(data))
  }

  // Load cross-venue links on mount / when staff or venues change
  useEffect(() => { refreshVenueLinks() }, [staff, venues])

  useEffect(() => {
    if (!staff.length || !venueRoles.length) { setStaffRoleMap({}); return }
    const staffIds = staff.map(s => s.id)
    supabase
      .from('staff_role_assignments')
      .select('staff_id, role_id')
      .in('staff_id', staffIds)
      .then(({ data }) => {
        if (!data) return
        const map = {}
        for (const a of data) {
          const role = venueRoles.find(r => r.id === a.role_id)
          if (!role) continue
          if (!map[a.staff_id]) map[a.staff_id] = []
          map[a.staff_id].push(role.name)
        }
        setStaffRoleMap(map)
      })
  }, [staff, venueRoles])

  // Load permission counts for the staff list badges
  const [permCounts, setPermCounts] = useState({})
  useEffect(() => {
    if (!staff.length || !venueId) return
    const staffIds = staff.filter(s => s.role === 'staff').map(s => s.id)
    if (!staffIds.length) { setPermCounts({}); return }
    supabase
      .from('staff_permissions')
      .select('staff_id, permission')
      .eq('venue_id', venueId)
      .in('staff_id', staffIds)
      .then(({ data }) => {
        const counts = {}
        for (const r of (data ?? [])) {
          counts[r.staff_id] = (counts[r.staff_id] ?? 0) + 1
        }
        setPermCounts(counts)
      })
  }, [staff, venueId])

  const uploadStaffPhoto = async (staffId, file) => {
    if (!file || !staffId) return
    setUploadingPhoto(true)
    const ext  = file.name.split('.').pop()
    const path = `${venueId}/${staffId}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('staff-photos')
      .upload(path, file, { upsert: true })
    if (upErr) { toast('Photo upload failed: ' + upErr.message, 'error'); setUploadingPhoto(false); return }
    const { data: urlData } = supabase.storage.from('staff-photos').getPublicUrl(path)
    const { error: dbErr } = await supabase.from('staff')
      .update({ photo_url: urlData.publicUrl + '?t=' + Date.now() })
      .eq('id', staffId)
    setUploadingPhoto(false)
    if (dbErr) { toast('Failed to save photo URL', 'error'); return }
    toast('Photo uploaded')
    setPhotoFile(null)
    reloadStaff()
  }

  const openAdd = () => { setStaffForm(EMPTY_FORM); setEditingId(null); setPermForm(new Set(DEFAULT_STAFF_PERMISSIONS)); setShowForm(true) }
  const openEdit = async (s) => {
    setStaffForm({
      name:           s.name,
      role:           s.role ?? 'staff',
      job_role:       s.job_role ?? 'kitchen',
      pin:            '',
      email:          s.email ?? '',
      hourly_rate:    s.hourly_rate?.toString() ?? '',
      show_temp_logs: s.show_temp_logs ?? false,
      show_allergens: s.show_allergens ?? false,
      skills:         s.skills ?? [],
      is_under_18:    s.is_under_18 ?? false,
      working_days:   s.working_days ?? [],
      colour:         s.colour ?? '',
    })
    setEditingId(s.id)
    setShowForm(true)
    // Load existing permissions for this staff member
    if (s.role === 'staff') {
      const { data } = await supabase
        .from('staff_permissions')
        .select('permission')
        .eq('staff_id', s.id)
        .eq('venue_id', venueId)
      setPermForm(new Set((data ?? []).map(r => r.permission)))
    } else {
      setPermForm(new Set(STAFF_PERMISSIONS.map(p => p.id)))
    }
  }
  const cancelEdit = () => { setShowForm(false); setEditingId(null) }

  // Toggle a staff member's link to another owned venue
  const toggleVenueLink = async (staffId, targetVenueId, currentlyLinked) => {
    setSavingLinks(true)
    const rpc = currentlyLinked ? 'unlink_staff_from_venue' : 'link_staff_to_venue'
    const { error } = await supabase.rpc(rpc, {
      p_session_token:   session.token,
      p_staff_id:        staffId,
      p_target_venue_id: targetVenueId,
    })
    if (error) { toast(error.message, 'error'); setSavingLinks(false); return }
    await refreshVenueLinks()
    setSavingLinks(false)
  }

  const saveStaff = async () => {
    if (!staffForm.name.trim())           { toast('Name is required', 'error'); return }
    if (!editingId && !staffForm.pin)     { toast('PIN is required for new staff', 'error'); return }
    if (staffForm.pin && !/^\d{4}$/.test(staffForm.pin)) { toast('PIN must be exactly 4 digits', 'error'); return }

    setSavingStaff(true)
    let error

    if (editingId) {
      const { error: e } = await supabase.rpc('update_staff_member', {
        p_session_token:  session.token,
        p_staff_id:       editingId,
        p_name:           staffForm.name.trim(),
        p_job_role:       staffForm.job_role,
        p_role:           staffForm.role,
        p_email:          staffForm.email.trim() || null,
        p_hourly_rate:    parseFloat(staffForm.hourly_rate) || 0,
        p_new_pin:        staffForm.pin || null,
        p_show_temp_logs: staffForm.show_temp_logs,
        p_show_allergens: staffForm.show_allergens,
        p_skills:         staffForm.skills || [],
        p_colour:         staffForm.colour || null,
      })
      error = e
    } else {
      const { error: e } = await supabase.rpc('create_staff_member', {
        p_session_token: session.token,
        p_name:          staffForm.name.trim(),
        p_job_role:      staffForm.job_role,
        p_pin:           staffForm.pin,
        p_role:          staffForm.role,
        p_email:         staffForm.email.trim() || null,
        p_hourly_rate:   parseFloat(staffForm.hourly_rate) || 0,
        p_skills:        staffForm.skills || [],
        p_colour:        staffForm.colour || null,
      })
      error = e
    }

    setSavingStaff(false)
    if (error) { toast(error.message, 'error'); return }

    // Persist fields not covered by RPC (is_under_18, working_days)
    if (editingId) {
      const { error: extraErr } = await supabase.from('staff').update({
        is_under_18:  staffForm.is_under_18,
        working_days: staffForm.working_days,
      }).eq('id', editingId)
      if (extraErr) { toast('Saved, but failed to update some fields: ' + extraErr.message, 'error') }
    } else {
      // Find the newly created staff member by name + venue
      const { data: newRow } = await supabase
        .from('staff')
        .select('id')
        .eq('venue_id', venueId)
        .eq('name', staffForm.name.trim())
        .order('created_at', { ascending: false })
        .limit(1)
      if (newRow?.[0]?.id) {
        const { error: extraErr } = await supabase.from('staff').update({
          is_under_18:  staffForm.is_under_18,
          working_days: staffForm.working_days,
          colour:       staffForm.colour || null,
        }).eq('id', newRow[0].id)
        if (extraErr) { toast('Saved, but failed to update some fields: ' + extraErr.message, 'error') }
      }
    }

    // Save granular permissions for staff role
    if (staffForm.role === 'staff') {
      const targetId = editingId || await (async () => {
        const { data: newRow } = await supabase
          .from('staff')
          .select('id')
          .eq('venue_id', venueId)
          .eq('name', staffForm.name.trim())
          .order('created_at', { ascending: false })
          .limit(1)
        return newRow?.[0]?.id
      })()
      if (targetId) {
        await saveStaffPermissions(targetId, venueId, [...permForm])
      }
    }

    toast(editingId ? 'Staff member updated' : 'Staff member added')
    setShowForm(false)
    setEditingId(null)
    reloadStaff()
  }

  const toggleActive = async (s) => {
    const fn = s.is_active ? 'deactivate_staff_member' : 'reactivate_staff_member'
    const { error } = await supabase.rpc(fn, {
      p_session_token: session.token,
      p_staff_id:      s.id,
    })
    if (error) { toast(error.message, 'error'); return }
    toast(s.is_active ? `${s.name} deactivated` : `${s.name} reactivated`)
    reloadStaff()
  }

  const confirmDeleteStaff = async () => {
    const { error } = await supabase.from('staff').delete().eq('id', deleteTarget.id)
    setDeleteTarget(null)
    if (error) { toast(error.message, 'error'); return }
    toast(`${deleteTarget.name} permanently deleted`)
    reloadStaff()
  }

  const moveStaff = async (id, direction) => {
    const list = [...staff]
    const idx  = list.findIndex(s => s.id === id)
    if (idx === -1) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= list.length) return
    ;[list[idx], list[swapIdx]] = [list[swapIdx], list[idx]]
    await Promise.all(list.map((s, i) =>
      supabase.from('staff').update({ sort_order: i }).eq('id', s.id)
    ))
    reloadStaff()
  }

  if (staffLoading) return null

  const activeStaffCount = staff.filter(s => s.is_active).length

  return (
    <SettingsSection
      title="Staff Members"
      subtitle={`${activeStaffCount} active member${activeStaffCount !== 1 ? 's' : ''}`}
      defaultOpen
      locked={venuePlan !== PLANS.PRO}
    >
      {/* Add staff button */}
      {!showForm && (
        <div className="flex justify-end mb-4">
          <button
            onClick={openAdd}
            className="text-[11px] tracking-widest uppercase text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20"
          >
            + Add Staff
          </button>
        </div>
      )}

      {/* Add / Edit form */}
      {showForm && (
        <div className="mb-6 p-5 rounded-xl bg-cream/50 border border-charcoal/10 flex flex-col gap-4">
          <p className="text-sm font-semibold text-charcoal">{editingId ? 'Edit Staff Member' : 'New Staff Member'}</p>

          {/* Photo upload (edit only) */}
          {editingId && (() => {
            const s = staff.find(m => m.id === editingId)
            return (
              <div className="flex items-center gap-4">
                {s?.photo_url ? (
                  <img src={s.photo_url} alt={s.name}
                    className="w-14 h-14 rounded-full object-cover border border-charcoal/10" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-charcoal/10 flex items-center justify-center">
                    <span className="text-xl font-semibold text-charcoal/40">{staffForm.name.charAt(0) || '?'}</span>
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] tracking-widest uppercase text-charcoal/40">Photo</label>
                  <input type="file" accept="image/*"
                    onChange={e => setPhotoFile(e.target.files[0] ?? null)}
                    className="text-xs text-charcoal/60 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border file:border-charcoal/15 file:text-xs file:bg-cream/50 file:text-charcoal/60 hover:file:bg-cream" />
                  {photoFile && (
                    <button type="button"
                      onClick={() => uploadStaffPhoto(editingId, photoFile)}
                      disabled={uploadingPhoto}
                      className="self-start text-xs bg-charcoal text-cream px-3 py-1 rounded-lg disabled:opacity-40 hover:bg-charcoal/90 transition-colors">
                      {uploadingPhoto ? 'Uploading…' : 'Upload Photo →'}
                    </button>
                  )}
                </div>
              </div>
            )
          })()}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1.5">Name *</label>
              <input
                value={staffForm.name}
                onChange={e => setStaffForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Full name"
                className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            </div>
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1.5">Email</label>
              <input
                type="email"
                value={staffForm.email}
                onChange={e => setStaffForm(f => ({ ...f, email: e.target.value }))}
                placeholder="staff@example.com"
                className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            </div>
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1.5">
                PIN {editingId && <span className="normal-case text-charcoal/30">— blank to keep current</span>}
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={staffForm.pin}
                onChange={e => setStaffForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                placeholder="••••"
                className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 tracking-widest"
              />
            </div>
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1.5">Hourly Rate (£)</label>
              <input
                type="number" step="0.01" min="0"
                value={staffForm.hourly_rate}
                onChange={e => setStaffForm(f => ({ ...f, hourly_rate: e.target.value }))}
                placeholder="e.g. 12.50"
                className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            </div>
          </div>

          {/* Permission level chips */}
          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">Permission Level</label>
            <div className="flex gap-2 flex-wrap">
              {PERMISSION_ROLES.map(r => (
                <button
                  key={r} type="button"
                  onClick={() => setStaffForm(f => ({ ...f, role: r }))}
                  className={['px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                    staffForm.role === r ? 'bg-charcoal text-cream border-charcoal' : 'bg-white text-charcoal/50 border-charcoal/15',
                  ].join(' ')}
                >
                  {PERMISSION_LABELS[r]}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-charcoal/40 mt-1.5">
              {staffForm.role === 'owner'   && 'Full access — same as Manager plus cannot be deactivated.'}
              {staffForm.role === 'manager' && 'Can manage rota, settings, and all staff operations.'}
              {staffForm.role === 'staff'   && 'Standard access — tasks, cleaning, temp logs and allergens (if enabled).'}
            </p>
          </div>

          {/* Job role chips */}
          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">Department</label>
            <div className="flex gap-2 flex-wrap">
              {JOB_ROLES.map(r => (
                <button
                  key={r} type="button"
                  onClick={() => setStaffForm(f => ({ ...f, job_role: r }))}
                  className={['px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                    staffForm.job_role === r ? 'bg-charcoal text-cream border-charcoal' : 'bg-white text-charcoal/50 border-charcoal/15',
                  ].join(' ')}
                >
                  {JOB_LABELS[r]}
                </button>
              ))}
            </div>
          </div>

          {/* Skills / role assignment */}
          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">Skills</label>
            {editingId ? (
              <StaffRolesAssignment staffId={editingId} />
            ) : (
              <p className="text-xs text-charcoal/35 italic">Save this staff member first, then assign their skills.</p>
            )}
            <p className="text-[11px] text-charcoal/35 mt-2">
              Skills tell the AI rota builder which shifts this person can cover.
            </p>
          </div>

          {/* Working days */}
          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1.5">Working Days</label>
            <p className="text-[11px] text-charcoal/35 mb-2">
              Days this person is available to work. Leave all selected to indicate no restriction.
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {DOW_LABELS.map((day, i) => {
                const dow    = i + 1 // 1=Mon…7=Sun
                const allOn  = staffForm.working_days.length === 0
                const active = allOn || staffForm.working_days.includes(dow)
                return (
                  <button
                    key={dow}
                    type="button"
                    onClick={() => {
                      const current = staffForm.working_days.length === 0
                        ? [1, 2, 3, 4, 5, 6, 7]
                        : [...staffForm.working_days]
                      const next = current.includes(dow)
                        ? current.filter(d => d !== dow)
                        : [...current, dow].sort((a, b) => a - b)
                      setStaffForm(f => ({ ...f, working_days: next.length === 7 ? [] : next }))
                    }}
                    className={[
                      'px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all',
                      active
                        ? 'bg-brand text-cream border-brand'
                        : 'bg-charcoal/4 text-charcoal/30 border-charcoal/10',
                    ].join(' ')}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
            {staffForm.working_days.length > 0 && staffForm.working_days.length < 7 && (
              <p className="text-[11px] text-brand mt-1.5">
                Works: {staffForm.working_days.map(d => DOW_LABELS[d - 1]).join(', ')} only
              </p>
            )}
          </div>

          {/* Under-18 toggle */}
          <div className="flex items-center justify-between rounded-xl border border-charcoal/10 px-4 py-3 bg-charcoal/2">
            <div>
              <p className="text-sm font-medium text-charcoal">Under 18</p>
              <p className="text-[11px] text-charcoal/45 mt-0.5">
                Applies 30-min unpaid break for shifts over 4.5h (UK law)
              </p>
            </div>
            <Toggle
              checked={staffForm.is_under_18}
              onChange={v => setStaffForm(f => ({ ...f, is_under_18: v }))}
            />
          </div>

          {/* Granular permissions (staff role only — managers get everything) */}
          {staffForm.role === 'staff' && (
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">Permissions</label>
              <p className="text-[11px] text-charcoal/35 mb-3">
                Controls what this staff member can see and do in the app.
              </p>

              {/* Quick presets */}
              <div className="flex gap-2 mb-4 flex-wrap">
                {PERMISSION_PRESETS.map(preset => {
                  const active = preset.permissions.length === permForm.size &&
                    preset.permissions.every(p => permForm.has(p))
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setPermForm(new Set(preset.permissions))}
                      className={[
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                        active ? 'bg-brand text-cream border-brand' : 'bg-white text-charcoal/50 border-charcoal/15 hover:border-charcoal/30',
                      ].join(' ')}
                    >
                      {preset.label}
                    </button>
                  )
                })}
              </div>

              {/* Permission toggles by category */}
              {['Compliance', 'Operations', 'Team'].map(category => {
                const perms = STAFF_PERMISSIONS.filter(p => p.category === category)
                return (
                  <div key={category} className="mb-3">
                    <p className="text-[11px] tracking-widest uppercase text-charcoal/30 mb-1.5">{category}</p>
                    <div className="flex flex-col gap-1.5">
                      {perms.map(perm => (
                        <div key={perm.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-charcoal/3 transition-colors">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-charcoal">{perm.label}</p>
                            <p className="text-[11px] text-charcoal/35">{perm.description}</p>
                          </div>
                          <Toggle
                            checked={permForm.has(perm.id)}
                            onChange={v => {
                              setPermForm(prev => {
                                const next = new Set(prev)
                                v ? next.add(perm.id) : next.delete(perm.id)
                                return next
                              })
                            }}
                            size="sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Rota colour picker */}
          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">Rota Colour</label>
            <div className="flex items-center gap-2 flex-wrap">
              {STAFF_COLOUR_PALETTE.map(hex => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setStaffForm(f => ({ ...f, colour: f.colour === hex ? '' : hex }))}
                  style={{ backgroundColor: hex }}
                  className={[
                    'w-7 h-7 rounded-full border-2 transition-all',
                    staffForm.colour === hex ? 'border-charcoal scale-110 shadow-sm' : 'border-transparent opacity-80 hover:opacity-100 hover:scale-105',
                  ].join(' ')}
                  title={hex}
                />
              ))}
              {staffForm.colour && (
                <button
                  type="button"
                  onClick={() => setStaffForm(f => ({ ...f, colour: '' }))}
                  className="text-[10px] text-charcoal/40 hover:text-charcoal transition-colors border border-charcoal/15 rounded-full px-2 py-0.5"
                >
                  Auto
                </button>
              )}
            </div>
            <p className="text-[11px] text-charcoal/35 mt-1">
              Colour used to identify this person on the rota. Leave unset for automatic assignment.
            </p>
          </div>

          {/* Venue assignment — only shown to multi-venue owners, edit mode only */}
          {editingId && venues.length > 1 && (() => {
            const isManager = staffForm.role === 'manager' || staffForm.role === 'owner'
            return (
              <div>
                <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1.5">
                  {isManager ? 'Venue Access' : 'Works At'}
                </label>
                <p className="text-[11px] text-charcoal/35 mb-2">
                  {isManager
                    ? 'Controls which venues this manager sees in their All Venues overview dashboard. Also determines which venues they can be rostered at.'
                    : 'Toggling a venue on makes this staff member visible in that venue\'s rota.'}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {venues.map(v => {
                    const isHome   = v.id === venueId
                    const isLinked = isHome || (venueLinks[editingId] ?? []).includes(v.id)
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={isHome || savingLinks}
                        onClick={() => !isHome && toggleVenueLink(editingId, v.id, (venueLinks[editingId] ?? []).includes(v.id))}
                        className={[
                          'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                          isLinked ? 'bg-brand text-cream border-brand' : 'bg-white text-charcoal/50 border-charcoal/15',
                          isHome ? 'opacity-60 cursor-default' : 'hover:border-brand/40',
                        ].join(' ')}
                      >
                        {isLinked ? '✓ ' : ''}{v.name}{isHome ? ' (home)' : ''}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          <div className="flex gap-2 pt-1">
            <button
              onClick={saveStaff}
              disabled={savingStaff}
              className="flex-1 bg-charcoal text-cream py-2.5 rounded-lg text-sm font-medium disabled:opacity-40"
            >
              {savingStaff ? 'Saving…' : editingId ? 'Update Staff Member' : 'Add Staff Member →'}
            </button>
            <button onClick={cancelEdit} className="px-4 py-2.5 rounded-lg border border-charcoal/15 text-sm text-charcoal/50">
              Cancel
            </button>
          </div>

          {editingId && <TrainingSection staffId={editingId} />}
        </div>
      )}

      {/* Staff list */}
      <div className="flex flex-col divide-y divide-charcoal/6">
        {staff.map((s, idx) => (
          <div key={s.id} className={`py-4 first:pt-0 last:pb-0 flex items-center gap-3 ${!s.is_active ? 'opacity-40' : ''}`}>
            {/* Reorder arrows */}
            <div className="flex flex-col gap-0.5 shrink-0">
              <button
                onClick={() => moveStaff(s.id, 'up')}
                disabled={idx === 0}
                className="w-6 h-5 flex items-center justify-center rounded text-charcoal/25 hover:text-charcoal hover:bg-charcoal/6 transition-colors disabled:opacity-0 text-[10px]"
              >▲</button>
              <button
                onClick={() => moveStaff(s.id, 'down')}
                disabled={idx === staff.length - 1}
                className="w-6 h-5 flex items-center justify-center rounded text-charcoal/25 hover:text-charcoal hover:bg-charcoal/6 transition-colors disabled:opacity-0 text-[10px]"
              >▼</button>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-charcoal text-sm">{s.name}</p>
                <span className={[
                  'text-[11px] tracking-widest uppercase font-medium px-1.5 py-0.5 rounded',
                  s.role === 'owner'   ? 'bg-purple-50 text-purple-600' :
                  s.role === 'manager' ? 'bg-amber-50 text-amber-600' :
                                        'bg-charcoal/5 text-charcoal/50',
                ].join(' ')}>
                  {PERMISSION_LABELS[s.role] ?? s.role}
                </span>
                <span className="text-[11px] tracking-widest uppercase text-charcoal/40 border border-charcoal/15 px-1.5 py-0.5 rounded">
                  {JOB_LABELS[s.job_role] ?? s.job_role}
                </span>
                {s.role === 'staff' && (permCounts[s.id] ?? 0) > 0 && (
                  <span className="text-[11px] bg-brand/8 text-brand px-1.5 py-0.5 rounded">
                    {permCounts[s.id]} permission{permCounts[s.id] !== 1 ? 's' : ''}
                  </span>
                )}
                {s.is_under_18     && <span className="text-[11px] bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded">Under 18</span>}
                {(s.working_days ?? []).length > 0 && (s.working_days ?? []).length < 7 && (
                  <span className="text-[11px] bg-brand/8 text-brand px-1.5 py-0.5 rounded">
                    {(s.working_days ?? []).map(d => DOW_LABELS[d - 1]).join('/')}
                  </span>
                )}
                {(staffRoleMap[s.id] ?? []).map(name => (
                  <span key={name} className="text-[11px] bg-brand/8 text-brand px-1.5 py-0.5 rounded">{name}</span>
                ))}
                {!s.is_active && <span className="text-[11px] tracking-widest uppercase text-charcoal/30 italic">inactive</span>}
                {s.pin_locked_until && new Date(s.pin_locked_until) > new Date() && (
                  <span className="text-[11px] tracking-widest uppercase bg-danger/10 text-danger px-1.5 py-0.5 rounded font-semibold">🔒 Locked</span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                {s.email && <p className="text-xs text-charcoal/40">{s.email}</p>}
                {s.hourly_rate > 0 && <p className="text-xs text-charcoal/40 font-mono">£{Number(s.hourly_rate).toFixed(2)}/hr</p>}
              </div>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap justify-end">
              {s.pin_locked_until && new Date(s.pin_locked_until) > new Date() && (
                <button
                  onClick={async () => {
                    await supabase.rpc('reset_staff_pin_lock', {
                      p_session_token: session.token,
                      p_staff_id: s.id,
                    })
                    toast(`${s.name}'s PIN unlocked`)
                    reloadStaff()
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg border border-danger/20 text-danger/60 hover:text-danger hover:border-danger/40 transition-colors"
                >Unlock</button>
              )}
              <button
                onClick={() => openEdit(s)}
                className="text-xs px-3 py-1.5 rounded-lg border border-charcoal/15 text-charcoal/60 hover:text-charcoal hover:border-charcoal/30 transition-colors"
              >Edit</button>
              <button
                onClick={() => toggleActive(s)}
                className={['text-xs px-3 py-1.5 rounded-lg border transition-colors',
                  s.is_active ? 'border-danger/20 text-danger/60 hover:text-danger hover:border-danger/40'
                              : 'border-success/20 text-success/60 hover:text-success hover:border-success/40',
                ].join(' ')}
              >
                {s.is_active ? 'Deactivate' : 'Reactivate'}
              </button>
              <button
                onClick={() => setDeleteTarget({ id: s.id, name: s.name })}
                className="text-xs px-3 py-1.5 rounded-lg border border-danger/15 text-danger/40 hover:text-danger hover:border-danger/35 transition-colors"
              >Delete</button>
            </div>
          </div>
        ))}
        {staff.length === 0 && <p className="text-sm text-charcoal/35 italic py-4">No staff members yet.</p>}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete staff member?"
        message={`Permanently delete ${deleteTarget?.name}? This will remove them from the PIN screen and delete all their associated shifts, time off and training records. This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={confirmDeleteStaff}
        onClose={() => setDeleteTarget(null)}
      />
    </SettingsSection>
  )
}
