import React, { useState } from 'react'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import DateRangePresets, { presetToDates } from '../../components/ui/DateRangePresets'
import {
  usePestControlLogs,
  useOpenPestIssues,
  PEST_LOG_TYPES,
  PEST_TYPES,
  PEST_SEVERITIES,
} from '../../hooks/usePestControl'

const TABS = ['log', 'open', 'history']

const EMPTY_FORM = {
  logType:    'inspection',
  pestType:   '',
  location:   '',
  description: '',
  actionTaken: '',
  contractor:  '',
  severity:   'low',
  status:     'open',
}

const SEVERITY_STYLES = {
  low:    { badge: 'bg-success/10 text-success',   dot: 'bg-success' },
  medium: { badge: 'bg-warning/10 text-warning',   dot: 'bg-warning' },
  high:   { badge: 'bg-danger/10 text-danger',     dot: 'bg-danger' },
}

const TYPE_LABELS = {
  inspection: 'Inspection',
  sighting:   'Sighting',
  treatment:  'Treatment',
  follow_up:  'Follow-up',
}

function StatusPill({ status }) {
  return (
    <span className={`text-[11px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full ${
      status === 'resolved'
        ? 'bg-success/10 text-success'
        : 'bg-warning/10 text-warning'
    }`}>
      {status === 'resolved' ? 'Resolved' : 'Open'}
    </span>
  )
}

