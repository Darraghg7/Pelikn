import React, { useState, useEffect, useCallback } from 'react'
import { format, isPast, parseISO, differenceInDays } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import PageHeader from '../../components/layout/PageHeader'

const CATEGORIES = [
  'Food Safety',
  'HACCP',
  'Manual Handling',
  'Fire Safety',
  'First Aid',
  'Allergen Awareness',
  'Customer Service',
  'Other',
]

const EMPTY_FORM = {
  staff_id: '',
  title: '',
  category: '',
  issued_date: '',
  expiry_date: '',
  notes: '',
}

function trainingStatus(record) {
  if (!record.expiry_date) return 'valid'
  const expiry = parseISO(record.expiry_date)
  if (isPast(expiry)) return 'expired'
  if (differenceInDays(expiry, new Date()) <= 30) return 'expiring'
  return 'valid'
}

function StatusBadge({ status }) {
  const styles = {
    expired:  'bg-red-50 text-red-600',
    expiring: 'bg-amber-50 text-amber-600',
    valid:    'bg-emerald-50 text-emerald-600',
  }
  const labels = { expired: 'Expired', expiring: 'Expiring Soon', valid: 'Valid' }
  return (
    <span className={`text-[10px] tracking-widest uppercase font-medium px-1.5 py-0.5 rounded ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

function useAllTraining(venueId) {
  const [records, setRecords]   = useState([])
  const [loading, setLoading]   = useState(true)

  const load = useCallback(async () => {
    if (!venueId) return
    setLoading(true)
    const { data } = await supabase
      .from('staff_training')
      .select('*, staff:staff_id(id, name, job_role, photo_url)')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
    setRecords(data ?? [])
    setLoading(false)
  }, [venueId])

  useEffect(() => { load() }, [load])
  return { records, loading, reload: load }
}

function useActiveStaff(venueId) {
  const [staff, setStaff]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!venueId) return
    supabase
      .from('staff')
      .select('id, name, job_role, photo_url')
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => { setStaff(data ?? []); setLoading(false) })
  }, [venueId])

  return { staff, loading }
}

export default function TrainingPage() {
  const toast = useToast()
  const { venueId } = useVenue()
  const { records, loading, reload } = useAllTraining(venueId)
  const { staff, loading: staffLoading } = useActiveStaff(venueId)

  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [file, setFile]           = useState(null)
  const [saving, setSaving]       = useState(false)
  const [filterStaff, setFilterStaff]     = useState('')
  const [filterStatus, setFilterStatus]   = useState('')
  const [filterCategory, setFilterCategory] = useState('')

  const handleAdd = async () => {
    if (!form.staff_id)       { toast('Select a staff member', 'error'); return }
    if (!form.title.trim())   { toast('Title is required', 'error'); return }
    setSaving(true)

    let file_url = null
    let file_name = null

    if (file) {
      const ext  = file.name.split('.').pop()
      const path = `${venueId}/${form.staff_id}/${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('training-files')
        .upload(path, file, { upsert: false })
      if (uploadErr) {
        toast('File upload failed: ' + uploadErr.message, 'error')
        setSaving(false)
        return
      }
      const { data: urlData } = supabase.storage.from('training-files').getPublicUrl(path)
      file_url  = urlData.publicUrl
      file_name = file.name
    }

    const { error } = await supabase.from('staff_training').insert({
      staff_id:    form.staff_id,
      title:       form.title.trim(),
      category:    form.category || null,
      issued_date: form.issued_date || null,
      expiry_date: form.expiry_date || null,
      notes:       form.notes.trim() || null,
      file_url,
      file_name,
      venue_id:    venueId,
    })

    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Training record added')
    setForm(EMPTY_FORM)
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

  if (loading || staffLoading) {
    return <div className="flex justify-center pt-20"><LoadingSpinner size="lg" /></div>
  }

  // Stats
  const expiredCount  = records.filter(r => trainingStatus(r) === 'expired').length
  const expiringCount = records.filter(r => trainingStatus(r) === 'expiring').length
  const validCount    = records.filter(r => trainingStatus(r) === 'valid').length

  // Filtered records
  const filtered = records.filter(r => {
    if (filterStaff && r.staff_id !== filterStaff) return false
    if (filterStatus && trainingStatus(r) !== filterStatus) return false
    if (filterCategory && r.category !== filterCategory) return false
    return true
  })

  // Group by staff
  const byStaff = {}
  for (const r of filtered) {
    const name = r.staff?.name ?? 'Unknown'
    if (!byStaff[name]) byStaff[name] = []
    byStaff[name].push(r)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Staff Training"
        subtitle="Manage training records and certificates"
        action={
          <button
            onClick={() => setShowForm(f => !f)}
            className="bg-charcoal text-cream px-4 py-2 rounded-lg text-sm font-medium hover:bg-charcoal/90 transition-colors"
          >
            {showForm ? 'Cancel' : '+ Add Record'}
          </button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Valid',    count: validCount,    color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Expiring', count: expiringCount, color: 'text-amber-600',   bg: 'bg-amber-50' },
          { label: 'Expired',  count: expiredCount,  color: 'text-red-600',     bg: 'bg-red-50' },
        ].map(s => (
          <button
            key={s.label}
            onClick={() => setFilterStatus(filterStatus === s.label.toLowerCase() ? '' : s.label.toLowerCase())}
            className={`rounded-xl border border-charcoal/10 p-4 text-left transition-all ${
              filterStatus === s.label.toLowerCase() ? 'ring-2 ring-charcoal/20' : ''
            } bg-white`}
          >
            <p className="text-[10px] tracking-widest uppercase text-charcoal/40 mb-1">{s.label}</p>
            <p className={`text-2xl font-serif ${s.color}`}>{s.count}</p>
          </button>
        ))}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-charcoal/10 p-6 flex flex-col gap-4">
          <p className="text-sm font-semibold text-charcoal">New Training Record</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-1">Staff Member *</label>
              <select
                value={form.staff_id}
                onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              >
                <option value="">— Select —</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-1">Category</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              >
                <option value="">— Select —</option>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-1">Title *</label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Food Hygiene Level 2"
              className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-1">Issued Date</label>
              <input
                type="date"
                value={form.issued_date}
                onChange={e => setForm(f => ({ ...f, issued_date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            </div>
            <div>
              <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-1">Expiry Date</label>
              <input
                type="date"
                value={form.expiry_date}
                onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Optional notes"
              className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 resize-none"
            />
          </div>

          <div>
            <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-1">Certificate / Document</label>
            <input
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              onChange={e => setFile(e.target.files[0] ?? null)}
              className="w-full text-sm text-charcoal/60 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-charcoal/15 file:text-xs file:bg-cream/50 file:text-charcoal/60 hover:file:bg-cream"
            />
            <p className="text-[11px] text-charcoal/35 mt-1">Upload certificates, diplomas, or training documents (PDF, images, Word docs).</p>
          </div>

          <button
            onClick={handleAdd}
            disabled={saving}
            className="bg-charcoal text-cream py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-charcoal/90 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Training Record →'}
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <select
          value={filterStaff}
          onChange={e => setFilterStaff(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-charcoal/15 bg-white text-xs text-charcoal/70 focus:outline-none focus:ring-2 focus:ring-charcoal/20"
        >
          <option value="">All Staff</option>
          {staff.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-charcoal/15 bg-white text-xs text-charcoal/70 focus:outline-none focus:ring-2 focus:ring-charcoal/20"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {(filterStaff || filterStatus || filterCategory) && (
          <button
            onClick={() => { setFilterStaff(''); setFilterStatus(''); setFilterCategory('') }}
            className="px-3 py-1.5 rounded-lg text-xs text-charcoal/40 hover:text-charcoal transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Records grouped by staff */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-charcoal/10 p-8 text-center">
          <p className="text-sm text-charcoal/40">
            {records.length === 0 ? 'No training records yet. Add the first one above.' : 'No records match your filters.'}
          </p>
        </div>
      ) : (
        Object.entries(byStaff).map(([name, recs]) => (
          <div key={name} className="bg-white rounded-xl border border-charcoal/10 overflow-hidden">
            <div className="px-5 py-3 bg-cream/40 border-b border-charcoal/8 flex items-center gap-3">
              {recs[0]?.staff?.photo_url ? (
                <img
                  src={recs[0].staff.photo_url}
                  alt={name}
                  className="w-8 h-8 rounded-full object-cover border border-charcoal/10"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-charcoal/10 flex items-center justify-center">
                  <span className="text-sm font-semibold text-charcoal/40">{name.charAt(0)}</span>
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-charcoal">{name}</p>
                <p className="text-[10px] tracking-widest uppercase text-charcoal/40">
                  {recs[0]?.staff?.job_role === 'kitchen' ? 'Kitchen' : recs[0]?.staff?.job_role === 'foh' ? 'Front of House' : recs[0]?.staff?.job_role ?? ''}
                  {' · '}{recs.length} record{recs.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <ul className="divide-y divide-charcoal/6">
              {recs.map(r => {
                const status = trainingStatus(r)
                return (
                  <li key={r.id} className="px-5 py-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-charcoal">{r.title}</p>
                        <StatusBadge status={status} />
                        {r.category && (
                          <span className="text-[10px] tracking-widest uppercase text-charcoal/30 border border-charcoal/10 px-1.5 py-0.5 rounded">
                            {r.category}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {r.issued_date && (
                          <p className="text-xs text-charcoal/40">
                            Issued: {format(parseISO(r.issued_date), 'dd MMM yyyy')}
                          </p>
                        )}
                        {r.expiry_date && (
                          <p className={`text-xs ${status === 'expired' ? 'text-red-500' : status === 'expiring' ? 'text-amber-500' : 'text-charcoal/40'}`}>
                            Expires: {format(parseISO(r.expiry_date), 'dd MMM yyyy')}
                          </p>
                        )}
                        {r.file_url && (
                          <a
                            href={r.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-accent underline underline-offset-2 hover:opacity-70 transition-opacity truncate max-w-[200px]"
                          >
                            {r.file_name ?? 'View certificate'}
                          </a>
                        )}
                      </div>
                      {r.notes && <p className="text-xs text-charcoal/40 mt-1 italic">{r.notes}</p>}
                    </div>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-xs text-charcoal/25 hover:text-red-500 transition-colors shrink-0 mt-0.5"
                    >
                      ✕
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))
      )}
    </div>
  )
}
