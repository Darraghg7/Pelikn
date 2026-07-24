import React, { useState, useEffect, useCallback } from 'react'
import { format, parseISO, isToday, isYesterday, subDays } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import OpeningClosingExportModal from './OpeningClosingExportModal'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** "John Smith" → "JS" */
function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
}

function todayStr() { return format(new Date(), 'yyyy-MM-dd') }

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useChecks(venueId) {
  const [checks, setChecks]   = useState([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    if (!venueId) return
    const { data } = await supabase
      .from('opening_closing_checks')
      .select('id, title, type, sort_order, created_at')
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .order('sort_order')
      .order('created_at')
    setChecks(data ?? [])
    setLoading(false)
  }, [venueId])
  useEffect(() => { load() }, [load])
  return { checks, loading, reload: load }
}

function useCompletionsForDate(sessionDate, venueId) {
  const [completions, setCompletions] = useState([])
  const load = useCallback(async () => {
    if (!venueId || !sessionDate) return
    const { data } = await supabase
      .from('opening_closing_completions')
      .select('id, check_id, session_date, session_type, completed_at, staff_name, corrective_action')
      .eq('venue_id', venueId)
      .eq('session_date', sessionDate)
    setCompletions(data ?? [])
  }, [sessionDate, venueId])
  useEffect(() => { load() }, [load])
  return { completions, reload: load }
}

// ── IssueModal ────────────────────────────────────────────────────────────────

