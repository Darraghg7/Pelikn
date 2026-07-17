import React, { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { useVenue } from '../../contexts/VenueContext'
import { useComplaints } from '../../hooks/useComplaints'
import { insertComplaint, updateComplaint } from '../../lib/api/complaints'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'

// ── Constants ─────────────────────────────────────────────────────────────────

const COMPLAINT_TYPES = [
  { value: 'food_illness',      label: 'Food-borne illness',    color: 'bg-red-50 text-red-700 border-red-200' },
  { value: 'allergen_reaction', label: 'Allergic reaction',     color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'foreign_body',      label: 'Foreign body in food',  color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'contamination',     label: 'Contamination / quality', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { value: 'other',             label: 'Other food safety issue', color: 'bg-charcoal/5 text-charcoal/60 border-charcoal/15' },
]

const typeInfo = (value) => COMPLAINT_TYPES.find(t => t.value === value) ?? COMPLAINT_TYPES[4]

const EMPTY = {
  date_received:        new Date().toISOString().slice(0, 10),
  complaint_type:       'food_illness',
  product_involved:     '',
  complainant_contact:  '',
  description:          '',
  investigation_notes:  '',
  outcome:              '',
  corrective_action:    '',
  resolved_at:          '',
}

// ── Data hook ─────────────────────────────────────────────────────────────────


// ── Complaint modal ───────────────────────────────────────────────────────────

function ComplaintModal({ open, onClose, editItem, venueId, onSaved }) {
  const toast = useToast()
  const [form, setForm]     = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setForm(editItem ? { ...EMPTY, ...editItem, resolved_at: editItem.resolved_at ?? '' } : { ...EMPTY, date_received: new Date().toISOString().slice(0, 10) })
  }, [open, editItem])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.description.trim()) { toast('Description is required', 'error'); return }
    setSaving(true)
    const payload = {
      venue_id:            venueId,
      date_received:       form.date_received,
      complaint_type:      form.complaint_type,
      product_involved:    form.product_involved.trim() || null,
      complainant_contact: form.complainant_contact.trim() || null,
      description:         form.description.trim(),
      investigation_notes: form.investigation_notes.trim() || null,
      outcome:             form.outcome.trim() || null,
      corrective_action:   form.corrective_action.trim() || null,
      resolved_at:         form.resolved_at || null,
    }
    const { error } = editItem
      ? await updateComplaint(editItem.id, payload)
      : await insertComplaint(payload)
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast(editItem ? 'Complaint updated' : 'Complaint logged')
    onSaved()
  }

  const Field = ({ label, required, children }) => (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] tracking-widest uppercase text-charcoal/40">
        {label}{required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
  const inp = 'px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20'
  const ta  = `${inp} resize-none`

  return (
    <Modal open={open} onClose={onClose} title={editItem ? 'Edit Complaint' : 'Log Food Safety Complaint'}>
      <div className="flex flex-col gap-4 p-5">

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date received" required>
            <input type="date" value={form.date_received} onChange={e => set('date_received', e.target.value)} className={inp} />
          </Field>
          <Field label="Complaint type" required>
            <select value={form.complaint_type} onChange={e => set('complaint_type', e.target.value)} className={inp}>
              {COMPLAINT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Product / dish involved">
          <input value={form.product_involved} onChange={e => set('product_involved', e.target.value)}
            placeholder="e.g. Chicken caesar wrap, batch 24-06" className={inp} />
        </Field>

        <Field label="Complainant contact (optional)">
          <input value={form.complainant_contact} onChange={e => set('complainant_contact', e.target.value)}
            placeholder="Name / email / phone — only if provided voluntarily" className={inp} />
        </Field>

        <Field label="Description of complaint" required>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3}
            placeholder="What did the customer report? When did they consume the product? Any symptoms?" className={ta} />
        </Field>

        <Field label="Investigation notes">
          <textarea value={form.investigation_notes} onChange={e => set('investigation_notes', e.target.value)} rows={2}
            placeholder="What was checked? Staff interviewed, batch records reviewed, etc." className={ta} />
        </Field>

        <Field label="Outcome">
          <textarea value={form.outcome} onChange={e => set('outcome', e.target.value)} rows={2}
            placeholder="What was established? Was a safety issue confirmed or ruled out?" className={ta} />
        </Field>

        <Field label="Corrective action taken">
          <textarea value={form.corrective_action} onChange={e => set('corrective_action', e.target.value)} rows={2}
            placeholder="What changes were made to prevent recurrence?" className={ta} />
        </Field>

        <Field label="Resolved on">
          <input type="date" value={form.resolved_at} onChange={e => set('resolved_at', e.target.value)} className={inp} />
        </Field>

        <button onClick={save} disabled={saving}
          className="w-full bg-charcoal text-cream py-2.5 rounded-xl text-sm font-semibold hover:bg-charcoal/90 transition-colors disabled:opacity-40">
          {saving ? 'Saving…' : editItem ? 'Save Changes' : 'Log Complaint'}
        </button>
      </div>
    </Modal>
  )
}

// ── Complaint card ────────────────────────────────────────────────────────────

