import React, { useState, useEffect, useCallback } from 'react'
import { format, isPast, parseISO, differenceInDays } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import { SkeletonList } from '../../components/ui/Skeleton'
import SignaturePad from '../../components/ui/SignaturePad'

// ── SC6 topic list (standard food safety induction) ───────────────────────────
const SC6_TOPICS = [
  'Personal hygiene — handwashing, illness reporting, protective clothing',
  'Food handling and storage — temperatures, use-by dates, labelling',
  'Cross-contamination prevention — raw/ready-to-eat separation',
  'Cooking and cooling temperatures — core temp verification',
  'Cleaning and disinfection — schedules, correct dilutions',
  'Allergen awareness — identification and communication to customers',
  'HACCP food safety management system overview',
  'Pest control — signs to report, entry point hygiene',
  'Waste management procedures',
  'Reporting illness, injury and accidents',
  'Opening and closing procedures',
  'Emergency procedures — fire, evacuation',
]

const CERT_CATEGORIES = [
  'Food Safety', 'HACCP', 'Manual Handling', 'Fire Safety',
  'First Aid', 'Allergen Awareness', 'Customer Service', 'Other',
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function certStatus(record) {
  if (!record.expiry_date) return 'valid'
  const expiry = parseISO(record.expiry_date)
  if (isPast(expiry)) return 'expired'
  if (differenceInDays(expiry, new Date()) <= 30) return 'expiring'
  return 'valid'
}

function StatusBadge({ status }) {
  const styles = { expired: 'bg-danger/8 text-danger', expiring: 'bg-warning/8 text-warning', valid: 'bg-success/8 text-success' }
  const labels = { expired: 'Expired', expiring: 'Expiring Soon', valid: 'Valid' }
  return (
    <span className={`text-[11px] tracking-widest uppercase font-medium px-1.5 py-0.5 rounded ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// ── Data hooks ────────────────────────────────────────────────────────────────
function useSignOffs(venueId) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    if (!venueId) return
    setLoading(true)
    const { data } = await supabase
      .from('training_sign_offs')
      .select('*, staff:staff_id(id, name, job_role, photo_url)')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
    setRecords(data ?? [])
    setLoading(false)
  }, [venueId])
  useEffect(() => { load() }, [load])
  return { records, loading, reload: load }
}

function useCertRecords(venueId) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
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
  const [staff, setStaff] = useState([])
  useEffect(() => {
    if (!venueId) return
    supabase.from('staff').select('id, name, job_role, photo_url').eq('venue_id', venueId).eq('is_active', true).order('name')
      .then(({ data }) => setStaff(data ?? []))
  }, [venueId])
  return staff
}

// ── Create SC6 record modal ───────────────────────────────────────────────────
function CreateSignOffModal({ staff, venueId, managerName, onSaved, onClose }) {
  const toast = useToast()
  const today = format(new Date(), 'yyyy-MM-dd')
  const [form, setForm] = useState({
    staff_id:      '',
    training_date: today,
    trainer_name:  managerName ?? '',
    topics:        [],
    notes:         '',
  })
  const [managerSig, setManagerSig] = useState(null)
  const [saving, setSaving]         = useState(false)

  const toggleTopic = (t) =>
    setForm(f => ({
      ...f,
      topics: f.topics.includes(t) ? f.topics.filter(x => x !== t) : [...f.topics, t],
    }))

  const allTopics = () => setForm(f => ({ ...f, topics: SC6_TOPICS }))

  const handleSave = async () => {
    if (!form.staff_id)           { toast('Select a staff member', 'error'); return }
    if (form.topics.length === 0) { toast('Select at least one training topic', 'error'); return }
    if (!form.trainer_name.trim()) { toast('Trainer name is required', 'error'); return }
    if (!managerSig)              { toast('Manager signature is required', 'error'); return }

    setSaving(true)
    const { error } = await supabase.from('training_sign_offs').insert({
      venue_id:          venueId,
      staff_id:          form.staff_id,
      training_date:     form.training_date,
      trainer_name:      form.trainer_name.trim(),
      topics:            form.topics,
      notes:             form.notes.trim() || null,
      manager_name:      managerName ?? null,
      manager_signature: managerSig,
      staff_acknowledged: false,
    })
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    const member = staff.find(s => s.id === form.staff_id)
    toast(`Training record sent to ${member?.name ?? 'staff member'} for signature`)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="px-6 py-5 border-b border-charcoal/8 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <p className="font-semibold text-charcoal">New SC6 Training Record</p>
            <p className="text-xs text-charcoal/40 mt-0.5">Induction &amp; on-the-job training sign-off</p>
          </div>
          <button onClick={onClose} className="text-charcoal/30 hover:text-charcoal text-xl leading-none">×</button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {/* Staff + date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">Employee *</label>
              <select
                value={form.staff_id}
                onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              >
                <option value="">— Select —</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">Training Date *</label>
              <input
                type="date"
                value={form.training_date}
                onChange={e => setForm(f => ({ ...f, training_date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            </div>
          </div>

          {/* Trainer */}
          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">Trainer Name *</label>
            <input
              value={form.trainer_name}
              onChange={e => setForm(f => ({ ...f, trainer_name: e.target.value }))}
              placeholder="Name of person delivering the training"
              className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>

          {/* Topics */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40">Training Topics *</label>
              <button onClick={allTopics} className="text-[11px] text-accent hover:text-accent/70 transition-colors">Select all</button>
            </div>
            <div className="flex flex-col gap-2">
              {SC6_TOPICS.map(t => (
                <label key={t} className="flex items-start gap-2.5 cursor-pointer group">
                  <span
                    onClick={() => toggleTopic(t)}
                    className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center text-[10px] transition-colors ${
                      form.topics.includes(t)
                        ? 'bg-charcoal border-charcoal text-cream'
                        : 'border-charcoal/25 group-hover:border-charcoal/50'
                    }`}
                  >
                    {form.topics.includes(t) ? <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg> : ''}
                  </span>
                  <span
                    onClick={() => toggleTopic(t)}
                    className={`text-sm leading-snug ${form.topics.includes(t) ? 'text-charcoal' : 'text-charcoal/50'}`}
                  >
                    {t}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Any additional context about this training session"
              className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>

          {/* Manager signature */}
          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">Manager / Trainer Signature *</label>
            <SignaturePad onChange={setManagerSig} />
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-charcoal text-cream py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-charcoal/90 transition-colors"
          >
            {saving ? 'Saving…' : 'Send for Staff Signature →'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-charcoal/15 text-sm text-charcoal/50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Staff acknowledgement modal ───────────────────────────────────────────────
function AcknowledgeModal({ record, staffName, onSaved, onClose }) {
  const toast   = useToast()
  const [staffSig, setStaffSig] = useState(null)
  const [saving, setSaving]     = useState(false)

  const handleSubmit = async () => {
    if (!staffSig) { toast('Please sign to confirm you received this training', 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('training_sign_offs').update({
      staff_acknowledged:    true,
      staff_acknowledged_at: new Date().toISOString(),
      staff_signature:       staffSig,
    }).eq('id', record.id)
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Training record signed ✓')
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-charcoal/8 flex items-center justify-between">
          <div>
            <p className="font-semibold text-charcoal">Training Record — Sign to Confirm</p>
            <p className="text-xs text-charcoal/40 mt-0.5">
              {format(parseISO(record.training_date), 'd MMMM yyyy')} · Trainer: {record.trainer_name}
            </p>
          </div>
          <button onClick={onClose} className="text-charcoal/30 hover:text-charcoal text-xl leading-none">×</button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {/* Topics */}
          <div>
            <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-3">Training Covered</p>
            <ul className="flex flex-col gap-1.5">
              {record.topics.map(t => (
                <li key={t} className="flex items-start gap-2 text-sm text-charcoal">
                  <span className="text-success mt-0.5 shrink-0"><svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg></span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {record.notes && (
            <div className="bg-white rounded-lg px-4 py-3">
              <p className="text-[11px] text-charcoal/40 uppercase tracking-widest mb-1">Notes</p>
              <p className="text-sm text-charcoal/70 italic">{record.notes}</p>
            </div>
          )}

          {/* Manager signature */}
          {record.manager_signature && (
            <div>
              <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-2">
                Manager / Trainer Signature {record.manager_name ? `(${record.manager_name})` : ''}
              </p>
              <SignaturePad value={record.manager_signature} disabled />
            </div>
          )}

          {/* Staff signature */}
          <div>
            <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-1">Your Signature — {staffName}</p>
            <p className="text-xs text-charcoal/40 mb-2">
              By signing, you confirm you have received and understood the above training.
            </p>
            <SignaturePad onChange={setStaffSig} />
          </div>
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={handleSubmit}
            disabled={saving || !staffSig}
            className="w-full bg-charcoal text-cream py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-charcoal/90 transition-colors"
          >
            {saving ? 'Saving…' : 'I confirm I have received this training →'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── View sign-off detail modal ────────────────────────────────────────────────
function SignOffDetailModal({ record, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-charcoal/8 flex items-center justify-between">
          <div>
            <p className="font-semibold text-charcoal">{record.staff?.name}</p>
            <p className="text-xs text-charcoal/40 mt-0.5">
              {format(parseISO(record.training_date), 'd MMMM yyyy')} · Trainer: {record.trainer_name}
            </p>
          </div>
          <button onClick={onClose} className="text-charcoal/30 hover:text-charcoal text-xl leading-none">×</button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          <div>
            <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-3">Topics Covered</p>
            <ul className="flex flex-col gap-1.5">
              {record.topics.map(t => (
                <li key={t} className="flex items-start gap-2 text-sm text-charcoal/70">
                  <span className="text-success mt-0.5 shrink-0"><svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg></span>{t}
                </li>
              ))}
            </ul>
          </div>

          {record.notes && (
            <div className="bg-white rounded-lg px-4 py-3">
              <p className="text-[11px] text-charcoal/40 uppercase tracking-widest mb-1">Notes</p>
              <p className="text-sm text-charcoal/70 italic">{record.notes}</p>
            </div>
          )}

          {record.manager_signature && (
            <div>
              <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-2">
                Trainer Signature {record.manager_name ? `(${record.manager_name})` : ''}
              </p>
              <SignaturePad value={record.manager_signature} disabled />
            </div>
          )}

          {record.staff_acknowledged && record.staff_signature && (
            <div>
              <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-2">
                Employee Signature — acknowledged {format(new Date(record.staff_acknowledged_at), 'd MMM yyyy, HH:mm')}
              </p>
              <SignaturePad value={record.staff_signature} disabled />
            </div>
          )}

          {!record.staff_acknowledged && (
            <div className="bg-warning/8 border border-warning/25 rounded-lg px-4 py-3">
              <p className="text-sm text-warning font-medium">Awaiting employee signature</p>
              <p className="text-xs text-warning/70 mt-0.5">
                {record.staff?.name} needs to sign this record from their account.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── SC6 Induction Records tab ─────────────────────────────────────────────────
function InductionTab({ venueId, isManager, session }) {
  const toast = useToast()
  const { records, loading, reload } = useSignOffs(venueId)
  const staff    = useActiveStaff(venueId)
  const [showCreate, setShowCreate]   = useState(false)
  const [viewRecord, setViewRecord]   = useState(null)
  const [ackRecord, setAckRecord]     = useState(null)

  // For staff: show their pending sign-offs
  const staffId = session?.staffId
  const pending  = records.filter(r => r.staff_id === staffId && !r.staff_acknowledged)
  const myRecords = records.filter(r => r.staff_id === staffId)

  if (loading) return <SkeletonList rows={4} className="py-4" />

  return (
    <div className="flex flex-col gap-5">
      {/* Staff: pending banner */}
      {!isManager && pending.length > 0 && (
        <div className="bg-accent/10 border border-accent/20 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-accent">Training record awaiting your signature</p>
            <p className="text-xs text-accent/70 mt-0.5">
              {pending.length === 1
                ? `${pending[0].trainer_name} recorded training on ${format(parseISO(pending[0].training_date), 'd MMM yyyy')}`
                : `${pending.length} records need your signature`}
            </p>
          </div>
          <button
            onClick={() => setAckRecord(pending[0])}
            className="bg-accent text-white px-4 py-2 rounded-lg text-xs font-medium shrink-0 hover:bg-accent/90 transition-colors"
          >
            Sign now →
          </button>
        </div>
      )}

      {/* Manager controls */}
      {isManager && (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-charcoal/40">
              {records.filter(r => r.staff_acknowledged).length} signed · {records.filter(r => !r.staff_acknowledged).length} awaiting
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-charcoal text-cream px-4 py-2 rounded-lg text-sm font-medium hover:bg-charcoal/90 transition-colors"
          >
            + New Record
          </button>
        </div>
      )}

      {/* Records list */}
      {(isManager ? records : myRecords).length === 0 ? (
        <EmptyState
          icon="clipboard"
          title="No training records"
          description={isManager ? 'Create the first training record to get started.' : 'No training records on your account yet.'}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {(isManager ? records : myRecords).map(r => (
            <button
              key={r.id}
              onClick={() => isManager ? setViewRecord(r) : (r.staff_acknowledged ? setViewRecord(r) : setAckRecord(r))}
              className="bg-white rounded-2xl border-charcoal/10 px-5 py-4 flex items-center gap-4 text-left hover:border-charcoal/25 transition-colors w-full"
            >
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-charcoal/10 flex items-center justify-center shrink-0">
                {r.staff?.photo_url
                  ? <img src={r.staff.photo_url} alt="" className="w-9 h-9 rounded-full object-cover" loading="lazy" />
                  : <span className="text-sm font-semibold text-charcoal/40">{initials(r.staff?.name)}</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-charcoal">{r.staff?.name ?? 'Unknown'}</p>
                  {r.staff_acknowledged ? (
                    <span className="text-[11px] tracking-widest uppercase font-medium px-1.5 py-0.5 rounded bg-success/8 text-success">
                      <span className="inline-flex items-center gap-0.5">Signed <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg></span>
                    </span>
                  ) : (
                    <span className="text-[11px] tracking-widest uppercase font-medium px-1.5 py-0.5 rounded bg-warning/8 text-warning">
                      Awaiting Signature
                    </span>
                  )}
                </div>
                <p className="text-xs text-charcoal/40 mt-0.5">
                  {format(parseISO(r.training_date), 'd MMM yyyy')} · {r.topics.length} topic{r.topics.length !== 1 ? 's' : ''} · Trainer: {r.trainer_name}
                </p>
                {r.staff_acknowledged && r.staff_acknowledged_at && (
                  <p className="text-[11px] text-charcoal/30 mt-0.5">
                    Signed {format(new Date(r.staff_acknowledged_at), 'd MMM yyyy, HH:mm')}
                  </p>
                )}
              </div>
              <span className="text-charcoal/25 text-sm shrink-0">›</span>
            </button>
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateSignOffModal
          staff={staff}
          venueId={venueId}
          managerName={session?.staffName}
          onSaved={() => { setShowCreate(false); reload() }}
          onClose={() => setShowCreate(false)}
        />
      )}
      {viewRecord && (
        <SignOffDetailModal record={viewRecord} onClose={() => setViewRecord(null)} />
      )}
      {ackRecord && (
        <AcknowledgeModal
          record={ackRecord}
          staffName={session?.staffName}
          onSaved={() => { setAckRecord(null); reload() }}
          onClose={() => setAckRecord(null)}
        />
      )}
    </div>
  )
}

// ── Certificates tab (existing feature) ───────────────────────────────────────
function CertificatesTab({ venueId }) {
  const toast   = useToast()
  const { records, loading, reload } = useCertRecords(venueId)
  const staff   = useActiveStaff(venueId)

  const EMPTY_FORM = { staff_id: '', title: '', category: '', issued_date: '', expiry_date: '', notes: '' }
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [file, setFile]         = useState(null)
  const [saving, setSaving]     = useState(false)

  const handleAdd = async () => {
    if (!form.staff_id)     { toast('Select a staff member', 'error'); return }
    if (!form.title.trim()) { toast('Title is required', 'error'); return }
    setSaving(true)
    let file_url = null, file_name = null
    if (file) {
      const ext  = file.name.split('.').pop()
      const path = `${venueId}/${form.staff_id}/${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('training-files').upload(path, file, { upsert: false })
      if (uploadErr) { toast('File upload failed: ' + uploadErr.message, 'error'); setSaving(false); return }
      const { data: urlData } = supabase.storage.from('training-files').getPublicUrl(path)
      file_url = urlData.publicUrl
      file_name = file.name
    }
    const { error } = await supabase.from('staff_training').insert({
      staff_id: form.staff_id, title: form.title.trim(), category: form.category || null,
      issued_date: form.issued_date || null, expiry_date: form.expiry_date || null,
      notes: form.notes.trim() || null, file_url, file_name, venue_id: venueId,
    })
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Certificate added')
    setForm(EMPTY_FORM); setFile(null); setShowForm(false); reload()
  }

  const handleDelete = async (id) => {
    const { error } = await supabase.from('staff_training').delete().eq('id', id).eq('venue_id', venueId)
    if (error) { toast(error.message, 'error'); return }
    toast('Record deleted'); reload()
  }

  if (loading) return <SkeletonList rows={4} className="py-4" />

  const byStaff = {}
  for (const r of records) {
    const name = r.staff?.name ?? 'Unknown'
    if (!byStaff[name]) byStaff[name] = []
    byStaff[name].push(r)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(f => !f)}
          className="bg-charcoal text-cream px-4 py-2 rounded-lg text-sm font-medium hover:bg-charcoal/90 transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add Certificate'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border-charcoal/10 p-6 flex flex-col gap-4">
          <p className="text-sm font-semibold text-charcoal">New Training Certificate</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">Staff Member *</label>
              <select value={form.staff_id} onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20">
                <option value="">— Select —</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20">
                <option value="">— Select —</option>
                {CERT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
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
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">Certificate / Document</label>
            <input type="file" accept="image/*,.pdf,.doc,.docx"
              onChange={e => setFile(e.target.files[0] ?? null)}
              className="w-full text-sm text-charcoal/60 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-charcoal/15 file:text-xs file:bg-white file:text-charcoal/60 hover:file:bg-cream" />
          </div>
          <button onClick={handleAdd} disabled={saving}
            className="bg-charcoal text-cream py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-charcoal/90 transition-colors">
            {saving ? 'Saving…' : 'Save Certificate →'}
          </button>
        </div>
      )}

      {Object.keys(byStaff).length === 0 ? (
        <EmptyState
          icon="clipboard"
          title="No certificates"
          description="Add the first certificate above to start tracking."
        />
      ) : (
        Object.entries(byStaff).map(([name, recs]) => (
          <div key={name} className="bg-white rounded-2xl border-charcoal/10 overflow-hidden">
            <div className="px-5 py-3 bg-white border-b border-charcoal/8 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-charcoal/10 flex items-center justify-center">
                {recs[0]?.staff?.photo_url
                  ? <img src={recs[0].staff.photo_url} alt={name} className="w-8 h-8 rounded-full object-cover" loading="lazy" />
                  : <span className="text-sm font-semibold text-charcoal/40">{name.charAt(0)}</span>}
              </div>
              <div>
                <p className="text-sm font-semibold text-charcoal">{name}</p>
                <p className="text-[11px] tracking-widest uppercase text-charcoal/40">{recs.length} record{recs.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <ul className="divide-y divide-charcoal/6">
              {recs.map(r => {
                const status = certStatus(r)
                return (
                  <li key={r.id} className="px-5 py-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-charcoal">{r.title}</p>
                        <StatusBadge status={status} />
                        {r.category && (
                          <span className="text-[11px] tracking-widest uppercase text-charcoal/30 border border-charcoal/10 px-1.5 py-0.5 rounded">{r.category}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {r.issued_date && <p className="text-xs text-charcoal/40">Issued: {format(parseISO(r.issued_date), 'dd MMM yyyy')}</p>}
                        {r.expiry_date && (
                          <p className={`text-xs ${status === 'expired' ? 'text-danger' : status === 'expiring' ? 'text-warning' : 'text-charcoal/40'}`}>
                            Expires: {format(parseISO(r.expiry_date), 'dd MMM yyyy')}
                          </p>
                        )}
                        {r.file_url && (
                          <a href={r.file_url} target="_blank" rel="noreferrer"
                            className="text-xs text-accent underline underline-offset-2 hover:opacity-70 transition-opacity truncate max-w-[200px]">
                            {r.file_name ?? 'View certificate'}
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
          </div>
        ))
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TrainingPage() {
  const { venueId } = useVenue()
  const { session, isManager } = useSession()
  const [tab, setTab] = useState('induction')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Staff Training</h1>
          <p className="text-sm text-charcoal/40 mt-1">SC6 induction records &amp; certificates</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-charcoal/5 rounded-xl p-1 w-fit">
        {[
          { id: 'induction',    label: 'Induction Records' },
          { id: 'certificates', label: 'Certificates' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? 'bg-white text-charcoal shadow-sm' : 'text-charcoal/50 hover:text-charcoal'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'induction'
        ? <InductionTab venueId={venueId} isManager={isManager} session={session} />
        : <CertificatesTab venueId={venueId} />
      }
    </div>
  )
}
