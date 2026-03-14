import React, { useState, useEffect } from 'react'
import { format, isPast, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useStaffTraining } from '../../hooks/useTraining'

const PERMISSION_ROLES  = ['staff', 'manager', 'owner']
const PERMISSION_LABELS = { staff: 'Staff', manager: 'Manager', owner: 'Owner' }

const JOB_ROLES  = ['kitchen', 'foh']
const JOB_LABELS = { kitchen: 'Kitchen', foh: 'Front of House' }

function SectionLabel({ children }) {
  return <p className="text-[10px] tracking-widest uppercase text-charcoal/40 mb-3">{children}</p>
}

function useVenueSettings() {
  const [settings, setSettings] = useState({ venue_name: '', manager_email: '' })
  const [loading, setLoading]   = useState(true)
  const load = async () => {
    const { data } = await supabase.from('app_settings').select('*')
    if (data) {
      const map = Object.fromEntries(data.map(r => [r.key, r.value]))
      setSettings({ venue_name: map.venue_name ?? '', manager_email: map.manager_email ?? '' })
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [])
  return { settings, loading, reload: load }
}

function useStaffManagement() {
  const [staff, setStaff]     = useState([])
  const [loading, setLoading] = useState(true)
  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('staff')
      .select('id, name, email, job_role, role, hourly_rate, is_active, show_temp_logs, show_allergens')
      .order('name')
    setStaff(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])
  return { staff, loading, reload: load }
}

const EMPTY_FORM = {
  name: '', role: 'staff', job_role: 'kitchen', pin: '', email: '', hourly_rate: '',
  show_temp_logs: false, show_allergens: false,
}

const EMPTY_TRAINING = { title: '', issued_date: '', expiry_date: '', notes: '' }

function TrainingSection({ staffId }) {
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
      const path = `${staffId}/${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('training-files')
        .upload(path, file, { upsert: false })
      if (uploadErr) { toast('File upload failed: ' + uploadErr.message, 'error'); setSaving(false); return }
      const { data: urlData } = supabase.storage.from('training-files').getPublicUrl(path)
      file_url  = urlData.publicUrl
      file_name = file.name
    }

    const { error } = await supabase.from('staff_training').insert({
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
    const { error } = await supabase.from('staff_training').delete().eq('id', id)
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

export default function SettingsPage() {
  const toast = useToast()
  const { session } = useSession()
  const { settings, loading: sLoading, reload: reloadSettings } = useVenueSettings()
  const { staff, loading: staffLoading, reload: reloadStaff }   = useStaffManagement()

  // Venue form
  const [venueForm, setVenueForm]   = useState({ venue_name: '', manager_email: '' })
  const [savingVenue, setSavingVenue] = useState(false)
  useEffect(() => {
    if (!sLoading) setVenueForm({ venue_name: settings.venue_name, manager_email: settings.manager_email })
  }, [sLoading, settings])

  const saveVenue = async () => {
    setSavingVenue(true)
    const results = await Promise.all([
      supabase.from('app_settings').upsert({ key: 'venue_name',    value: venueForm.venue_name }),
      supabase.from('app_settings').upsert({ key: 'manager_email', value: venueForm.manager_email }),
    ])
    setSavingVenue(false)
    if (results.some(r => r.error)) { toast('Failed to save venue settings', 'error'); return }
    toast('Venue settings saved')
    reloadSettings()
  }

  // Staff form
  const [showForm, setShowForm]       = useState(false)
  const [editingId, setEditingId]     = useState(null)
  const [staffForm, setStaffForm]     = useState(EMPTY_FORM)
  const [savingStaff, setSavingStaff] = useState(false)

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
      })
      error = e
    }

    setSavingStaff(false)
    if (error) { toast(error.message, 'error'); return }
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
        </div>
      </div>

      {/* Staff */}
      <div className="bg-white rounded-xl border border-charcoal/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <SectionLabel>Staff Members</SectionLabel>
          {!showForm && (
            <button
              onClick={openAdd}
              className="text-[11px] tracking-widests uppercase text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20"
            >
              + Add Staff
            </button>
          )}
        </div>

        {/* Add / Edit form */}
        {showForm && (
          <div className="mb-6 p-5 rounded-xl bg-cream/50 border border-charcoal/10 flex flex-col gap-4">
            <p className="text-sm font-semibold text-charcoal">{editingId ? 'Edit Staff Member' : 'New Staff Member'}</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] tracking-widests uppercase text-charcoal/40 block mb-1.5">Name *</label>
                <input
                  value={staffForm.name}
                  onChange={e => setStaffForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Full name"
                  className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
                />
              </div>
              <div>
                <label className="text-[10px] tracking-widests uppercase text-charcoal/40 block mb-1.5">Email</label>
                <input
                  type="email"
                  value={staffForm.email}
                  onChange={e => setStaffForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="staff@example.com"
                  className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
                />
              </div>
              <div>
                <label className="text-[10px] tracking-widests uppercase text-charcoal/40 block mb-1.5">
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
                <label className="text-[10px] tracking-widests uppercase text-charcoal/40 block mb-1.5">Hourly Rate (£)</label>
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
              <label className="text-[10px] tracking-widests uppercase text-charcoal/40 block mb-2">Permission Level</label>
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
              <label className="text-[10px] tracking-widests uppercase text-charcoal/40 block mb-2">Department</label>
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

            {/* Tab access toggles */}
            <div>
              <label className="text-[10px] tracking-widests uppercase text-charcoal/40 block mb-2">App Tab Access</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={staffForm.show_temp_logs}
                    onChange={e => setStaffForm(f => ({ ...f, show_temp_logs: e.target.checked }))}
                    className="w-4 h-4 rounded accent-charcoal"
                  />
                  <span className="text-sm text-charcoal">Temp Logs</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={staffForm.show_allergens}
                    onChange={e => setStaffForm(f => ({ ...f, show_allergens: e.target.checked }))}
                    className="w-4 h-4 rounded accent-charcoal"
                  />
                  <span className="text-sm text-charcoal">Allergens</span>
                </label>
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
                    'text-[10px] tracking-widests uppercase font-medium px-1.5 py-0.5 rounded',
                    s.role === 'owner'   ? 'bg-purple-50 text-purple-600' :
                    s.role === 'manager' ? 'bg-amber-50 text-amber-600' :
                                          'bg-charcoal/5 text-charcoal/50',
                  ].join(' ')}>
                    {PERMISSION_LABELS[s.role] ?? s.role}
                  </span>
                  <span className="text-[10px] tracking-widests uppercase text-charcoal/40 border border-charcoal/15 px-1.5 py-0.5 rounded">
                    {JOB_LABELS[s.job_role] ?? s.job_role}
                  </span>
                  {s.show_temp_logs  && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">Temp Logs</span>}
                  {s.show_allergens  && <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">Allergens</span>}
                  {!s.is_active      && <span className="text-[10px] tracking-widests uppercase text-charcoal/30 italic">inactive</span>}
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
