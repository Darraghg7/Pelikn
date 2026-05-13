import React, { useState, useEffect, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import EmptyState from '../../components/ui/EmptyState'
import { SkeletonList } from '../../components/ui/Skeleton'

// ── Hooks ────────────────────────────────────────────────────────────────────

function useTipSplits(venueId) {
  const [splits, setSplits] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!venueId) return
    const { data } = await supabase
      .from('tip_splits')
      .select('*, created_by_staff:created_by(id, name), tip_allocations(id, staff_id, amount, staff:staff_id(id, name))')
      .eq('venue_id', venueId)
      .order('split_date', { ascending: false })
    setSplits(data ?? [])
    setLoading(false)
  }, [venueId])

  useEffect(() => { load() }, [load])
  return { splits, loading, reload: load }
}

function useActiveStaff(venueId) {
  const [staff, setStaff] = useState([])

  useEffect(() => {
    if (!venueId) return
    supabase
      .from('staff')
      .select('id, name, job_role')
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setStaff(data ?? []))
  }, [venueId])

  return staff
}

// ── Add Tip Split Modal ──────────────────────────────────────────────────────

function AddTipSplitModal({ staff, venueId, managerId, onSaved, onClose }) {
  const toast = useToast()
  const [total, setTotal] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [amounts, setAmounts] = useState(() =>
    Object.fromEntries(staff.map(s => [s.id, '']))
  )
  const [saving, setSaving] = useState(false)

  const totalNum = parseFloat(total) || 0
  const allocated = Object.values(amounts).reduce((sum, v) => sum + (parseFloat(v) || 0), 0)
  const remaining = Math.round((totalNum - allocated) * 100) / 100
  const staffWithAmounts = staff.filter(s => parseFloat(amounts[s.id]) > 0)
  const canSave = totalNum > 0 && remaining === 0 && staffWithAmounts.length > 0

  function setAmount(staffId, value) {
    setAmounts(prev => ({ ...prev, [staffId]: value }))
  }

  function splitEvenly() {
    if (totalNum <= 0 || staff.length === 0) return
    const per = Math.floor((totalNum / staff.length) * 100) / 100
    const remainder = Math.round((totalNum - per * staff.length) * 100) / 100
    const newAmounts = {}
    staff.forEach((s, i) => {
      newAmounts[s.id] = (i === 0 ? per + remainder : per).toFixed(2)
    })
    setAmounts(newAmounts)
  }

  async function handleSave() {
    setSaving(true)
    const { data: split, error } = await supabase
      .from('tip_splits')
      .insert({ venue_id: venueId, total_amount: totalNum, split_date: date, created_by: managerId, notes: notes || null })
      .select()
      .single()

    if (error || !split) {
      toast.error('Failed to save tip split')
      setSaving(false)
      return
    }

    const allocations = staffWithAmounts.map(s => ({
      tip_split_id: split.id,
      staff_id: s.id,
      amount: parseFloat(amounts[s.id]),
    }))

    const { error: allocError } = await supabase
      .from('tip_allocations')
      .insert(allocations)

    if (allocError) {
      toast.error('Split created but failed to save allocations')
    } else {
      toast.success('Tip split saved')
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-charcoal/8">
          <h2 className="text-lg font-bold text-charcoal">Add Tip Split</h2>
          <button onClick={onClose} className="text-charcoal/30 hover:text-charcoal text-xl leading-none">&times;</button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-charcoal/50 mb-1 block">Total tips</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/40 text-sm">&pound;</span>
                <input
                  type="number" step="0.01" min="0" value={total}
                  onChange={e => setTotal(e.target.value)}
                  className="w-full border border-charcoal/15 rounded-xl py-2.5 pl-7 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                  placeholder="0.00"
                  autoFocus
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-charcoal/50 mb-1 block">Date</label>
              <input
                type="date" value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full border border-charcoal/15 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-charcoal/50 mb-1 block">Notes (optional)</label>
            <input
              type="text" value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full border border-charcoal/15 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              placeholder="e.g. Friday evening service"
            />
          </div>

          {totalNum > 0 && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-charcoal/50">Assign to staff</p>
                <button onClick={splitEvenly} className="text-xs text-brand font-medium hover:underline">
                  Split evenly
                </button>
              </div>

              <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
                {staff.map(s => (
                  <div key={s.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-charcoal truncate">{s.name}</p>
                      {s.job_role && <p className="text-[11px] text-charcoal/40">{s.job_role}</p>}
                    </div>
                    <div className="relative w-24 shrink-0">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-charcoal/40 text-xs">&pound;</span>
                      <input
                        type="number" step="0.01" min="0"
                        value={amounts[s.id]}
                        onChange={e => setAmount(s.id, e.target.value)}
                        className="w-full border border-charcoal/15 rounded-lg py-1.5 pl-6 pr-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-brand/30"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold ${
                remaining === 0 ? 'bg-success/8 text-success' :
                remaining < 0 ? 'bg-danger/8 text-danger' :
                'bg-warning/8 text-warning'
              }`}>
                <span>Remaining</span>
                <span>&pound;{remaining.toFixed(2)}</span>
              </div>
            </>
          )}
        </div>

        <div className="px-5 pb-5 pt-2 flex gap-3">
          <button onClick={onClose} className="flex-1 border border-charcoal/15 text-charcoal/60 py-2.5 rounded-xl text-sm font-medium hover:bg-charcoal/5 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="flex-1 bg-brand text-cream py-2.5 rounded-xl text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tip Split Card ───────────────────────────────────────────────────────────

function TipSplitCard({ split }) {
  const [expanded, setExpanded] = useState(false)
  const allocations = split.tip_allocations || []
  const createdBy = split.created_by_staff?.name || 'Unknown'

  return (
    <div className="bg-white rounded-2xl border border-charcoal/8 overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left"
      >
        <div>
          <p className="text-sm font-semibold text-charcoal">
            &pound;{parseFloat(split.total_amount).toFixed(2)}
          </p>
          <p className="text-[11px] text-charcoal/40 mt-0.5">
            {format(parseISO(split.split_date), 'EEE d MMM yyyy')} &middot; {createdBy}
            {split.notes && <> &middot; {split.notes}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-charcoal/35">{allocations.length} staff</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`text-charcoal/30 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </button>

      {expanded && allocations.length > 0 && (
        <div className="border-t border-charcoal/6 px-4 py-3 flex flex-col gap-1.5">
          {allocations
            .sort((a, b) => b.amount - a.amount)
            .map(a => (
              <div key={a.id} className="flex items-center justify-between">
                <span className="text-xs text-charcoal/60">{a.staff?.name || 'Unknown'}</span>
                <span className="text-xs font-semibold text-charcoal/70">&pound;{parseFloat(a.amount).toFixed(2)}</span>
              </div>
            ))
          }
        </div>
      )}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function TipsPage() {
  const { venueId } = useVenue()
  const { session, isManager } = useSession()
  const { splits, loading, reload } = useTipSplits(venueId)
  const staff = useActiveStaff(venueId)
  const [showAdd, setShowAdd] = useState(false)

  if (!isManager) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Tips</h1>
          <p className="text-sm text-charcoal/40 mt-1">Only managers can view tip distributions.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Tips</h1>
          <p className="text-sm text-charcoal/40 mt-1">Distribute and track tips across your team</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-accent text-cream px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-accent/90 transition-colors"
        >
          + Add Tip Split
        </button>
      </div>

      {loading ? (
        <SkeletonList count={3} />
      ) : splits.length === 0 ? (
        <EmptyState
          title="No tip splits yet"
          description="Add your first tip split to start tracking how tips are distributed across your team."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {splits.map(s => <TipSplitCard key={s.id} split={s} />)}
        </div>
      )}

      {showAdd && (
        <AddTipSplitModal
          staff={staff}
          venueId={venueId}
          managerId={session?.staffId}
          onSaved={() => { setShowAdd(false); reload() }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  )
}
