import React, { useState, useEffect, useCallback } from 'react'
import { format, isPast, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../contexts/SessionContext'
import { useVenue } from '../../contexts/VenueContext'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useStaffTraining } from '../../hooks/useTraining'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { useAppSettings } from '../../hooks/useSettings'
import { useTheme } from '../../contexts/ThemeContext'
import { useVenueFeatures, FEATURE_GROUPS, ALL_FEATURE_IDS, PRO_ONLY_FEATURE_IDS } from '../../hooks/useVenueFeatures'
import { useVenueRoles, useStaffRoleAssignments } from '../../hooks/useVenueRoles'
import Toggle from '../../components/ui/Toggle'

const PERMISSION_ROLES  = ['staff', 'manager', 'owner']
const PERMISSION_LABELS = { staff: 'Staff', manager: 'Manager', owner: 'Owner' }

const JOB_ROLES  = ['kitchen', 'foh']
const JOB_LABELS = { kitchen: 'Kitchen', foh: 'Front of House' }

/* ── Collapsible settings section ──────────────────────────────────────────── */
function SettingsSection({ title, subtitle, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white dark:bg-white/5 rounded-xl border border-charcoal/10 dark:border-white/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-charcoal/[0.02] dark:hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex-1 min-w-0 mr-3">
          <p className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35">{title}</p>
          {subtitle && <p className="text-xs text-charcoal/30 dark:text-white/25 mt-0.5 truncate">{subtitle}</p>}
        </div>
        <span
          className="text-charcoal/25 dark:text-white/20 text-sm shrink-0 inline-block transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >▾</span>
      </button>
      {open && (
        <div className="px-6 pb-6 pt-5 border-t border-charcoal/8 dark:border-white/8">
          {children}
        </div>
      )}
    </div>
  )
}

