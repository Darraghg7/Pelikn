import React, { useState, useEffect } from 'react'
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
import { useVenueFeatures, FEATURE_GROUPS, ALL_FEATURE_IDS } from '../../hooks/useVenueFeatures'
import Toggle from '../../components/ui/Toggle'

const PERMISSION_ROLES  = ['staff', 'manager', 'owner']
const PERMISSION_LABELS = { staff: 'Staff', manager: 'Manager', owner: 'Owner' }

const JOB_ROLES  = ['kitchen', 'foh']
const JOB_LABELS = { kitchen: 'Kitchen', foh: 'Front of House' }

function SectionLabel({ children }) {
  return <p className="text-[10px] tracking-widest uppercase text-charcoal/40 mb-3">{children}</p>
}

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

function useStaffManagement() {
  const { venueId } = useVenue()
  const [staff, setStaff]     = useState([])
  const [loading, setLoading] = useState(true)
  const load = async () => {
    if (!venueId) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('staff')
      .select('id, name, email, job_role, role, hourly_rate, is_active, show_temp_logs, show_allergens, photo_url, skills, is_under_18')
      .eq('venue_id', venueId)
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
}

const EMPTY_TRAINING = { title: '', issued_date: '', expiry_date: '', notes: '' }

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
        <p className="text-[10px] tracking-widest uppercase text-charcoal/40">Training Records</p>
        <button
          type="button"
          onClick={() => setShowForm(f => !f)}
          className="text-[10px] tracking-widest uppercase text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20"
        >
          {showForm ? 'Cancel' : '+ Add Record'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-charcoal/10 p-4 mb-3 flex flex-col gap-3">
          <div>
            <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-1">Title *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Food Hygiene Level 2"
              className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-1">Issued Date</label>
              <input type="date" value={form.issued_date} onChange={e => setForm(f => ({ ...f, issued_date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20" />
            </div>
            <div>
              <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-1">Expiry Date</label>
              <input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20" />
            </div>
          </div>
          <div>
            <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} placeholder="Optional notes"
              className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 resize-none" />
          </div>
          <div>
            <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-1">Certificate / File</label>
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
                      <span className="text-[10px] tracking-widest uppercase bg-danger/10 text-danger px-1.5 py-0.5 rounded font-medium">Expired</span>
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
    <div className="bg-white rounded-xl border border-charcoal/10 p-6">
      <SectionLabel>Notifications &amp; Reports</SectionLabel>
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
    </div>
  )
}

export default function SettingsPage() {
  const toast = useToast()
  const { session } = useSession()
  const { venueId } = useVenue()
  const { settings, loading: sLoading, reload: reloadSettings } = useVenueSettings()
  const { staff, loading: staffLoading, reload: reloadStaff }   = useStaffManagement()
  const { customRoles, closedDays, saveCustomRoles, saveClosedDays, nextColor } = useAppSettings()
  const { dark, toggle: toggleDark } = useTheme()
  const { config: featuresConfig, save: saveFeatures } = useVenueFeatures()

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

    // Persist is_under_18 directly (not in RPC)
    if (editingId) {
      await supabase.from('staff').update({ is_under_18: staffForm.is_under_18 }).eq('id', editingId)
    } else {
      // Find the newly created staff member by name + venue
      const { data: newRow } = await supabase
        .from('staff')
        .select('id')
        .eq('venue_id', venueId)
        .eq('name', staffForm.name.trim())
        .order('created_at', { ascending: false })
        .limit(1)
      if (newRow?.[0]?.id && staffForm.is_under_18) {
        await supabase.from('staff').update({ is_under_18: true }).eq('id', newRow[0].id)
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

  if (sLoading || staffLoading) {
    return <div className="flex justify-center pt-20"><LoadingSpinner size="lg" /></div>
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-serif text-3xl text-charcoal">Settings</h1>

      {/* Venue */}
      <div className="bg-white rounded-xl border border-charcoal/10 p-6">
        <SectionLabel>Venue Details</SectionLabel>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-2">Venue Name</label>
            <input
              value={venueForm.venue_name}
              onChange={e => setVenueForm(f => ({ ...f, venue_name: e.target.value }))}
              placeholder="e.g. The Crown Bar & Kitchen"
              className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>
          <div>
            <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-2">Manager Email</label>
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
            <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-3">Venue Logo</label>
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
      </div>

      {/* Appearance */}
      <div className="bg-white rounded-xl border border-charcoal/10 p-6">
        <SectionLabel>Appearance</SectionLabel>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-charcoal">Dark Mode</p>
            <p className="text-xs text-charcoal/40 mt-0.5">
              {dark ? 'Dark theme is active.' : 'Switch to a darker colour scheme.'}
            </p>
          </div>
          <button
            onClick={toggleDark}
            className="flex items-center gap-1.5"
          >
            <span className="text-base">{dark ? '🌙' : '☀️'}</span>
            <Toggle checked={dark} onChange={toggleDark} />
        </div>
      </div>

      {/* Features & Modules */}
      <div className="bg-white dark:bg-white/5 rounded-xl border border-charcoal/10 dark:border-white/10 p-6">
        <SectionLabel>Features &amp; Modules</SectionLabel>
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
          <div className="space-y-6">
            {FEATURE_GROUPS.map(group => {
              const allOn  = group.features.every(f => featuresConfig.enabled?.includes(f.id))
              const someOn = group.features.some(f => featuresConfig.enabled?.includes(f.id))

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
                  {/* Group header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-charcoal/3 dark:bg-white/4 border-b border-charcoal/8 dark:border-white/8">
                    <div>
                      <p className="text-sm font-semibold text-charcoal dark:text-white">{group.label}</p>
                      <p className="text-[11px] text-charcoal/40 dark:text-white/35 mt-0.5">{group.description}</p>
                    </div>
                    {/* Group toggle */}
                    <Toggle checked={allOn} onChange={toggleGroup} />
                  </div>

                  {/* Individual features */}
                  <div className="divide-y divide-charcoal/6 dark:divide-white/6">
                    {group.features.map(feature => {
                      const on = featuresConfig.enabled?.includes(feature.id) ?? true
                      return (
                        <div key={feature.id} className="flex items-center justify-between px-4 py-3">
                          <div className="flex-1 min-w-0 pr-4">
                            <p className={`text-sm font-medium ${on ? 'text-charcoal dark:text-white' : 'text-charcoal/35 dark:text-white/30'}`}>
                              {feature.label}
                            </p>
                            <p className="text-[11px] text-charcoal/40 dark:text-white/35 mt-0.5 truncate">{feature.description}</p>
                          </div>
                          <Toggle checked={on} onChange={() => toggleFeature(feature.id)} />
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
      </div>

      {/* Roles */}
      <div className="bg-white rounded-xl border border-charcoal/10 p-6">
        <SectionLabel>Roles</SectionLabel>
        <p className="text-xs text-charcoal/40 mb-4">
          Manage the roles available for shift assignment and the rota builder.
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          {customRoles.map(r => (
            <div key={r.value} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${r.color}`}>
              <span>{r.label}</span>
              <button
                onClick={() => removeRole(r.value)}
                className="opacity-40 hover:opacity-100 transition-opacity ml-0.5"
              >✕</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newRoleName}
            onChange={e => setNewRoleName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addRole()}
            placeholder="New role name…"
            className="flex-1 px-4 py-2.5 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
          />
          <button
            onClick={addRole}
            disabled={!newRoleName.trim()}
            className="bg-charcoal text-cream px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40"
          >
            Add →
          </button>
        </div>
      </div>

      {/* Opening Days */}
      <div className="bg-white rounded-xl border border-charcoal/10 p-6">
        <SectionLabel>Opening Days</SectionLabel>
        <p className="text-xs text-charcoal/40 mb-4">
          Mark days the café is closed. Closed days are skipped by the rota builder and greyed out in the schedule.
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
        <p className="text-[11px] text-charcoal/35 mt-3">
          {closedDays.length === 0
            ? 'All days open.'
            : `Closed: ${closedDays.sort((a, b) => a - b).map(d => DAY_NAMES[d]).join(', ')}`}
        </p>
      </div>

      {/* Notifications & Reports */}
      <NotificationsPanel session={session} toast={toast} settings={settings} />

      {/* Staff */}
      <div className="bg-white rounded-xl border border-charcoal/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <SectionLabel>Staff Members</SectionLabel>
          {!showForm && (
            <button
              onClick={openAdd}
              className="text-[11px] tracking-widest uppercase text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20"
            >
              + Add Staff
            </button>
          )}
        </div>

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
                    <label className="text-[10px] tracking-widest uppercase text-charcoal/40">Photo</label>
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
                <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-1.5">Name *</label>
                <input
                  value={staffForm.name}
                  onChange={e => setStaffForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Full name"
                  className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
                />
              </div>
              <div>
                <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-1.5">Email</label>
                <input
                  type="email"
                  value={staffForm.email}
                  onChange={e => setStaffForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="staff@example.com"
                  className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
                />
              </div>
              <div>
                <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-1.5">
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
                <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-1.5">Hourly Rate (£)</label>
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
              <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-2">Permission Level</label>
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
              <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-2">Department</label>
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

            {/* Skills (checkboxes from custom roles) */}
            <div>
              <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-2">Skills</label>
              <div className="flex gap-3 flex-wrap">
                {customRoles.map(role => {
                  const checked = staffForm.skills?.includes(role.value)
                  return (
                    <label key={role.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => {
                          setStaffForm(f => ({
                            ...f,
                            skills: e.target.checked
                              ? [...(f.skills || []), role.value]
                              : (f.skills || []).filter(s => s !== role.value),
                          }))
                        }}
                        className="w-4 h-4 rounded accent-charcoal"
                      />
                      <span className={`text-sm px-2 py-0.5 rounded ${role.color}`}>{role.label}</span>
                    </label>
                  )
                })}
              </div>
              <p className="text-[11px] text-charcoal/35 mt-1.5">
                Skills are used by the AI rota builder for shift assignment.
              </p>
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
              <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-2">App Tab Access</label>
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
          {staff.map(s => (
            <div key={s.id} className={`py-4 first:pt-0 last:pb-0 flex items-center gap-4 ${!s.is_active ? 'opacity-40' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-charcoal text-sm">{s.name}</p>
                  <span className={[
                    'text-[10px] tracking-widest uppercase font-medium px-1.5 py-0.5 rounded',
                    s.role === 'owner'   ? 'bg-purple-50 text-purple-600' :
                    s.role === 'manager' ? 'bg-amber-50 text-amber-600' :
                                          'bg-charcoal/5 text-charcoal/50',
                  ].join(' ')}>
                    {PERMISSION_LABELS[s.role] ?? s.role}
                  </span>
                  <span className="text-[10px] tracking-widest uppercase text-charcoal/40 border border-charcoal/15 px-1.5 py-0.5 rounded">
                    {JOB_LABELS[s.job_role] ?? s.job_role}
                  </span>
                  {s.show_temp_logs  && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">Temp Logs</span>}
                  {s.show_allergens  && <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">Allergens</span>}
                  {(s.skills ?? []).map(sk => {
                    const roleDef = customRoles.find(r => r.value === sk)
                    return roleDef ? (
                      <span key={sk} className={`text-[10px] px-1.5 py-0.5 rounded ${roleDef.color}`}>{roleDef.label}</span>
                    ) : null
                  })}
                  {!s.is_active      && <span className="text-[10px] tracking-widest uppercase text-charcoal/30 italic">inactive</span>}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {s.email && <p className="text-xs text-charcoal/40">{s.email}</p>}
                  {s.hourly_rate > 0 && <p className="text-xs text-charcoal/40 font-mono">£{Number(s.hourly_rate).toFixed(2)}/hr</p>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
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
              </div>
            </div>
          ))}
          {staff.length === 0 && <p className="text-sm text-charcoal/35 italic py-4">No staff members yet.</p>}
        </div>
      </div>
    </div>
  )
}
