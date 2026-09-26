/**
 * PestControlPage — inspections, sightings, treatments and follow-ups.
 * EHOs expect a documented pest record even when nothing is found.
 *
 * A sighting (or a treatment not tied to an earlier issue) opens an issue.
 * Later treatments and follow-ups link to it via issue_id (migration 121), and
 * resolving always writes a follow-up entry, so the record shows who closed an
 * issue, when, and what they found.
 *
 * Tabs:
 *   - Log entry: the entry form (with an open-issues banner on top)
 *   - Open issues: each issue with its timeline, Log follow-up and Resolve
 *   - History: counts plus every entry, newest first
 */
import React, { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format, isToday, isYesterday, differenceInCalendarDays } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import { PageSkeleton } from '../../components/ui/Skeleton'
import {
  usePestControlLogs, useOpenPestIssues, usePestLocations, useRefreshPest,
  PEST_LOG_TYPES, PEST_TYPES, PEST_SEVERITIES,
} from '../../hooks/usePestControl'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { CARD, TONE, PageHeader, TabBar } from '../../components/temperature/TempPageParts'
import { HistoryRangePills, StatStrip, historyDateFrom } from '../../components/temperature/TempHistoryView'
import PestExportModal from './PestExportModal'

const ALL_CLEAR_TEXT = 'All clear — no activity, traps checked and reset.'

const FIELD_LABEL = 'block text-[12px] font-semibold tracking-[0.08em] uppercase text-ink3 dark:text-white/45 mb-2'
const TEXT_FIELD  = 'w-full h-9 px-3.5 rounded-xl border border-line dark:border-white/10 bg-cream dark:bg-white/5 text-[13px] text-ink dark:text-white placeholder:text-ink4 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40 focus:bg-white dark:focus:bg-white/10 transition-colors'
const TEXT_AREA   = 'w-full px-3.5 py-2.5 rounded-xl border border-line dark:border-white/10 bg-cream dark:bg-white/5 text-[13px] text-ink dark:text-white placeholder:text-ink4 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand/15 focus:border-brand/40 focus:bg-white dark:focus:bg-white/10 resize-none transition-colors'

const SEVERITY_TONE = { low: TONE.ok, medium: TONE.explained, high: TONE.bad }

const SHORT_TYPE = { inspection: 'Inspection', sighting: 'Sighting', treatment: 'Treatment', follow_up: 'Follow-up' }
const HISTORY_RANGES = [
  { id: 7,  label: '7 days'  },
  { id: 30, label: '30 days' },
  { id: 90, label: '90 days' },
]

const typeLabel = (value) => SHORT_TYPE[value] ?? value
const pestLabel = (value) => PEST_TYPES.find(p => p.value === value)?.label ?? null

function issueSummary(issue) {
  return [issueTitle(issue), issue.location].filter(Boolean).join(', ')
}

// Short name for an issue: the description up to its first break, then up to
// where it starts saying where ("…behind flour sacks"), e.g.
// "Mouse droppings behind flour sacks, gnaw marks…" → "Mouse droppings"
const WHERE_WORDS = /\s(?:behind|near|in|inside|under|underneath|on|by|at|along|around|beside|next to|outside)\s/i
function issueTitle(issue) {
  const text = (issue.description ?? '').trim()
  const first = text.split(/[.,;—–]| - /)[0].trim()
  const beforeWhere = first.split(WHERE_WORDS)[0].trim()
  const title = (beforeWhere.length >= 3 ? beforeWhere : first) || text
  return title.length > 48 ? `${title.slice(0, 46).trimEnd()}…` : title
}

// "Today" / "Yday" / "22 Sep"
function shortDay(iso) {
  const d = new Date(iso)
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yday'
  return format(d, 'd MMM')
}

/**
 * Insert a pest log. Before migration 121 there's no issue_id column, so an
 * entry about an existing issue falls back to naming the issue in its text.
 */