function LogCard({ log, onResolve }) {
  const pestLabel = PEST_TYPES.find(p => p.value === log.pest_type)?.label
  const sevStyle  = log.severity ? SEVERITY_STYLES[log.severity] : null
  const showSeverity = log.log_type === 'sighting' || log.log_type === 'treatment'

  return (
    <div className={`rounded-xl border p-4 space-y-2 ${
      log.status === 'open' && log.severity === 'high'
        ? 'border-danger/30 bg-danger/5'
        : 'border-charcoal/10 dark:border-white/10 bg-white dark:bg-white/5'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold tracking-widest uppercase text-charcoal/50 dark:text-white/40">
              {TYPE_LABELS[log.log_type] ?? log.log_type}
            </span>
            {pestLabel && (
              <span className="text-[11px] font-medium text-charcoal/60 dark:text-white/50">· {pestLabel}</span>
            )}
            {showSeverity && sevStyle && (
              <span className={`text-[11px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded-full ${sevStyle.badge}`}>
                {log.severity}
              </span>
            )}
          </div>
          <p className="font-medium text-sm text-charcoal dark:text-white mt-0.5">{log.location}</p>
          <p className="text-xs text-charcoal/60 dark:text-white/50 mt-0.5">{log.description}</p>
        </div>
        <StatusPill status={log.status} />
      </div>

      {(log.action_taken || log.contractor) && (
        <div className="text-xs text-charcoal/50 dark:text-white/40 space-y-0.5 border-t border-charcoal/6 dark:border-white/8 pt-2">
          {log.action_taken && <p><span className="font-medium">Action:</span> {log.action_taken}</p>}
          {log.contractor   && <p><span className="font-medium">Contractor:</span> {log.contractor}</p>}
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-charcoal/6 dark:border-white/8">
        <span className="text-[11px] text-charcoal/40 dark:text-white/35">
          {format(new Date(log.logged_at), 'd MMM yyyy, HH:mm')} · {log.logged_by_name ?? 'Staff'}
        </span>
        {log.status === 'open' && onResolve && (
          <button
            onClick={() => onResolve(log.id)}
            className="text-[11px] font-semibold text-accent hover:text-accent/80 transition-colors"
          >
            Mark Resolved →
          </button>
        )}
      </div>
    </div>
  )
}

export default function PestControlPage() {
  const { venueId } = useVenue()
  const { session } = useSession()
  const { addToast } = useToast()

  const [tab, setTab] = useState('log')
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  const [preset, setPreset]     = useState('today')
  const [dateFrom, setDateFrom] = useState(presetToDates('today').dateFrom)
  const [dateTo, setDateTo]     = useState(presetToDates('today').dateTo)

  const { issues, loading: openLoading } = useOpenPestIssues()
  const { logs: historyLogs, loading: historyLoading, reload: reloadHistory } = usePestControlLogs(
    tab === 'history' ? dateFrom : null,
    tab === 'history' ? dateTo   : null,
  )

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const requiresPestType = form.logType === 'sighting' || form.logType === 'treatment'
  const requiresSeverity = form.logType === 'sighting' || form.logType === 'treatment'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.location.trim())    { addToast('Enter a location', 'error'); return }
    if (!form.description.trim()) { addToast('Enter a description', 'error'); return }
    if (requiresPestType && !form.pestType) { addToast('Select the pest type', 'error'); return }

    setSubmitting(true)
    const { error } = await supabase.from('pest_control_logs').insert({
      venue_id:       venueId,
      log_type:       form.logType,
      pest_type:      requiresPestType ? form.pestType : null,
      location:       form.location.trim(),
      description:    form.description.trim(),
      action_taken:   form.actionTaken.trim() || null,
      contractor:     form.contractor.trim()  || null,
      severity:       requiresSeverity ? form.severity : null,
      status:         form.status,
      logged_by:      session?.staffId   ?? null,
      logged_by_name: session?.staffName ?? null,
    })

    setSubmitting(false)
    if (error) { addToast(error.message, 'error'); return }
    addToast('Pest control log saved', 'success')
    setForm(EMPTY_FORM)
  }

  const handleResolve = async (id) => {
    const { error } = await supabase.from('pest_control_logs').update({ status: 'resolved' }).eq('id', id)
    if (error) { addToast(error.message, 'error'); return }
    addToast('Issue marked as resolved', 'success')
    reloadHistory()
  }

  const highCount = issues.filter(i => i.severity === 'high').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-charcoal dark:text-white tracking-tight">Pest Control</h1>
        <p className="text-sm text-charcoal/50 dark:text-white/40 mt-1">
          Log inspections, sightings, treatments and follow-ups
        </p>
      </div>

      {/* Open issues banner */}
      {issues.length > 0 && (
        <div className={`rounded-xl border p-4 ${
          highCount > 0 ? 'border-danger/30 bg-danger/8' : 'border-warning/30 bg-warning/8'
        }`}>
          <p className={`text-sm font-semibold ${highCount > 0 ? 'text-danger' : 'text-warning'}`}>
            {issues.length} open issue{issues.length !== 1 ? 's' : ''}
            {highCount > 0 && ` · ${highCount} high severity`}
          </p>
          <p className="text-xs text-charcoal/60 dark:text-white/50 mt-0.5">
            Tap "Open Issues" to view and resolve
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-charcoal/6 dark:bg-white/8 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t
                ? 'bg-white dark:bg-white/15 text-charcoal dark:text-white shadow-sm'
                : 'text-charcoal/50 dark:text-white/40 hover:text-charcoal dark:hover:text-white'
            }`}>
            {t === 'log'     ? 'Log Entry' :
             t === 'open'    ? 'Open Issues' :
                               'History'}
            {t === 'open' && issues.length > 0 && (
              <span className={`ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-white ${
                highCount > 0 ? 'bg-danger' : 'bg-warning'
              }`}>
                {issues.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Log Entry ─────────────────────────────────────────────────── */}
      {tab === 'log' && (
        <div className="bg-white dark:bg-white/5 rounded-2xl border border-charcoal/10 dark:border-white/10 p-5 space-y-4">
          <p className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 font-semibold">New Entry</p>

          {/* Log type */}
          <div>
            <label className="text-xs text-charcoal/60 dark:text-white/50 mb-2 block">Entry Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PEST_LOG_TYPES.map(t => (
                <button key={t.value} type="button"
                  onClick={() => set('logType', t.value)}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                    form.logType === t.value
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-charcoal/15 dark:border-white/15 text-charcoal/60 dark:text-white/50 hover:border-charcoal/30 dark:hover:border-white/30'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pest type + severity — only for sightings/treatments */}
          {requiresPestType && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-charcoal/60 dark:text-white/50 mb-1 block">Pest Type</label>
                <select
                  value={form.pestType}
                  onChange={e => set('pestType', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-white/8 text-sm text-charcoal dark:text-white outline-none focus:border-accent appearance-none"
                >
                  <option value="">Select…</option>
                  {PEST_TYPES.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-charcoal/60 dark:text-white/50 mb-1 block">Severity</label>
                <div className="flex gap-2">
                  {PEST_SEVERITIES.map(s => (
                    <button key={s.value} type="button"
                      onClick={() => set('severity', s.value)}
                      className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                        form.severity === s.value
                          ? `border-current ${SEVERITY_STYLES[s.value].badge}`
                          : 'border-charcoal/15 dark:border-white/15 text-charcoal/50 dark:text-white/40'
                      }`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Location */}
          <div>
            <label className="text-xs text-charcoal/60 dark:text-white/50 mb-1 block">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={e => set('location', e.target.value)}
              placeholder="e.g. Kitchen store room, Back yard, Near bins"
              className="w-full px-4 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-white/8 text-sm text-charcoal dark:text-white placeholder:text-charcoal/30 dark:placeholder:text-white/25 outline-none focus:border-accent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-charcoal/60 dark:text-white/50 mb-1 block">
              {form.logType === 'inspection' ? 'Inspection findings' : 'Description'}
            </label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder={
                form.logType === 'inspection' ? 'e.g. No evidence of pest activity found. Traps checked and reset.' :
                form.logType === 'sighting'   ? 'e.g. Single mouse sighting near dry store, no droppings observed.' :
                form.logType === 'treatment'  ? 'e.g. Bait stations placed along skirting boards in store room.' :
                'e.g. Follow-up inspection after previous sighting.'
              }
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-white/8 text-sm text-charcoal dark:text-white placeholder:text-charcoal/30 dark:placeholder:text-white/25 outline-none focus:border-accent resize-none"
            />
          </div>

          {/* Action taken */}
          <div>
            <label className="text-xs text-charcoal/60 dark:text-white/50 mb-1 block">Action Taken (optional)</label>
            <input
              type="text"
              value={form.actionTaken}
              onChange={e => set('actionTaken', e.target.value)}
              placeholder="e.g. Sealed entry point, notified pest control contractor"
              className="w-full px-4 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-white/8 text-sm text-charcoal dark:text-white placeholder:text-charcoal/30 dark:placeholder:text-white/25 outline-none focus:border-accent"
            />
          </div>

          {/* Contractor */}
          <div>
            <label className="text-xs text-charcoal/60 dark:text-white/50 mb-1 block">Contractor (optional)</label>
            <input
              type="text"
              value={form.contractor}
              onChange={e => set('contractor', e.target.value)}
              placeholder="e.g. Rentokil, local pest control company"
              className="w-full px-4 py-2.5 rounded-xl border border-charcoal/15 dark:border-white/15 bg-white dark:bg-white/8 text-sm text-charcoal dark:text-white placeholder:text-charcoal/30 dark:placeholder:text-white/25 outline-none focus:border-accent"
            />
          </div>

          {/* Status */}
          {(form.logType === 'sighting' || form.logType === 'treatment') && (
            <div>
              <label className="text-xs text-charcoal/60 dark:text-white/50 mb-2 block">Status</label>
              <div className="flex gap-2">
                {['open', 'resolved'].map(s => (
                  <button key={s} type="button"
                    onClick={() => set('status', s)}
                    className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold capitalize transition-all ${
                      form.status === s
                        ? s === 'resolved'
                          ? 'border-success bg-success/10 text-success'
                          : 'border-warning bg-warning/10 text-warning'
                        : 'border-charcoal/15 dark:border-white/15 text-charcoal/50 dark:text-white/40'
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-charcoal dark:bg-white text-cream dark:text-charcoal py-3 rounded-xl text-sm font-semibold tracking-wide hover:bg-charcoal/85 dark:hover:bg-white/85 transition-colors disabled:opacity-40"
          >
            {submitting ? 'Saving…' : 'Save Entry'}
          </button>
        </div>
      )}

      {/* ── Open Issues ───────────────────────────────────────────────── */}
      {tab === 'open' && (
        <div className="space-y-3">
          {openLoading ? (
            <p className="text-sm text-charcoal/40 dark:text-white/35">Loading…</p>
          ) : issues.length === 0 ? (
            <div className="rounded-xl border border-success/30 bg-success/8 p-5 text-center">
              <p className="text-sm font-semibold text-success">No open pest issues</p>
              <p className="text-xs text-charcoal/50 dark:text-white/40 mt-1">All sightings and treatments are resolved</p>
            </div>
          ) : (
            issues.map(log => <LogCard key={log.id} log={log} onResolve={handleResolve} />)
          )}
        </div>
      )}

      {/* ── History ───────────────────────────────────────────────────── */}
      {tab === 'history' && (
        <div className="space-y-4">
          <DateRangePresets
            preset={preset} onPreset={setPreset}
            dateFrom={dateFrom} dateTo={dateTo}
            onDateChange={(k, v) => { if (k === 'dateFrom') setDateFrom(v); else setDateTo(v) }}
          />
          {historyLoading ? (
            <p className="text-sm text-charcoal/40 dark:text-white/35">Loading…</p>
          ) : historyLogs.length === 0 ? (
            <p className="text-sm text-charcoal/40 dark:text-white/35 italic">No pest control logs for this period</p>
          ) : (
            <div className="space-y-3">
              {historyLogs.map(log => <LogCard key={log.id} log={log} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
