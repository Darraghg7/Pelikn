import React, { useState, useEffect, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'

// ── Procedure sections definition ─────────────────────────────────────────────

const PROC_SECTIONS = [
  {
    key: 'identification',
    title: '1. Identification',
    desc: 'What triggers this procedure and who decides?',
    rows: 4,
    default:
      'A recall or withdrawal is required when:\n' +
      '• A product is found to be unsafe (biological, chemical, or physical hazard)\n' +
      '• A supplier or the FSA issues an alert affecting our stock\n' +
      '• A customer complaint indicates a potential safety issue\n' +
      '• Incorrect labelling or undeclared allergens are discovered\n\n' +
      'The responsible manager listed above has authority to initiate a recall at any time.',
  },
  {
    key: 'notification',
    title: '2. Immediate Notification',
    desc: 'Who to contact in the first few hours.',
    rows: 5,
    default:
      '1. Stop sale of the affected product immediately.\n' +
      '2. Notify the FSA: fsa.gov.uk or 0808 200 4024.\n' +
      '3. Contact the local Environmental Health Officer (EHO) — see contact above.\n' +
      '4. Inform the supplier or manufacturer and request full batch information.\n' +
      '5. Notify senior management or head office (if applicable).',
  },
  {
    key: 'customer',
    title: '3. Customer Notification',
    desc: 'How to reach affected customers if required.',
    rows: 4,
    default:
      'If customers may have purchased or consumed the affected product:\n' +
      '• Display a clear in-store notice at point of sale.\n' +
      '• Post an alert on the venue\'s social media.\n' +
      '• Contact customers directly where booking or contact data is available.\n' +
      '• Offer a full refund — no receipt required.\n\n' +
      'All customer-facing communications must be approved by the responsible manager before publication.',
  },
  {
    key: 'quarantine',
    title: '4. Stock Quarantine & Disposal',
    desc: 'How to handle affected stock safely.',
    rows: 4,
    default:
      '1. Remove all affected product from service and sale immediately.\n' +
      '2. Segregate and clearly label: "DO NOT USE — Product Alert".\n' +
      '3. Do not dispose of stock until instructed by the FSA or EHO — batches may need to be returned for testing.\n' +
      '4. Record exact quantities quarantined and lot/batch numbers.\n' +
      '5. Once authorised, dispose safely and record method and date of disposal.',
  },
  {
    key: 'investigation',
    title: '5. Investigation & Root Cause',
    desc: 'How to establish what went wrong.',
    rows: 3,
    default:
      '• Work with the supplier to identify the root cause.\n' +
      '• Review delivery records, temperature logs, and staff sign-offs for the affected batch.\n' +
      '• Document findings in writing.\n' +
      '• Implement corrective action to prevent recurrence — log in Pelikn Corrective Actions.',
  },
  {
    key: 'records',
    title: '6. Record Keeping',
    desc: 'Documentation obligations after any incident.',
    rows: 3,
    default:
      'All recall and withdrawal events must be recorded in the Recall Log in Pelikn, including:\n' +
      '• Date identified, product name, batch/lot number, supplier, and reason.\n' +
      '• Actions taken and who was notified.\n' +
      '• Resolution date and outcome.\n\n' +
      'All records must be retained for a minimum of 2 years.',
  },
]

const DEFAULT_SECTIONS = Object.fromEntries(PROC_SECTIONS.map(s => [s.key, s.default]))

// ── Data hooks ────────────────────────────────────────────────────────────────

function useRecallProcedure(venueId) {
  const [procedure, setProcedure] = useState(null)
  const [loading, setLoading]     = useState(true)

  const load = useCallback(async () => {
    if (!venueId) return
    setLoading(true)
    const { data } = await supabase
      .from('recall_procedures')
      .select('*')
      .eq('venue_id', venueId)
      .maybeSingle()
    setProcedure(data)
    setLoading(false)
  }, [venueId])

  useEffect(() => { load() }, [load])
  return { procedure, loading, reload: load }
}

function useRecallLogs(venueId) {
  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!venueId) return
    setLoading(true)
    const { data } = await supabase
      .from('recall_logs')
      .select('*')
      .eq('venue_id', venueId)
      .order('date_identified', { ascending: false })
      .limit(200)
    setLogs(data ?? [])
    setLoading(false)
  }, [venueId])

  useEffect(() => { load() }, [load])
  return { logs, loading, reload: load }
}