function IssueModal({ check, onConfirm, onCancel, saving }) {
  const [action, setAction] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-charcoal/40 backdrop-blur-sm">
      <div
        className="bg-white rounded-2xl w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <div>
          <p className="text-[11px] tracking-widest uppercase text-warning mb-1">Issue Flagged</p>
          <h3 className="font-semibold text-charcoal text-lg">{check.title}</h3>
          <p className="text-xs text-charcoal/40 mt-1">
            Describe what corrective action was taken. This will appear in the audit log.
          </p>
        </div>
        <div>
          <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">
            Corrective Action Taken <span className="text-danger">*</span>
          </label>
          <textarea
            value={action}
            onChange={e => setAction(e.target.value)}
            placeholder="e.g. Back door lock was stiff, reported to maintenance and used side entrance for closing."
            rows={4}
            autoFocus
            className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-charcoal/20"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onConfirm(action.trim())}
            disabled={saving || !action.trim()}
            className="flex-1 bg-warning text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-warning/90 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Issue →'}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2.5 rounded-lg border border-charcoal/15 text-sm text-charcoal/50 hover:border-charcoal/30 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── CheckRow ──────────────────────────────────────────────────────────────────

function CheckRow({ check, completion, onOK, onIssue, readOnly, isManager, onRemove, saving }) {
  const done = !!completion
  const hasIssue = completion?.has_issue ?? false

  return (
    <div className={`flex items-start gap-3 px-5 py-3 group ${done ? 'opacity-70' : ''}`}>
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
        <span className="w-[26px] h-[26px] rounded-full shrink-0 border-2 border-charcoal/12 mt-px" />
      ) : (
        <button
          onClick={() => onOK(check)}
          disabled={saving}
          aria-label="Mark OK"
          className="w-[26px] h-[26px] rounded-full shrink-0 p-0 grid place-items-center border-2 border-charcoal/20 bg-transparent text-transparent hover:bg-success hover:border-success hover:text-white transition-colors disabled:cursor-wait mt-px"
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
        <p className={`text-[15px] font-medium tracking-[-0.01em] leading-snug break-words ${done ? 'text-charcoal/60' : 'text-charcoal'}`}>
          {check.title}
        </p>
        {done && completion.staff_name && (
          <p className="text-[11.5px] text-charcoal/35 mt-0.5 break-words">
            {completion.staff_name} · {format(new Date(completion.completed_at), 'HH:mm')}
            {hasIssue && completion.corrective_action && <span className="text-warning/70 italic"> · "{completion.corrective_action}"</span>}
          </p>
        )}
        {!done && readOnly && (
          <p className="text-[11.5px] text-charcoal/30 italic mt-0.5">Not recorded</p>
        )}
      </div>

      {/* Flag issue + remove */}
      {!done && !readOnly && (
        <button
          onClick={() => onIssue(check)}
          disabled={saving}
          className="shrink-0 text-[11px] font-bold tracking-wide uppercase text-warning/70 hover:text-warning transition-colors disabled:opacity-50 px-1 mt-1"
        >
          Issue
        </button>
      )}
      {isManager && !readOnly && (
        <button
          onClick={() => onRemove(check.id)}
          aria-label="Remove check"
          className="opacity-0 group-hover:opacity-100 shrink-0 w-7 h-7 rounded-lg grid place-items-center text-charcoal/25 hover:text-danger hover:bg-danger/8 transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      )}
    </div>
  )
}

// ── CheckSection ──────────────────────────────────────────────────────────────

function CheckSection({ type, label, checks, completions, onOK, onIssue, isManager, onAddCheck, onRemoveCheck, venueId, readOnly, savingCheckId }) {
  const toast = useToast()
  const typeChecks      = checks.filter(c => c.type === type)
  const typeCompletions = completions.filter(c => c.session_type === type)
  const doneCount       = typeChecks.filter(c => typeCompletions.some(cp => cp.check_id === c.id)).length
  const issueCount      = typeCompletions.filter(c => c.has_issue).length
  const allDone         = typeChecks.length > 0 && doneCount === typeChecks.length

  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [saving, setSaving]   = useState(false)

  const handleAdd = async () => {
    if (!newTitle.trim()) return
    setSaving(true)
    const { error } = await supabase.from('opening_closing_checks').insert({
      title: newTitle.trim(),
      type,
      sort_order: typeChecks.length,
      venue_id: venueId,
    })
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    setNewTitle('')
    setShowAdd(false)
    onAddCheck()
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div>
          <p className="text-[11px] font-bold tracking-widest uppercase text-charcoal/50">{label}</p>
          <p className="text-xs text-charcoal/40 mt-0.5">
            {doneCount}/{typeChecks.length} recorded
            {issueCount > 0 && (
              <span className="ml-2 text-warning font-semibold">· {issueCount} issue{issueCount > 1 ? 's' : ''}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {allDone && issueCount === 0 && (
            <span className="text-[11px] font-bold tracking-widest uppercase text-success bg-success/10 px-2.5 py-1 rounded-full">
              <span className="inline-flex items-center gap-1">All Clear <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg></span>
            </span>
          )}
          {allDone && issueCount > 0 && (
            <span className="text-[11px] font-bold tracking-widest uppercase text-warning bg-warning/10 px-2.5 py-1 rounded-full">
              <span className="inline-flex items-center gap-1">Complete <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>
            </span>
          )}
          {isManager && !readOnly && (
            <button
              onClick={() => setShowAdd(v => !v)}
              className="text-[11px] font-semibold text-charcoal/40 hover:text-charcoal transition-colors"
            >
              {showAdd ? 'Cancel' : '+ Add'}
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-charcoal/6 mx-5 rounded-full">
        <div
          className={`h-full rounded-full transition-all duration-300 ${issueCount > 0 ? 'bg-warning' : 'bg-success'}`}
          style={{ width: typeChecks.length > 0 ? `${(doneCount / typeChecks.length) * 100}%` : '0%' }}
        />
      </div>

      {/* Add check form */}
      {showAdd && isManager && (
        <div className="px-5 py-3 border-b border-charcoal/8 flex gap-2">
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="e.g. Check all fridges are at temperature"
            autoFocus
            className="flex-1 px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
          />
          <button
            onClick={handleAdd}
            disabled={saving || !newTitle.trim()}
            className="bg-charcoal text-cream px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-charcoal/90 transition-colors whitespace-nowrap"
          >
            {saving ? '…' : 'Add →'}
          </button>
        </div>
      )}

      {/* Rows */}
      <div className="flex flex-col divide-y divide-charcoal/6">
        {typeChecks.slice().sort((a, b) => {
          const aDone = typeCompletions.some(c => c.check_id === a.id) ? 1 : 0
          const bDone = typeCompletions.some(c => c.check_id === b.id) ? 1 : 0
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
              onRemove={onRemoveCheck}
              saving={savingCheckId === check.id}
            />
          )
        })}
        {typeChecks.length === 0 && (
          <p className="text-sm text-charcoal/35 italic px-5 py-4">
            No {label.toLowerCase()} checks set up yet.
            {isManager && ' Click "+ Add Check" to get started.'}
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
    <div className="bg-white rounded-2xl p-1 flex items-center gap-1">
      <button
        onClick={() => onChange(prevDay)}
        className="p-2 rounded-xl text-charcoal/40 hover:text-charcoal hover:bg-charcoal/5 transition-colors"
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
              'flex-1 py-2 px-2 rounded-xl text-[12px] font-semibold transition-colors text-center truncate',
              d === value
                ? 'bg-brand text-white'
                : d > today
                ? 'text-charcoal/20 cursor-default'
                : 'text-charcoal/50 hover:bg-charcoal/5',
            ].join(' ')}
          >
            {labelFor(d)}
          </button>
        ))}
      </div>

      <button
        onClick={() => onChange(nextDay)}
        disabled={nextDay > today}
        className="p-2 rounded-xl text-charcoal/40 hover:text-charcoal hover:bg-charcoal/5 transition-colors disabled:opacity-25 disabled:cursor-default"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OpeningClosingPage() {
  const toast = useToast()
  const { venueId } = useVenue()
  const { session, isManager } = useSession()

  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [showExport, setShowExport]     = useState(false)

  const { checks, loading: checksLoading, reload: reloadChecks } = useChecks(venueId)
  const { completions, reload: reloadCompletions } = useCompletionsForDate(selectedDate, venueId)

  // Is the selected date strictly in the future? (tomorrow or later = read-only)
  const readOnly = selectedDate > todayStr()
  const isPast   = !isToday(parseISO(selectedDate))

  // ── Pending action state ──────────────────────────────────────────────────
  const [pendingCheck, setPendingCheck] = useState(null)   // check object
  const [pendingIsIssue, setPendingIsIssue] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingCheckId, setSavingCheckId] = useState(null)

  const openOK = (check) => {
    if (savingCheckId) return
    doComplete(check, false, null)
  }

  const openIssue = (check) => {
    if (savingCheckId) return
    setPendingCheck(check)
    setPendingIsIssue(true)
  }

  const cancelPending = () => {
    setPendingCheck(null)
    setPendingIsIssue(false)
  }

  const doComplete = async (check, hasIssue, correctiveAction) => {
    if (savingCheckId) return
    setSaving(true)
    setSavingCheckId(check.id)
    const { error } = await supabase.from('opening_closing_completions').insert({
      check_id:          check.id,
      session_date:      selectedDate,
      session_type:      check.type,
      staff_id:          session?.staffId   ?? null,
      staff_name:        session?.staffName ?? 'Unknown',
      has_issue:         hasIssue,
      corrective_action: correctiveAction || null,
      notes:             null,
      venue_id:          venueId,
    })
    setSaving(false)
    setSavingCheckId(null)
    setPendingCheck(null)
    setPendingIsIssue(false)
    if (error) { toast(error.message, 'error'); return }
    reloadCompletions()
  }

  const removeCheck = async (id) => {
    await supabase.from('opening_closing_checks').update({ is_active: false }).eq('id', id)
    reloadChecks()
  }

  if (checksLoading) {
    return <div className="flex justify-center pt-20"><LoadingSpinner size="lg" /></div>
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
          <p className="text-[11px] font-medium tracking-widest uppercase text-charcoal/40">{dateLabel}</p>
          <h1 className="text-2xl font-bold text-charcoal mt-0.5">Opening &amp; Closing</h1>
        </div>
        {isManager && (
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-1.5 bg-brand text-white text-[11px] font-bold tracking-wide px-3 py-2 rounded-xl hover:bg-brand/90 transition-colors shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0-3-3m3 3 3-3m2 8H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" /></svg>
            PDF
          </button>
        )}
      </div>

      {/* Date selector */}
      <div className="flex flex-col gap-2">
        <DateSelector value={selectedDate} onChange={setSelectedDate} />
        {isPast && (
          <p className="text-[11px] text-charcoal/40 italic px-1">
            Retroactive entry — checks will be logged against {format(parseISO(selectedDate), 'd MMM yyyy')}.
          </p>
        )}
      </div>

      {/* Check sections */}
      <div className="grid md:grid-cols-2 gap-4">
        <CheckSection
          type="opening"
          label="Opening Checks"
          checks={checks}
          completions={completions}
          onOK={openOK}
          onIssue={openIssue}
          isManager={isManager}
          onAddCheck={reloadChecks}
          onRemoveCheck={removeCheck}
          venueId={venueId}
          readOnly={readOnly}
          savingCheckId={savingCheckId}
        />
        <CheckSection
          type="closing"
          label="Closing Checks"
          checks={checks}
          completions={completions}
          onOK={openOK}
          onIssue={openIssue}
          isManager={isManager}
          onAddCheck={reloadChecks}
          onRemoveCheck={removeCheck}
          venueId={venueId}
          readOnly={readOnly}
          savingCheckId={savingCheckId}
        />
      </div>
    </div>
  )
}
