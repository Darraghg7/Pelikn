import React, { useState, useEffect } from 'react'
import { format, isPast, parseISO, differenceInDays } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { SkeletonList } from '../../components/ui/Skeleton'
import Modal from '../../components/ui/Modal'
import { Link } from 'react-router-dom'
import { CARD, TONE, TabBar } from '../../components/temperature/TempPageParts'
import SignaturePad from '../../components/ui/SignaturePad'
import AcknowledgeModal from '../../components/training/AcknowledgeModal'
import { sendPush } from '../../lib/sendPush'
import { useSignOffs, useCertRecords, useActiveStaff, useAllergenCerts } from '../../hooks/useTraining'
import { TRAINING_BUCKET, trainingFilePath, openTrainingFile } from '../../lib/trainingFiles'
import { insertSignOff, insertTrainingRecord, deleteTrainingRecord } from '../../lib/api/training'

// ── SC6 topic list (standard food safety induction) ───────────────────────────
const SC6_TOPICS = [
  'Personal hygiene: handwashing, illness reporting, protective clothing',
  'Food handling and storage: temperatures, use-by dates, labelling',
  'Cross-contamination prevention: raw/ready-to-eat separation',
  'Cooking and cooling temperatures: core temp verification',
  'Cleaning and disinfection: schedules, correct dilutions',
  'Allergen awareness: identification and communication to customers',
  'HACCP food safety management system overview',
  'Pest control: signs to report, entry point hygiene',
  'Waste management procedures',
  'Reporting illness, injury and accidents',
  'Opening and closing procedures',
  'Emergency procedures: fire, evacuation',
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



// ── Create SC6 record modal ───────────────────────────────────────────────────
function useEscapeKey(onClose) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])
}

