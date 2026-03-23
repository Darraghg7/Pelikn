import React, { useState, useEffect, useCallback } from 'react'
import { format, parseISO, isToday, isYesterday, isFuture, subDays } from 'date-fns'
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
      .select('*')
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
      .select('*')
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
            placeholder="e.g. Back door lock was stiff — reported to maintenance and used side entrance for closing."
            rows={4}
            autoFocus
            className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-cream/30 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-charcoal/20"
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

function CheckRow({ check, completion, onOK, onIssue, readOnly, isManager, onRemove }) {
  const done = !!completion
  const hasIssue = completion?.has_issue ?? false

  return (
    <div className={`flex items-start gap-3 px-5 py-4 group ${done ? 'opacity-75' : ''}`}>
      {/* Status indicator */}
      <div className="shrink-0 mt-0.5">
        {done ? (
          <span
            className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold ${
              hasIssue
                ? 'bg-warning/15 text-warning'
                : 'bg-success/15 text-success'
            }`}
          >
            {hasIssue ? '!' : '✓'}
          </span>
        ) : (
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-charcoal/5 text-charcoal/30 text-[11px]">
            ○
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${done ? 'text-charcoal/50' : 'text-charcoal'}`}>
          {check.title}
        </p>

        {done ? (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span className="inline-flex items-center gap-1 text-[11px] text-charcoal/40">
              <span className="font-semibold text-charcoal/60">{initials(completion.staff_name)}</span>
              · {format(new Date(completion.completed_at), 'HH:mm')}
              {completion.staff_name && (
                <span className="text-charcoal/30">({completion.staff_name})</span>
              )}
            </span>
            {hasIssue && completion.corrective_action && (
              <span className="text-[11px] text-warning/80 italic">
                "{completion.corrective_action}"
              </span>
            )}
          </div>
        ) : !readOnly ? (
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => onOK(check)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 text-success text-xs font-medium hover:bg-success/20 transition-colors"
            >
              <span>✓</span> OK
            </button>
            <button
              onClick={() => onIssue(check)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-warning/10 text-warning text-xs font-medium hover:bg-warning/20 transition-colors"
            >
              <span>⚠</span> Issue
            </button>
          </div>
        ) : (
          <p className="text-[11px] text-charcoal/30 mt-1 italic">Not recorded</p>
        )}
      </div>

      {/* Manager remove */}
      {isManager && !done && !readOnly && (
        <button
          onClick={() => onRemove(check.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-charcoal/25 hover:text-danger shrink-0 px-1 pt-0.5"
        >
          ×
        </button>
      )}
    </div>
  )
}

// ── CheckSection ──────────────────────────────────────────────────────────────

function CheckSection({ type, label, checks, completions, onOK, onIssue, isManager, onAddCheck, onRemoveCheck, venueId, readOnly }) {
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
    <div className="bg-white rounded-xl border border-charcoal/10 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-charcoal/8">
        <div>
          <p className="font-semibold text-charcoal">{label}</p>
          <p className="text-xs text-charcoal/40 mt-0.5">
            {doneCount}/{typeChecks.length} recorded
            {issueCount > 0 && (
              <span className="ml-2 text-warning font-medium">· {issueCount} issue{issueCount > 1 ? 's' : ''}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {allDone && issueCount === 0 && (
            <span className="text-[11px] tracking-widest uppercase font-medium text-success bg-success/10 px-2.5 py-1 rounded-full">
              All Clear ✓
            </span>
          )}
          {allDone && issueCount > 0 && (
            <span className="text-[11px] tracking-widest uppercase font-medium text-warning bg-warning/10 px-2.5 py-1 rounded-full">
              Complete ⚠
            </span>
          )}
          {isManager && !readOnly && (
            <button
              onClick={() => setShowAdd(v => !v)}
              className="text-[11px] tracking-widest uppercase text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20"
            >
              {showAdd ? 'Cancel' : '+ Add Check'}
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-charcoal/8">
        <div
          className={`h-full transition-all duration-300 ${issueCount > 0 ? 'bg-warning' : 'bg-success'}`}
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
            className="flex-1 px-3 py-2 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
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
        {typeChecks.map(check => {
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
  const dayBefore = format(subDays(new Date(), 2), 'yyyy-MM-dd')

  const presets = [
    { label: 'Today',     value: today },
    { label: 'Yesterday', value: yesterday },
    { label: format(parseISO(dayBefore), 'EEE d MMM'), value: dayBefore },
  ]

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {presets.map(p => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            value === p.value
              ? 'bg-charcoal text-cream'
              : 'bg-charcoal/8 text-charcoal/60 hover:bg-charcoal/12'
          }`}
        >
          {p.label}
        </button>
      ))}
      <input
        type="date"
        value={value}
        max={today}
        onChange={e => e.target.value && onChange(e.target.value)}
        className="px-3 py-1.5 rounded-lg border border-charcoal/15 text-xs text-charcoal/60 bg-white focus:outline-none focus:ring-2 focus:ring-charcoal/20"
      />
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

  // Is the selected date in the future? (shouldn't be reachable but guard anyway)
  const readOnly = isFuture(parseISO(selectedDate + 'T23:59:59'))
  const isPast   = !isToday(parseISO(selectedDate))

  // ── Pending action state ──────────────────────────────────────────────────
  const [pendingCheck, setPendingCheck] = useState(null)   // check object
  const [pendingIsIssue, setPendingIsIssue] = useState(false)
  const [saving, setSaving] = useState(false)

  const openOK = (check) => {
    setPendingCheck(check)
    setPendingIsIssue(false)
  }

  const openIssue = (check) => {
    setPendingCheck(check)
    setPendingIsIssue(true)
  }

  const cancelPending = () => {
    setPendingCheck(null)
    setPendingIsIssue(false)
  }

  // OK press — no modal needed, save immediately
  useEffect(() => {
    if (pendingCheck && !pendingIsIssue) {
      doComplete(pendingCheck, false, null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCheck, pendingIsIssue])

  const doComplete = async (check, hasIssue, correctiveAction) => {
    setSaving(true)
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
    ? `Yesterday — ${format(parseISO(selectedDate), 'EEEE d MMMM')}`
    : format(parseISO(selectedDate), 'EEEE, d MMMM yyyy')

  return (
    <div className="flex flex-col gap-6">
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
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-charcoal/40 mb-1">{dateLabel}</p>
          <h1 className="font-serif text-3xl text-brand">Opening &amp; Closing</h1>
        </div>
        {isManager && (
          <button
            onClick={() => setShowExport(true)}
            className="text-[11px] tracking-widest uppercase text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20"
          >
            Export PDF
          </button>
        )}
      </div>

      {/* Date selector */}
      <div className="flex flex-col gap-2">
        <p className="text-[11px] tracking-widest uppercase text-charcoal/35">Viewing checks for</p>
        <DateSelector value={selectedDate} onChange={setSelectedDate} />
        {isPast && (
          <p className="text-[11px] text-charcoal/40 italic">
            Retroactive entry — checks recorded here will be timestamped with the current time but logged against {format(parseISO(selectedDate), 'd MMM yyyy')}.
          </p>
        )}
      </div>

      {/* Check sections */}
      <div className="grid md:grid-cols-2 gap-6">
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
        />
      </div>
    </div>
  )
}
