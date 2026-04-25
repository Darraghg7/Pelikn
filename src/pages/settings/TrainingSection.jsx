import React, { useState } from 'react'
import { format, isPast, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useStaffTraining } from '../../hooks/useTraining'

const EMPTY_TRAINING = { title: '', issued_date: '', expiry_date: '', notes: '' }

/* ── Training section ───────────────────────────────────────────────────────── */
export default function TrainingSection({ staffId }) {
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
              className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">Issued Date</label>
              <input type="date" value={form.issued_date} onChange={e => setForm(f => ({ ...f, issued_date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20" />
            </div>
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">Expiry Date</label>
              <input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20" />
            </div>
          </div>
          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} placeholder="Optional notes"
              className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 resize-none" />
          </div>
          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">Certificate / File</label>
            <input type="file" accept="image/*,.pdf"
              onChange={e => setFile(e.target.files[0] ?? null)}
              className="w-full text-sm text-charcoal/60 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-charcoal/15 file:text-xs file:bg-white file:text-charcoal/60 hover:file:bg-cream" />
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
              <li key={r.id} className="flex items-start justify-between gap-3 rounded-lg border border-charcoal/8 bg-white px-4 py-3">
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
                  className="text-charcoal/25 hover:text-danger transition-colors shrink-0 mt-0.5"><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