// ── Log form modal ────────────────────────────────────────────────────────────

const EMPTY_LOG = {
  date_identified: new Date().toISOString().slice(0, 10),
  product_name:    '',
  batch_lot_number: '',
  reason:          '',
  action_taken:    '',
  who_notified:    '',
  resolved_at:     '',
  notes:           '',
}

function LogModal({ open, onClose, onSaved, venueId, editLog }) {
  const toast = useToast()
  const [form, setForm] = useState(EMPTY_LOG)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setForm(editLog ? {
      ...EMPTY_LOG,
      ...editLog,
      date_identified: editLog.date_identified?.slice(0, 10) ?? EMPTY_LOG.date_identified,
      resolved_at:     editLog.resolved_at?.slice(0, 10) ?? '',
    } : EMPTY_LOG)
  }, [open, editLog])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.product_name.trim()) { toast('Product name is required', 'error'); return }
    if (!form.reason.trim())       { toast('Reason is required', 'error'); return }
    if (!form.action_taken.trim()) { toast('Action taken is required', 'error'); return }
    setSaving(true)

    const payload = {
      venue_id:         venueId,
      date_identified:  form.date_identified,
      product_name:     form.product_name.trim(),
      batch_lot_number: form.batch_lot_number.trim() || null,
      reason:           form.reason.trim(),
      action_taken:     form.action_taken.trim(),
      who_notified:     form.who_notified.trim() || null,
      resolved_at:      form.resolved_at || null,
      notes:            form.notes.trim() || null,
    }

    const { error } = editLog
      ? await supabase.from('recall_logs').update(payload).eq('id', editLog.id)
      : await supabase.from('recall_logs').insert(payload)

    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast(editLog ? 'Recall log updated' : 'Recall log created')
    onSaved()
  }

  const Field = ({ label, required, children }) => (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] tracking-widest uppercase text-charcoal/40">
        {label}{required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )

  const Input = ({ k, ...rest }) => (
    <input
      value={form[k]}
      onChange={e => set(k, e.target.value)}
      className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm text-charcoal placeholder-charcoal/25 focus:outline-none focus:ring-2 focus:ring-charcoal/20"
      {...rest}
    />
  )

  const Textarea = ({ k, rows = 3, ...rest }) => (
    <textarea
      value={form[k]}
      onChange={e => set(k, e.target.value)}
      rows={rows}
      className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm text-charcoal placeholder-charcoal/25 focus:outline-none focus:ring-2 focus:ring-charcoal/20 resize-none"
      {...rest}
    />
  )

  return (
    <Modal open={open} onClose={onClose} title={editLog ? 'Edit Recall Log' : 'New Recall / Withdrawal'}>
      <div className="flex flex-col gap-4 p-5">

        <Field label="Date identified" required>
          <Input k="date_identified" type="date" />
        </Field>

        <Field label="Product name" required>
          <Input k="product_name" placeholder="e.g. Chicken caesar wraps" />
        </Field>

        <Field label="Batch / lot number">
          <Input k="batch_lot_number" placeholder="From packaging or delivery note (if known)" />
        </Field>

        <Field label="Reason for recall / withdrawal" required>
          <Textarea k="reason" placeholder="e.g. Supplier notified undeclared sesame allergen in bread rolls. / Cooking temperature not achieved." />
        </Field>

        <Field label="Action taken" required>
          <Textarea k="action_taken" placeholder="e.g. Product removed from sale. Remaining stock quarantined. EHO contacted. Supplier advised." />
        </Field>

        <Field label="Who was notified">
          <Input k="who_notified" placeholder="e.g. EHO, FSA, supplier, customers via booking system" />
        </Field>

        <Field label="Notes">
          <Textarea k="notes" placeholder="Any additional context, customer complaints, staff involved…" />
        </Field>

        <Field label="Resolved on">
          <Input k="resolved_at" type="date" />
        </Field>

        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-charcoal text-cream py-2.5 rounded-xl text-sm font-semibold hover:bg-charcoal/90 transition-colors disabled:opacity-40"
        >
          {saving ? 'Saving…' : editLog ? 'Save Changes' : 'Log Recall'}
        </button>
      </div>
    </Modal>
  )
}

// ── Log card ──────────────────────────────────────────────────────────────────

