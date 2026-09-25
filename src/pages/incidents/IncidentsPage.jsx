/**
 * IncidentsPage — accident, injury and near-miss records.
 *
 * Open / Closed / All tabs, a severity + RIDDOR filter, and a banner for every
 * RIDDOR-reportable incident that hasn't been reported to the HSE yet. Tapping
 * an incident opens its full record, where it can be marked reported, closed
 * with a note of what was done, reopened, or exported as a PDF.
 */
import React, { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import { PageSkeleton } from '../../components/ui/Skeleton'
import Modal from '../../components/ui/Modal'
import { buildPdfReport } from '../../lib/pdfUtils'
import { useIncidents } from '../../hooks/useIncidents'
import { insertIncident, updateIncident } from '../../lib/api/incidents'
import {
  INCIDENT_TYPES, SEVERITIES, RIDDOR_CATEGORIES,
  typeLabel, severityOf, isRiddor, isOpen, incidentTitle, riddorDeadline, dueText,
} from '../../lib/incidents'
import { CARD, TONE, PageHeader, TabBar } from '../../components/temperature/TempPageParts'

const LOCATION_SUGGESTIONS = ['Kitchen', 'Bar', 'Dining area', 'Storeroom', 'Toilets', 'Outside']

const PERSON_TYPES = [
  { value: 'staff',      label: 'Staff' },
  { value: 'customer',   label: 'Customer' },
  { value: 'visitor',    label: 'Visitor' },
  { value: 'contractor', label: 'Contractor' },
]

const FIELD_LABEL = 'block text-[13px] font-semibold tracking-[0.08em] uppercase text-ink3 dark:text-white/45 mb-2'
const TEXT_FIELD  = 'w-full h-12 px-4 rounded-xl border border-line dark:border-white/10 bg-cream dark:bg-white/5 text-[15px] text-ink dark:text-white placeholder:text-ink4 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40 focus:bg-white dark:focus:bg-white/10 transition-colors'
const TEXT_AREA   = 'w-full px-4 py-3 rounded-xl border border-line dark:border-white/10 bg-cream dark:bg-white/5 text-[15px] text-ink dark:text-white placeholder:text-ink4 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40 focus:bg-white dark:focus:bg-white/10 resize-none transition-colors'
const PRIMARY_BTN = 'h-12 rounded-xl bg-brand text-white text-[16px] font-semibold transition-colors hover:bg-brand/90 disabled:bg-ink3/70 dark:disabled:bg-white/15 disabled:cursor-not-allowed'
const OUTLINE_BTN = 'h-12 rounded-xl border border-line dark:border-white/15 bg-white dark:bg-paperDark text-[16px] font-semibold text-ink dark:text-white hover:border-ink4 transition-colors'

// Severity colours: the card's left bar, the filter dot and the tag
const SEVERITY_STYLE = {
  minor:    { bar: 'bg-ink4', dot: 'bg-ink4', tag: 'bg-line2 text-ink3 dark:bg-white/10 dark:text-white/50' },
  moderate: { bar: 'bg-warn', dot: 'bg-warn', tag: TONE.explained },
  serious:  { bar: 'bg-bad',  dot: 'bg-bad',  tag: TONE.bad },
}
const SEVERITY_LABEL = Object.fromEntries(SEVERITIES.map(s => [s.value, s.label]))
const SEVERITY_RANK  = { minor: 0, moderate: 1, serious: 2 }

function incidentWhen(incident) {
  return format(parseISO(incident.incident_date), 'd MMM HH:mm')
}

function metaLine(incident) {
  return [typeLabel(incident.incident_type), incident.location, incidentWhen(incident)].filter(Boolean).join(' · ')
}

function RiddorTag({ reported }) {
  return (
    <span className={`h-8 px-2.5 rounded-lg inline-flex items-center font-mono text-sm font-bold border-[1.5px] ${reported ? 'border-line text-ink3 dark:border-white/15 dark:text-white/45' : 'border-bad text-bad dark:border-[#f19a86] dark:text-[#f19a86]'}`}>
      {reported ? 'RIDDOR ✓' : 'RIDDOR'}
    </span>
  )
}

function StatusPill({ incident }) {
  const open = isOpen(incident)
  return (
    <span className={`shrink-0 h-8 px-3.5 rounded-full inline-flex items-center text-sm font-semibold ${open ? TONE.explained : TONE.ok}`}>
      {open ? 'Open' : 'Closed'}
    </span>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        'h-10 px-4 rounded-full border text-[15px] transition-colors',
        active
          ? 'bg-brand-tint border-brand/40 text-brand font-semibold dark:bg-white/10 dark:text-white dark:border-white/30'
          : 'bg-white dark:bg-paperDark border-line dark:border-white/10 text-ink2 dark:text-white/75 hover:border-ink4',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

/* ── Report an incident ───────────────────────────────────────────────────── */
function nowLocalInput() {
  return format(new Date(), "yyyy-MM-dd'T'HH:mm")
}

function ReportIncidentModal({ open, onClose, onSaved }) {
  const toast = useToast()
  const { venueId } = useVenue()
  const { session } = useSession()

  const blank = () => ({
    title: '', incident_type: 'injury', incident_date: nowLocalInput(), location: '', severity: 'minor',
    riddor: false, riddor_category: 'specified_injury', description: '',
    injury_details: '', first_aid_given: '', witnesses: '', follow_up_actions: '',
  })
  const [form, setForm]     = useState(blank)
  const [people, setPeople] = useState([{ name: '', type: 'staff' }])
  const [showMore, setShowMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))

  const canSave = form.title.trim() && form.location.trim() && form.description.trim() && form.incident_date && !saving

  const reset = () => { setForm(blank()); setPeople([{ name: '', type: 'staff' }]); setShowMore(false) }

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    const { error } = await insertIncident({
      venue_id:          venueId,
      title:             form.title.trim(),
      incident_type:     form.incident_type,
      incident_date:     new Date(form.incident_date).toISOString(),
      location:          form.location.trim(),
      description:       form.description.trim(),
      injury_details:    form.injury_details.trim() || null,
      first_aid_given:   form.first_aid_given.trim() || null,
      witnesses:         form.witnesses.trim() || null,
      follow_up_actions: form.follow_up_actions.trim() || null,
      severity:          form.severity,
      riddor:            form.riddor,
      riddor_category:   form.riddor ? form.riddor_category : null,
      reported_by:       session?.staffId,
      people_involved:   people.filter(p => p.name.trim()),
    })
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Incident reported')
    reset()
    onSaved()
  }

  const riddorDays = RIDDOR_CATEGORIES.find(c => c.value === form.riddor_category)?.days ?? 10

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Report an incident">
      <div className="flex flex-col gap-5">
        <label>
          <span className={FIELD_LABEL}>What happened, in a line</span>
          <input type="text" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Slip on wet floor by dish wash" className={TEXT_FIELD} />
        </label>

        <div>
          <span className={FIELD_LABEL}>Type</span>
          <div className="flex flex-wrap gap-2">
            {INCIDENT_TYPES.map(t => (
              <Chip key={t.value} active={form.incident_type === t.value} onClick={() => set('incident_type', t.value)}>{t.label}</Chip>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
          <label>
            <span className={FIELD_LABEL}>When</span>
            <input type="datetime-local" value={form.incident_date} max={nowLocalInput()} onChange={e => set('incident_date', e.target.value)} className={TEXT_FIELD} />
          </label>
          <label>
            <span className={FIELD_LABEL}>Where</span>
            <input type="text" value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Cellar stairs" className={TEXT_FIELD} />
          </label>
        </div>
        <div className="flex flex-wrap gap-2 -mt-2">
          {LOCATION_SUGGESTIONS.map(l => (
            <Chip key={l} active={form.location.trim().toLowerCase() === l.toLowerCase()} onClick={() => set('location', l)}>{l}</Chip>
          ))}
        </div>

        <div>
          <span className={FIELD_LABEL}>Severity</span>
          <div className="grid grid-cols-3 gap-2">
            {SEVERITIES.map(s => (
              <button
                key={s.value}
                type="button"
                aria-pressed={form.severity === s.value}
                onClick={() => set('severity', s.value)}
                className={[
                  'h-11 rounded-xl border text-[15px] font-semibold transition-colors',
                  form.severity === s.value
                    ? `${SEVERITY_STYLE[s.value].tag} border-transparent`
                    : 'bg-white dark:bg-paperDark border-line dark:border-white/10 text-ink2 dark:text-white/75 hover:border-ink4',
                ].join(' ')}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className={`rounded-xl px-4 py-3.5 ${form.riddor ? 'bg-badBg dark:bg-bad/20' : 'bg-cream dark:bg-white/5'}`}>
          <button
            type="button"
            role="switch"
            aria-checked={form.riddor}
            onClick={() => set('riddor', !form.riddor)}
            className="w-full flex items-center gap-4 text-left"
          >
            <span className="flex-1 min-w-0">
              <span className="block text-[16px] font-semibold text-ink dark:text-white">Reportable under RIDDOR</span>
              <span className="block text-sm text-ink3 dark:text-white/50 mt-0.5">Serious injuries, over-7-day absences, public taken to hospital</span>
            </span>
            <span className={`shrink-0 w-[52px] h-8 rounded-full p-1 transition-colors ${form.riddor ? 'bg-bad' : 'bg-ink4/70 dark:bg-white/20'}`}>
              <span className={`block w-6 h-6 rounded-full bg-white shadow transition-transform ${form.riddor ? 'translate-x-5' : ''}`} />
            </span>
          </button>
          {form.riddor && (
            <div className="mt-3 flex flex-col gap-2">
              {RIDDOR_CATEGORIES.map(c => (
                <label key={c.value} className="flex items-center gap-3 text-[15px] text-ink dark:text-white">
                  <input type="radio" name="riddor_category" checked={form.riddor_category === c.value} onChange={() => set('riddor_category', c.value)} className="accent-[#b3331c] w-4 h-4" />
                  {c.label}
                </label>
              ))}
              <p className="text-sm text-ink2 dark:text-white/70 mt-1">
                Report to the HSE within {riddorDays} days of the incident. Check HSE guidance if you're unsure whether it's reportable.
              </p>
            </div>
          )}
        </div>

        <label>
          <span className={FIELD_LABEL}>Full account</span>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} placeholder="What happened, in order, and what was done straight away" className={TEXT_AREA} />
        </label>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className={`${FIELD_LABEL} mb-0`}>People involved</span>
            <button type="button" onClick={() => setPeople(p => [...p, { name: '', type: 'staff' }])} className="text-sm font-semibold text-brand dark:text-white">+ Add person</button>
          </div>
          <div className="flex flex-col gap-2">
            {people.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text" value={p.name} placeholder="Name"
                  onChange={e => setPeople(list => list.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                  className={`${TEXT_FIELD} flex-1 min-w-0`}
                />
                <select
                  value={p.type}
                  onChange={e => setPeople(list => list.map((x, j) => j === i ? { ...x, type: e.target.value } : x))}
                  className="h-12 px-3 rounded-xl border border-line dark:border-white/10 bg-cream dark:bg-white/5 text-[15px] text-ink dark:text-white"
                >
                  {PERSON_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                {people.length > 1 && (
                  <button type="button" aria-label="Remove person" onClick={() => setPeople(list => list.filter((_, j) => j !== i))} className="w-8 text-xl text-ink4 hover:text-bad">&times;</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {showMore ? (
          <>
            <label><span className={FIELD_LABEL}>Injury details</span><textarea value={form.injury_details} onChange={e => set('injury_details', e.target.value)} rows={2} placeholder="Nature and extent of any injury" className={TEXT_AREA} /></label>
            <label><span className={FIELD_LABEL}>First aid given</span><textarea value={form.first_aid_given} onChange={e => set('first_aid_given', e.target.value)} rows={2} placeholder="Treatment given, and by whom" className={TEXT_AREA} /></label>
            <label><span className={FIELD_LABEL}>Witnesses</span><input type="text" value={form.witnesses} onChange={e => set('witnesses', e.target.value)} placeholder="Names of anyone who saw it" className={TEXT_FIELD} /></label>
            <label><span className={FIELD_LABEL}>Follow-up actions</span><textarea value={form.follow_up_actions} onChange={e => set('follow_up_actions', e.target.value)} rows={2} placeholder="What's being done so it doesn't happen again" className={TEXT_AREA} /></label>
          </>
        ) : (
          <button type="button" onClick={() => setShowMore(true)} className="self-start inline-flex items-center gap-2 text-[16px] font-semibold text-ink2 dark:text-white/75 hover:text-ink dark:hover:text-white">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Injury, first aid, witnesses
          </button>
        )}

        <button type="button" onClick={save} disabled={!canSave} className={`w-full ${PRIMARY_BTN} h-[52px] rounded-2xl text-[17px]`}>
          {saving ? 'Saving…' : 'Report incident'}
        </button>
      </div>
    </Modal>
  )
}

/* ── Incident record ──────────────────────────────────────────────────────── */
function Field({ label, value }) {
  if (!value) return null
  return (
    <div>
      <p className={FIELD_LABEL}>{label}</p>
      <p className="text-[15px] text-ink2 dark:text-white/75 whitespace-pre-wrap -mt-1">{value}</p>
    </div>
  )
}

function IncidentDetailModal({ incident, onClose, onChanged }) {
  const toast = useToast()
  const { venueName } = useVenue()
  const { session } = useSession()
  const [reference, setReference]   = useState('')
  const [closureNote, setClosureNote] = useState('')
  const [busy, setBusy] = useState(false)

  if (!incident) return null
  const people   = incident.people_involved || []
  const severity = severityOf(incident)
  const riddor   = isRiddor(incident)
  const deadline = riddorDeadline(incident)
  const open     = isOpen(incident)
  const riddorCategory = RIDDOR_CATEGORIES.find(c => c.value === incident.riddor_category)?.label

  const change = async (changes, message) => {
    setBusy(true)
    const { error } = await updateIncident(incident.id, changes)
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    toast(message)
    onChanged()
  }

  const exportPdf = () => {
    const rows = [
      ['Title', incidentTitle(incident)],
      ['Type', typeLabel(incident.incident_type) ?? '—'],
      ['Date & time', format(parseISO(incident.incident_date), 'EEE d MMM yyyy, HH:mm')],
      ['Location', incident.location],
      ['Severity', SEVERITY_LABEL[severity]],
      ['RIDDOR', riddor ? [riddorCategory, incident.riddor_reported_at && `reported ${format(new Date(incident.riddor_reported_at), 'd MMM yyyy')}`, incident.riddor_reference && `ref ${incident.riddor_reference}`].filter(Boolean).join(' · ') || 'Yes' : 'No'],
      ['Status', open ? 'Open' : `Closed ${incident.closed_at ? format(new Date(incident.closed_at), 'd MMM yyyy') : ''}`.trim()],
      ['Reported by', incident.reporter?.name || 'Unknown'],
      ['Account', incident.description],
    ]
    if (people.length > 0) rows.push(['People involved', people.map(p => `${p.name} (${p.type})`).join(', ')])
    if (incident.injury_details) rows.push(['Injury details', incident.injury_details])
    if (incident.first_aid_given) rows.push(['First aid given', incident.first_aid_given])
    if (incident.witnesses) rows.push(['Witnesses', incident.witnesses])
    if (incident.follow_up_actions) rows.push(['Follow-up actions', incident.follow_up_actions])
    if (incident.closure_note) rows.push(['Closure note', incident.closure_note])

    buildPdfReport({
      title: 'Pelikn',
      subtitle: 'Incident & Accident Report',
      venueLabel: venueName,
      periodLabel: format(parseISO(incident.incident_date), 'd MMM yyyy'),
      columns: ['Field', 'Details'],
      rows,
      filename: `incident-${format(parseISO(incident.incident_date), 'yyyy-MM-dd')}.pdf`,
    })
  }

  return (
    <Modal open={!!incident} onClose={onClose} title={incidentTitle(incident)}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2 -mt-2">
          <p className="text-sm text-ink3 dark:text-white/45">{metaLine(incident)} · reported by {incident.reporter?.name ?? 'Unknown'}</p>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill incident={incident} />
            <span className={`h-8 px-3 rounded-lg inline-flex items-center text-sm font-semibold ${SEVERITY_STYLE[severity].tag}`}>{SEVERITY_LABEL[severity]}</span>
            {riddor && <RiddorTag reported={!!incident.riddor_reported_at} />}
          </div>
        </div>

        {riddor && (
          <div className={`rounded-xl px-4 py-3.5 ${incident.riddor_reported_at ? 'bg-cream dark:bg-white/5' : 'bg-badBg dark:bg-bad/20'}`}>
            {incident.riddor_reported_at ? (
              <p className="text-[15px] text-ink2 dark:text-white/75">
                Reported to the HSE on {format(new Date(incident.riddor_reported_at), 'd MMM yyyy')}
                {incident.riddor_reference && <> · ref <span className="font-mono">{incident.riddor_reference}</span></>}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-[15px] font-semibold text-bad dark:text-[#f19a86]">
                  Report to the HSE · {deadline ? dueText(deadline.daysLeft) : 'due'}{deadline && ` (${format(deadline.due, 'd MMM')})`}
                </p>
                {riddorCategory && <p className="text-sm text-ink2 dark:text-white/70 -mt-2">{riddorCategory}</p>}
                <input type="text" value={reference} onChange={e => setReference(e.target.value)} placeholder="HSE reference number (optional)" className={TEXT_FIELD} />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => change({ riddor_reported_at: new Date().toISOString(), riddor_reference: reference.trim() || null }, 'Marked as reported to the HSE')}
                  className={PRIMARY_BTN}
                >
                  Mark reported to HSE
                </button>
              </div>
            )}
          </div>
        )}

        <Field label="Account" value={incident.description} />
        {people.length > 0 && (
          <div>
            <p className={FIELD_LABEL}>People involved</p>
            <div className="flex flex-wrap gap-1.5 -mt-1">
              {people.map((p, i) => (
                <span key={i} className="text-sm bg-cream dark:bg-white/5 text-ink2 dark:text-white/70 px-2.5 py-1 rounded-lg">
                  {p.name} <span className="text-ink3 dark:text-white/40">({p.type})</span>
                </span>
              ))}
            </div>
          </div>
        )}
        <Field label="Injury details" value={incident.injury_details} />
        <Field label="First aid given" value={incident.first_aid_given} />
        <Field label="Witnesses" value={incident.witnesses} />
        <Field label="Follow-up actions" value={incident.follow_up_actions} />

        {open ? (
          <div className="flex flex-col gap-2 border-t border-line dark:border-white/10 pt-4">
            <span className={FIELD_LABEL}>Close this incident</span>
            <textarea
              value={closureNote}
              onChange={e => setClosureNote(e.target.value)}
              rows={2}
              placeholder="What was done, e.g. Non-slip mat fitted, staff briefed"
              className={TEXT_AREA}
            />
            <div className="grid grid-cols-2 gap-3 mt-1">
              <button type="button" onClick={exportPdf} className={OUTLINE_BTN}>Export PDF</button>
              <button
                type="button"
                disabled={busy || !closureNote.trim()}
                onClick={() => change({ status: 'closed', closed_at: new Date().toISOString(), closed_by: session?.staffId ?? null, closure_note: closureNote.trim() }, 'Incident closed')}
                className={PRIMARY_BTN}
              >
                Close incident
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 border-t border-line dark:border-white/10 pt-4">
            <Field label={`Closed ${incident.closed_at ? format(new Date(incident.closed_at), 'd MMM yyyy') : ''}`} value={incident.closure_note} />
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={exportPdf} className={OUTLINE_BTN}>Export PDF</button>
              <button
                type="button"
                disabled={busy}
                onClick={() => change({ status: 'open', closed_at: null, closed_by: null }, 'Incident reopened')}
                className={OUTLINE_BTN}
              >
                Reopen
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ── Main page ────────────────────────────────────────────────────────────── */
export default function IncidentsPage() {
  const { venueSlug } = useVenue()
  const { incidents, loading, reload } = useIncidents()
  const [searchParams, setSearchParams] = useSearchParams()

  const [severityFilter, setSeverityFilter] = useState('all')
  const [showReport, setShowReport] = useState(false)
  const [viewId, setViewId] = useState(null)

  const TABS = ['open', 'closed', 'all']
  const tab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'open'
  const setTab = (next) => setSearchParams(next === 'open' ? {} : { tab: next }, { replace: true })

  const openCount   = incidents.filter(isOpen).length
  const closedCount = incidents.length - openCount

  // Every RIDDOR incident not yet reported to the HSE, soonest deadline first
  const riddorDue = useMemo(() => incidents
    .map(incident => ({ incident, deadline: riddorDeadline(incident) }))
    .filter(x => x.deadline)
    .sort((a, b) => a.deadline.daysLeft - b.deadline.daysLeft), [incidents])

  const visible = useMemo(() => incidents
    .filter(i => tab === 'all' || (tab === 'open' ? isOpen(i) : !isOpen(i)))
    .filter(i => severityFilter === 'all' || (severityFilter === 'riddor' ? isRiddor(i) : severityOf(i) === severityFilter))
    // Open before closed; most severe first among open ones; then newest first
    .sort((a, b) =>
      (isOpen(b) - isOpen(a)) ||
      (isOpen(a) ? SEVERITY_RANK[severityOf(b)] - SEVERITY_RANK[severityOf(a)] : 0) ||
      b.incident_date.localeCompare(a.incident_date)),
  [incidents, tab, severityFilter])

  const viewing = incidents.find(i => i.id === viewId) ?? null

  if (loading) return <PageSkeleton />

  const filters = [
    { value: 'all', label: 'All' },
    ...SEVERITIES.map(s => ({ ...s, dot: SEVERITY_STYLE[s.value].dot })),
    { value: 'riddor', label: 'RIDDOR', dot: 'bg-bad' },
  ]

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <PageHeader
        title="Incidents"
        backTo={`/v/${venueSlug}/checks`}
        action={(
          <button
            type="button"
            onClick={() => setShowReport(true)}
            className="shrink-0 inline-flex items-center gap-2 h-11 px-4 sm:px-5 rounded-xl bg-brand text-white text-[15px] sm:text-[16px] font-semibold hover:bg-brand/90 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Report
          </button>
        )}
      />

      <TabBar
        tabs={[
          { id: 'open', label: 'Open', count: openCount },
          { id: 'closed', label: 'Closed', count: closedCount },
          { id: 'all', label: 'All', count: incidents.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="flex flex-wrap gap-2">
        {filters.map(f => (
          <button
            key={f.value}
            type="button"
            aria-pressed={severityFilter === f.value}
            onClick={() => setSeverityFilter(f.value)}
            className={[
              'h-11 px-4 rounded-full border inline-flex items-center gap-2 text-[15px] font-semibold transition-colors',
              severityFilter === f.value
                ? 'bg-brand border-brand text-white'
                : 'bg-white dark:bg-paperDark border-line dark:border-white/10 text-ink2 dark:text-white/75 hover:border-ink4',
            ].join(' ')}
          >
            {f.dot && <span className={`w-2.5 h-2.5 rounded-full ${f.dot}`} />}
            {f.label}
          </button>
        ))}
      </div>

      {riddorDue.map(({ incident, deadline }) => (
        <button
          key={incident.id}
          type="button"
          onClick={() => setViewId(incident.id)}
          className="w-full flex items-center gap-3 rounded-2xl bg-badBg dark:bg-bad/20 px-4 sm:px-5 py-3.5 text-left"
        >
          <span className="shrink-0 px-2.5 py-1 rounded-lg bg-bad text-white font-mono text-sm font-bold">RIDDOR</span>
          <span className="flex-1 min-w-0 text-[15px] min-[420px]:text-[17px] text-ink dark:text-white">
            Report “{incidentTitle(incident).replace(/^./, c => c.toLowerCase())}” to HSE · <span className={deadline.daysLeft < 0 ? 'font-semibold text-bad dark:text-[#f19a86]' : ''}>{dueText(deadline.daysLeft)}</span>
          </span>
          <span className="shrink-0 text-[15px] min-[420px]:text-[17px] font-semibold text-bad dark:text-[#f19a86]">Open</span>
        </button>
      ))}

      {visible.length === 0 ? (
        <div className={`${CARD} px-5 py-10 text-center`}>
          <p className="text-[17px] font-semibold text-ink dark:text-white">
            {incidents.length === 0 ? 'No incidents recorded' : tab === 'open' ? 'No open incidents' : 'Nothing matches'}
          </p>
          <p className="text-sm text-ink3 dark:text-white/45 mt-1">
            {incidents.length === 0 ? 'Report accidents, injuries and near misses here so there’s a record ready for an inspection.' : 'Try a different tab or filter.'}
          </p>
        </div>
      ) : (
        <div className={`${CARD} divide-y divide-line dark:divide-white/10 overflow-hidden`}>
          {visible.map(incident => {
            const severity = severityOf(incident)
            const open = isOpen(incident)
            return (
              <button
                key={incident.id}
                type="button"
                onClick={() => setViewId(incident.id)}
                className="w-full flex gap-4 px-4 sm:px-5 py-4 text-left hover:bg-cream/60 dark:hover:bg-white/5 transition-colors"
              >
                <span className={`shrink-0 w-1 self-stretch rounded-full ${open ? SEVERITY_STYLE[severity].bar : 'bg-ink4'}`} />
                <span className="flex-1 min-w-0 flex flex-col gap-2">
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-[17px] min-[420px]:text-[19px] leading-snug font-semibold text-ink dark:text-white">{incidentTitle(incident)}</span>
                    <StatusPill incident={incident} />
                  </span>
                  <span className="text-[15px] text-ink3 dark:text-white/45 -mt-1">{metaLine(incident)}</span>
                  <span className="flex flex-wrap gap-2">
                    <span className={`h-8 px-3 rounded-lg inline-flex items-center text-sm font-semibold ${open ? SEVERITY_STYLE[severity].tag : SEVERITY_STYLE.minor.tag}`}>
                      {SEVERITY_LABEL[severity]}
                    </span>
                    {isRiddor(incident) && <RiddorTag reported={!!incident.riddor_reported_at} />}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}

      <ReportIncidentModal open={showReport} onClose={() => setShowReport(false)} onSaved={() => { setShowReport(false); reload() }} />
      <IncidentDetailModal key={viewId ?? 'none'} incident={viewing} onClose={() => setViewId(null)} onChanged={reload} />
    </div>
  )
}