async function insertPestLog(input, issue) {
  // Only send issue_id when there is one, so unlinked entries never depend on 121
  const { issue_id: issueId, ...legacy } = input
  const row = issueId ? input : legacy
  const { error } = await supabase.from('pest_control_logs').insert(row)
  if (!error || !issueId || !/issue_id/.test(error.message ?? '')) return error
  const { error: legacyError } = await supabase.from('pest_control_logs').insert({
    ...legacy,
    description: `Re: ${issueSummary(issue)} — ${legacy.description}`,
  })
  return legacyError
}

/** Log a follow-up saying the issue is over, then close the issue. */
async function resolveIssue(issue, session, note = 'Resolved — no further activity.') {
  const error = await insertPestLog({
    venue_id:       issue.venue_id,
    log_type:       'follow_up',
    issue_id:       issue.id,
    pest_type:      issue.pest_type ?? null,
    location:       issue.location,
    description:    note,
    status:         'resolved',
    logged_by:      session?.staffId ?? null,
    logged_by_name: session?.staffName ?? null,
  }, issue)
  if (error) return error
  const { error: updateError } = await supabase.from('pest_control_logs').update({ status: 'resolved' }).eq('id', issue.id)
  return updateError
}

/* ── Small pieces ─────────────────────────────────────────────────────────── */
function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        'h-8 px-3.5 rounded-full border text-[13px] transition-colors',
        active
          ? 'bg-brand-tint border-brand/40 text-brand font-semibold dark:bg-white/10 dark:text-white dark:border-white/30'
          : 'bg-white dark:bg-paperDark border-line dark:border-white/10 text-ink2 dark:text-white/75 hover:border-ink4',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function ToggleRow({ title, hint, checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`w-full flex items-center gap-2.5 text-left rounded-xl px-3.5 sm:px-3.5 py-2 transition-colors ${checked ? 'bg-goodBg dark:bg-good/15' : 'bg-cream dark:bg-white/5'}`}
    >
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-semibold text-ink dark:text-white">{title}</span>
        {hint && <span className="block text-[13px] text-ink3 dark:text-white/50 mt-0.5">{hint}</span>}
      </span>
      <span className={`shrink-0 w-[52px] h-7 rounded-full p-1 transition-colors ${checked ? 'bg-accent' : 'bg-ink4/70 dark:bg-white/20'}`}>
        <span className={`block w-6 h-6 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  )
}

/* ── Log entry form ───────────────────────────────────────────────────────── */
function LogEntryForm({ issues, followUpIssueId, onFollowUpIssue, onSaved }) {
  const toast = useToast()
  const { venueId } = useVenue()
  const { session } = useSession()
  const locations = usePestLocations(5)

  const [logType, setLogType]       = useState(followUpIssueId ? 'follow_up' : 'inspection')
  const [allClear, setAllClear]     = useState(true)
  const [pestType, setPestType]     = useState('')
  const [severity, setSeverity]     = useState('low')
  const [location, setLocation]     = useState('')
  const [details, setDetails]       = useState('')
  const [resolved, setResolved]     = useState(false)
  const [showExtra, setShowExtra]   = useState(false)
  const [actionTaken, setActionTaken] = useState('')
  const [contractor, setContractor]   = useState('')
  const [saving, setSaving]         = useState(false)

  const issue = issues.find(i => i.id === followUpIssueId) ?? null
  const [treatmentIssueId, setTreatmentIssueId] = useState(null)
  const treatmentIssue = issues.find(i => i.id === treatmentIssueId) ?? null
  const needsPest    = logType === 'sighting' || logType === 'treatment'
  const needsDetails = logType !== 'inspection' || !allClear
  const needsLocation = logType !== 'follow_up'

  const valid =
    (!needsLocation || location.trim()) &&
    (!needsDetails || details.trim()) &&
    (!needsPest || pestType) &&
    (logType !== 'follow_up' || issue)

  const detailsPrompt = {
    inspection: 'What did you find?',
    sighting:   'What did you see?',
    treatment:  'What was done?',
    follow_up:  'What did you find?',
  }[logType]
  const detailsPlaceholder = {
    inspection: 'e.g. Droppings behind the flour sacks',
    sighting:   'e.g. Mouse droppings along the back wall',
    treatment:  'e.g. Bait stations placed along the skirting',
    follow_up:  'e.g. No fresh droppings, bait untouched',
  }[logType]

  const reset = () => {
    setAllClear(true); setPestType(''); setSeverity('low'); setLocation(''); setDetails('')
    setResolved(false); setShowExtra(false); setActionTaken(''); setContractor(''); setTreatmentIssueId(null)
  }

  const save = async () => {
    if (!valid || saving) return
    setSaving(true)

    const description = logType === 'inspection' && allClear ? ALL_CLEAR_TEXT : details.trim()
    // Follow-ups, and treatments done for an existing issue, are linked to it
    const linkedIssue = logType === 'follow_up' ? issue : logType === 'treatment' ? treatmentIssue : null

    const status =
      logType === 'sighting'  ? 'open'
      : logType === 'treatment' ? (resolved ? 'resolved' : 'open')
      : logType === 'follow_up' ? (resolved ? 'resolved' : 'open')
      : 'resolved'

    const error = await insertPestLog({
      venue_id:       venueId,
      log_type:       logType,
      issue_id:       linkedIssue?.id ?? null,
      pest_type:      needsPest ? pestType : linkedIssue?.pest_type ?? null,
      location:       logType === 'follow_up' ? issue.location : location.trim(),
      description,
      action_taken:   actionTaken.trim() || null,
      contractor:     contractor.trim() || null,
      severity:       needsPest ? severity : null,
      status,
      logged_by:      session?.staffId ?? null,
      logged_by_name: session?.staffName ?? null,
    }, linkedIssue)
    if (error) { setSaving(false); toast(error.message, 'error'); return }

    // Resolving from a linked entry closes the original issue too
    if (linkedIssue && resolved) {
      const { error: resolveError } = await supabase
        .from('pest_control_logs')
        .update({ status: 'resolved' })
        .eq('id', linkedIssue.id)
      if (resolveError) { setSaving(false); toast(resolveError.message, 'error'); onSaved(); return }
    }

    setSaving(false)
    toast(linkedIssue && resolved ? 'Pest control log saved — issue resolved' : 'Pest control log saved')
    reset()
    if (logType === 'follow_up') onFollowUpIssue(null)
    onSaved()
  }

  return (
    <div className={`${CARD} px-3.5 sm:px-6 py-4 flex flex-col gap-4`}>
      {/* Entry type */}
      <div className="grid grid-cols-2 gap-2.5">
        {PEST_LOG_TYPES.map(t => {
          const active = logType === t.value
          return (
            <button
              key={t.value}
              type="button"
              aria-pressed={active}
              onClick={() => { setLogType(t.value); setResolved(false) }}
              className={[
                'text-left rounded-2xl border-2 px-3.5 sm:px-3.5 py-2.5 transition-colors',
                active ? 'border-brand bg-brand-tint dark:bg-white/10 dark:border-white/70' : 'border-line dark:border-white/10 bg-white dark:bg-paperDark hover:border-ink4/60',
              ].join(' ')}
            >
              <span className="block text-[13px] min-[420px]:text-[14px] font-semibold text-ink dark:text-white">{t.label}</span>
              <span className={`block text-[12px] min-[420px]:text-[13px] mt-0.5 ${active ? 'text-ink2 dark:text-white/70' : 'text-ink3 dark:text-white/45'}`}>{t.hint}</span>
            </button>
          )
        })}
      </div>

      {/* Inspection: all clear */}
      {logType === 'inspection' && (
        <ToggleRow
          title="All clear"
          hint="No activity found, traps checked and reset"
          checked={allClear}
          onChange={setAllClear}
        />
      )}

      {/* Follow-up: which issue */}
      {logType === 'follow_up' && (
        issues.length === 0 ? (
          <p className="rounded-xl bg-goodBg dark:bg-good/15 px-3.5 py-2 text-[13px] text-good dark:text-[#7fd1a4] font-semibold">
            No open issues to follow up.
          </p>
        ) : (
          <div>
            <span className={FIELD_LABEL}>Which issue?</span>
            <div className="flex flex-col gap-2">
              {issues.map(i => {
                const active = i.id === followUpIssueId
                return (
                  <button
                    key={i.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onFollowUpIssue(i.id)}
                    className={[
                      'text-left rounded-xl border-2 px-3.5 py-2.5 transition-colors',
                      active ? 'border-brand bg-brand-tint dark:bg-white/10 dark:border-white/70' : 'border-line dark:border-white/10 hover:border-ink4/60',
                    ].join(' ')}
                  >
                    <span className="block text-[13px] font-semibold text-ink dark:text-white">{issueSummary(i)}</span>
                    <span className="block text-[13px] text-ink3 dark:text-white/45 mt-0.5">
                      {[pestLabel(i.pest_type), typeLabel(i.log_type), format(new Date(i.logged_at), 'd MMM')].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      )}

      {/* Treatment: for an existing issue? */}
      {logType === 'treatment' && issues.length > 0 && (
        <div>
          <span className={FIELD_LABEL}>For an open issue?</span>
          <div className="flex flex-wrap gap-2">
            <Chip active={!treatmentIssueId} onClick={() => setTreatmentIssueId(null)}>No — new</Chip>
            {issues.map(i => (
              <Chip
                key={i.id}
                active={treatmentIssueId === i.id}
                onClick={() => { setTreatmentIssueId(i.id); if (i.pest_type) setPestType(i.pest_type); if (!location.trim()) setLocation(i.location) }}
              >
                {issueSummary(i)}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {/* Sighting / treatment: pest + severity */}
      {needsPest && (
        <>
          <div>
            <span className={FIELD_LABEL}>Pest</span>
            <div className="flex flex-wrap gap-2">
              {PEST_TYPES.map(p => (
                <Chip key={p.value} active={pestType === p.value} onClick={() => setPestType(p.value)}>{p.label}</Chip>
              ))}
            </div>
          </div>
          <div>
            <span className={FIELD_LABEL}>Severity</span>
            <div className="grid grid-cols-3 gap-2">
              {PEST_SEVERITIES.map(s => (
                <button
                  key={s.value}
                  type="button"
                  aria-pressed={severity === s.value}
                  onClick={() => setSeverity(s.value)}
                  className={[
                    'h-8 rounded-xl border text-[13px] font-semibold transition-colors',
                    severity === s.value
                      ? `${SEVERITY_TONE[s.value]} border-transparent`
                      : 'bg-white dark:bg-paperDark border-line dark:border-white/10 text-ink2 dark:text-white/75 hover:border-ink4',
                  ].join(' ')}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Location */}
      {needsLocation && (
        <div>
          <span className={FIELD_LABEL}>Location</span>
          <input
            type="text"
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="e.g. Dry store, Back yard"
            aria-label="Location"
            className={TEXT_FIELD}
          />
          <div className="flex flex-wrap gap-2 mt-2">
            {locations.map(name => (
              <Chip key={name} active={location.trim().toLowerCase() === name.toLowerCase()} onClick={() => setLocation(name)}>{name}</Chip>
            ))}
          </div>
        </div>
      )}

      {/* Details */}
      {needsDetails && (
        <div>
          <span className={FIELD_LABEL}>{detailsPrompt}</span>
          <textarea
            value={details}
            onChange={e => setDetails(e.target.value)}
            rows={3}
            placeholder={detailsPlaceholder}
            aria-label={detailsPrompt}
            className={TEXT_AREA}
          />
          {logType === 'inspection' && (
            <p className="text-[13px] text-ink3 dark:text-white/45 mt-2">
              Found signs of pests?{' '}
              <button type="button" onClick={() => setLogType('sighting')} className="font-semibold text-brand dark:text-white underline underline-offset-2">
                Log a pest sighting
              </button>{' '}
              instead, so it stays open until it's dealt with.
            </p>
          )}
        </div>
      )}

      {/* Treatment / follow-up: resolved? */}
      {(logType === 'treatment' || (logType === 'follow_up' && issues.length > 0)) && (
        <ToggleRow
          title="Issue resolved"
          hint={logType === 'follow_up' ? 'No further activity — close this issue' : 'Nothing more to do after this treatment'}
          checked={resolved}
          onChange={setResolved}
        />
      )}

      {/* Action taken / contractor */}
      {showExtra ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <label>
            <span className={FIELD_LABEL}>Action taken</span>
            <input type="text" value={actionTaken} onChange={e => setActionTaken(e.target.value)} placeholder="e.g. Sealed gap under door" className={TEXT_FIELD} />
          </label>
          <label>
            <span className={FIELD_LABEL}>Contractor</span>
            <input type="text" value={contractor} onChange={e => setContractor(e.target.value)} placeholder="e.g. Rentokil" className={TEXT_FIELD} />
          </label>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowExtra(true)}
          className="self-start inline-flex items-center gap-2 text-[13px] font-semibold text-ink2 dark:text-white/75 hover:text-ink dark:hover:text-white"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Action taken, contractor
        </button>
      )}

      <button
        type="button"
        onClick={save}
        disabled={!valid || saving}
        className="w-full h-10 rounded-2xl bg-brand text-white text-[14px] font-semibold transition-colors hover:bg-brand/90 disabled:bg-ink3/70 dark:disabled:bg-white/15 disabled:cursor-not-allowed"
      >
        {saving ? 'Saving…' : 'Save entry'}
      </button>
    </div>
  )
}

/* ── Open issue card ──────────────────────────────────────────────────────── */
function OpenIssueCard({ issue, onFollowUp, onResolve }) {
  const daysOpen = differenceInCalendarDays(new Date(), new Date(issue.logged_at))
  const title = issueTitle(issue)
  const openingNote = [
    issue.logged_by_name && `Reported by ${issue.logged_by_name}`,
    issue.action_taken,
    issue.contractor,
  ].filter(Boolean).join('. ')
  const timeline = [
    { id: issue.id, at: issue.logged_at, type: issue.log_type, text: openingNote },
    ...issue.timeline.map(log => ({
      id: log.id,
      at: log.logged_at,
      type: log.log_type,
      text: [log.contractor, log.description, log.action_taken].filter(Boolean).join('. '),
    })),
  ]

  return (
    <div className={`${CARD} px-3.5 sm:px-3.5 py-2.5 flex flex-col gap-2.5`}>
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-ink dark:text-white">{title}</p>
          <p className="text-[13px] text-ink3 dark:text-white/45 mt-0.5">
            {[issue.location, pestLabel(issue.pest_type), `raised ${format(new Date(issue.logged_at), 'd MMM')}`].filter(Boolean).join(' · ')}
          </p>
        </div>
        <span className={`shrink-0 h-7 px-3 rounded-full inline-flex items-center text-[13px] font-semibold whitespace-nowrap ${issue.severity === 'high' ? TONE.bad : TONE.explained}`}>
          {daysOpen === 0 ? 'Opened today' : `${daysOpen} day${daysOpen === 1 ? '' : 's'} open`}
        </span>
      </div>

      {issue.description && issue.description !== title && (
        <p className="text-[13px] text-ink2 dark:text-white/75">{issue.description}</p>
      )}

      <div className="rounded-xl bg-cream dark:bg-white/5 px-3.5 py-2.5 flex flex-col gap-2">
        {timeline.map(entry => (
          <div key={entry.id} className="flex gap-2.5 text-[13px]">
            <span className="shrink-0 w-10 font-mono text-[13px] text-ink3 dark:text-white/45 pt-px">{shortDay(entry.at)}</span>
            <p className="min-w-0 text-ink2 dark:text-white/75">
              <span className="font-semibold text-ink dark:text-white">{typeLabel(entry.type)}</span>
              {entry.text && ` · ${entry.text}`}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={onFollowUp}
          className="h-9 rounded-xl border border-line dark:border-white/15 bg-white dark:bg-paperDark text-[13px] font-semibold text-ink dark:text-white hover:border-ink4 transition-colors"
        >
          Log follow-up
        </button>
        <button
          type="button"
          onClick={onResolve}
          className="h-9 rounded-xl bg-brand text-white text-[13px] font-semibold hover:bg-brand/90 transition-colors"
        >
          Resolve
        </button>
      </div>
    </div>
  )
}

/* ── History tab ──────────────────────────────────────────────────────────── */
function historyPill(log) {
  if (log.log_type === 'follow_up') {
    return log.status === 'resolved'
      ? { label: 'Resolved', cls: TONE.ok }
      : { label: 'Follow-up', cls: 'bg-line2 text-ink2 dark:bg-white/10 dark:text-white/70' }
  }
  return {
    inspection: { label: 'Inspection', cls: TONE.ok },
    treatment:  { label: 'Treatment',  cls: 'bg-infoBg text-info dark:bg-info/30 dark:text-[#a9bfe8]' },
    sighting:   { label: 'Sighting',   cls: TONE.bad },
  }[log.log_type] ?? { label: typeLabel(log.log_type), cls: TONE.pending }
}

function PestHistory({ openCount }) {
  const [range, setRange] = useState(30)
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const { logs, loading } = usePestControlLogs(historyDateFrom(range), todayStr)

  const inspections = logs.filter(l => l.log_type === 'inspection').length
  const sightings   = logs.filter(l => l.log_type === 'sighting').length

  return (
    <div className="flex flex-col gap-2.5">
      <HistoryRangePills range={range} onRange={setRange} ranges={HISTORY_RANGES} />

      {loading ? (
        <div className="py-12 text-center">
          <div className="w-5 h-5 rounded-full border-2 border-charcoal/15 dark:border-white/15 border-t-charcoal animate-spin mx-auto" />
        </div>
      ) : (
        <>
          <StatStrip stats={[
            { value: inspections, label: inspections === 1 ? 'Inspection' : 'Inspections', tone: null },
            { value: sightings, label: sightings === 1 ? 'Sighting' : 'Sightings', tone: sightings ? 'bad' : null },
            { value: openCount, label: 'Open now', tone: openCount ? 'warn' : null },
          ]} />

          {logs.length === 0 ? (
            <p className="text-[13px] text-ink3 dark:text-white/40 py-10 text-center">No pest control entries in this period.</p>
          ) : (
            <div className={`${CARD} divide-y divide-line dark:divide-white/10`}>
              {logs.map(log => {
                const pill = historyPill(log)
                return (
                  <div key={log.id} className="flex gap-2.5 px-3.5 sm:px-3.5 py-2.5">
                    <span className="shrink-0 w-10 font-mono text-[13px] text-ink3 dark:text-white/45 pt-1">{shortDay(log.logged_at)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2.5">
                        <p className="text-[14px] font-semibold text-ink dark:text-white truncate">{log.location}</p>
                        <span className={`shrink-0 h-7 px-3 rounded-full inline-flex items-center text-[12px] font-semibold ${pill.cls}`}>{pill.label}</span>
                      </div>
                      <p className="text-[13px] text-ink2 dark:text-white/75 mt-1">{log.description}</p>
                      {log.action_taken && (
                        <p className="text-[13px] text-ink2 dark:text-white/70 mt-1">Action: {log.action_taken}</p>
                      )}
                      <p className="text-[13px] text-ink3 dark:text-white/45 mt-1.5">
                        {[log.contractor || log.logged_by_name, format(new Date(log.logged_at), 'HH:mm')].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ── Main page ────────────────────────────────────────────────────────────── */
export default function PestControlPage() {
  const { venueSlug } = useVenue()
  const { session } = useSession()
  const toast = useToast()
  const refresh = useRefreshPest()
  const [searchParams, setSearchParams] = useSearchParams()
  const { issues, loading } = useOpenPestIssues()

  const [showExport, setShowExport] = useState(false)
  const [followUpIssueId, setFollowUpIssueId] = useState(null)
  const [resolveTarget, setResolveTarget] = useState(null)
  // Remount the form when a Follow up button picks an issue, so it opens on Follow-up
  const [formKey, setFormKey] = useState(0)

  const TABS = ['log', 'open', 'history']
  const tab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'log'
  const setTab = (next) => setSearchParams(next === 'log' ? {} : { tab: next }, { replace: true })

  const startFollowUp = (issueId) => {
    setFollowUpIssueId(issueId)
    setFormKey(k => k + 1)
    setTab('log')
  }

  const confirmResolve = async (issue) => {
    const error = await resolveIssue(issue, session)
    if (error) { toast(error.message, 'error'); refresh(); return }
    toast(`${issueTitle(issue)} resolved`)
    refresh()
  }

  if (loading) return <PageSkeleton />

  const high = issues.filter(i => i.severity === 'high').length

  return (
    <div className="flex flex-col gap-2.5 max-w-3xl">
      <PageHeader title="Pest control" backTo={`/v/${venueSlug}/checks`} onExport={() => setShowExport(true)} />

      <TabBar
        tabs={[
          { id: 'log', label: 'Log entry' },
          { id: 'open', label: 'Open issues', count: issues.length, countTone: 'bad' },
          { id: 'history', label: 'History' },
        ]}
        active={tab}
        onChange={setTab}
      />

      <PestExportModal open={showExport} onClose={() => setShowExport(false)} />
      <ConfirmDialog
        open={!!resolveTarget}
        title="Resolve this issue?"
        message={resolveTarget ? `This logs a follow-up saying there's no further activity for "${issueSummary(resolveTarget)}", and closes the issue. To record what you found, use Log follow-up instead.` : ''}
        confirmLabel="Resolve"
        onClose={() => setResolveTarget(null)}
        onConfirm={() => { confirmResolve(resolveTarget); setResolveTarget(null) }}
      />

      {tab === 'log' && (
        <>
          {issues.length > 0 && (
            <button
              type="button"
              onClick={() => setTab('open')}
              className="w-full flex items-center gap-2.5 rounded-2xl bg-badBg dark:bg-bad/20 px-3.5 sm:px-3.5 py-2 text-left"
            >
              <span className="shrink-0 w-2.5 h-2.5 rounded-full bg-bad" />
              <span className="flex-1 min-w-0 text-[13px] min-[420px]:text-[14px] font-semibold text-ink dark:text-white truncate">
                {issues.length === 1
                  ? `1 open issue · ${issueSummary(issues[0])}`
                  : `${issues.length} open issues${high ? ` · ${high} high severity` : ` · latest: ${issueSummary(issues[0])}`}`}
              </span>
              <span className="shrink-0 text-[13px] min-[420px]:text-[14px] font-semibold text-bad dark:text-[#f19a86]">View</span>
            </button>
          )}
          <LogEntryForm
            key={formKey}
            issues={issues}
            followUpIssueId={followUpIssueId}
            onFollowUpIssue={setFollowUpIssueId}
            onSaved={refresh}
          />
        </>
      )}

      {tab === 'open' && (
        issues.length === 0 ? (
          <div className={`${CARD} px-3.5 py-8 text-center`}>
            <p className="text-[14px] font-semibold text-good dark:text-[#7fd1a4]">No open pest issues</p>
            <p className="text-[13px] text-ink3 dark:text-white/45 mt-1">Every sighting and treatment has been followed up and resolved.</p>
          </div>
        ) : (
          issues.map(issue => (
            <OpenIssueCard
              key={issue.id}
              issue={issue}
              onFollowUp={() => startFollowUp(issue.id)}
              onResolve={() => setResolveTarget(issue)}
            />
          ))
        )
      )}

      {tab === 'history' && <PestHistory openCount={issues.length} />}
    </div>
  )
}
