import React, { useState, useEffect, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import EmptyState from '../../components/ui/EmptyState'
import { SkeletonList } from '../../components/ui/Skeleton'
import { buildPdfReport } from '../../lib/pdfUtils'

// ── Constants ────────────────────────────────────────────────────────────────

const SEVERITIES = [
  { value: 'minor',    label: 'Minor',    cls: 'bg-blue-50 text-blue-600 border-blue-200' },
  { value: 'moderate', label: 'Moderate', cls: 'bg-warning/8 text-warning border-warning/20' },
  { value: 'serious',  label: 'Serious',  cls: 'bg-danger/8 text-danger border-danger/20' },
  { value: 'riddor',   label: 'RIDDOR',   cls: 'bg-danger/15 text-danger border-danger/30 font-bold' },
]

const SEVERITY_MAP = Object.fromEntries(SEVERITIES.map(s => [s.value, s]))

const LOCATION_SUGGESTIONS = ['Kitchen', 'Bar', 'Dining area', 'Storeroom', 'Toilets', 'External', 'Office', 'Entrance']

const PERSON_TYPES = [
  { value: 'staff',      label: 'Staff' },
  { value: 'customer',   label: 'Customer' },
  { value: 'visitor',    label: 'Visitor' },
  { value: 'contractor', label: 'Contractor' },
]

// ── Hook ─────────────────────────────────────────────────────────────────────

function useIncidents(venueId) {
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!venueId) return
    const { data } = await supabase
      .from('incidents')
      .select('*, reporter:reported_by(id, name)')
      .eq('venue_id', venueId)
      .order('incident_date', { ascending: false })
    setIncidents(data ?? [])
    setLoading(false)
  }, [venueId])

  useEffect(() => { load() }, [load])
  return { incidents, loading, reload: load }
}

// ── Severity Badge ───────────────────────────────────────────────────────────

function SeverityBadge({ severity }) {
  const s = SEVERITY_MAP[severity]
  if (!s) return null
  return (
    <span className={`text-[11px] tracking-widest uppercase font-medium px-1.5 py-0.5 rounded border ${s.cls}`}>
      {s.label}
    </span>
  )
}

// ── Report Incident Modal ────────────────────────────────────────────────────

