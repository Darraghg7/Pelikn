import { Link } from 'react-router-dom'
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { format, parseISO, isToday, isYesterday, subDays } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import { PageSkeleton } from '../../components/ui/Skeleton'
import { reportError } from '../../lib/reportError'
import LoadError from '../../components/ui/LoadError'
import OpeningClosingExportModal from './OpeningClosingExportModal'
import { useViewerDepartments } from '../../hooks/useDepartments'
import { useAppSettings } from '../../hooks/useSettings'
import { departmentMatcher } from '../../lib/roleFilter'
import DepartmentFilter from '../../components/ui/DepartmentFilter'
import Button, { CloseButton } from '../../components/ui/Button'
import { CHECK_DAYS, DEFAULT_CHECK_DAYS, formatCheckDaysCompact } from '../../lib/temperatureChecks'
import { isCheckDueOn, dateFromISO } from '../../lib/openingChecks'
import { updateOpeningCheck } from '../../lib/api/openingChecks'
import { insertRow } from '../../lib/api/writes'

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() { return format(new Date(), 'yyyy-MM-dd') }

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useChecks(venueId) {
  const [checks, setChecks]   = useState([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed]   = useState(false)
  const load = useCallback(async () => {
    if (!venueId) return
    const { data, error } = await supabase
      .from('opening_closing_checks')
      .select('id, title, type, department_id, check_days, sort_order, created_at')
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .order('sort_order')
      .order('created_at')
    if (error) reportError(error, 'OpeningClosingPage:checks')
    else setChecks(data ?? [])
    setFailed(!!error)
    setLoading(false)
  }, [venueId])
  useEffect(() => { load() }, [load])
  return { checks, loading, failed, reload: load }
}

function useCompletionsForDate(sessionDate, venueId) {
  const [completions, setCompletions] = useState([])
  // Which checks were already done when this day's list first loaded. Rows are
  // ordered by this, not by live state: re-sorting on every tick slid the next
  // check under the finger that had just tapped "Mark OK", so a quick
  // double-tap could record a check nobody did. Ticked-this-visit rows stay
  // put (shown as done) and drop to the bottom next load or day switch.
  const [doneAtLoad, setDoneAtLoad] = useState({ date: null, ids: new Set() })
  const load = useCallback(async () => {
    if (!venueId || !sessionDate) return
    const { data, error } = await supabase
      .from('opening_closing_completions')
      .select('id, check_id, session_date, session_type, completed_at, staff_name, has_issue, corrective_action')
      .eq('venue_id', venueId)
      .eq('session_date', sessionDate)
    // An empty list would show done checks as still to do.
    if (error) { reportError(error, 'OpeningClosingPage:completions'); return }
    const rows = data ?? []
    setCompletions(rows)
    setDoneAtLoad(prev => prev.date === sessionDate ? prev : { date: sessionDate, ids: new Set(rows.map(r => r.check_id)) })
  }, [sessionDate, venueId])
  useEffect(() => { load() }, [load])
  // Show a tick the moment it's tapped, before the save comes back. The next
  // load replaces it with the saved row.
  const addLocal = useCallback(row => setCompletions(prev => [...prev, row]), [])
  const removeLocal = useCallback(id => setCompletions(prev => prev.filter(r => r.id !== id)), [])
  return { completions, doneAtLoad: doneAtLoad.ids, reload: load, addLocal, removeLocal }
}

// ── IssueModal ────────────────────────────────────────────────────────────────

function IssueModal({ check, onConfirm, onCancel, saving }) {
  const [action, setAction] = useState('')

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-charcoal/40 dark:bg-white/40 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-paperDark rounded-card w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl max-h-[90dvh] overflow-y-auto"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <div>
          <p className="text-micro tracking-widest uppercase text-warning mb-1">Issue Flagged</p>
          <h3 className="font-semibold text-charcoal dark:text-white text-lg">{check.title}</h3>
          <p className="text-xs text-charcoal/40 dark:text-white/35 mt-1">
            Describe what corrective action was taken. This will appear in the audit log.
          </p>
        </div>
        <div>
          <label className="text-micro tracking-widest uppercase text-charcoal/40 dark:text-white/35 block mb-2">
            Corrective Action Taken <span className="text-danger">*</span>
          </label>
          <textarea
            value={action}
            onChange={e => setAction(e.target.value)}
            placeholder="e.g. Back door lock was stiff, reported to maintenance and used side entrance for closing."
            rows={4}
            autoFocus
            className="w-full px-4 py-2.5 rounded-control border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm resize-none focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="warning"
            loading={saving}
            onClick={() => onConfirm(action.trim())}
            disabled={saving || !action.trim()}
            className="flex-1"
          >
            {saving ? 'Saving…' : 'Save Issue →'}
          </Button>
          <Button
            variant="secondary"
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Days picker ───────────────────────────────────────────────────────────────

function DayPicker({ value, onChange }) {
  const toggle = (day) => {
    onChange(value.includes(day) ? value.filter(d => d !== day) : [...value, day])
  }
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Days this check is needed">
      {CHECK_DAYS.map(day => {
        const active = value.includes(day.value)
        return (
          <Button
            key={day.value}
            size="sm"
            variant={active ? 'primary' : 'secondary'}
            aria-pressed={active}
            onClick={() => toggle(day.value)}
          >
            {day.short}
          </Button>
        )
      })}
    </div>
  )
}

// A check with every day ticked is stored as NULL ("every day"), so changing
// the rule later never needs a data fix.
const daysToStore = (days) => (days.length === 7 ? null : days.slice().sort((a, b) => a - b))
const daysFromCheck = (check) =>
  Array.isArray(check?.check_days) && check.check_days.length > 0 ? check.check_days : [...DEFAULT_CHECK_DAYS]

// The days a list runs on. Days are set for the whole list, but older checks
// may each have their own, so take the most common pattern.
function listDaysOf(checks) {
  if (checks.length === 0) return { days: [...DEFAULT_CHECK_DAYS], mixed: false }
  const counts = new Map()
  checks.forEach(c => {
    const key = daysFromCheck(c).slice().sort((x, y) => x - y).join(',')
    counts.set(key, (counts.get(key) ?? 0) + 1)
  })
  const [key] = [...counts.entries()].sort((x, y) => y[1] - x[1])[0]
  return { days: key.split(',').map(Number), mixed: counts.size > 1 }
}

// Grows with its text, so a long check reads in full instead of scrolling.
function GrowingTextarea(props) {
  const fit = (el) => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` } }
  return <textarea rows={1} {...props} ref={fit} onInput={e => fit(e.currentTarget)} />
}

// ── ChecklistEditor ───────────────────────────────────────────────────────────

// Edits one list (say, Kitchen opening checks) in one go: wording, the days
// the list runs, department, removals and new checks (added at the bottom) are
// all held here and written on Save, so Cancel really does throw them away.
function ChecklistEditor({ title, type, departmentId, checks, venueId, departments, onClose, onSaved }) {
  const toast = useToast()
  const [rows, setRows] = useState(() => checks.map(c => ({
    key: c.id, id: c.id, title: c.title, departmentId: c.department_id ?? '',
  })))
  const [removed, setRemoved] = useState([]) // ids of existing checks
  const initialDays = useMemo(() => listDaysOf(checks), [checks])
  const [days, setDays] = useState(initialDays.days)
  const [daysTouched, setDaysTouched] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const patch = (key, values) => setRows(rs => rs.map(r => (r.key === key ? { ...r, ...values } : r)))
  const remove = (row) => {
    setRows(rs => rs.filter(r => r.key !== row.key))
    if (row.id) setRemoved(ids => [...ids, row.id])
  }
  const addRow = () => {
    const key = `new-${Date.now()}`
    setRows(rs => [...rs, { key, id: null, title: '', departmentId: departmentId ?? '' }])
  }

  // A brand-new row left blank is just dropped; an existing one can't be blanked.
  const kept = rows.filter(r => r.id || r.title.trim())
  const invalid = days.length === 0 || kept.some(r => !r.title.trim())

  const save = async () => {
    if (invalid) return
    setSaving(true)
    const original = new Map(checks.map(c => [c.id, c]))
    const listDays = daysToStore(days)
    const sameDays = (x, y) => JSON.stringify(x) === JSON.stringify(y)
    let nextOrder = checks.reduce((max, c) => Math.max(max, c.sort_order ?? 0), -1) + 1
    const writes = removed.map(id => updateOpeningCheck(id, venueId, { is_active: false }))
    kept.forEach(r => {
      const title = r.title.trim()
      const department_id = r.departmentId || null
      if (!r.id) {
        writes.push(insertRow('opening_closing_checks', {
          title, department_id, check_days: listDays, sort_order: nextOrder++, type, venue_id: venueId,
        }))
        return
      }
      const was = original.get(r.id)
      const values = {}
      if (title !== was.title) values.title = title
      if (department_id !== (was.department_id ?? null)) values.department_id = department_id
      // Untouched days leave each older check's own days alone.
      if (daysTouched && !sameDays(listDays, was.check_days ?? null)) values.check_days = listDays
      if (Object.keys(values).length) writes.push(updateOpeningCheck(r.id, venueId, values))
    })
    const results = await Promise.allSettled(writes)
    setSaving(false)
    const failed = results.find(r => r.status === 'rejected')
    // Some writes may have landed, so reload either way.
    onSaved()
    if (failed) { toast(failed.reason?.message ?? 'Some changes could not be saved.', 'error'); return }
    toast('Checklist saved')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-charcoal/40 dark:bg-white/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
        className="bg-white dark:bg-paperDark rounded-card w-full max-w-lg flex flex-col shadow-2xl max-h-[90dvh]"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div>
            <p className="text-micro tracking-widest uppercase text-charcoal/40 dark:text-white/35 mb-1">Edit list</p>
            <h3 className="font-semibold text-charcoal dark:text-white text-lg">{title}</h3>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-2 flex flex-col gap-4">
          <div>
            <p className="text-micro tracking-widest uppercase text-charcoal/40 dark:text-white/35 mb-2">Needed on</p>
            <DayPicker value={days} onChange={d => { setDays(d); setDaysTouched(true) }} />
            <p className="text-caption text-charcoal/40 dark:text-white/35 mt-2">
              {initialDays.mixed && !daysTouched
                ? 'Some checks in this list are set to different days. Change the days here to set them all the same.'
                : "On other days this list isn't shown and doesn't count towards the dashboard."}
            </p>
          </div>

          <div>
            <p className="text-micro tracking-widest uppercase text-charcoal/40 dark:text-white/35 mb-2">Checks</p>
            <div className="flex flex-col gap-2">
              {rows.length === 0 && (
                <p className="text-sm text-charcoal/40 dark:text-white/35 italic py-2">No checks in this list.</p>
              )}
              {rows.map((row, index) => (
                <div key={row.key} className="flex items-start gap-1">
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <GrowingTextarea
                      value={row.title}
                      onChange={e => patch(row.key, { title: e.target.value })}
                      placeholder="e.g. Check all fridges are at temperature"
                      aria-label={`Check ${index + 1}`}
                      autoFocus={!row.id && index === rows.length - 1}
                      className="w-full px-3 py-2.5 rounded-control border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm leading-snug resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
                    />
                    {departments.length > 0 && (
                      <select
                        value={row.departmentId}
                        onChange={e => patch(row.key, { departmentId: e.target.value })}
                        aria-label="Department"
                        className="self-start max-w-full px-2 py-1.5 rounded-control border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-caption"
                      >
                        <option value="">No department</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    )}
                  </div>
                  <CloseButton label="Remove check" onClick={() => remove(row)} className="mt-0.5" />
                </div>
              ))}
            </div>
            <Button variant="secondary" size="sm" onClick={addRow} className="mt-3">+ Add a check</Button>
            {removed.length > 0 && (
              <p className="text-caption text-charcoal/50 dark:text-white/40 mt-2">
                {removed.length} check{removed.length > 1 ? 's' : ''} will be removed. Past records stay in the log.
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2 px-5 pt-3 border-t border-charcoal/8 dark:border-white/8" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
          <Button loading={saving} onClick={save} disabled={saving || invalid} className="flex-1">Save list</Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}

// ── CheckRow ──────────────────────────────────────────────────────────────────

function CheckRow({ check, completion, onOK, onIssue, readOnly, isManager, saving }) {
  const done = !!completion
  const hasIssue = completion?.has_issue ?? false

  return (
    <div className={`flex items-start gap-3 px-5 py-3 ${done ? 'opacity-70' : ''}`}>
      {/* Leading tap-to-complete circle — tap marks OK, this IS the action */}
      {done ? (
        <span
          aria-label={hasIssue ? 'Completed with issue' : 'Done'}
          className={`w-[26px] h-[26px] rounded-full shrink-0 grid place-items-center text-white mt-px ${hasIssue ? 'bg-warning' : 'bg-success'}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      ) : readOnly ? (
        <span className="w-[26px] h-[26px] rounded-full shrink-0 border-2 border-charcoal/12 dark:border-white/15 mt-px" />
      ) : (
        <button
          onClick={() => onOK(check)}
          disabled={saving}
          aria-label="Mark OK"
          className="w-[26px] h-[26px] rounded-full shrink-0 p-0 grid place-items-center border-2 border-charcoal/20 dark:border-white/20 bg-transparent text-transparent hover:bg-success hover:border-success hover:text-white transition-colors disabled:cursor-wait mt-px"
        >
          {saving ? (
            <span className="w-3 h-3 rounded-full border-2 border-success/25 border-t-success animate-spin" />
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>
      )}

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <p className={`text-body-lg font-medium tracking-[-0.01em] leading-snug break-words ${done ? 'text-charcoal/60 dark:text-white/50' : 'text-charcoal dark:text-white'}`}>
          {check.title}
        </p>
        {done && completion.staff_name && (
          <p className="text-caption text-charcoal/35 dark:text-white/30 mt-0.5 break-words">
            {completion.staff_name} · {format(new Date(completion.completed_at), 'HH:mm')}
            {hasIssue && completion.corrective_action && <span className="text-warning/70 italic"> · "{completion.corrective_action}"</span>}
          </p>
        )}
        {!done && readOnly && (
          <p className="text-caption text-charcoal/30 dark:text-white/30 italic mt-0.5">Not recorded</p>
        )}
        {isManager && Array.isArray(check.check_days) && check.check_days.length > 0 && check.check_days.length < 7 && (
          <p className="text-caption text-charcoal/40 dark:text-white/35 mt-0.5">{formatCheckDaysCompact(check.check_days)}</p>
        )}
      </div>

      {/* Flag issue */}
      {!done && !readOnly && (
        <button
          onClick={() => onIssue(check)}
          disabled={saving}
          className="shrink-0 text-micro font-bold tracking-wide uppercase text-warning/70 hover:text-warning transition-colors disabled:opacity-50 px-1 mt-1"
        >
          Issue
        </button>
      )}
    </div>
  )
}