/* ── Data hooks ─────────────────────────────────────────────────────────────── */
function useVenueSettings() {
  const { venueId } = useVenue()
  const [settings, setSettings] = useState({ venue_name: '', manager_email: '', logo_url: '' })
  const [loading, setLoading]   = useState(true)
  const load = async () => {
    if (!venueId) { setLoading(false); return }
    const { data } = await supabase.from('app_settings').select('*').eq('venue_id', venueId)
    if (data) {
      const map = Object.fromEntries(data.map(r => [r.key, r.value]))
      setSettings({
        venue_name:    map.venue_name    ?? '',
        manager_email: map.manager_email ?? '',
        logo_url:      map.logo_url      ?? '',
      })
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [venueId])
  return { settings, loading, reload: load }
}

function useVenueClosures() {
  const { venueId } = useVenue()
  const [closures, setClosures] = useState([])
  const [loading, setLoading]   = useState(true)
  const load = useCallback(async () => {
    if (!venueId) { setLoading(false); return }
    const { data } = await supabase
      .from('venue_closures')
      .select('*')
      .eq('venue_id', venueId)
      .order('start_date')
    setClosures(data ?? [])
    setLoading(false)
  }, [venueId])
  useEffect(() => { load() }, [load])
  return { closures, loading, reload: load }
}

function useStaffManagement() {
  const { venueId } = useVenue()
  const [staff, setStaff]     = useState([])
  const [loading, setLoading] = useState(true)
  const load = async () => {
    if (!venueId) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('staff')
      .select('id, name, email, job_role, role, hourly_rate, is_active, show_temp_logs, show_allergens, photo_url, skills, is_under_18, working_days, sort_order')
      .eq('venue_id', venueId)
      .order('sort_order')
      .order('name')
    setStaff(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [venueId])
  return { staff, loading, reload: load }
}

const EMPTY_FORM = {
  name: '', role: 'staff', job_role: 'kitchen', pin: '', email: '', hourly_rate: '',
  show_temp_logs: false, show_allergens: false, skills: [], is_under_18: false,
  working_days: [],
}

const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const EMPTY_TRAINING = { title: '', issued_date: '', expiry_date: '', notes: '' }

/* ── Rota roles section ─────────────────────────────────────────────────────── */
function RolesSection() {
  const toast = useToast()
  const { roles, loading, addRole, renameRole, deleteRole } = useVenueRoles()
  const [newName, setNewName]     = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName]   = useState('')
  const [saving, setSaving]       = useState(false)

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

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Remove role "${name}"? This will unassign it from all staff.`)) return
    const { error } = await deleteRole(id)
    if (error) toast(error.message, 'error')
  }

  if (loading) return <div className="py-4 text-center text-sm text-charcoal/30">Loading…</div>

  return (
    <div className="flex flex-col gap-4">
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
                    onClick={() => handleDelete(role.id, role.name)}
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
          className="flex-1 px-3 py-2.5 rounded-xl border border-charcoal/15 bg-cream/30 text-sm text-charcoal placeholder-charcoal/25 focus:outline-none focus:ring-2 focus:ring-charcoal/20"
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
function StaffRolesAssignment({ staffId }) {
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
            {active ? '✓ ' : ''}{role.name}
          </button>
        )
      })}
    </div>
  )
}

/* ── Training section ───────────────────────────────────────────────────────── */
function TrainingSection({ staffId }) {
  const { venueId } = useVenue()
  const toast = useToast()
  const { records, loading, reload } = useStaffTraining(staffId)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState(EMPTY_TRAINING)
  const [file, setFile]         = useState(null)
  const [saving, setSaving]     = useState(false)

  const handleAdd = async () => {
    if (!form.title.trim()) { toast('Title is required', 'error'); return }
    setSaving(true)

    let file_url = null
    let file_name = null

    if (file) {
      const ext  = file.name.split('.').pop()
      const path = `${venueId}/${staffId}/${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('training-files')
        .upload(path, file, { upsert: false })
      if (uploadErr) { toast('File upload failed: ' + uploadErr.message, 'error'); setSaving(false); return }
      const { data: urlData } = supabase.storage.from('training-files').getPublicUrl(path)
      file_url  = urlData.publicUrl
      file_name = file.name
    }

    const { error } = await supabase.from('staff_training').insert({
      venue_id:    venueId,
      staff_id:    staffId,
      title:       form.title.trim(),
      issued_date: form.issued_date || null,
      expiry_date: form.expiry_date || null,
      notes:       form.notes.trim() || null,
      file_url,
      file_name,
    })

    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Training record added')
    setForm(EMPTY_TRAINING)
    setFile(null)
    setShowForm(false)
    reload()
  }

  const handleDelete = async (id) => {
    const { error } = await supabase.from('staff_training').delete().eq('id', id).eq('venue_id', venueId)
    if (error) { toast(error.message, 'error'); return }
    toast('Record deleted')
    reload()
  }

  if (loading) return <div className="pt-2"><LoadingSpinner size="sm" /></div>

  return (
    <div className="border-t border-charcoal/10 pt-4 mt-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] tracking-widest uppercase text-charcoal/40">Training Records</p>
        <button
          type="button"
          onClick={() => setShowForm(f => !f)}
          className="text-[11px] tracking-widest uppercase text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20"
        >
          {showForm ? 'Cancel' : '+ Add Record'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-charcoal/10 p-4 mb-3 flex flex-col gap-3">
          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">Title *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Food Hygiene Level 2"
              className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">Issued Date</label>
              <input type="date" value={form.issued_date} onChange={e => setForm(f => ({ ...f, issued_date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20" />
            </div>
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">Expiry Date</label>
              <input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20" />
            </div>
          </div>
          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} placeholder="Optional notes"
              className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 resize-none" />
          </div>
          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">Certificate / File</label>
            <input type="file" accept="image/*,.pdf"
              onChange={e => setFile(e.target.files[0] ?? null)}
              className="w-full text-sm text-charcoal/60 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-charcoal/15 file:text-xs file:bg-cream/50 file:text-charcoal/60 hover:file:bg-cream" />
          </div>
          <button onClick={handleAdd} disabled={saving}
            className="bg-charcoal text-cream py-2 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-charcoal/90 transition-colors">
            {saving ? 'Saving…' : 'Save Record →'}
          </button>
        </div>
      )}

      {records.length === 0 && !showForm && (
        <p className="text-xs text-charcoal/30 italic">No training records yet.</p>
      )}

      {records.length > 0 && (
        <ul className="flex flex-col gap-2">
          {records.map(r => {
            const expired = r.expiry_date && isPast(parseISO(r.expiry_date))
            return (
              <li key={r.id} className="flex items-start justify-between gap-3 rounded-lg border border-charcoal/8 bg-cream/20 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-charcoal">{r.title}</p>
                    {expired && (
                      <span className="text-[11px] tracking-widest uppercase bg-danger/10 text-danger px-1.5 py-0.5 rounded font-medium">Expired</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {r.issued_date && <p className="text-xs text-charcoal/40">Issued: {format(parseISO(r.issued_date), 'dd/MM/yyyy')}</p>}
                    {r.expiry_date && (
                      <p className={`text-xs ${expired ? 'text-danger/70' : 'text-charcoal/40'}`}>
                        Expires: {format(parseISO(r.expiry_date), 'dd/MM/yyyy')}
                      </p>
                    )}
                    {r.file_url && (
                      <a href={r.file_url} target="_blank" rel="noreferrer"
                        className="text-xs text-accent underline underline-offset-2 hover:opacity-70 transition-opacity truncate max-w-[200px]">
                        {r.file_name ?? 'View file'}
                      </a>
                    )}
                  </div>
                  {r.notes && <p className="text-xs text-charcoal/40 mt-1 italic">{r.notes}</p>}
                </div>
                <button onClick={() => handleDelete(r.id)}
                  className="text-xs text-charcoal/25 hover:text-danger transition-colors shrink-0 mt-0.5">✕</button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/* ── Notifications panel ────────────────────────────────────────────────────── */
function NotificationsPanel({ session, toast, settings }) {
  const { supported, permission, subscribed, subscribing, subscribe, unsubscribe } =
    usePushNotifications(session?.staffId)
  const [sendingReport, setSendingReport] = useState(false)

  const sendWeeklyReport = async () => {
    setSendingReport(true)
    const { error } = await supabase.functions.invoke('send-weekly-report', {
      body: { to: settings.manager_email },
    })
    setSendingReport(false)
    if (error) { toast('Failed to send report: ' + error.message, 'error'); return }
    toast(`Report sent to ${settings.manager_email || 'manager email'}`)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Push notifications */}
      <div>
        <p className="text-sm font-medium text-charcoal mb-1">Push Notifications</p>
        <p className="text-xs text-charcoal/40 mb-3">
          Receive alerts on your phone for late clock-ins and overdue tasks — even when the app is in the background.
        </p>
        {!supported ? (
          <p className="text-xs text-charcoal/35 italic">Push notifications are not supported in this browser. Install the app on your phone to enable them.</p>
        ) : permission === 'denied' ? (
          <p className="text-xs text-danger/70">Notifications blocked. Please enable them in your browser/phone settings.</p>
        ) : subscribed ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-success font-medium">● Notifications enabled</span>
            <button onClick={unsubscribe}
              className="text-xs text-charcoal/40 hover:text-danger transition-colors underline underline-offset-2">
              Disable
            </button>
          </div>
        ) : (
          <button onClick={subscribe} disabled={subscribing}
            className="bg-charcoal text-cream px-4 py-2 rounded-lg text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40">
            {subscribing ? 'Enabling…' : 'Enable Notifications →'}
          </button>
        )}
      </div>

      {/* Weekly email report */}
      <div className="border-t border-charcoal/8 pt-4">
        <p className="text-sm font-medium text-charcoal mb-1">Weekly Report</p>
        <p className="text-xs text-charcoal/40 mb-3">
          Send a summary report to <span className="font-medium text-charcoal/60">{settings.manager_email || 'your manager email'}</span> covering hours, temp checks, cleaning and waste for the past 7 days.
        </p>
        {!settings.manager_email ? (
          <p className="text-xs text-charcoal/35 italic">Set your manager email in Venue Details to enable reports.</p>
        ) : (
          <button onClick={sendWeeklyReport} disabled={sendingReport}
            className="bg-charcoal text-cream px-4 py-2 rounded-lg text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40">
            {sendingReport ? 'Sending…' : 'Send Weekly Report →'}
          </button>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   SETTINGS PAGE
   ═══════════════════════════════════════════════════════════════════════════ */
export default function SettingsPage() {
  const toast = useToast()
  const { session } = useSession()
  const { venueId } = useVenue()
  const { settings, loading: sLoading, reload: reloadSettings } = useVenueSettings()
  const { staff, loading: staffLoading, reload: reloadStaff }   = useStaffManagement()
  const { closures, reload: reloadClosures } = useVenueClosures()
  const { customRoles, closedDays, breakDurationMins, saveCustomRoles, saveClosedDays, saveBreakDuration, nextColor } = useAppSettings()
  const { roles: venueRoles } = useVenueRoles()
  const { dark, toggle: toggleDark } = useTheme()
  const { config: featuresConfig, save: saveFeatures, venuePlan } = useVenueFeatures()

  // Closed periods form
  const [closureForm, setClosureForm] = useState({ start_date: '', end_date: '', reason: '' })
  const [savingClosure, setSavingClosure] = useState(false)

  const addClosure = async () => {
    if (!closureForm.start_date || !closureForm.end_date) { toast('Start and end date are required', 'error'); return }
    if (closureForm.end_date < closureForm.start_date) { toast('End date must be on or after start date', 'error'); return }
    setSavingClosure(true)
    const { error } = await supabase.from('venue_closures').insert({
      venue_id:   venueId,
      start_date: closureForm.start_date,
      end_date:   closureForm.end_date,
      reason:     closureForm.reason.trim() || null,
    })
    setSavingClosure(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Closed period added')
    setClosureForm({ start_date: '', end_date: '', reason: '' })
    reloadClosures()
  }

  const deleteClosure = async (id) => {
    const { error } = await supabase.from('venue_closures').delete().eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    toast('Closed period removed')
    reloadClosures()
  }

  // Venue form
  const [venueForm, setVenueForm]   = useState({ venue_name: '', manager_email: '' })
  const [savingVenue, setSavingVenue] = useState(false)
  const [logoFile, setLogoFile]     = useState(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  useEffect(() => {
    if (!sLoading) setVenueForm({ venue_name: settings.venue_name, manager_email: settings.manager_email })
  }, [sLoading, settings])

  const saveVenue = async () => {
    setSavingVenue(true)
    const results = await Promise.all([
      supabase.from('app_settings').upsert({ venue_id: venueId, key: 'venue_name',    value: venueForm.venue_name }),
      supabase.from('app_settings').upsert({ venue_id: venueId, key: 'manager_email', value: venueForm.manager_email }),
    ])
    setSavingVenue(false)
    if (results.some(r => r.error)) { toast('Failed to save venue settings', 'error'); return }
    toast('Venue settings saved')
    reloadSettings()
  }

  const uploadLogo = async (file) => {
    if (!file) return
    setUploadingLogo(true)
    const ext  = file.name.split('.').pop()
    const path = `${venueId}/logo/venue-logo.${ext}`
    const { error: upErr } = await supabase.storage
      .from('app-assets')
      .upload(path, file, { upsert: true })
    if (upErr) { toast('Logo upload failed: ' + upErr.message, 'error'); setUploadingLogo(false); return }
    const { data: urlData } = supabase.storage.from('app-assets').getPublicUrl(path)
    const { error: dbErr } = await supabase.from('app_settings')
      .upsert({ venue_id: venueId, key: 'logo_url', value: urlData.publicUrl + '?t=' + Date.now() })
    setUploadingLogo(false)
    if (dbErr) { toast('Failed to save logo URL', 'error'); return }
    toast('Logo uploaded')
    setLogoFile(null)
    reloadSettings()
  }

  // Roles management
  const [newRoleName, setNewRoleName] = useState('')

  const addRole = async () => {
    const label = newRoleName.trim()
    if (!label) return
    const value = label.toLowerCase().replace(/\s+/g, '_')
    if (customRoles.some(r => r.value === value)) { toast('Role already exists', 'error'); return }
    const color = nextColor()
    await saveCustomRoles([...customRoles, { value, label, color }])
    setNewRoleName('')
    toast('Role added')
  }

  const removeRole = async (value) => {
    await saveCustomRoles(customRoles.filter(r => r.value !== value))
    toast('Role removed')
  }

  // Staff role map: staffId → role name[]  (used in staff list)
  const [staffRoleMap, setStaffRoleMap] = useState({})
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

  // Opening days
  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  const toggleClosedDay = async (dayIndex) => {
    const next = closedDays.includes(dayIndex)
      ? closedDays.filter(d => d !== dayIndex)
      : [...closedDays, dayIndex]
    await saveClosedDays(next)
  }

  // Staff form
  const [showForm, setShowForm]       = useState(false)
  const [editingId, setEditingId]     = useState(null)
  const [staffForm, setStaffForm]     = useState(EMPTY_FORM)
  const [savingStaff, setSavingStaff] = useState(false)
  const [photoFile, setPhotoFile]     = useState(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

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

  const openAdd = () => { setStaffForm(EMPTY_FORM); setEditingId(null); setShowForm(true) }
  const openEdit = (s) => {
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
    })
    setEditingId(s.id)
    setShowForm(true)
  }
  const cancelEdit = () => { setShowForm(false); setEditingId(null) }

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
      })
      error = e
    }

    setSavingStaff(false)
    if (error) { toast(error.message, 'error'); return }

    // Persist fields not covered by RPC (is_under_18, working_days)
    if (editingId) {
      await supabase.from('staff').update({
        is_under_18:  staffForm.is_under_18,
        working_days: staffForm.working_days,
      }).eq('id', editingId)
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
        await supabase.from('staff').update({
          is_under_18:  staffForm.is_under_18,
          working_days: staffForm.working_days,
        }).eq('id', newRow[0].id)
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

  const deleteStaffPermanently = async (s) => {
    if (!window.confirm(
      `Permanently delete ${s.name}?\n\nThis will remove them from the PIN screen and delete all their associated shifts, time off and training records.\n\nThis cannot be undone.`
    )) return
    const { error } = await supabase.from('staff').delete().eq('id', s.id)
    if (error) { toast(error.message, 'error'); return }
    toast(`${s.name} permanently deleted`)
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

  if (sLoading || staffLoading) {
    return <div className="flex justify-center pt-20"><LoadingSpinner size="lg" /></div>
  }

  const activeStaffCount = staff.filter(s => s.is_active).length

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-serif text-3xl text-brand dark:text-white">Settings</h1>

      {/* ── Venue Details ──────────────────────────────────────────────────── */}
      <SettingsSection title="Venue Details" defaultOpen>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">Venue Name</label>
            <input
              value={venueForm.venue_name}
              onChange={e => setVenueForm(f => ({ ...f, venue_name: e.target.value }))}
              placeholder="e.g. The Crown Bar & Kitchen"
              className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>
          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">Manager Email</label>
            <input
              type="email"
              value={venueForm.manager_email}
              onChange={e => setVenueForm(f => ({ ...f, manager_email: e.target.value }))}
              placeholder="manager@yoursite.com"
              className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>
          <button
            onClick={saveVenue}
            disabled={savingVenue}
            className="bg-charcoal text-cream px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40 self-start"
          >
            {savingVenue ? 'Saving…' : 'Save Changes →'}
          </button>

          {/* Logo upload */}
          <div className="border-t border-charcoal/10 pt-4 mt-2">
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-3">Venue Logo</label>
            <div className="flex items-center gap-4 flex-wrap">
              {settings.logo_url && (
                <img
                  src={settings.logo_url}
                  alt="Venue logo"
                  className="h-12 w-12 rounded-lg object-contain border border-charcoal/10 bg-cream/50 p-1"
                />
              )}
              <div className="flex flex-col gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => setLogoFile(e.target.files[0] ?? null)}
                  className="text-sm text-charcoal/60 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-charcoal/15 file:text-xs file:bg-cream/50 file:text-charcoal/60 hover:file:bg-cream"
                />
                {logoFile && (
                  <button
                    onClick={() => uploadLogo(logoFile)}
                    disabled={uploadingLogo}
                    className="self-start bg-charcoal text-cream px-4 py-2 rounded-lg text-xs font-medium disabled:opacity-40 hover:bg-charcoal/90 transition-colors"
                  >
                    {uploadingLogo ? 'Uploading…' : 'Upload Logo →'}
                  </button>
                )}
                <p className="text-[11px] text-charcoal/35">Displayed in the app header after login. PNG or SVG recommended.</p>
              </div>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* ── Appearance ─────────────────────────────────────────────────────── */}
      <SettingsSection title="Appearance" subtitle="Dark mode · Theme">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-charcoal dark:text-white">Dark Mode</p>
            <p className="text-xs text-charcoal/40 dark:text-white/40 mt-0.5">
              {dark ? 'Dark theme is active.' : 'Switch to a darker colour scheme.'}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-base">{dark ? '🌙' : '☀️'}</span>
            <Toggle checked={dark} onChange={toggleDark} />
          </div>
        </div>
      </SettingsSection>

      {/* ── Features & Modules ─────────────────────────────────────────────── */}
      <SettingsSection
        title="Features & Modules"
        subtitle={featuresConfig.mode === 'all' ? 'All features enabled' : `Custom — ${featuresConfig.enabled?.length ?? 0} enabled`}
      >
        <p className="text-xs text-charcoal/40 dark:text-white/40 mb-5">
          Choose which features are available in this venue. Disabled features are hidden from the navigation.
        </p>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-6">
          {['all', 'custom'].map(mode => (
            <button
              key={mode}
              onClick={() => saveFeatures({
                mode,
                enabled: mode === 'all' ? ALL_FEATURE_IDS : (featuresConfig.enabled ?? ALL_FEATURE_IDS),
              })}
              className={`px-5 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                featuresConfig.mode === mode
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-charcoal/15 dark:border-white/15 text-charcoal/50 dark:text-white/40 hover:border-charcoal/30 dark:hover:border-white/30'
              }`}
            >
              {mode === 'all' ? 'All Features' : 'Custom'}
            </button>
          ))}
        </div>

        {/* Feature groups — only shown in custom mode */}
        {featuresConfig.mode === 'custom' && (
          <div className="space-y-4">
            {FEATURE_GROUPS.map(group => {
              const allOn = group.features.every(f => featuresConfig.enabled?.includes(f.id))

              const toggleGroup = () => {
                const next = allOn
                  ? (featuresConfig.enabled ?? ALL_FEATURE_IDS).filter(id => !group.features.find(f => f.id === id))
                  : [...new Set([...(featuresConfig.enabled ?? []), ...group.features.map(f => f.id)])]
                saveFeatures({ ...featuresConfig, enabled: next })
              }

              const toggleFeature = (featureId) => {
                const current = featuresConfig.enabled ?? ALL_FEATURE_IDS
                const next = current.includes(featureId)
                  ? current.filter(id => id !== featureId)
                  : [...current, featureId]
                saveFeatures({ ...featuresConfig, enabled: next })
              }

              return (
                <div key={group.id} className="rounded-xl border border-charcoal/10 dark:border-white/10 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-charcoal/3 dark:bg-white/4 border-b border-charcoal/8 dark:border-white/8">
                    <div>
                      <p className="text-sm font-semibold text-charcoal dark:text-white">{group.label}</p>
                      <p className="text-[11px] text-charcoal/40 dark:text-white/35 mt-0.5">{group.description}</p>
                    </div>
                    <Toggle checked={allOn} onChange={toggleGroup} />
                  </div>
                  <div className="divide-y divide-charcoal/6 dark:divide-white/6">
                    {group.features.map(feature => {
                      const isProOnly = PRO_ONLY_FEATURE_IDS.includes(feature.id)
                      const locked = isProOnly && venuePlan !== 'pro'
                      const on = !locked && (featuresConfig.enabled?.includes(feature.id) ?? true)
                      return (
                        <div key={feature.id} className={`flex items-center justify-between px-4 py-3 ${locked ? 'opacity-60' : ''}`}>
                          <div className="flex-1 min-w-0 pr-4">
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-medium ${on ? 'text-charcoal dark:text-white' : 'text-charcoal/35 dark:text-white/30'}`}>
                                {feature.label}
                              </p>
                              {locked && (
                                <span className="text-[9px] tracking-widest uppercase font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded shrink-0">Pro</span>
                              )}
                            </div>
                            <p className="text-[11px] text-charcoal/40 dark:text-white/35 mt-0.5 truncate">{feature.description}</p>
                          </div>
                          <Toggle checked={on} onChange={locked ? undefined : () => toggleFeature(feature.id)} disabled={locked} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {featuresConfig.mode === 'all' && (
          <p className="text-xs text-charcoal/35 dark:text-white/30 italic">
            All {ALL_FEATURE_IDS.length} features are enabled. Switch to Custom to hide modules that don't apply to your business.
          </p>
        )}
      </SettingsSection>

      {/* ── Opening Days ───────────────────────────────────────────────────── */}
      <SettingsSection
        title="Opening Days"
        subtitle={closedDays.length === 0 ? 'All 7 days open' : `Closed: ${closedDays.sort((a,b)=>a-b).map(d=>DAY_NAMES[d]).join(', ')}`}
      >
        <p className="text-xs text-charcoal/40 mb-4">
          Mark days the venue is closed. Closed days are skipped by the rota builder and greyed out in the schedule.
        </p>
        <div className="flex gap-2 flex-wrap">
          {DAY_NAMES.map((day, i) => {
            const isClosed = closedDays.includes(i)
            return (
              <button
                key={i}
                onClick={() => toggleClosedDay(i)}
                className={[
                  'px-4 py-2.5 rounded-lg text-sm font-medium border transition-all min-w-[64px]',
                  isClosed
                    ? 'bg-charcoal/8 text-charcoal/35 border-charcoal/15 line-through'
                    : 'bg-success/10 text-success border-success/20',
                ].join(' ')}
              >
                {day}
              </button>
            )
          })}
        </div>
      </SettingsSection>

      {/* ── Rota & Pay ─────────────────────────────────────────────────────── */}
      <SettingsSection title="Rota & Pay" subtitle={`Adult break: ${breakDurationMins} min · Under-18: 30 min`}>
        <p className="text-sm text-charcoal/50 mb-5">
          Set the unpaid break deducted from paid hours for adult staff (18+) working more than 6 hours. UK law requires a minimum of 20 minutes. Under-18 staff always get 30 minutes as required by law.
        </p>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-medium text-charcoal">Break duration (adults, shifts &gt;6h)</p>
            <p className="text-xs text-charcoal/40 mt-0.5">Deducted from paid hours and wage cost</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {[15, 20, 30, 45, 60].map(mins => (
              <button
                key={mins}
                onClick={() => saveBreakDuration(mins)}
                className={[
                  'px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
                  breakDurationMins === mins
                    ? 'bg-charcoal text-cream border-charcoal'
                    : 'bg-white text-charcoal/50 border-charcoal/15 hover:border-charcoal/30',
                ].join(' ')}
              >
                {mins}m
              </button>
            ))}
          </div>
        </div>
        {breakDurationMins < 20 && (
          <p className="text-xs text-warning mt-3">Note: UK minimum break is 20 minutes.</p>
        )}
      </SettingsSection>

      {/* ── Closed Periods ─────────────────────────────────────────────────── */}
      <SettingsSection
        title="Closed Periods"
        subtitle={closures.length > 0 ? `${closures.length} period${closures.length !== 1 ? 's' : ''} scheduled` : 'None scheduled'}
      >
        <p className="text-xs text-charcoal/40 mb-5">
          Mark your venue as closed for a specific date range — e.g. Christmas week, annual holiday. This flags the period across the app so staff aren't expected to complete checks.
        </p>

        {/* Existing closures */}
        {closures.length > 0 && (
          <div className="flex flex-col gap-2 mb-5">
            {closures.map(c => {
              const past = c.end_date < format(new Date(), 'yyyy-MM-dd')
              return (
                <div key={c.id} className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border ${past ? 'bg-charcoal/2 border-charcoal/8 opacity-50' : 'bg-cream/40 border-charcoal/10'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-charcoal">
                      {format(parseISO(c.start_date), 'd MMM yyyy')}
                      {c.start_date !== c.end_date && ` – ${format(parseISO(c.end_date), 'd MMM yyyy')}`}
                    </p>
                    {c.reason && <p className="text-xs text-charcoal/40 mt-0.5">{c.reason}</p>}
                    {past && <p className="text-[11px] text-charcoal/30 italic mt-0.5">Past</p>}
                  </div>
                  <button
                    onClick={() => deleteClosure(c.id)}
                    className="text-xs text-charcoal/25 hover:text-danger transition-colors shrink-0"
                  >×</button>
                </div>
              )
            })}
          </div>
        )}

        {/* Add closure form */}
        <div className="flex flex-col gap-3 p-4 rounded-xl bg-cream/40 border border-charcoal/10">
          <p className="text-[11px] tracking-widest uppercase text-charcoal/40">Add Closed Period</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">From *</label>
              <input
                type="date"
                value={closureForm.start_date}
                onChange={e => setClosureForm(f => ({ ...f, start_date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            </div>
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">To *</label>
              <input
                type="date"
                value={closureForm.end_date}
                min={closureForm.start_date}
                onChange={e => setClosureForm(f => ({ ...f, end_date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">Reason (optional)</label>
            <input
              value={closureForm.reason}
              onChange={e => setClosureForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="e.g. Christmas holiday, annual deep clean"
              className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>
          <button
            onClick={addClosure}
            disabled={savingClosure || !closureForm.start_date || !closureForm.end_date}
            className="self-start bg-charcoal text-cream px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-charcoal/90 transition-colors"
          >
            {savingClosure ? 'Saving…' : 'Add Closed Period →'}
          </button>
        </div>
      </SettingsSection>

      {/* ── Notifications & Reports ────────────────────────────────────────── */}
      <SettingsSection title="Notifications & Reports" subtitle="Push alerts · Weekly email">
        <NotificationsPanel session={session} toast={toast} settings={settings} />
      </SettingsSection>

      {/* ── Roles & Skills ─────────────────────────────────────────────────── */}
      <SettingsSection
        title="Roles & Skills"
        subtitle="Define the roles in your business — assign them to staff and use them in the rota builder"
      >
        <RolesSection />
      </SettingsSection>

      {/* ── Staff Members ──────────────────────────────────────────────────── */}
      <SettingsSection
        title="Staff Members"
        subtitle={`${activeStaffCount} active member${activeStaffCount !== 1 ? 's' : ''}`}
        defaultOpen
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

            {/* Tab access toggles */}
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">App Tab Access</label>
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-charcoal">Temp Logs</span>
                  <Toggle
                    checked={staffForm.show_temp_logs}
                    onChange={v => setStaffForm(f => ({ ...f, show_temp_logs: v }))}
                    size="sm"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-charcoal">Allergens</span>
                  <Toggle
                    checked={staffForm.show_allergens}
                    onChange={v => setStaffForm(f => ({ ...f, show_allergens: v }))}
                    size="sm"
                  />
                </div>
              </div>
            </div>

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
                  {s.show_temp_logs  && <span className="text-[11px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">Temp Logs</span>}
                  {s.show_allergens  && <span className="text-[11px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">Allergens</span>}
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
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {s.email && <p className="text-xs text-charcoal/40">{s.email}</p>}
                  {s.hourly_rate > 0 && <p className="text-xs text-charcoal/40 font-mono">£{Number(s.hourly_rate).toFixed(2)}/hr</p>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap justify-end">
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
                  onClick={() => deleteStaffPermanently(s)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-danger/15 text-danger/40 hover:text-danger hover:border-danger/35 transition-colors"
                >Delete</button>
              </div>
            </div>
          ))}
          {staff.length === 0 && <p className="text-sm text-charcoal/35 italic py-4">No staff members yet.</p>}
        </div>
      </SettingsSection>
    </div>
  )
}
