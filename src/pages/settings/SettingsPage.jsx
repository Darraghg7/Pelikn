import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

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
