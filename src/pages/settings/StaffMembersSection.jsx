import React, { useState, useEffect } from 'react'
import {
  fetchStaffVenueLinks, fetchStaffRoleAssignments, fetchStaffPermissionCounts, fetchStaffPermissionsFor,
  uploadStaffPhotoFile, getStaffPhotoPublicUrl, updateStaffPhotoUrl,
  linkStaffToVenue, unlinkStaffFromVenue,
  createStaffMemberRpc, updateStaffMemberRpc, updateStaffFields, findNewestStaffByName, updateStaffContractType,
  deactivateStaffMemberRpc, reactivateStaffMemberRpc, restrictStaffMemberRpc, unrestrictStaffMemberRpc, deleteStaffMember, reorderVenueStaff, resetStaffPinLockRpc,
} from '../../lib/api/staffManagement'
import { useSession } from '../../contexts/SessionContext'
import { useVenue } from '../../contexts/VenueContext'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { useVenueRoles } from '../../hooks/useVenueRoles'
import { usePermissionTitles } from '../../hooks/usePermissionTitles'
import Toggle from '../../components/ui/Toggle'
import useStaffManagement from '../../hooks/useStaffManagement'
import { StaffRolesAssignment, StaffDepartmentsAssignment } from './RolesSection'
import TrainingSection from './TrainingSection'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { STAFF_COLOUR_PALETTE, STAFF_PERMISSIONS, DEFAULT_STAFF_PERMISSIONS } from '../../lib/constants'
import { saveStaffPermissions } from '../../hooks/useStaffPermissions'
import { CARD } from '../../components/temperature/TempPageParts'

const PERMISSION_ROLES  = ['staff', 'manager', 'owner']
const PERMISSION_LABELS = { staff: 'Staff', manager: 'Manager', owner: 'Owner' }
const CONTRACT_BTNS = [
  { value: 'full_time',  label: 'Full time' },
  { value: 'part_time',  label: 'Part time' },
  { value: 'zero_hours', label: 'Zero hours' },
]
const CONTRACT_LABELS = { full_time: 'Full time', part_time: 'Part time', zero_hours: 'Zero hours', fixed_term: 'Fixed term' }
const INPUT = 'w-full h-12 px-4 rounded-xl border border-line dark:border-white/10 bg-cream dark:bg-white/5 text-[16px] text-ink dark:text-white placeholder:text-ink4 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40 focus:bg-white dark:focus:bg-white/10 transition-colors'

