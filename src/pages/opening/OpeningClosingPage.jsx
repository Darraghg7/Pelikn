import React, { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

function SectionLabel({ children }) {
  return <p className="text-[10px] tracking-widest uppercase text-charcoal/40 mb-3">{children}</p>
}

// ── Hooks ────────────────────────────────────────────────────────────────────

function useChecks() {
  const [checks, setChecks] = useState([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    const { data } = await supabase
      .from('opening_closing_checks')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .order('created_at')
    setChecks(data ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])
  return { checks, loading, reload: load }
}

function useTodayCompletions(sessionDate) {
  const [completions, setCompletions] = useState([])
  const load = useCallback(async () => {
    const { data } = await supabase
      .from('opening_closing_completions')
      .select('*')
      .eq('session_date', sessionDate)
    setCompletions(data ?? [])
  }, [sessionDate])
  useEffect(() => { load() }, [load])
  return { completions, reload: load }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CheckItem({ check, completion, onMark }) {
  const done = !!completion
  return (
    <div className={`flex items-center gap-4 px-5 py-3.5 ${done ? 'opacity-60' : ''}`}>
      <button
        onClick={() => !done && onMark(check)}
        className={[
          'w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-all',
          done
            ? 'bg-success border-success text-white cursor-default'
            : 'border-charcoal/25 hover:border-charcoal/60 cursor-pointer',
        ].join(' ')}
      >
        {done && <span className="text-[10px] font-bold">✓</span>}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${done ? 'line-through text-charcoal/40' : 'text-charcoal'}`}>
          {check.title}
        </p>
        {done && completion.staff_name && (
          <p className="text-[11px] text-charcoal/35 mt-0.5">
            {completion.staff_name} · {format(new Date(completion.completed_at), 'HH:mm')}
            {completion.notes && ` · "${completion.notes}"`}
          </p>
        )}
      </div>
    </div>
  )
}

function CheckList({ type, label, checks, completions, onMark, isManager, onAddCheck, onRemoveCheck }) {
  const typeChecks = checks.filter(c => c.type === type)
  const typeCompletions = completions.filter(c => c.session_type === type)
  const doneCount = typeChecks.filter(c => typeCompletions.some(cp => cp.check_id === c.id)).length
  const allDone = typeChecks.length > 0 && doneCount === typeChecks.length

  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    if (!newTitle.trim()) return
    setSaving(true)
    const { error } = await supabase.from('opening_closing_checks').insert({
      title: newTitle.trim(),
      type,
      sort_order: typeChecks.length,
    })
    setSaving(false)
    if (error) { return }
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
          <p className="text-xs text-charcoal/40 mt-0.5">{doneCount}/{typeChecks.length} complete</p>
        </div>
        <div className="flex items-center gap-3">
          {allDone && (
            <span className="text-[10px] tracking-widest uppercase font-medium text-success bg-success/10 px-2.5 py-1 rounded-full">
              Complete ✓
            </span>
          )}
          {isManager && (
            <button
              onClick={() => setShowAdd(v => !v)}
              className="text-[10px] tracking-widest uppercase text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20"
            >
              {showAdd ? 'Cancel' : '+ Add Check'}
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-charcoal/8">
        <div
          className="h-full bg-success transition-all duration-300"
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

      {/* Check items */}
      <div className="flex flex-col divide-y divide-charcoal/6">
        {typeChecks.map(check => {
          const completion = typeCompletions.find(c => c.check_id === check.id) ?? null
          return (
            <div key={check.id} className="flex items-center group">
              <div className="flex-1">
                <CheckItem check={check} completion={completion} onMark={onMark} />
              </div>
              {isManager && !completion && (
                <button
                  onClick={() => onRemoveCheck(check.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-charcoal/25 hover:text-danger px-4 shrink-0"
                >
                  ×
                </button>
              )}
            </div>
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

// ── Main page ────────────────────────────────────────────────────────────────

export default function OpeningClosingPage() {
  const toast = useToast()
  const { session, isManager } = useSession()
  const today = format(new Date(), 'yyyy-MM-dd')

  const { checks, loading: checksLoading, reload: reloadChecks } = useChecks()
  const { completions, reload: reloadCompletions } = useTodayCompletions(today)

  // ── Complete modal ───────────────────────────────────────────────────────
  const [pendingCheck, setPendingCheck] = useState(null) // { check, sessionType }
  const [notes, setNotes] = useState('')
  const [completing, setCompleting] = useState(false)

  const openMark = (check) => {
    setPendingCheck(check)
    setNotes('')
  }

  const confirmMark = async () => {
    if (!pendingCheck) return
    setCompleting(true)
    const { error } = await supabase.from('opening_closing_completions').insert({
      check_id:     pendingCheck.id,
      session_date: today,
      session_type: pendingCheck.type,
      staff_id:     session?.staffId,
      staff_name:   session?.staffName ?? 'Unknown',
      notes:        notes.trim() || null,
    })
    setCompleting(false)
    if (error) { toast(error.message, 'error'); return }
    setPendingCheck(null)
    reloadCompletions()
  }

  const removeCheck = async (id) => {
    await supabase.from('opening_closing_checks').update({ is_active: false }).eq('id', id)
    reloadChecks()
  }

  if (checksLoading) {
    return <div className="flex justify-center pt-20"><LoadingSpinner size="lg" /></div>
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-charcoal/40 mb-1">{format(new Date(), 'EEEE, d MMMM')}</p>
        <h1 className="font-serif text-3xl text-charcoal">Opening &amp; Closing</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <CheckList
          type="opening"
          label="Opening Checks"
          checks={checks}
          completions={completions}
          onMark={openMark}
          isManager={isManager}
          onAddCheck={reloadChecks}
          onRemoveCheck={removeCheck}
        />
        <CheckList
          type="closing"
          label="Closing Checks"
          checks={checks}
          completions={completions}
          onMark={openMark}
          isManager={isManager}
          onAddCheck={reloadChecks}
          onRemoveCheck={removeCheck}
        />
      </div>

      {/* Mark complete modal */}
      {pendingCheck && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-charcoal/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl">
            <div>
              <p className="text-[10px] tracking-widest uppercase text-charcoal/40 mb-1">Mark Complete</p>
              <h3 className="font-semibold text-charcoal text-lg">{pendingCheck.title}</h3>
            </div>
            <div>
              <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-2">
                Comment <span className="normal-case text-charcoal/30">(optional — add if something needs flagging)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Back door lock is stiff — needs attention"
                rows={3}
                className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-cream/30 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={confirmMark}
                disabled={completing}
                className="flex-1 bg-charcoal text-cream py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-charcoal/90 transition-colors"
              >
                {completing ? 'Saving…' : 'Mark Complete →'}
              </button>
              <button
                onClick={() => setPendingCheck(null)}
                className="px-4 py-2.5 rounded-lg border border-charcoal/15 text-sm text-charcoal/50 hover:border-charcoal/30 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