function LogCard({ log, onEdit }) {
  const resolved = !!log.resolved_at

  return (
    <div className={`bg-white rounded-2xl border overflow-hidden ${resolved ? 'border-charcoal/10' : 'border-danger/30'}`}>
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-charcoal text-sm">{log.product_name}</p>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                resolved
                  ? 'bg-success/10 text-success'
                  : 'bg-danger/10 text-danger'
              }`}>
                {resolved ? 'Resolved' : 'Open'}
              </span>
            </div>
            <p className="text-xs text-charcoal/40 mt-0.5">
              Identified {format(parseISO(log.date_identified), 'd MMM yyyy')}
              {log.batch_lot_number && <> · Batch: <span className="font-mono">{log.batch_lot_number}</span></>}
            </p>
          </div>
          <button
            onClick={() => onEdit(log)}
            className="text-xs text-charcoal/40 hover:text-charcoal border border-charcoal/12 hover:border-charcoal/25 px-3 py-1.5 rounded-lg transition-colors shrink-0"
          >
            Edit
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <div>
            <p className="text-[10px] tracking-widest uppercase text-charcoal/30 mb-0.5">Reason</p>
            <p className="text-xs text-charcoal/70">{log.reason}</p>
          </div>
          <div>
            <p className="text-[10px] tracking-widest uppercase text-charcoal/30 mb-0.5">Action taken</p>
            <p className="text-xs text-charcoal/70">{log.action_taken}</p>
          </div>
          {log.who_notified && (
            <div>
              <p className="text-[10px] tracking-widest uppercase text-charcoal/30 mb-0.5">Notified</p>
              <p className="text-xs text-charcoal/70">{log.who_notified}</p>
            </div>
          )}
          {log.resolved_at && (
            <p className="text-xs text-success/80">Resolved {format(parseISO(log.resolved_at), 'd MMM yyyy')}</p>
          )}
          {log.notes && (
            <p className="text-xs text-charcoal/40 italic border-t border-charcoal/6 pt-2 mt-1">{log.notes}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Procedure tab ─────────────────────────────────────────────────────────────

function ProcedureTab({ venueId }) {
  const toast = useToast()
  const { procedure, loading, reload } = useRecallProcedure(venueId)
  const [sections, setSections] = useState(DEFAULT_SECTIONS)
  const [meta, setMeta]         = useState({ responsible_person: '', fsa_contact: '', eho_contact: '' })
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    if (procedure) {
      setSections({ ...DEFAULT_SECTIONS, ...(procedure.procedure_sections || {}) })
      setMeta({
        responsible_person: procedure.responsible_person ?? '',
        fsa_contact:        procedure.fsa_contact ?? '',
        eho_contact:        procedure.eho_contact ?? '',
      })
    }
  }, [procedure])

  const buildProcedureText = (s) =>
    PROC_SECTIONS
      .map(({ title, key }) => `${title.toUpperCase()}\n${'─'.repeat(38)}\n${s[key] || ''}`)
      .join('\n\n')

  const save = async () => {
    setSaving(true)
    const payload = {
      venue_id:           venueId,
      procedure_sections: sections,
      procedure_text:     buildProcedureText(sections),
      responsible_person: meta.responsible_person.trim() || null,
      fsa_contact:        meta.fsa_contact.trim() || null,
      eho_contact:        meta.eho_contact.trim() || null,
      updated_at:         new Date().toISOString(),
    }
    const { error } = procedure
      ? await supabase.from('recall_procedures').update(payload).eq('venue_id', venueId)
      : await supabase.from('recall_procedures').insert(payload)
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Recall procedure saved')
    await reload()
  }

  if (loading) return <div className="flex justify-center pt-12"><LoadingSpinner size="md" /></div>

  return (
    <div className="flex flex-col gap-5">

      {/* Key contacts */}
      <div className="bg-white rounded-2xl border border-charcoal/10 p-5">
        <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-3">Key Contacts</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { key: 'responsible_person', label: 'Responsible person', placeholder: 'Name of manager responsible for recall decisions' },
            { key: 'fsa_contact',        label: 'FSA contact / number', placeholder: 'fsa.gov.uk / 0808 200 4024' },
            { key: 'eho_contact',        label: 'Local EHO contact',   placeholder: 'Name and phone number of your local EHO' },
          ].map(f => (
            <div key={f.key} className="flex flex-col gap-1">
              <label className="text-[10px] tracking-widest uppercase text-charcoal/30">{f.label}</label>
              <input
                value={meta[f.key]}
                onChange={e => setMeta(m => ({ ...m, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Procedure sections */}
      {PROC_SECTIONS.map(section => (
        <div key={section.key} className="bg-white rounded-2xl border border-charcoal/10 p-5">
          <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-0.5">{section.title}</p>
          <p className="text-xs text-charcoal/40 mb-3">{section.desc}</p>
          <textarea
            value={sections[section.key] || ''}
            onChange={e => setSections(prev => ({ ...prev, [section.key]: e.target.value }))}
            rows={section.rows}
            className="w-full px-4 py-3 rounded-lg border border-charcoal/15 bg-white text-charcoal text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-charcoal/20 resize-none"
          />
        </div>
      ))}

      <div className="flex gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 bg-charcoal text-cream py-3 rounded-xl text-sm font-semibold hover:bg-charcoal/90 transition-colors disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save Procedure'}
        </button>
        <button
          onClick={() => window.print()}
          className="px-5 py-3 rounded-xl border border-charcoal/15 text-sm text-charcoal/60 hover:border-charcoal/30 hover:text-charcoal transition-colors"
        >
          Print
        </button>
      </div>
    </div>
  )
}

// ── Log tab ───────────────────────────────────────────────────────────────────

function LogTab({ venueId }) {
  const { logs, loading, reload } = useRecallLogs(venueId)
  const [showModal, setShowModal] = useState(false)
  const [editLog, setEditLog]     = useState(null)
  const [filter, setFilter]       = useState('all') // all | open | resolved

  const filtered = logs.filter(l => {
    if (filter === 'open')     return !l.resolved_at
    if (filter === 'resolved') return !!l.resolved_at
    return true
  })

  const openCount = logs.filter(l => !l.resolved_at).length

  const handleEdit = (log) => { setEditLog(log); setShowModal(true) }
  const handleNew  = ()    => { setEditLog(null); setShowModal(true) }
  const onSaved    = async () => { setShowModal(false); await reload() }

  return (
    <>
      <LogModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSaved={onSaved}
        venueId={venueId}
        editLog={editLog}
      />

      <div className="flex flex-col gap-4">

        {/* Alert banner for open recalls */}
        {openCount > 0 && (
          <div className="bg-danger/8 border border-danger/25 rounded-xl px-4 py-3 flex items-start gap-2">
            <svg className="w-4 h-4 text-danger mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <p className="text-sm text-danger/90 font-medium">
              {openCount} open recall{openCount !== 1 ? 's' : ''} — resolve each one once the issue is fully closed.
            </p>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-1.5">
            {[
              { value: 'all',      label: 'All' },
              { value: 'open',     label: 'Open' },
              { value: 'resolved', label: 'Resolved' },
            ].map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === f.value
                    ? 'bg-charcoal text-cream'
                    : 'bg-white border border-charcoal/12 text-charcoal/50 hover:border-charcoal/25 hover:text-charcoal'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleNew}
            className="px-4 py-2 bg-charcoal text-cream rounded-xl text-sm font-semibold hover:bg-charcoal/90 transition-colors"
          >
            + Log Recall
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center pt-8"><LoadingSpinner size="md" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border-charcoal/10 px-6 py-10 text-center">
            <p className="text-sm text-charcoal/35 font-medium">
              {logs.length === 0
                ? 'No recall events logged yet'
                : `No ${filter} recalls`}
            </p>
            {logs.length === 0 && (
              <p className="text-xs text-charcoal/25 mt-1">
                Log a recall or withdrawal event whenever a product is removed from service due to a food safety concern.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(log => (
              <LogCard key={log.id} log={log} onEdit={handleEdit} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RecallPage() {
  const { venueId } = useVenue()
  const [tab, setTab] = useState('procedure') // procedure | log

  return (
    <div className="flex flex-col gap-6 max-w-2xl">

      <div>
        <h1 className="text-2xl font-bold text-charcoal">Food Recall & Withdrawal</h1>
        <p className="text-sm text-charcoal/40 mt-0.5">
          Standing procedure and a log of all recall events
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-charcoal/5 p-1 rounded-xl w-fit">
        {[
          { id: 'procedure', label: 'Procedure' },
          { id: 'log',       label: 'Recall Log' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-white text-charcoal shadow-sm'
                : 'text-charcoal/45 hover:text-charcoal'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'procedure' && <ProcedureTab venueId={venueId} />}
      {tab === 'log'       && <LogTab venueId={venueId} />}

    </div>
  )
}