function ReportIncidentModal({ venueId, reporterId, onSaved, onClose }) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    incident_date: new Date().toISOString().slice(0, 16),
    location: '',
    description: '',
    injury_details: '',
    first_aid_given: '',
    witnesses: '',
    follow_up_actions: '',
    severity: 'minor',
  })
  const [people, setPeople] = useState([{ name: '', type: 'staff' }])

  function updateForm(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function addPerson() {
    setPeople(prev => [...prev, { name: '', type: 'staff' }])
  }

  function updatePerson(index, field, value) {
    setPeople(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p))
  }

  function removePerson(index) {
    setPeople(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    if (!form.location.trim()) { toast('Location is required', 'error'); return }
    if (!form.description.trim()) { toast('Description is required', 'error'); return }

    setSaving(true)
    const validPeople = people.filter(p => p.name.trim())

    const { error } = await supabase.from('incidents').insert({
      venue_id: venueId,
      incident_date: form.incident_date,
      location: form.location.trim(),
      description: form.description.trim(),
      injury_details: form.injury_details.trim() || null,
      first_aid_given: form.first_aid_given.trim() || null,
      witnesses: form.witnesses.trim() || null,
      follow_up_actions: form.follow_up_actions.trim() || null,
      severity: form.severity,
      reported_by: reporterId,
      people_involved: validPeople,
    })

    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Incident reported')
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-charcoal/8">
          <h2 className="text-lg font-bold text-charcoal">Report Incident</h2>
          <button onClick={onClose} className="text-charcoal/30 hover:text-charcoal text-xl leading-none">&times;</button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Date / time & location */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-charcoal/50 mb-1 block">Date &amp; time</label>
              <input
                type="datetime-local" value={form.incident_date}
                onChange={e => updateForm('incident_date', e.target.value)}
                className="w-full border border-charcoal/15 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-charcoal/50 mb-1 block">Location</label>
              <input
                type="text" value={form.location}
                onChange={e => updateForm('location', e.target.value)}
                list="location-suggestions"
                className="w-full border border-charcoal/15 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                placeholder="e.g. Kitchen"
              />
              <datalist id="location-suggestions">
                {LOCATION_SUGGESTIONS.map(l => <option key={l} value={l} />)}
              </datalist>
            </div>
          </div>

          {/* Severity */}
          <div>
            <label className="text-xs font-medium text-charcoal/50 mb-2 block">Severity</label>
            <div className="flex gap-2 flex-wrap">
              {SEVERITIES.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => updateForm('severity', s.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                    form.severity === s.value ? s.cls : 'border-charcoal/10 text-charcoal/40 hover:border-charcoal/25'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* People involved */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-charcoal/50">People involved</label>
              <button onClick={addPerson} className="text-xs text-brand font-medium hover:underline">+ Add person</button>
            </div>
            <div className="flex flex-col gap-2">
              {people.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text" value={p.name} placeholder="Name"
                    onChange={e => updatePerson(i, 'name', e.target.value)}
                    className="flex-1 border border-charcoal/15 rounded-lg py-1.5 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                  <select
                    value={p.type}
                    onChange={e => updatePerson(i, 'type', e.target.value)}
                    className="border border-charcoal/15 rounded-lg py-1.5 px-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
                  >
                    {PERSON_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  {people.length > 1 && (
                    <button onClick={() => removePerson(i)} className="text-charcoal/25 hover:text-danger text-lg leading-none">&times;</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-charcoal/50 mb-1 block">Description *</label>
            <textarea
              value={form.description}
              onChange={e => updateForm('description', e.target.value)}
              rows={3}
              className="w-full border border-charcoal/15 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none"
              placeholder="What happened?"
            />
          </div>

          {/* Optional fields */}
          <div>
            <label className="text-xs font-medium text-charcoal/50 mb-1 block">Injury details (optional)</label>
            <textarea
              value={form.injury_details}
              onChange={e => updateForm('injury_details', e.target.value)}
              rows={2}
              className="w-full border border-charcoal/15 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none"
              placeholder="Nature and extent of any injuries"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-charcoal/50 mb-1 block">First aid given (optional)</label>
            <textarea
              value={form.first_aid_given}
              onChange={e => updateForm('first_aid_given', e.target.value)}
              rows={2}
              className="w-full border border-charcoal/15 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none"
              placeholder="Treatment administered"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-charcoal/50 mb-1 block">Witnesses (optional)</label>
            <input
              type="text" value={form.witnesses}
              onChange={e => updateForm('witnesses', e.target.value)}
              className="w-full border border-charcoal/15 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              placeholder="Names of any witnesses"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-charcoal/50 mb-1 block">Follow-up actions (optional)</label>
            <textarea
              value={form.follow_up_actions}
              onChange={e => updateForm('follow_up_actions', e.target.value)}
              rows={2}
              className="w-full border border-charcoal/15 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none"
              placeholder="Steps taken or planned to prevent recurrence"
            />
          </div>
        </div>

        <div className="px-5 pb-5 pt-2 flex gap-3">
          <button onClick={onClose} className="flex-1 border border-charcoal/15 text-charcoal/60 py-2.5 rounded-xl text-sm font-medium hover:bg-charcoal/5 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-brand text-cream py-2.5 rounded-xl text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Report Incident'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Incident Detail Modal ────────────────────────────────────────────────────

function IncidentDetailModal({ incident, venueName, onClose }) {
  const people = incident.people_involved || []

  function exportPdf() {
    const rows = [
      ['Date & Time', format(parseISO(incident.incident_date), 'EEE d MMM yyyy, HH:mm')],
      ['Location', incident.location],
      ['Severity', SEVERITY_MAP[incident.severity]?.label || incident.severity],
      ['Reported by', incident.reporter?.name || 'Unknown'],
      ['Description', incident.description],
    ]
    if (people.length > 0) rows.push(['People involved', people.map(p => `${p.name} (${p.type})`).join(', ')])
    if (incident.injury_details) rows.push(['Injury details', incident.injury_details])
    if (incident.first_aid_given) rows.push(['First aid given', incident.first_aid_given])
    if (incident.witnesses) rows.push(['Witnesses', incident.witnesses])
    if (incident.follow_up_actions) rows.push(['Follow-up actions', incident.follow_up_actions])

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

  const Field = ({ label, value }) => {
    if (!value) return null
    return (
      <div>
        <p className="text-[11px] tracking-widest uppercase text-charcoal/35 mb-0.5">{label}</p>
        <p className="text-sm text-charcoal/70 whitespace-pre-wrap">{value}</p>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-charcoal/8">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-charcoal">Incident Report</h2>
            <SeverityBadge severity={incident.severity} />
          </div>
          <button onClick={onClose} className="text-charcoal/30 hover:text-charcoal text-xl leading-none">&times;</button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date & time" value={format(parseISO(incident.incident_date), 'EEE d MMM yyyy, HH:mm')} />
            <Field label="Location" value={incident.location} />
          </div>
          <Field label="Reported by" value={incident.reporter?.name} />

          {people.length > 0 && (
            <div>
              <p className="text-[11px] tracking-widest uppercase text-charcoal/35 mb-1.5">People involved</p>
              <div className="flex flex-wrap gap-1.5">
                {people.map((p, i) => (
                  <span key={i} className="text-xs bg-charcoal/5 text-charcoal/60 px-2 py-1 rounded-lg">
                    {p.name} <span className="text-charcoal/35">({p.type})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <Field label="Description" value={incident.description} />
          <Field label="Injury details" value={incident.injury_details} />
          <Field label="First aid given" value={incident.first_aid_given} />
          <Field label="Witnesses" value={incident.witnesses} />
          <Field label="Follow-up actions" value={incident.follow_up_actions} />
        </div>

        <div className="px-5 pb-5 pt-2 flex gap-3">
          <button onClick={onClose} className="flex-1 border border-charcoal/15 text-charcoal/60 py-2.5 rounded-xl text-sm font-medium hover:bg-charcoal/5 transition-colors">
            Close
          </button>
          <button
            onClick={exportPdf}
            className="flex-1 bg-brand text-cream py-2.5 rounded-xl text-sm font-semibold hover:bg-brand/90 transition-colors"
          >
            Export PDF
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Incident Card ────────────────────────────────────────────────────────────

function IncidentCard({ incident, onClick }) {
  const people = incident.people_involved || []

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-2xl border border-charcoal/8 px-4 py-3.5 flex items-center gap-3 text-left hover:border-brand/20 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-charcoal truncate">{incident.location}</p>
          <SeverityBadge severity={incident.severity} />
        </div>
        <p className="text-[11px] text-charcoal/40">
          {format(parseISO(incident.incident_date), 'EEE d MMM yyyy, HH:mm')}
          {' '}&middot; {incident.reporter?.name || 'Unknown'}
          {people.length > 0 && <> &middot; {people.length} {people.length === 1 ? 'person' : 'people'}</>}
        </p>
        <p className="text-xs text-charcoal/50 mt-1 line-clamp-2">{incident.description}</p>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-charcoal/25 shrink-0">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </button>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function IncidentsPage() {
  const { venueId, venueName } = useVenue()
  const { session, isManager } = useSession()
  const { incidents, loading, reload } = useIncidents(venueId)
  const [showReport, setShowReport] = useState(false)
  const [viewIncident, setViewIncident] = useState(null)
  const [severityFilter, setSeverityFilter] = useState('all')

  if (!isManager) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Incidents</h1>
          <p className="text-sm text-charcoal/40 mt-1">Only managers can view and report incidents.</p>
        </div>
      </div>
    )
  }

  const filtered = severityFilter === 'all'
    ? incidents
    : incidents.filter(i => i.severity === severityFilter)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Incidents</h1>
          <p className="text-sm text-charcoal/40 mt-1">Workplace incident and accident records</p>
        </div>
        <button
          onClick={() => setShowReport(true)}
          className="bg-accent text-cream px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-accent/90 transition-colors"
        >
          + Report Incident
        </button>
      </div>

      {/* Severity filter */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setSeverityFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            severityFilter === 'all' ? 'bg-brand text-cream' : 'bg-charcoal/5 text-charcoal/50 hover:bg-charcoal/10'
          }`}
        >
          All
        </button>
        {SEVERITIES.map(s => (
          <button
            key={s.value}
            onClick={() => setSeverityFilter(s.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              severityFilter === s.value ? 'bg-brand text-cream' : 'bg-charcoal/5 text-charcoal/50 hover:bg-charcoal/10'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonList count={3} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={severityFilter === 'all' ? 'No incidents recorded' : `No ${SEVERITY_MAP[severityFilter]?.label?.toLowerCase() || ''} incidents`}
          description="Report an incident to create a record. All incidents are stored securely for compliance."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(i => (
            <IncidentCard key={i.id} incident={i} onClick={() => setViewIncident(i)} />
          ))}
        </div>
      )}

      {showReport && (
        <ReportIncidentModal
          venueId={venueId}
          reporterId={session?.staffId}
          onSaved={() => { setShowReport(false); reload() }}
          onClose={() => setShowReport(false)}
        />
      )}

      {viewIncident && (
        <IncidentDetailModal
          incident={viewIncident}
          venueName={venueName}
          onClose={() => setViewIncident(null)}
        />
      )}
    </div>
  )
}