// ── CheckSection ──────────────────────────────────────────────────────────────

function CheckSection({ type, label, departmentId, departmentName, departments, checks, scheduledChecks, completions, doneAtLoad, onOK, onIssue, isManager, onChecksChanged, moveHint, venueId, readOnly, savingIds }) {
  const toast = useToast()
  const typeChecks      = checks.filter(c => c.type === type)
  const typeCompletions = completions.filter(c => c.session_type === type)
  const doneCount       = typeChecks.filter(c => typeCompletions.some(cp => cp.check_id === c.id)).length
  const issueCount      = typeCompletions.filter(c => c.has_issue).length
  const allDone         = typeChecks.length > 0 && doneCount === typeChecks.length
  const listChecks      = scheduledChecks.filter(c => c.type === type)

  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [saving, setSaving]   = useState(false)
  const [editing, setEditing] = useState(false)

  const handleAdd = async () => {
    if (!newTitle.trim()) return
    setSaving(true)
    const { error } = await supabase.from('opening_closing_checks').insert({
      title: newTitle.trim(),
      type,
      department_id: departmentId,
      check_days: daysToStore(listDaysOf(listChecks).days),
      sort_order: listChecks.reduce((max, c) => Math.max(max, c.sort_order ?? 0), -1) + 1,
      venue_id: venueId,
    })
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    setNewTitle('')
    setShowAdd(false)
    onChecksChanged()
  }

  return (
    <div className="bg-white dark:bg-paperDark rounded-card overflow-hidden flex flex-col">
      {editing && (
        <ChecklistEditor
          title={departmentName ? `${departmentName} ${label.toLowerCase()}` : label}
          type={type}
          departmentId={departmentId}
          checks={listChecks}
          venueId={venueId}
          departments={departments}
          onClose={() => setEditing(false)}
          onSaved={onChecksChanged}
        />
      )}
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div>
          {departmentName && (
            <p className="text-micro font-bold tracking-widest uppercase text-brand dark:text-accentDark mb-1">{departmentName}</p>
          )}
          <p className="text-micro font-bold tracking-widest uppercase text-charcoal/50 dark:text-white/40">{label}</p>
          <p className="text-xs text-charcoal/40 dark:text-white/35 mt-0.5">
            {doneCount}/{typeChecks.length} recorded
            {issueCount > 0 && (
              <span className="ml-2 text-warning font-semibold">· {issueCount} issue{issueCount > 1 ? 's' : ''}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {allDone && issueCount === 0 && (
            <span className="text-micro font-bold tracking-widest uppercase text-success bg-success/10 px-2.5 py-1 rounded-full">
              <span className="inline-flex items-center gap-1">All Clear <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg></span>
            </span>
          )}
          {allDone && issueCount > 0 && (
            <span className="text-micro font-bold tracking-widest uppercase text-warning bg-warning/10 px-2.5 py-1 rounded-full">
              <span className="inline-flex items-center gap-1">Complete <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>
            </span>
          )}
          {isManager && !readOnly && listChecks.length > 0 && !showAdd && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Edit</Button>
          )}
          {isManager && !readOnly && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdd(v => !v)}
            >
              {showAdd ? 'Cancel' : '+ Add'}
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-charcoal/6 dark:bg-white/8 mx-5 rounded-full">
        <div
          className={`h-full rounded-full transition-all duration-300 ${issueCount > 0 ? 'bg-warning' : 'bg-success'}`}
          style={{ width: typeChecks.length > 0 ? `${(doneCount / typeChecks.length) * 100}%` : '0%' }}
        />
      </div>

      {/* Add check form */}
      {showAdd && isManager && (
        <div className="px-5 py-3 border-b border-charcoal/8 dark:border-white/8 flex flex-col gap-3">
          <div className="flex gap-2">
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="e.g. Check all fridges are at temperature"
            autoFocus
            className="flex-1 px-3 py-2 rounded-control border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
          />
          <Button
            loading={saving}
            onClick={handleAdd}
            disabled={saving || !newTitle.trim()}
          >
            Add →
          </Button>
          </div>
        </div>
      )}
      {moveHint && typeChecks.length > 0 && (
        <p className="px-5 py-2 text-caption text-warning bg-warning/10">{moveHint}</p>
      )}

      {/* Rows */}
      <div className="flex flex-col divide-y divide-charcoal/6 dark:divide-white/8">
        {typeChecks.slice().sort((a, b) => {
          // Order as of page load — see useCompletionsForDate
          const aDone = doneAtLoad.has(a.id) ? 1 : 0
          const bDone = doneAtLoad.has(b.id) ? 1 : 0
          return aDone - bDone
        }).map(check => {
          const completion = typeCompletions.find(c => c.check_id === check.id) ?? null
          return (
            <CheckRow
              key={check.id}
              check={check}
              completion={completion}
              onOK={onOK}
              onIssue={onIssue}
              readOnly={readOnly}
              isManager={isManager}
              saving={savingIds.has(check.id)}
            />
          )
        })}
        {typeChecks.length === 0 && listChecks.length > 0 && (
          <p className="text-sm text-charcoal/35 dark:text-white/30 italic px-5 py-4">
            No {label.toLowerCase()} needed on this day.
          </p>
        )}
        {typeChecks.length === 0 && listChecks.length === 0 && (
          <p className="text-sm text-charcoal/35 dark:text-white/30 italic px-5 py-4">
            No {label.toLowerCase()} set up yet.
            {isManager && ' Click "+ Add" to get started.'}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Date selector ─────────────────────────────────────────────────────────────

function DateSelector({ value, onChange }) {
  const today     = todayStr()
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const prevDay   = format(subDays(parseISO(value), 1), 'yyyy-MM-dd')
  const nextDay   = format(subDays(parseISO(value), -1), 'yyyy-MM-dd')
  const isToday   = value === today

  const labelFor = (d) => {
    if (d === today) return 'Today'
    if (d === yesterday) return 'Yesterday'
    return format(parseISO(d), 'EEE, d MMM')
  }

  return (
    <div className="bg-white dark:bg-paperDark rounded-card p-1 flex items-center gap-1">
      <button
        onClick={() => onChange(prevDay)}
        aria-label="Previous day"
        className="min-w-11 min-h-11 flex items-center justify-center rounded-control text-charcoal/40 dark:text-white/35 hover:text-charcoal dark:hover:text-white hover:bg-charcoal/5 dark:hover:bg-white/5 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
      </button>

      <div className="flex-1 flex items-center justify-center gap-1">
        {[prevDay, value, nextDay].map((d) => (
          <button
            key={d}
            onClick={() => onChange(d)}
            disabled={d > today}
            className={[
              'flex-1 py-2 px-2 rounded-control text-caption font-semibold transition-colors text-center truncate',
              d === value
                ? 'bg-brand text-white'
                : d > today
                ? 'text-charcoal/20 dark:text-white/20 cursor-default'
                : 'text-charcoal/50 dark:text-white/40 hover:bg-charcoal/5 dark:hover:bg-white/5',
            ].join(' ')}
          >
            {labelFor(d)}
          </button>
        ))}
      </div>

      <button
        onClick={() => onChange(nextDay)}
        aria-label="Next day"
        disabled={nextDay > today}
        className="min-w-11 min-h-11 flex items-center justify-center rounded-control text-charcoal/40 dark:text-white/35 hover:text-charcoal dark:hover:text-white hover:bg-charcoal/5 dark:hover:bg-white/5 transition-colors disabled:opacity-25 disabled:cursor-default"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OpeningClosingPage() {
  const toast = useToast()
  const { venueId, venueSlug } = useVenue()
  const { session, isManager } = useSession()
  const { enforceClosingChecklist } = useAppSettings()

  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [showExport, setShowExport]     = useState(false)

  const { checks, loading: checksLoading, failed: checksFailed, reload: reloadChecks } = useChecks(venueId)
  const { completions, doneAtLoad, reload: reloadCompletions, addLocal, removeLocal } = useCompletionsForDate(selectedDate, venueId)
  // Staff see the departments they're in (none = all of them); managers pick
  // one department or all. Same rule as cleaning and Tasks — lib/roleFilter.
  const {
    departments, viewerDepartmentIds, knownDepartmentIds,
    filter: deptFilter, setFilter: setDeptFilter,
  } = useViewerDepartments()
  const canSeeDepartment = departmentMatcher(viewerDepartmentIds, knownDepartmentIds)

  // One (or two, opening+closing) section per department that either has
  // checks already, or — for a manager — could have checks added to it.
  // The ungrouped ("no department") section always shows, matching the
  // page's original two-section layout for venues with no departments set up.
  const departmentGroups = useMemo(() => {
    const groups = [{ id: null, name: null }, ...departments]
    return groups.filter(d => {
      if (!canSeeDepartment(d.id)) return false
      // The "no department" section only exists for venues with no
      // departments, or while checks are still sitting in it waiting to be
      // moved. Once departments exist, each gets its own opening and closing.
      if (d.id === null) return departments.length === 0 || checks.some(c => !c.department_id)
      return isManager || checks.some(c => c.department_id === d.id)
    })
  }, [departments, checks, isManager, canSeeDepartment])

  // Only the checks due on the selected day are listed. One that was already
  // recorded that day stays (a schedule edited afterwards must not hide work
  // that was done).
  const dueChecks = useMemo(() => {
    const day = dateFromISO(selectedDate)
    return checks.filter(c => isCheckDueOn(c, day) || completions.some(cp => cp.check_id === c.id))
  }, [checks, completions, selectedDate])

  // Is the selected date strictly in the future? (tomorrow or later = read-only)
  const readOnly = selectedDate > todayStr()
  const isPast   = !isToday(parseISO(selectedDate))

  // ── Pending action state ──────────────────────────────────────────────────
  const [pendingCheck, setPendingCheck] = useState(null)   // check object
  const [pendingIsIssue, setPendingIsIssue] = useState(false)
  const [saving, setSaving] = useState(false)
  // Checks whose save is in flight. Each check saves on its own, so ticking
  // down the list quickly never ignores a tap.
  const [savingIds, setSavingIds] = useState(() => new Set())
  // Same set, read synchronously — two taps in one instant both see the
  // state from before either landed, and would save the check twice.
  const inFlight = useRef(new Set())
  const setCheckSaving = (id, on) => setSavingIds(prev => {
    const next = new Set(prev)
    if (on) next.add(id); else next.delete(id)
    return next
  })

  const openOK = (check) => {
    doComplete(check, false, null)
  }

  const openIssue = (check) => {
    if (savingIds.has(check.id)) return
    setPendingCheck(check)
    setPendingIsIssue(true)
  }

  const cancelPending = () => {
    setPendingCheck(null)
    setPendingIsIssue(false)
  }

  const doComplete = async (check, hasIssue, correctiveAction) => {
    if (inFlight.current.has(check.id)) return
    // A ticked check already shows as done, so it can't be tapped again.
    if (completions.some(c => c.check_id === check.id)) return
    const row = {
      check_id:          check.id,
      session_date:      selectedDate,
      session_type:      check.type,
      staff_id:          session?.staffId   ?? null,
      staff_name:        session?.staffName ?? 'Unknown',
      has_issue:         hasIssue,
      corrective_action: correctiveAction || null,
      notes:             null,
      venue_id:          venueId,
    }
    // One tap = done. The tick shows straight away; it used to wait for the
    // save, then briefly fall back to an empty circle until the list
    // reloaded, so people tapped again thinking the first tap missed.
    const localId = `local-${check.id}`
    if (!hasIssue) addLocal({ ...row, id: localId, completed_at: new Date().toISOString() })
    if (hasIssue) setSaving(true)
    inFlight.current.add(check.id)
    setCheckSaving(check.id, true)
    const { error } = await supabase.from('opening_closing_completions').insert(row)
    inFlight.current.delete(check.id)
    setCheckSaving(check.id, false)
    if (hasIssue) {
      setSaving(false)
      setPendingCheck(null)
      setPendingIsIssue(false)
    }
    if (error) {
      removeLocal(localId)
      toast(error.message, 'error')
      return
    }
    if (hasIssue) addLocal({ ...row, id: localId, completed_at: new Date().toISOString() })
    reloadCompletions()
  }

  if (checksLoading) {
    return <PageSkeleton />
  }
  if (checksFailed && checks.length === 0) {
    return <LoadError what="your opening and closing checks" onRetry={reloadChecks} />
  }

  const dateLabel = isToday(parseISO(selectedDate))
    ? format(parseISO(selectedDate), 'EEEE, d MMMM')
    : isYesterday(parseISO(selectedDate))
    ? `Yesterday, ${format(parseISO(selectedDate), 'EEEE d MMMM')}`
    : format(parseISO(selectedDate), 'EEEE, d MMMM yyyy')

  return (
    <div className="flex flex-col gap-4">
      <OpeningClosingExportModal open={showExport} onClose={() => setShowExport(false)} />

      {/* Issue modal (shown when staff taps "Issue") */}
      {pendingCheck && pendingIsIssue && (
        <IssueModal
          check={pendingCheck}
          saving={saving}
          onConfirm={(action) => doComplete(pendingCheck, true, action)}
          onCancel={cancelPending}
        />
      )}

      {/* Page header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-micro font-medium tracking-widest uppercase text-charcoal/40 dark:text-white/35">{dateLabel}</p>
          <h1 className="text-2xl font-bold text-charcoal dark:text-white mt-0.5">Opening &amp; Closing</h1>
        </div>
        {isManager && (
          <Button
            size="sm"
            onClick={() => setShowExport(true)}
            className="shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0-3-3m3 3 3-3m2 8H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" /></svg>
            PDF
          </Button>
        )}
      </div>

      {isManager && <DepartmentFilter departments={departments} value={deptFilter} onChange={setDeptFilter} />}

      {/* The clock-out sign-off is set in Compliance settings; say here, where
          the checklist is built, whether it's switched on. */}
      {isManager && (
        <p className="text-caption text-charcoal/50 dark:text-white/40 px-1">
          Closers sign off before clocking out: <span className="font-semibold text-charcoal/70 dark:text-white/60">{enforceClosingChecklist ? 'On' : 'Off'}</span>
          {' · '}
          <Link to={`/v/${venueSlug}/settings/compliance#closing-checklist`} className="underline underline-offset-2 hover:text-charcoal dark:hover:text-white">Change</Link>
        </p>
      )}

      {/* Date selector */}
      <div className="flex flex-col gap-2">
        <DateSelector value={selectedDate} onChange={setSelectedDate} />
        {isPast && (
          <p className="text-caption text-charcoal/40 dark:text-white/35 italic px-1">
            Retroactive entry — checks will be logged against {format(parseISO(selectedDate), 'd MMM yyyy')}.
          </p>
        )}
      </div>

      {/* Check sections — one department at a time, opening then closing */}
      {departmentGroups.map(dept => {
        const deptChecks = dueChecks.filter(c => (c.department_id ?? null) === dept.id)
        const deptScheduled = checks.filter(c => (c.department_id ?? null) === dept.id)
        const moveHint = dept.id === null && departments.length > 0 && isManager
          ? 'These checks are not in a department yet. Tap Edit to move them into one.'
          : null
        return (
          <div key={dept.id ?? 'ungrouped'} className="grid md:grid-cols-2 gap-4">
            <CheckSection
              type="opening"
              label="Opening Checks"
              departmentId={dept.id}
              departmentName={dept.name}
              departments={departments}
              checks={deptChecks}
              scheduledChecks={deptScheduled}
              completions={completions}
              doneAtLoad={doneAtLoad}
              onOK={openOK}
              onIssue={openIssue}
              isManager={isManager}
              onChecksChanged={reloadChecks}
              moveHint={moveHint}
              venueId={venueId}
              readOnly={readOnly}
              savingIds={savingIds}
            />
            <CheckSection
              type="closing"
              label="Closing Checks"
              departmentId={dept.id}
              departmentName={dept.name}
              departments={departments}
              checks={deptChecks}
              scheduledChecks={deptScheduled}
              completions={completions}
              doneAtLoad={doneAtLoad}
              onOK={openOK}
              onIssue={openIssue}
              isManager={isManager}
              onChecksChanged={reloadChecks}
              moveHint={moveHint}
              venueId={venueId}
              readOnly={readOnly}
              savingIds={savingIds}
            />
          </div>
        )
      })}
    </div>
  )
}