const EMPTY_FORM = {
  name: '', role: 'staff', job_role: '', permission_title_id: null, pin: '', email: '', hourly_rate: '',
  contracted_hours: '',
  show_temp_logs: false, show_allergens: false, skills: [], is_under_18: false,
  working_days: [], colour: '',
  employment_type: '', start_date: '', emergency_contact_name: '', emergency_contact_phone: '',
  holiday_pay_eligible: true,
}
const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function StaffMembersSection({ detailId = null, onOpen, onClose, backLabel = 'Staff & roles' }) {
  const { staff, loading: staffLoading, reload: reloadStaff } = useStaffManagement()
  const { titles: permissionTitles } = usePermissionTitles()
  const { roles: venueRoles } = useVenueRoles()
  const { session } = useSession()
  const [deleteTarget, setDeleteTarget] = useState(null)
  const { venueId } = useVenue()
  const { venues } = useAuth()
  const toast = useToast()

  // Cross-venue links: { staffId -> [venueId, ...] }
  const [venueLinks, setVenueLinks] = useState({})
  const [savingLinks, setSavingLinks] = useState(false)

  const [editingId, setEditingId]           = useState(null)
  const [staffForm, setStaffForm]           = useState(EMPTY_FORM)
  const [savingStaff, setSavingStaff]       = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [staffRoleMap, setStaffRoleMap]     = useState({})
  const [permForm, setPermForm]             = useState(new Set(DEFAULT_STAFF_PERMISSIONS))
  const [search, setSearch]                 = useState('')

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
    if (!staff.length || venues.length <= 1) {
      setVenueLinks(prev => (Object.keys(prev).length === 0 ? prev : {}))
      return
    }
    const { data, error } = await fetchStaffVenueLinks(staff.map(s => s.id))
    if (!error && data) setVenueLinks(buildLinkMap(data))
  }

  // Load cross-venue links on mount / when staff or venues change
  useEffect(() => { refreshVenueLinks() }, [staff, venues])

  useEffect(() => {
    if (!staff.length || !venueRoles.length) {
      setStaffRoleMap(prev => (Object.keys(prev).length === 0 ? prev : {}))
      return
    }
    const staffIds = staff.map(s => s.id)
    fetchStaffRoleAssignments(staffIds)
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
    if (!staffIds.length) {
      setPermCounts(prev => (Object.keys(prev).length === 0 ? prev : {}))
      return
    }
    fetchStaffPermissionCounts(venueId, staffIds)
      .then((data) => {
        const counts = {}
        for (const r of data) {
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
    const { error: upErr } = await uploadStaffPhotoFile(path, file)
    if (upErr) { toast('Photo upload failed: ' + upErr.message, 'error'); setUploadingPhoto(false); return }
    const { data: urlData } = getStaffPhotoPublicUrl(path)
    const { error: dbErr } = await updateStaffPhotoUrl(session.token, staffId, urlData.publicUrl + '?t=' + Date.now())
    setUploadingPhoto(false)
    if (dbErr) { toast('Failed to save photo URL', 'error'); return }
    toast('Photo uploaded')
    reloadStaff()
  }

  const startNew = () => { setStaffForm(EMPTY_FORM); setEditingId(null); setPermForm(new Set(DEFAULT_STAFF_PERMISSIONS)) }
  const loadForm = async (s) => {
    setStaffForm({
      name:                    s.name,
      role:                    s.role ?? 'staff',
      job_role:                s.job_role ?? '',
      permission_title_id:     s.permission_title_id ?? null,
      pin:                     '',
      email:                   s.email ?? '',
      hourly_rate:             s.hourly_rate?.toString() ?? '',
      contracted_hours:        s.contracted_hours?.toString() ?? '',
      show_temp_logs:          s.show_temp_logs ?? false,
      show_allergens:          s.show_allergens ?? false,
      skills:                  s.skills ?? [],
      is_under_18:             s.is_under_18 ?? false,
      working_days:            s.working_days ?? [],
      colour:                  s.colour ?? '',
      employment_type:         s.employment_type ?? '',
      start_date:              s.start_date ?? '',
      emergency_contact_name:  s.emergency_contact_name ?? '',
      emergency_contact_phone: s.emergency_contact_phone ?? '',
      holiday_pay_eligible:    s.holiday_pay_eligible ?? true,
    })
    setEditingId(s.id)
    // Load existing permissions for this staff member
    if (s.role === 'staff') {
      const data = await fetchStaffPermissionsFor(s.id, venueId)
      setPermForm(new Set(data.map(r => r.permission)))
    } else {
      setPermForm(new Set(STAFF_PERMISSIONS.map(p => p.id)))
    }
  }
  const cancelEdit = () => { setEditingId(null); onClose?.() }

  // The page opens one person (or a blank form for "new") by id. Load their
  // details once per id — and only once they're in the list, which a
  // just-created person may not be until the reload lands.
  const loadedFor = React.useRef(null)
  useEffect(() => {
    if (!detailId) { loadedFor.current = null; return }
    if (loadedFor.current === detailId) return
    if (detailId === 'new') { startNew(); loadedFor.current = 'new'; return }
    const s = staff.find(m => m.id === detailId)
    if (!s) return
    loadForm(s)
    loadedFor.current = detailId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailId, staff])

  // Toggle a staff member's link to another owned venue
  const toggleVenueLink = async (staffId, targetVenueId, currentlyLinked) => {
    setSavingLinks(true)
    const { error } = currentlyLinked
      ? await unlinkStaffFromVenue(session.token, staffId, targetVenueId)
      : await linkStaffToVenue(session.token, staffId, targetVenueId)
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
      const { error: e } = await updateStaffMemberRpc({
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
      const { error: e } = await createStaffMemberRpc({
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

    if (error) { toast(error.message, 'error'); setSavingStaff(false); return }

    // Persist fields not covered by RPC
    const extraFields = {
      is_under_18:             staffForm.is_under_18,
      working_days:            staffForm.working_days,
      contracted_hours:        parseFloat(staffForm.contracted_hours) || null,
      employment_type:         staffForm.employment_type || null,
      start_date:              staffForm.start_date || null,
      emergency_contact_name:  staffForm.emergency_contact_name.trim() || null,
      emergency_contact_phone: staffForm.emergency_contact_phone.trim() || null,
      holiday_pay_eligible:    staffForm.holiday_pay_eligible,
    }
    // Newly-created staff aren't in `staff` yet at this point in the function,
    // so anything keyed on their id (extra fields, permissions, and — after
    // this save — the Roles picker below) needs their id resolved once here.
    const newId = editingId ? null : await findNewestStaffByName(venueId, staffForm.name.trim())
    const targetId = editingId || newId

    if (editingId) {
      const { error: extraErr } = await updateStaffFields(session.token, editingId, extraFields)
      if (extraErr) { toast('Saved, but failed to update some fields: ' + extraErr.message, 'error') }
    } else if (newId) {
      const { error: extraErr } = await updateStaffFields(session.token, newId, {
        ...extraFields,
        colour: staffForm.colour || null,
      })
      if (extraErr) { toast('Saved, but failed to update some fields: ' + extraErr.message, 'error') }
    }

    // Title carries its own permissions (looked up live, not copied) — see
    // SessionContext.jsx's fetchLivePermissions. Only persist the manual
    // checklist when no title is assigned ("Custom").
    if (staffForm.role === 'staff' && targetId) {
      const { error: titleErr } = await updateStaffFields(session.token, targetId, {
        permission_title_id: staffForm.permission_title_id,
      })
      if (titleErr) { toast('Saved, but failed to update permission title: ' + titleErr.message, 'error') }

      if (!staffForm.permission_title_id) {
        await saveStaffPermissions(targetId, venueId, [...permForm], session.token)
      }
    }

    setSavingStaff(false)
    if (editingId) {
      toast('Staff member updated')
      setEditingId(null)
      onClose?.()
    } else if (newId) {
      // Roles can only be assigned once the staff row exists (they're a
      // join table, not a plain field) — keep the sheet open, now in edit
      // mode for the person just created, so assigning a role doesn't need
      // a separate "find them in the list and reopen" step.
      toast('Staff member added — now pick their departments below')
      setEditingId(newId)
      setStaffForm(f => ({ ...f, pin: '' }))
      loadedFor.current = newId   // the form already holds what was just saved
      onOpen?.(newId)
    } else {
      toast('Staff member added')
      onClose?.()
    }
    reloadStaff()
  }

  const toggleActive = async (s) => {
    const { error } = s.is_active
      ? await deactivateStaffMemberRpc(session.token, s.id)
      : await reactivateStaffMemberRpc(session.token, s.id)
    if (error) { toast(error.message, 'error'); return }
    toast(s.is_active ? `${s.name} deactivated` : `${s.name} reactivated`)
    reloadStaff()
  }

  const toggleRestricted = async (s) => {
    const { error } = s.is_restricted
      ? await unrestrictStaffMemberRpc(session.token, s.id)
      : await restrictStaffMemberRpc(session.token, s.id)
    if (error) { toast(error.message, 'error'); return }
    toast(s.is_restricted ? `${s.name}'s account unrestricted` : `${s.name}'s account restricted to My Shifts only`)
    reloadStaff()
  }

  const confirmDeleteStaff = async () => {
    const { error } = await deleteStaffMember(session.token, deleteTarget.id)
    setDeleteTarget(null)
    if (error) { toast(error.message, 'error'); return }
    toast(`${deleteTarget.name} permanently deleted`)
    setEditingId(null)
    onClose?.()
    reloadStaff()
  }

  const moveStaff = async (id, direction) => {
    const list = [...staff]
    const idx  = list.findIndex(s => s.id === id)
    if (idx === -1) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= list.length) return
    ;[list[idx], list[swapIdx]] = [list[swapIdx], list[idx]]
    const { error: orderErr } = await reorderVenueStaff(session.token, list.map(s => s.id))
    if (orderErr) { toast(orderErr.message, 'error'); return }
    reloadStaff()
  }

  if (staffLoading) return null

  const current = editingId ? staff.find(m => m.id === editingId) : null

  // ── Staff list ──────────────────────────────────────────────────────────
  if (!detailId) {
    const q = search.trim().toLowerCase()
    const matches = (s) => !q || [s.name, s.email, ...(staffRoleMap[s.id] ?? [])].some(v => v?.toLowerCase().includes(q))
    const active   = staff.filter(s => s.is_active && matches(s))
    const inactive = staff.filter(s => !s.is_active && matches(s))

    const row = (s) => {
      const isLocked = s.pin_locked_until && new Date(s.pin_locked_until) > new Date()
      const subline = [
        ...(staffRoleMap[s.id] ?? []),
        s.role !== 'staff' && PERMISSION_LABELS[s.role],
        CONTRACT_LABELS[s.employment_type],
      ].filter(Boolean)
      const idx = staff.findIndex(m => m.id === s.id)
      return (
        <div key={s.id} className={`group flex items-center ${s.is_active ? '' : 'opacity-60'}`}>
          <button
            type="button"
            onClick={() => onOpen?.(s.id)}
            className="flex-1 min-w-0 flex items-center gap-2.5 px-3.5 sm:px-3.5 py-2 text-left hover:bg-cream/60 dark:hover:bg-white/5 transition-colors"
          >
            <StaffAvatar staff={s} size="md" />
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-2 min-w-0">
                <span className="text-[14px] font-semibold text-ink dark:text-white truncate">{s.name}</span>
                {isLocked && <Tag tone="bad">PIN locked</Tag>}
                {s.is_restricted && <Tag tone="warn">Restricted</Tag>}
              </span>
              {subline.length > 0 && (
                <span className="block text-[13px] text-ink3 dark:text-white/45 mt-0.5 truncate">{subline.join(' · ')}</span>
              )}
            </span>
            <svg className="shrink-0 w-4 h-4 text-ink4 dark:text-white/35" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
          {/* Rota order — desktop, on hover (as before) */}
          <div className="hidden sm:flex flex-col pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button type="button" aria-label={`Move ${s.name} up`} onClick={() => moveStaff(s.id, 'up')} disabled={idx === 0} className="w-6 h-5 flex items-center justify-center text-ink3 hover:text-ink disabled:opacity-0 text-[11px]">▲</button>
            <button type="button" aria-label={`Move ${s.name} down`} onClick={() => moveStaff(s.id, 'down')} disabled={idx === staff.length - 1} className="w-6 h-5 flex items-center justify-center text-ink3 hover:text-ink disabled:opacity-0 text-[11px]">▼</button>
          </div>
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-2.5">
        <div className="relative">
          <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink3 dark:text-white/45" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" /></svg>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search staff"
            aria-label="Search staff"
            className="w-full h-10 pl-12 pr-4 rounded-2xl border border-line dark:border-white/10 bg-white dark:bg-paperDark text-[13px] text-ink dark:text-white placeholder:text-ink4 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40"
          />
        </div>

        {staff.length === 0 ? (
          <div className={`${CARD} px-3.5 py-10 text-center`}>
            <p className="text-[14px] font-semibold text-ink dark:text-white">No staff members yet</p>
            <p className="text-[13px] text-ink3 dark:text-white/45 mt-1">Tap Add staff to set up your team.</p>
          </div>
        ) : (
          <>
            <SectionLabel>Active · {active.length}</SectionLabel>
            {active.length > 0 ? (
              <div className={`${CARD} divide-y divide-line dark:divide-white/10 overflow-hidden`}>{active.map(row)}</div>
            ) : (
              <p className="px-1 text-[13px] text-ink3 dark:text-white/45">No one matches “{search}”.</p>
            )}
            {inactive.length > 0 && (
              <>
                <SectionLabel>Inactive · {inactive.length}</SectionLabel>
                <div className={`${CARD} divide-y divide-line dark:divide-white/10 overflow-hidden`}>{inactive.map(row)}</div>
              </>
            )}
          </>
        )}
      </div>
    )
  }

  // ── One person (or a new one) ───────────────────────────────────────────
  const isNew    = !editingId
  const isLocked = current?.pin_locked_until && new Date(current.pin_locked_until) > new Date()
  const set = (key, value) => setStaffForm(f => ({ ...f, [key]: value }))
  const daysPerWeek     = staffForm.working_days?.length > 0 ? Math.min(staffForm.working_days.length, 7) : 5
  const entitlementDays = Math.round(5.6 * daysPerWeek * 2) / 2
  const contractOptions = staffForm.employment_type === 'fixed_term'
    ? [...CONTRACT_BTNS, { value: 'fixed_term', label: 'Fixed term' }]
    : CONTRACT_BTNS

  return (
    <div className="flex flex-col gap-2.5 pb-28">
      <button type="button" onClick={cancelEdit} className="self-start inline-flex items-center gap-1 text-[13px] font-semibold text-brand dark:text-white/80 hover:opacity-75">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        {backLabel}
      </button>

      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="relative shrink-0">
          <StaffAvatar staff={{ ...(current ?? {}), name: staffForm.name || 'New', colour: staffForm.colour || current?.colour }} size="lg" />
          {!isNew && (
            <label className="absolute -bottom-1 -right-1 w-9 h-8 rounded-full bg-white dark:bg-paperDark border border-line dark:border-white/15 shadow-sm inline-flex items-center justify-center cursor-pointer text-ink2 dark:text-white/80" title="Change photo">
              {uploadingPhoto
                ? <span className="w-3.5 h-3.5 rounded-full border-2 border-ink4 border-t-ink2 animate-spin" />
                : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                aria-label="Change photo"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadStaffPhoto(editingId, f); e.target.value = '' }}
              />
            </label>
          )}
        </div>
        <div className="min-w-0">
          <h1 className="text-[19px] min-[420px]:text-[20px] leading-tight font-bold tracking-tight text-ink dark:text-white break-words">
            {isNew ? (staffForm.name.trim() || 'New staff member') : staffForm.name || current?.name}
          </h1>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {!isNew && <Tag tone={current?.is_active ? 'good' : 'muted'} big>{current?.is_active ? 'Active' : 'Inactive'}</Tag>}
            <Tag tone="muted" big>{PERMISSION_LABELS[staffForm.role]}</Tag>
            {current?.is_restricted && <Tag tone="warn" big>Restricted</Tag>}
            {isLocked && <Tag tone="bad" big>PIN locked</Tag>}
          </div>
        </div>
      </div>

      {/* Contact */}
      <SectionLabel>Contact</SectionLabel>
      <div className={`${CARD} p-3 sm:p-5 grid grid-cols-1 min-[420px]:grid-cols-2 gap-2.5`}>
        <Field label="Name">
          <input value={staffForm.name} onChange={e => set('name', e.target.value)} placeholder="Full name" className={INPUT} />
        </Field>
        <Field label="Email">
          <input type="email" value={staffForm.email} onChange={e => set('email', e.target.value)} placeholder="staff@example.com" className={INPUT} />
        </Field>
        <Field label="PIN">
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={staffForm.pin}
            onChange={e => set('pin', e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder={isNew ? '4 digits' : 'Keep current'}
            autoComplete="new-password"
            className={`${INPUT} tracking-[0.3em] placeholder:tracking-normal`}
          />
        </Field>
        <Field label="Hourly rate (£)">
          <input type="number" step="0.01" min="0" value={staffForm.hourly_rate} onChange={e => set('hourly_rate', e.target.value)} placeholder="e.g. 12.50" className={INPUT} />
        </Field>
      </div>

      {/* Employment */}
      <SectionLabel>Employment</SectionLabel>
      <div className={`${CARD} p-3 sm:p-5 flex flex-col gap-2.5`}>
        <Field label="Contract" group>
          <Segmented
            options={contractOptions}
            value={staffForm.employment_type}
            onChange={v => set('employment_type', v)}
          />
        </Field>

        {/* Contracted hours and working pattern — not for zero-hours */}
        {staffForm.employment_type !== 'zero_hours' && (
          <>
            <Field label="Contracted hours / week">
              <input type="number" step="0.5" min="0" value={staffForm.contracted_hours} onChange={e => set('contracted_hours', e.target.value)} placeholder="e.g. 37.5" className={INPUT} />
            </Field>
            <Field label="Regular working days" group>
              <div className="flex gap-1.5 flex-wrap">
                {DOW_LABELS.map((day, i) => {
                  const dow    = i + 1
                  const allOn  = staffForm.working_days.length === 0
                  const on     = allOn || staffForm.working_days.includes(dow)
                  return (
                    <button
                      key={dow}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        const cur  = staffForm.working_days.length === 0 ? [1, 2, 3, 4, 5, 6, 7] : [...staffForm.working_days]
                        const next = cur.includes(dow) ? cur.filter(d => d !== dow) : [...cur, dow].sort((a, b) => a - b)
                        set('working_days', next.length === 7 ? [] : next)
                      }}
                      className={`h-8 min-w-[48px] px-2 rounded-xl border text-[13px] font-semibold transition-colors ${on ? 'bg-brand border-brand text-white' : 'bg-cream dark:bg-white/5 border-line dark:border-white/10 text-ink3 dark:text-white/45'}`}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
            </Field>
          </>
        )}

        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2.5">
          <Field label="Start date">
            <input type="date" value={staffForm.start_date} onChange={e => set('start_date', e.target.value)} className={INPUT} />
          </Field>
          <Field label="Emergency contact">
            <input value={staffForm.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)} placeholder="Contact name" className={INPUT} />
          </Field>
          <Field label="Emergency phone">
            <input type="tel" value={staffForm.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value)} placeholder="+44 7700 900000" className={INPUT} />
          </Field>
        </div>

        <div className="border-t border-line dark:border-white/10 -mx-4 sm:-mx-5 px-3.5 sm:px-3.5 pt-2.5 flex flex-col divide-y divide-line dark:divide-white/10">
          <ToggleRow
            title="Eligible for holiday pay"
            hint={staffForm.employment_type === 'zero_hours' ? 'Leave accrues per hour worked' : `${entitlementDays} days a year (5.6 weeks)`}
            checked={staffForm.holiday_pay_eligible}
            onChange={v => set('holiday_pay_eligible', v)}
          />
          <ToggleRow
            title="Under 18"
            hint="30-min unpaid break on shifts over 4.5h"
            checked={staffForm.is_under_18}
            onChange={v => set('is_under_18', v)}
          />
        </div>
      </div>

      {/* Access & roles */}
      <SectionLabel>Access &amp; departments</SectionLabel>
      <div className={`${CARD} p-3 sm:p-5 flex flex-col gap-2.5`}>
        <Field label="Permission level" group>
          <Segmented
            options={PERMISSION_ROLES.map(r => ({ value: r, label: PERMISSION_LABELS[r] }))}
            value={staffForm.role}
            onChange={v => set('role', v)}
          />
          <p className="text-[13px] text-ink3 dark:text-white/45 mt-2">
            {staffForm.role === 'owner'   && 'Everything a manager can do, and can’t be deactivated.'}
            {staffForm.role === 'manager' && 'Runs the rota, settings and all staff operations.'}
            {staffForm.role === 'staff'   && 'Tasks, cleaning, temp logs and allergens.'}
          </p>
        </Field>
        <Field label="Departments" group>
          {editingId ? (
            <StaffDepartmentsAssignment staffId={editingId} />
          ) : (
            <p className="text-[13px] text-ink3 dark:text-white/45">Save this person first, then pick their departments.</p>
          )}
          <p className="text-[13px] text-ink3 dark:text-white/45 mt-2">
            {staffForm.role === 'staff'
              ? 'They only see the Cleaning, Tasks and Checks for these departments. To let them see everything, leave all departments unticked.'
              : 'Their Cleaning, Tasks and Checks open on this department, and they can switch to any other. To open on everything, leave all departments unticked.'}
          </p>
        </Field>
        <Field label="Job titles" group>
          {editingId ? (
            <StaffRolesAssignment staffId={editingId} />
          ) : (
            <p className="text-[13px] text-ink3 dark:text-white/45">Save this person first, then pick their job titles.</p>
          )}
          <p className="text-[13px] text-ink3 dark:text-white/45 mt-2">Used by the rota builder to fill shifts.</p>
        </Field>
      </div>

      {/* Permissions — staff only; managers and owners get everything */}
      {staffForm.role === 'staff' && (
        <>
          <SectionLabel>Permissions</SectionLabel>
          <div className={`${CARD} overflow-hidden`}>
            <div className="p-3 sm:p-5">
              <Field label="Title" group>
                <div className="flex gap-2 flex-wrap">
                  {permissionTitles.map(title => (
                    <Chip key={title.id} active={staffForm.permission_title_id === title.id} onClick={() => set('permission_title_id', title.id)}>{title.label}</Chip>
                  ))}
                  <Chip active={!staffForm.permission_title_id} onClick={() => set('permission_title_id', null)}>Custom</Chip>
                </div>
              </Field>
            </div>
            <div className="border-t border-line dark:border-white/10 px-3.5 sm:px-3.5 py-2.5">
              {staffForm.permission_title_id ? (() => {
                const title   = permissionTitles.find(t => t.id === staffForm.permission_title_id)
                const granted = STAFF_PERMISSIONS.filter(p => title?.permissions.includes(p.id))
                return (
                  <>
                    <p className="text-[13px] text-ink3 dark:text-white/45 mb-2">“{title?.label}” lets them:</p>
                    {granted.length === 0 ? (
                      <p className="text-[13px] text-ink3 dark:text-white/45">Nothing yet — edit the title under Roles.</p>
                    ) : (
                      <ul className="flex flex-col gap-1.5">
                        {granted.map(p => (
                          <li key={p.id} className="flex items-center gap-2 text-[13px] text-ink dark:text-white">
                            <svg className="w-4 h-4 text-good shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg>
                            {p.label}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-[13px] text-ink3 dark:text-white/45 mt-2">Pick Custom to set permissions for just this person.</p>
                  </>
                )
              })() : (
                ['Compliance', 'Operations', 'Team'].map(category => (
                  <div key={category} className="mb-2 last:mb-0">
                    <p className="text-[12px] font-semibold tracking-[0.08em] uppercase text-ink4 dark:text-white/35 mb-1">{category}</p>
                    <div className="flex flex-col divide-y divide-line dark:divide-white/10">
                      {STAFF_PERMISSIONS.filter(p => p.category === category).map(perm => (
                        <ToggleRow
                          key={perm.id}
                          title={perm.label}
                          hint={perm.description}
                          checked={permForm.has(perm.id)}
                          onChange={v => setPermForm(prev => {
                            const next = new Set(prev)
                            v ? next.add(perm.id) : next.delete(perm.id)
                            return next
                          })}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Rota colour */}
      <SectionLabel>Rota colour</SectionLabel>
      <div className={`${CARD} p-3 sm:p-5`}>
        <div className="flex items-center gap-2 flex-wrap">
          {STAFF_COLOUR_PALETTE.map(hex => (
            <button
              key={hex}
              type="button"
              aria-label={`Colour ${hex}`}
              aria-pressed={staffForm.colour === hex}
              onClick={() => set('colour', staffForm.colour === hex ? '' : hex)}
              style={{ backgroundColor: hex }}
              className={`w-9 h-8 rounded-full transition-transform ${staffForm.colour === hex ? 'ring-2 ring-offset-2 ring-ink dark:ring-white dark:ring-offset-paperDark' : 'hover:scale-105'}`}
            />
          ))}
          <Chip active={!staffForm.colour} onClick={() => set('colour', '')}>Auto</Chip>
        </div>
        <p className="text-[13px] text-ink3 dark:text-white/45 mt-2">Identifies this person on the rota.</p>
      </div>

      {/* Venue access — multi-venue owners, existing staff only */}
      {editingId && venues.length > 1 && (() => {
        const isMgr = staffForm.role === 'manager' || staffForm.role === 'owner'
        return (
          <>
            <SectionLabel>{isMgr ? 'Venue access' : 'Works at'}</SectionLabel>
            <div className={`${CARD} p-3 sm:p-5`}>
              <div className="flex gap-2 flex-wrap">
                {venues.map(v => {
                  const isHome   = v.id === venueId
                  const isLinked = isHome || (venueLinks[editingId] ?? []).includes(v.id)
                  return (
                    <Chip
                      key={v.id}
                      active={isLinked}
                      disabled={isHome || savingLinks}
                      onClick={() => !isHome && toggleVenueLink(editingId, v.id, (venueLinks[editingId] ?? []).includes(v.id))}
                    >
                      {v.name}{isHome ? ' (home)' : ''}
                    </Chip>
                  )
                })}
              </div>
              <p className="text-[13px] text-ink3 dark:text-white/45 mt-2">
                {isMgr
                  ? 'Which venues this manager sees in their All Venues overview, and can be rostered at.'
                  : 'Turning a venue on shows this person on that venue’s rota.'}
              </p>
            </div>
          </>
        )
      })()}

      {/* Training records */}
      {editingId && <TrainingSection staffId={editingId} />}

      {/* Account access */}
      {current && (
        <>
          <p className="px-1 -mb-1 text-[12px] font-semibold tracking-[0.08em] uppercase text-bad dark:text-[#f19a86]">Account access</p>
          <div className={`${CARD} overflow-hidden divide-y divide-line dark:divide-white/10`}>
            {isLocked && (
              <ActionRow title="PIN locked" hint="Too many wrong PIN attempts. Unlock so they can sign in again.">
                <button
                  type="button"
                  onClick={async () => { await resetStaffPinLockRpc(session.token, current.id); toast(`${current.name}'s PIN unlocked`); reloadStaff() }}
                  className="h-8 px-3.5 rounded-xl border border-line dark:border-white/15 bg-white dark:bg-paperDark text-[13px] font-semibold text-ink dark:text-white hover:border-ink4"
                >
                  Unlock PIN
                </button>
              </ActionRow>
            )}
            {current.is_active ? (
              <>
                {current.role === 'staff' && (
                  <div className="px-3.5 sm:px-3.5">
                    <ToggleRow
                      title="Restrict account"
                      hint="Can sign in and clock in, but can't complete checks or tasks"
                      checked={!!current.is_restricted}
                      onChange={() => toggleRestricted(current)}
                    />
                  </div>
                )}
                <ActionRow title="Deactivate" hint="Signs them out and removes them from the rota. Records are kept.">
                  <button
                    type="button"
                    onClick={() => toggleActive(current)}
                    className="h-8 px-3.5 rounded-xl border-[1.5px] border-bad/60 bg-white dark:bg-paperDark text-[13px] font-semibold text-bad dark:text-[#f19a86] hover:bg-badBg/50"
                  >
                    Deactivate
                  </button>
                </ActionRow>
              </>
            ) : (
              <>
                <ActionRow title="Reactivate" hint="Restores sign-in and rota access.">
                  <button
                    type="button"
                    onClick={() => toggleActive(current)}
                    className="h-8 px-3.5 rounded-xl border border-line dark:border-white/15 bg-white dark:bg-paperDark text-[13px] font-semibold text-ink dark:text-white hover:border-ink4"
                  >
                    Reactivate
                  </button>
                </ActionRow>
                <div className="px-3.5 sm:px-3.5 py-2.5 bg-badBg/70 dark:bg-bad/15">
                  <p className="text-[14px] font-semibold text-bad dark:text-[#f19a86]">Delete staff member</p>
                  <p className="text-[13px] text-ink2 dark:text-white/70 mt-0.5">Permanently wipe this person and their records from the venue.</p>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(current)}
                    className="mt-2 w-full h-9 rounded-xl bg-bad text-white text-[13px] font-semibold hover:bg-bad/90"
                  >
                    Delete staff member
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Save bar */}
      <div className="fixed left-0 right-0 bottom-[calc(56px+env(safe-area-inset-bottom,0px))] lg:bottom-0 z-40 bg-surface/95 dark:bg-[#111111]/95 backdrop-blur border-t border-line dark:border-white/10">
        <div className="max-w-[480px] md:max-w-2xl lg:max-w-3xl mx-auto px-3.5 py-2.5 flex gap-2 lg:pl-[340px] lg:max-w-none">
          <button type="button" onClick={cancelEdit} className="h-9 px-3.5 rounded-xl border border-line dark:border-white/15 bg-white dark:bg-paperDark text-[13px] font-semibold text-ink2 dark:text-white/80">
            Cancel
          </button>
          <button type="button" onClick={saveStaff} disabled={savingStaff} className="flex-1 h-9 rounded-xl bg-brand text-white text-[13px] font-semibold hover:bg-brand/90 disabled:opacity-50">
            {savingStaff ? 'Saving…' : isNew ? 'Add staff member' : 'Save changes'}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete staff member?"
        message={`Permanently delete ${deleteTarget?.name}? This removes them from the PIN screen and deletes their shifts, time off and training records. This can't be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={confirmDeleteStaff}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}

/* ── Pieces ─────────────────────────────────────────────────────────────── */
function SectionLabel({ children }) {
  return <p className="px-1 -mb-1 text-[12px] font-semibold tracking-[0.08em] uppercase text-ink3 dark:text-white/45">{children}</p>
}

/**
 * Labelled field. `group` is for a set of buttons (segmented control, chips):
 * wrapping those in a <label> would send every click to the first button and
 * give them all the label's text as their accessible name.
 */
function Field({ label, group = false, children }) {
  const Tag = group ? 'div' : 'label'
  return (
    <Tag className="block min-w-0" {...(group ? { role: 'group', 'aria-label': label } : {})}>
      <span className="block text-[13px] font-semibold text-ink3 dark:text-white/50 mb-2">{label}</span>
      {children}
    </Tag>
  )
}

function Tag({ tone, big = false, children }) {
  const cls = {
    good:  'bg-goodBg text-good dark:bg-good/20 dark:text-[#7fd1a4]',
    warn:  'bg-warnBg text-warn dark:bg-warn/20 dark:text-[#e8b06a]',
    bad:   'bg-badBg text-bad dark:bg-bad/25 dark:text-[#f19a86]',
    muted: 'bg-line2 text-ink2 dark:bg-white/10 dark:text-white/70',
  }[tone]
  return <span className={`shrink-0 rounded-full inline-flex items-center font-semibold ${big ? 'h-7 px-3.5 text-[13px]' : 'h-6 px-2 text-xs'} ${cls}`}>{children}</span>
}

function Chip({ active, disabled, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={[
        'h-8 px-3.5 rounded-full border text-[13px] font-semibold transition-colors',
        active ? 'bg-brand border-brand text-white' : 'bg-white dark:bg-paperDark border-line dark:border-white/10 text-ink2 dark:text-white/75 hover:border-ink4',
        disabled ? 'opacity-70 cursor-default' : '',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function Segmented({ options, value, onChange }) {
  return (
    <div className="flex p-1 gap-1 rounded-2xl bg-cream dark:bg-white/5 border border-line dark:border-white/10" role="radiogroup">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 h-8 px-2 rounded-xl text-[13px] font-semibold whitespace-nowrap transition-colors ${value === o.value ? 'bg-brand text-white' : 'text-ink2 dark:text-white/70 hover:text-ink dark:hover:text-white'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function ToggleRow({ title, hint, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-2.5 py-2.5">
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-ink dark:text-white">{title}</p>
        {hint && <p className="text-[13px] text-ink3 dark:text-white/45 mt-0.5">{hint}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} size="lg" />
    </div>
  )
}

function ActionRow({ title, hint, children }) {
  return (
    <div className="flex items-center justify-between gap-2.5 px-3.5 sm:px-3.5 py-2.5">
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-ink dark:text-white">{title}</p>
        {hint && <p className="text-[13px] text-ink3 dark:text-white/45 mt-0.5">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

/** Photo, or initials on the person's rota colour (neutral when unset). */
function StaffAvatar({ staff: s, size }) {
  const dims = size === 'lg' ? 'w-14 h-14 text-[19px]' : 'w-10 h-10 text-[14px]'
  if (s.photo_url) return <img src={s.photo_url} alt="" className={`${dims} rounded-full object-cover shrink-0`} loading="lazy" />
  const parts = (s.name || '?').trim().split(/\s+/)
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0][0]
  return (
    <span
      className={`${dims} rounded-full shrink-0 inline-flex items-center justify-center font-semibold ${s.colour ? 'text-white' : 'bg-line2 text-ink2 dark:bg-white/10 dark:text-white/80'}`}
      style={s.colour ? { backgroundColor: s.colour } : undefined}
    >
      {(letters ?? '?').toUpperCase()}
    </span>
  )
}