function ComplaintCard({ item, onEdit }) {
  const resolved = !!item.resolved_at
  const info     = typeInfo(item.complaint_type)

  return (
    <div className={`bg-white rounded-2xl border overflow-hidden ${resolved ? 'border-charcoal/10' : 'border-danger/30'}`}>
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${info.color}`}>{info.label}</span>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                resolved ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
              }`}>
                {resolved ? 'Resolved' : 'Open'}
              </span>
            </div>
            <p className="text-xs text-charcoal/40 mt-1">
              Received {format(parseISO(item.date_received), 'd MMM yyyy')}
              {item.product_involved && <> · {item.product_involved}</>}
            </p>
          </div>
          <button onClick={() => onEdit(item)}
            className="text-xs text-charcoal/40 hover:text-charcoal border border-charcoal/12 hover:border-charcoal/25 px-3 py-1.5 rounded-lg transition-colors shrink-0">
            Edit
          </button>
        </div>

        <p className="text-sm text-charcoal leading-relaxed">{item.description}</p>

        {(item.investigation_notes || item.outcome || item.corrective_action) && (
          <div className="mt-3 pt-3 border-t border-charcoal/6 flex flex-col gap-1.5">
            {item.investigation_notes && (
              <div>
                <p className="text-[11px] tracking-widest uppercase text-charcoal/30">Investigation</p>
                <p className="text-xs text-charcoal/60 mt-0.5">{item.investigation_notes}</p>
              </div>
            )}
            {item.outcome && (
              <div>
                <p className="text-[11px] tracking-widest uppercase text-charcoal/30">Outcome</p>
                <p className="text-xs text-charcoal/60 mt-0.5">{item.outcome}</p>
              </div>
            )}
            {item.corrective_action && (
              <div>
                <p className="text-[11px] tracking-widest uppercase text-charcoal/30">Corrective action</p>
                <p className="text-xs text-charcoal/60 mt-0.5">{item.corrective_action}</p>
              </div>
            )}
            {resolved && (
              <p className="text-xs text-success/70 mt-0.5">
                Resolved {format(parseISO(item.resolved_at), 'd MMM yyyy')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ComplaintsPage() {
  const { venueId }                       = useVenue()
  const { complaints, loading, reload }   = useComplaints()
  const [showModal, setShowModal]         = useState(false)
  const [editItem, setEditItem]           = useState(null)
  const [filter, setFilter]              = useState('all')

  const openCount = complaints.filter(c => !c.resolved_at).length

  const filtered = complaints.filter(c => {
    if (filter === 'open')     return !c.resolved_at
    if (filter === 'resolved') return !!c.resolved_at
    return true
  })

  const openEdit  = (item) => { setEditItem(item); setShowModal(true) }
  const openNew   = ()     => { setEditItem(null);  setShowModal(true) }
  const onSaved   = ()     => { setShowModal(false); reload() }

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Food Safety Complaints</h1>
          <p className="text-sm text-charcoal/40 mt-1">
            Log and investigate illness reports, allergen reactions, and foreign body complaints
          </p>
        </div>
        <button onClick={openNew}
          className="bg-charcoal text-cream px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-charcoal/90 transition-colors shrink-0">
          + Log Complaint
        </button>
      </div>

      {/* Open alert banner */}
      {openCount > 0 && (
        <div className="bg-danger/8 border border-danger/20 rounded-xl px-5 py-3 flex items-center gap-3">
          <svg className="w-4 h-4 text-danger shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <p className="text-sm text-danger font-medium">
            {openCount} open complaint{openCount !== 1 ? 's' : ''} — investigate and resolve as soon as possible
          </p>
        </div>
      )}

      {/* EHO info */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 flex gap-3">
        <span className="text-blue-500 mt-0.5 shrink-0">ℹ</span>
        <p className="text-xs text-blue-700 leading-relaxed">
          EHOs expect a complete trail for every food safety complaint: complaint received → investigated → outcome established → corrective action taken → resolved. Records should be kept for a minimum of 3 years.
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-1 bg-charcoal/5 rounded-xl p-1 w-fit">
        {[
          { id: 'all',      label: 'All' },
          { id: 'open',     label: `Open${openCount > 0 ? ` (${openCount})` : ''}` },
          { id: 'resolved', label: 'Resolved' },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === f.id ? 'bg-white text-charcoal shadow-sm' : 'text-charcoal/50 hover:text-charcoal'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center pt-12"><LoadingSpinner size="md" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-charcoal/10 px-5 py-12 text-center">
          <p className="text-charcoal/40 text-sm">
            {filter === 'open' ? 'No open complaints.' : filter === 'resolved' ? 'No resolved complaints yet.' : 'No complaints logged yet.'}
          </p>
          {filter === 'all' && (
            <button onClick={openNew}
              className="mt-4 text-sm text-charcoal/50 hover:text-charcoal border border-charcoal/15 px-4 py-2 rounded-xl transition-colors">
              + Log first complaint
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(item => (
            <ComplaintCard key={item.id} item={item} onEdit={openEdit} />
          ))}
        </div>
      )}

      <ComplaintModal
        open={showModal}
        onClose={() => setShowModal(false)}
        editItem={editItem}
        venueId={venueId}
        onSaved={onSaved}
      />
    </div>
  )
}