function CreateSignOffModal({ staff, venueId, managerName, managerStaffId, onSaved, onClose }) {
  useEscapeKey(onClose)
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
    const { error } = await insertSignOff({
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
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-paperDark rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="px-6 py-5 border-b border-charcoal/8 dark:border-white/8 flex items-center justify-between sticky top-0 bg-white dark:bg-paperDark z-10">
          <div>
            <p className="font-semibold text-charcoal dark:text-white">New SC6 Training Record</p>
            <p className="text-xs text-charcoal/40 dark:text-white/35 mt-0.5">Induction &amp; on-the-job training sign-off</p>
          </div>
          <button onClick={onClose} className="text-charcoal/30 dark:text-white/30 hover:text-charcoal dark:hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {/* Staff + date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 block mb-1">Employee *</label>
              <select
                value={form.staff_id}
                onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
              >
                <option value="">Select</option>
                {staff.filter(s => s.id !== managerStaffId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 block mb-1">Training Date *</label>
              <input
                type="date"
                value={form.training_date}
                onChange={e => setForm(f => ({ ...f, training_date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
              />
            </div>
          </div>

          {/* Trainer */}
          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 block mb-1">Trainer Name *</label>
            <input
              value={form.trainer_name}
              onChange={e => setForm(f => ({ ...f, trainer_name: e.target.value }))}
              placeholder="Name of person delivering the training"
              className="w-full px-3 py-2 rounded-lg border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
            />
          </div>

          {/* Topics */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35">Training Topics *</label>
              <button onClick={allTopics} className="text-[11px] text-accent hover:text-accent/70 transition-colors">Select all</button>
            </div>
            <div className="flex flex-col gap-2">
              {SC6_TOPICS.map(t => (
                <label key={t} className="flex items-start gap-2.5 cursor-pointer group">
                  <span
                    onClick={() => toggleTopic(t)}
                    className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center text-[11px] transition-colors ${
                      form.topics.includes(t)
                        ? 'bg-charcoal border-charcoal dark:border-white text-cream'
                        : 'border-charcoal/25 dark:border-white/25 group-hover:border-charcoal/50 dark:group-hover:border-white/50'
                    }`}
                  >
                    {form.topics.includes(t) ? <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg> : ''}
                  </span>
                  <span
                    onClick={() => toggleTopic(t)}
                    className={`text-sm leading-snug ${form.topics.includes(t) ? 'text-charcoal dark:text-white' : 'text-charcoal/50 dark:text-white/40'}`}
                  >
                    {t}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 block mb-1">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Any additional context about this training session"
              className="w-full px-3 py-2 rounded-lg border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm resize-none focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
            />
          </div>

          {/* Manager signature */}
          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 block mb-2">Manager / Trainer Signature *</label>
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
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-charcoal/15 dark:border-white/15 text-sm text-charcoal/50 dark:text-white/40">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Staff acknowledgement modal ───────────────────────────────────────────────

// ── View sign-off detail modal ────────────────────────────────────────────────
function SignOffDetailModal({ record, venueId, onClose }) {
  useEscapeKey(onClose)
  const [sending, setSending] = useState(false)
  const [sent, setSent]       = useState(false)

  async function handleRemind() {
    setSending(true)
    await sendPush({
      venueId,
      staffIds: [record.staff_id],
      title: 'Training record to sign',
      body: `You have a training record from ${record.trainer_name} that needs your signature.`,
      url: '/training',
    })
    setSending(false)
    setSent(true)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-paperDark rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-charcoal/8 dark:border-white/8 flex items-center justify-between">
          <div>
            <p className="font-semibold text-charcoal dark:text-white">{record.staff?.name}</p>
            <p className="text-xs text-charcoal/40 dark:text-white/35 mt-0.5">
              {format(parseISO(record.training_date), 'd MMMM yyyy')} · Trainer: {record.trainer_name}
            </p>
          </div>
          <button onClick={onClose} className="text-charcoal/30 dark:text-white/30 hover:text-charcoal dark:hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          <div>
            <p className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 mb-3">Topics Covered</p>
            <ul className="flex flex-col gap-1.5">
              {record.topics.map(t => (
                <li key={t} className="flex items-start gap-2 text-sm text-charcoal/70 dark:text-white/60">
                  <span className="text-success mt-0.5 shrink-0"><svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg></span>{t}
                </li>
              ))}
            </ul>
          </div>

          {record.notes && (
            <div className="bg-white dark:bg-paperDark rounded-lg px-4 py-3">
              <p className="text-[11px] text-charcoal/40 dark:text-white/35 uppercase tracking-widest mb-1">Notes</p>
              <p className="text-sm text-charcoal/70 dark:text-white/60 italic">{record.notes}</p>
            </div>
          )}

          {record.manager_signature && (
            <div>
              <p className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 mb-2">
                Trainer Signature {record.manager_name ? `(${record.manager_name})` : ''}
              </p>
              <SignaturePad value={record.manager_signature} disabled />
            </div>
          )}

          {record.staff_acknowledged && record.staff_signature && (
            <div>
              <p className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 mb-2">
                Employee Signature — acknowledged {format(new Date(record.staff_acknowledged_at), 'd MMM yyyy, HH:mm')}
              </p>
              <SignaturePad value={record.staff_signature} disabled />
            </div>
          )}

          {!record.staff_acknowledged && (
            <div className="bg-warning/8 border border-warning/25 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-warning font-medium">Awaiting employee signature</p>
                <p className="text-xs text-warning/70 mt-0.5">
                  {record.staff?.name} needs to sign this record from their account.
                </p>
              </div>
              <button
                onClick={handleRemind}
                disabled={sending || sent}
                className="shrink-0 bg-warning text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-warning/90 transition-colors disabled:opacity-50"
              >
                {sent ? 'Reminder sent' : sending ? 'Sending…' : 'Send reminder'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Shared bits ───────────────────────────────────────────────────────────────
const FIELD_LABEL = 'block text-[13px] font-semibold tracking-[0.08em] uppercase text-ink3 dark:text-white/45 mb-2'
const TEXT_FIELD  = 'w-full h-12 px-4 rounded-xl border border-line dark:border-white/10 bg-cream dark:bg-white/5 text-[15px] text-ink dark:text-white placeholder:text-ink4 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40 focus:bg-white dark:focus:bg-white/10 transition-colors'
const PRIMARY_BTN = 'w-full h-[52px] rounded-2xl bg-brand text-white text-[17px] font-semibold transition-colors hover:bg-brand/90 disabled:bg-ink3/70 dark:disabled:bg-white/15 disabled:cursor-not-allowed'

const PILL = {
  signed:    { label: 'Signed',    cls: TONE.ok },
  awaiting:  { label: 'Awaiting',  cls: TONE.explained },
  valid:     { label: 'Valid',     cls: TONE.ok },
  expiring:  { label: 'Expiring',  cls: TONE.explained },
  expired:   { label: 'Expired',   cls: TONE.bad },
  compliant: { label: 'Compliant', cls: TONE.ok },
  due:       { label: 'Due',       cls: TONE.bad },
}

function Pill({ kind }) {
  const p = PILL[kind]
  return <span className={`shrink-0 h-8 px-3.5 rounded-full inline-flex items-center text-sm font-semibold ${p.cls}`}>{p.label}</span>
}

// "Eve Turbitt" → "ET", "Sarah" → "S"
function nameInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return parts.length === 1 ? parts[0][0].toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function Avatar({ name, photo, letters }) {
  return (
    <span className="shrink-0 w-14 h-14 rounded-full bg-line2 dark:bg-white/10 inline-flex items-center justify-center overflow-hidden text-[17px] font-semibold text-ink2 dark:text-white/80">
      {photo ? <img src={photo} alt="" className="w-full h-full object-cover" loading="lazy" /> : (letters ?? nameInitials(name))}
    </span>
  )
}

function FilterPill({ active, label, count, onClick }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        'h-11 px-4 rounded-full border inline-flex items-center gap-2 text-[15px] font-semibold transition-colors',
        active ? 'bg-brand border-brand text-white' : 'bg-white dark:bg-paperDark border-line dark:border-white/10 text-ink2 dark:text-white/75 hover:border-ink4',
      ].join(' ')}
    >
      {label}
      <span className={`font-mono text-sm ${active ? 'text-white/70' : 'text-ink4 dark:text-white/35'}`}>{count}</span>
    </button>
  )
}

function EmptyCard({ title, body }) {
  return (
    <div className={`${CARD} px-5 py-10 text-center`}>
      <p className="text-[17px] font-semibold text-ink dark:text-white">{title}</p>
      {body && <p className="text-sm text-ink3 dark:text-white/45 mt-1">{body}</p>}
    </div>
  )
}

function FileField({ label, onFile, accept }) {
  return (
    <label>
      <span className={FIELD_LABEL}>{label}</span>
      <input
        type="file"
        accept={accept}
        onChange={e => onFile(e.target.files?.[0] ?? null)}
        className="w-full text-sm text-ink2 dark:text-white/70 file:mr-3 file:h-10 file:px-4 file:rounded-xl file:border file:border-line dark:file:border-white/15 file:bg-white dark:file:bg-paperDark file:text-sm file:font-semibold file:text-ink2 dark:file:text-white/80"
      />
    </label>
  )
}

// ── Induction (SC6) tab ───────────────────────────────────────────────────────
function InductionTab({ venueId, isManager, session, showCreate, onCloseCreate }) {
  const { records, loading, reload } = useSignOffs()
  const staff = useActiveStaff()
  const [filter, setFilter]         = useState('all')
  const [viewRecord, setViewRecord] = useState(null)
  const [ackRecord, setAckRecord]   = useState(null)

  // Staff see their own records and any awaiting their signature
  const staffId = session?.staffId
  const pending = records.filter(r => r.staff_id === staffId && !r.staff_acknowledged)
  const visible = isManager ? records : records.filter(r => r.staff_id === staffId)

  const signedCount   = visible.filter(r => r.staff_acknowledged).length
  const awaitingCount = visible.length - signedCount
  const shown = visible.filter(r => filter === 'all' || (filter === 'signed' ? r.staff_acknowledged : !r.staff_acknowledged))

  if (loading) return <SkeletonList rows={4} className="py-4" />

  return (
    <div className="flex flex-col gap-4">
      {!isManager && pending.length > 0 && (
        <div className="rounded-2xl bg-warnBg dark:bg-warn/20 px-4 sm:px-5 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[16px] font-semibold text-ink dark:text-white">Training record awaiting your signature</p>
            <p className="text-sm text-ink2 dark:text-white/70 mt-0.5">
              {pending.length === 1
                ? `${pending[0].trainer_name} recorded training on ${format(parseISO(pending[0].training_date), 'd MMM yyyy')}`
                : `${pending.length} records need your signature`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAckRecord(pending[0])}
            className="shrink-0 h-11 px-4 rounded-xl bg-brand text-white text-[15px] font-semibold hover:bg-brand/90"
          >
            Sign now
          </button>
        </div>
      )}

      {visible.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <FilterPill active={filter === 'all'} label="All" count={visible.length} onClick={() => setFilter('all')} />
          <FilterPill active={filter === 'awaiting'} label="Awaiting" count={awaitingCount} onClick={() => setFilter('awaiting')} />
          <FilterPill active={filter === 'signed'} label="Signed" count={signedCount} onClick={() => setFilter('signed')} />
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyCard
          title="No induction records"
          body={isManager ? 'Tap New to record someone’s SC6 induction training.' : 'No training records on your account yet.'}
        />
      ) : shown.length === 0 ? (
        <EmptyCard title={filter === 'signed' ? 'Nothing signed yet' : 'Nothing awaiting signature'} />
      ) : (
        <div className={`${CARD} divide-y divide-line dark:divide-white/10 overflow-hidden`}>
          {shown.map(r => (
            <button
              key={r.id}
              type="button"
              onClick={() => isManager ? setViewRecord(r) : (r.staff_acknowledged ? setViewRecord(r) : setAckRecord(r))}
              className="w-full flex items-center gap-4 px-4 sm:px-5 py-4 text-left hover:bg-cream/60 dark:hover:bg-white/5 transition-colors"
            >
              <Avatar name={r.staff?.name ?? ''} photo={r.staff?.photo_url} />
              <span className="flex-1 min-w-0">
                <span className="block text-[19px] font-semibold text-ink dark:text-white truncate">{r.staff?.name ?? 'Unknown'}</span>
                <span className="block text-[15px] text-ink3 dark:text-white/45 mt-0.5 truncate">
                  {format(parseISO(r.training_date), 'd MMM yyyy')} · {r.topics.length} topic{r.topics.length !== 1 ? 's' : ''} · {r.trainer_name}
                </span>
              </span>
              <Pill kind={r.staff_acknowledged ? 'signed' : 'awaiting'} />
            </button>
          ))}
        </div>
      )}

      {showCreate && isManager && (
        <CreateSignOffModal
          staff={staff}
          venueId={venueId}
          managerName={session?.staffName}
          managerStaffId={session?.staffId}
          onSaved={() => { onCloseCreate(); reload() }}
          onClose={onCloseCreate}
        />
      )}
      {viewRecord && (
        <SignOffDetailModal record={viewRecord} venueId={venueId} onClose={() => setViewRecord(null)} />
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

// ── Certificates tab ──────────────────────────────────────────────────────────
const CERT_RANK = { expired: 0, expiring: 1, valid: 2 }

function CertificatesTab({ venueId, showCreate, onCloseCreate }) {
  const toast = useToast()
  const { records, loading, reload } = useCertRecords()
  const staff = useActiveStaff()

  const EMPTY_FORM = { staff_id: '', title: '', category: '', issued_date: '', expiry_date: '', notes: '' }
  const [form, setForm]     = useState(EMPTY_FORM)
  const [file, setFile]     = useState(null)
  const [saving, setSaving] = useState(false)
  const [viewing, setViewing]           = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const closeForm = () => { setForm(EMPTY_FORM); setFile(null); onCloseCreate() }

  const handleAdd = async () => {
    if (!form.staff_id)     { toast('Select a staff member', 'error'); return }
    if (!form.title.trim()) { toast('Title is required', 'error'); return }
    setSaving(true)
    let file_path = null, file_name = null
    if (file) {
      const path = trainingFilePath(venueId, form.staff_id, file.name)
      const { error: uploadErr } = await supabase.storage.from(TRAINING_BUCKET).upload(path, file, { upsert: false })
      if (uploadErr) { toast('File upload failed: ' + uploadErr.message, 'error'); setSaving(false); return }
      file_path = path
      file_name = file.name
    }
    const { error } = await insertTrainingRecord({
      staff_id: form.staff_id, title: form.title.trim(), category: form.category || null,
      issued_date: form.issued_date || null, expiry_date: form.expiry_date || null,
      notes: form.notes.trim() || null, file_name, venue_id: venueId,
    }, file_path)
    setSaving(false)
    if (error) {
      console.error('Training record insert failed:', error)
      toast("Certificate didn't upload, try again", 'error')
      return
    }
    toast('Certificate added')
    closeForm()
    reload()
  }

  const handleDelete = async (id) => {
    const { error } = await deleteTrainingRecord(id, venueId)
    if (error) { toast(error.message, 'error'); return }
    toast('Certificate deleted')
    setViewing(null)
    reload()
  }

  if (loading) return <SkeletonList rows={4} className="py-4" />

  // Expired first, then expiring soonest, then the rest by name
  const sorted = [...records].sort((a, b) => {
    const sa = certStatus(a), sb = certStatus(b)
    return CERT_RANK[sa] - CERT_RANK[sb]
      || (sa !== 'valid' ? (a.expiry_date ?? '').localeCompare(b.expiry_date ?? '') : 0)
      || (a.staff?.name ?? '').localeCompare(b.staff?.name ?? '')
  })

  return (
    <div className="flex flex-col gap-4">
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete certificate?"
        message={deleteTarget ? `Delete "${deleteTarget.title}" for ${deleteTarget.staff?.name ?? 'this person'}? This can't be undone.` : ''}
        confirmLabel="Delete"
        danger
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { handleDelete(deleteTarget.id); setDeleteTarget(null) }}
      />

      {sorted.length === 0 ? (
        <EmptyCard title="No certificates" body="Tap New to add someone’s food hygiene, first aid or other certificate." />
      ) : (
        <div className={`${CARD} divide-y divide-line dark:divide-white/10 overflow-hidden`}>
          {sorted.map(r => {
            const name = r.staff?.name ?? 'Unknown'
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setViewing(r)}
                className="w-full flex items-center gap-4 px-4 sm:px-5 py-4 text-left hover:bg-cream/60 dark:hover:bg-white/5 transition-colors"
              >
                <Avatar name={name} photo={r.staff?.photo_url} letters={name.charAt(0).toUpperCase()} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[17px] min-[420px]:text-[19px] leading-snug font-semibold text-ink dark:text-white line-clamp-2 break-words">{r.title}</span>
                  <span className="block text-[15px] text-ink3 dark:text-white/45 mt-0.5">
                    {name} · {r.expiry_date ? `expires ${format(parseISO(r.expiry_date), 'MMM yyyy')}` : 'no expiry'}
                  </span>
                </span>
                <Pill kind={certStatus(r)} />
              </button>
            )
          })}
        </div>
      )}

      {/* One certificate */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.title ?? ''}>
        {viewing && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 flex-wrap -mt-2">
              <Pill kind={certStatus(viewing)} />
              {viewing.category && <span className="text-sm text-ink3 dark:text-white/45">{viewing.category}</span>}
            </div>
            <dl className="grid grid-cols-2 gap-3 text-[15px]">
              <div><dt className={FIELD_LABEL}>Staff</dt><dd className="text-ink dark:text-white -mt-1">{viewing.staff?.name ?? 'Unknown'}</dd></div>
              <div><dt className={FIELD_LABEL}>Issued</dt><dd className="text-ink dark:text-white -mt-1">{viewing.issued_date ? format(parseISO(viewing.issued_date), 'd MMM yyyy') : '—'}</dd></div>
              <div><dt className={FIELD_LABEL}>Expires</dt><dd className="text-ink dark:text-white -mt-1">{viewing.expiry_date ? format(parseISO(viewing.expiry_date), 'd MMM yyyy') : 'No expiry'}</dd></div>
            </dl>
            {viewing.notes && <p className="text-[15px] text-ink2 dark:text-white/70">{viewing.notes}</p>}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(viewing)}
                className="h-12 rounded-xl border border-line dark:border-white/15 bg-white dark:bg-paperDark text-[16px] font-semibold text-bad dark:text-[#f19a86] hover:border-bad/40"
              >
                Delete
              </button>
              {(viewing.file_path || viewing.file_url) ? (
                <button
                  type="button"
                  onClick={() => openTrainingFile(viewing, toast)}
                  className="h-12 rounded-xl bg-brand text-white text-[16px] font-semibold hover:bg-brand/90"
                >
                  View certificate
                </button>
              ) : (
                <span className="h-12 rounded-xl bg-cream dark:bg-white/5 inline-flex items-center justify-center text-sm text-ink3 dark:text-white/45">No file attached</span>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Add a certificate */}
      <Modal open={showCreate} onClose={closeForm} title="New certificate">
        <div className="flex flex-col gap-5">
          <label>
            <span className={FIELD_LABEL}>Staff member</span>
            <select value={form.staff_id} onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))} className={TEXT_FIELD}>
              <option value="">Select</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label>
            <span className={FIELD_LABEL}>Title</span>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Food Hygiene Level 2" className={TEXT_FIELD} />
          </label>
          <label>
            <span className={FIELD_LABEL}>Category</span>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={TEXT_FIELD}>
              <option value="">Select</option>
              {CERT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className={FIELD_LABEL}>Issued</span>
              <input type="date" value={form.issued_date} onChange={e => setForm(f => ({ ...f, issued_date: e.target.value }))} className={TEXT_FIELD} />
            </label>
            <label>
              <span className={FIELD_LABEL}>Expires</span>
              <input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} className={TEXT_FIELD} />
            </label>
          </div>
          <FileField label="Certificate (optional)" accept="image/*,.pdf,.doc,.docx" onFile={setFile} />
          <button type="button" onClick={handleAdd} disabled={saving || !form.staff_id || !form.title.trim()} className={PRIMARY_BTN}>
            {saving ? 'Saving…' : 'Save certificate'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

// ── Allergen training tab ─────────────────────────────────────────────────────
function AllergenComplianceTab({ venueId, showCreate, onCloseCreate }) {
  const toast = useToast()
  const staff = useActiveStaff()
  const { certs, loading, reload } = useAllergenCerts()
  const [addFor, setAddFor] = useState(null)   // staff member, or {} to pick one
  const [pickedId, setPickedId] = useState('')
  const [form, setForm]     = useState({ issued_date: '', expiry_date: '', notes: '' })
  const [file, setFile]     = useState(null)
  const [saving, setSaving] = useState(false)

  // Latest cert per staff member
  const certByStaff = {}
  for (const c of certs) {
    if (!certByStaff[c.staff_id]) certByStaff[c.staff_id] = c
  }
  const isCompliant = (s) => { const c = certByStaff[s.id]; return !!c && certStatus(c) !== 'expired' }
  const compliantCount = staff.filter(isCompliant).length

  // Due first, then compliant; alphabetical within each
  const rows = [...staff].sort((a, b) => (isCompliant(a) - isCompliant(b)) || (a.name ?? '').localeCompare(b.name ?? ''))

  const openAdd = (s) => {
    setAddFor(s)
    setPickedId(s.id ?? '')
    setForm({ issued_date: format(new Date(), 'yyyy-MM-dd'), expiry_date: '', notes: '' })
    setFile(null)
  }
  // The page's New button opens the form without a person chosen
  useEffect(() => {
    if (showCreate) openAdd({})
  }, [showCreate])
  const closeAdd = () => { setAddFor(null); onCloseCreate() }

  const target = addFor?.id ? addFor : staff.find(s => s.id === pickedId)

  const save = async () => {
    if (!target) { toast('Select a staff member', 'error'); return }
    setSaving(true)
    let file_path = null, file_name = null
    if (file) {
      const path = trainingFilePath(venueId, target.id, file.name)
      const { error: uploadErr } = await supabase.storage.from(TRAINING_BUCKET).upload(path, file, { upsert: false })
      if (uploadErr) { toast('Upload failed: ' + uploadErr.message, 'error'); setSaving(false); return }
      file_path = path; file_name = file.name
    }
    const { error } = await insertTrainingRecord({
      staff_id: target.id, title: 'Allergen Awareness Training', category: 'allergen_awareness',
      issued_date: form.issued_date || null, expiry_date: form.expiry_date || null,
      notes: form.notes.trim() || null, file_name, venue_id: venueId,
    }, file_path)
    setSaving(false)
    if (error) {
      console.error('Allergen cert insert failed:', error)
      toast("Allergen training didn't save, try again", 'error')
      return
    }
    toast(`Allergen training recorded for ${target.name}`)
    closeAdd()
    reload()
  }

  if (loading) return <SkeletonList rows={4} className="py-4" />

  const pct = staff.length ? (compliantCount / staff.length) * 100 : 0

  return (
    <div className="flex flex-col gap-4">
      <div className={`${CARD} px-4 sm:px-5 py-4`}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[17px] font-semibold text-ink dark:text-white">Allergen training</p>
          <p className="font-mono text-[17px] font-semibold text-ink2 dark:text-white/80">{compliantCount}/{staff.length} trained</p>
        </div>
        <div className="mt-3 h-2 rounded-full bg-line2 dark:bg-white/10 overflow-hidden">
          <div className="h-full rounded-full bg-good" style={{ width: `${pct}%` }} />
        </div>
        {compliantCount < staff.length && (
          <p className="text-sm text-ink3 dark:text-white/45 mt-2.5">
            EHOs expect every food handler to have allergen awareness training (Natasha's Law, 2021).
          </p>
        )}
      </div>

      {staff.length === 0 ? (
        <EmptyCard title="No active staff" />
      ) : (
        <div className={`${CARD} divide-y divide-line dark:divide-white/10 overflow-hidden`}>
          {rows.map(s => {
            const cert = certByStaff[s.id]
            const expired = cert && certStatus(cert) === 'expired'
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => openAdd(s)}
                className="w-full flex items-center gap-3 px-4 sm:px-5 py-4 text-left hover:bg-cream/60 dark:hover:bg-white/5 transition-colors"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-[19px] font-semibold text-ink dark:text-white truncate">{s.name}</span>
                  <span className="block text-[15px] text-ink3 dark:text-white/45 mt-0.5">
                    {!cert
                      ? 'Not completed'
                      : expired
                        ? `Expired ${format(parseISO(cert.expiry_date), 'd MMM yyyy')}`
                        : cert.issued_date ? `Completed ${format(parseISO(cert.issued_date), 'd MMM yyyy')}` : 'Completed'}
                  </span>
                </span>
                {expired ? <Pill kind="expired" /> : <Pill kind={cert ? 'compliant' : 'due'} />}
              </button>
            )
          })}
        </div>
      )}

      <Modal open={!!addFor} onClose={closeAdd} title={addFor?.id ? `Allergen training · ${addFor.name}` : 'Allergen training'}>
        <div className="flex flex-col gap-5">
          {!addFor?.id && (
            <label>
              <span className={FIELD_LABEL}>Staff member</span>
              <select value={pickedId} onChange={e => setPickedId(e.target.value)} className={TEXT_FIELD}>
                <option value="">Select</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          )}
          {addFor?.id && certByStaff[addFor.id] && (
            <p className="text-[15px] text-ink2 dark:text-white/70 -mt-1">
              On record: {certByStaff[addFor.id].issued_date ? `completed ${format(parseISO(certByStaff[addFor.id].issued_date), 'd MMM yyyy')}` : 'completed'}
              {certByStaff[addFor.id].expiry_date && `, expires ${format(parseISO(certByStaff[addFor.id].expiry_date), 'd MMM yyyy')}`}. Saving adds a newer record.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className={FIELD_LABEL}>Completed</span>
              <input type="date" value={form.issued_date} onChange={e => setForm(f => ({ ...f, issued_date: e.target.value }))} className={TEXT_FIELD} />
            </label>
            <label>
              <span className={FIELD_LABEL}>Expires</span>
              <input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} className={TEXT_FIELD} />
            </label>
          </div>
          <FileField label="Certificate (optional)" accept=".pdf,.jpg,.jpeg,.png" onFile={setFile} />
          <label>
            <span className={FIELD_LABEL}>Notes</span>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Online course, in-house induction" className={TEXT_FIELD} />
          </label>
          <button type="button" onClick={save} disabled={saving || !target} className={PRIMARY_BTN}>
            {saving ? 'Saving…' : 'Save training'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'induction',    label: 'Induction' },
  { id: 'certificates', label: 'Certificates' },
  { id: 'allergen',     label: 'Allergens' },
]

export default function TrainingPage() {
  const { venueId, venueSlug } = useVenue()
  const { session, isManager } = useSession()
  const [tab, setTab] = useState('induction')
  const [creating, setCreating] = useState(null)   // tab id whose "New" form is open

  // Only managers create induction records; certificate/allergen entry follows
  // the page permission, same as before
  const canCreate = tab !== 'induction' || isManager
  const closeCreate = () => setCreating(null)

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="flex flex-col gap-1">
        {/* On mobile the shell's back row already links to Team */}
        <Link
          to={`/v/${venueSlug}/team`}
          className="hidden self-start lg:inline-flex items-center gap-1 text-[15px] font-semibold text-brand dark:text-white/80 hover:opacity-75 transition-opacity"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          Team
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl min-[420px]:text-[26px] sm:text-[32px] leading-tight font-bold tracking-tight text-ink dark:text-white">Staff training</h1>
            <p className="text-[15px] text-ink3 dark:text-white/45 mt-0.5">SC6 induction records &amp; certificates</p>
          </div>
          {canCreate && (
            <button
              type="button"
              onClick={() => setCreating(tab)}
              className="shrink-0 mt-1 h-11 px-5 rounded-xl bg-brand text-white text-[16px] font-semibold hover:bg-brand/90 transition-colors"
            >
              New
            </button>
          )}
        </div>
      </div>

      <TabBar tabs={TABS} active={tab} onChange={(id) => { setTab(id); setCreating(null) }} />

      {tab === 'induction' && (
        <InductionTab venueId={venueId} isManager={isManager} session={session} showCreate={creating === 'induction'} onCloseCreate={closeCreate} />
      )}
      {tab === 'certificates' && (
        <CertificatesTab venueId={venueId} showCreate={creating === 'certificates'} onCloseCreate={closeCreate} />
      )}
      {tab === 'allergen' && (
        <AllergenComplianceTab venueId={venueId} showCreate={creating === 'allergen'} onCloseCreate={closeCreate} />
      )}
    </div>
  )
}
