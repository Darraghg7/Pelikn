import React, { useState, useEffect, useCallback } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'

function useCorrectiveActions(venueId) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    if (!venueId) return
    setLoading(true)
    const { data } = await supabase
      .from('corrective_actions')
      .select('*, reporter:staff!reported_by(name), resolver:staff!resolved_by(name)')
      .eq('venue_id', venueId)
      .order('reported_at', { ascending: false })
      .limit(200)
    setRecords(data ?? [])
    setLoading(false)
  }, [venueId])
  useEffect(() => { load() }, [load])
  return { records, loading, reload: load }
}

const CATEGORIES = [
  { value: 'temperature', label: 'Temperature Issue' },
  { value: 'cleaning', label: 'Cleaning Issue' },
  { value: 'delivery', label: 'Delivery Issue' },
  { value: 'pest', label: 'Pest Control' },
  { value: 'equipment', label: 'Equipment Issue' },
  { value: 'food_safety', label: 'Food Safety' },
  { value: 'staff', label: 'Staff / Hygiene' },
  { value: 'other', label: 'Other' },
]

const SEVERITIES = [
  { value: 'minor', label: 'Minor', color: 'bg-warning/10 text-warning' },
  { value: 'major', label: 'Major', color: 'bg-orange-100 text-orange-700' },
  { value: 'critical', label: 'Critical', color: 'bg-danger/10 text-danger' },
]

const EMPTY_FORM = {
  category: 'temperature',
  title: '',
  description: '',
  action_taken: '',
  severity: 'minor',
}

export default function CorrectiveActionsPage() {
  const toast = useToast()
  const { venueId } = useVenue()
  const { session, isManager } = useSession()
  const { records, loading, reload } = useCorrectiveActions(venueId)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all') // all | open | resolved
  const [filterCat, setFilterCat] = useState('all')
  const [resolving, setResolving] = useState(null)

  const save = async () => {
    if (!form.title.trim()) { toast('Title is required', 'error'); return }
    if (!form.action_taken.trim()) { toast('Corrective action is required', 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('corrective_actions').insert({
      category: form.category,
      title: form.title.trim(),
      description: form.description.trim() || null,
      action_taken: form.action_taken.trim(),
      severity: form.severity,
      reported_by: session?.staffId,
      venue_id: venueId,
    })
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Corrective action logged')
    setForm(EMPTY_FORM)
    setShowForm(false)
    reload()
  }

  const resolve = async (id) => {
    setResolving(id)
    const { error } = await supabase.from('corrective_actions').update({
      status: 'resolved',
      resolved_by: session?.staffId,
      resolved_at: new Date().toISOString(),
    }).eq('id', id)
    setResolving(null)
    if (error) { toast(error.message, 'error'); return }
    toast('Marked as resolved')
    reload()
  }

  const filtered = records
    .filter(r => filterStatus === 'all' || r.status === filterStatus)
    .filter(r => filterCat === 'all' || r.category === filterCat)

  const openCount = records.filter(r => r.status === 'open').length
  const criticalOpen = records.filter(r => r.status === 'open' && r.severity === 'critical').length

  const catLabel = (cat) => CATEGORIES.find(c => c.value === cat)?.label ?? cat
  const sevConfig = (sev) => SEVERITIES.find(s => s.value === sev) ?? SEVERITIES[0]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-charcoal">Corrective Actions</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-charcoal text-cream px-4 py-2 rounded-lg text-sm font-medium hover:bg-charcoal/90 transition-colors self-start sm:self-auto"
        >
          + Log Issue
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border-charcoal/10 p-4 text-center">
          <p className="text-[11px] tracking-widest uppercase text-charcoal/40">Open</p>
          <p className={`text-2xl font-bold ${openCount > 0 ? 'text-warning' : 'text-charcoal'}`}>{openCount}</p>
        </div>
        <div className="bg-white rounded-2xl border-charcoal/10 p-4 text-center">
          <p className="text-[11px] tracking-widest uppercase text-charcoal/40">Critical</p>
          <p className={`text-2xl font-bold ${criticalOpen > 0 ? 'text-danger' : 'text-charcoal'}`}>{criticalOpen}</p>
        </div>
        <div className="bg-white rounded-2xl border-charcoal/10 p-4 text-center">
          <p className="text-[11px] tracking-widest uppercase text-charcoal/40">Total</p>
          <p className="text-2xl font-bold text-charcoal">{records.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {['all', 'open', 'resolved'].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              filterStatus === s
                ? 'bg-charcoal text-cream border-charcoal'
                : 'bg-white text-charcoal/50 border-charcoal/15 hover:border-charcoal/30'
            }`}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs border border-charcoal/15 bg-white text-charcoal/60 focus:outline-none"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {/* Records */}
      {loading ? (
        <div className="flex justify-center py-10"><LoadingSpinner /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border-charcoal/10 p-10 text-center">
          <p className="text-charcoal/30 text-sm">No corrective actions logged yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(r => {
            const sev = sevConfig(r.severity)
            return (
              <div key={r.id} className={`bg-white rounded-2xl p-4 ${
                r.status === 'open' ? 'border-warning/25' : 'border-charcoal/10'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={`font-semibold text-sm ${r.status === 'resolved' ? 'text-charcoal/50 line-through' : 'text-charcoal'}`}>
                        {r.title}
                      </h3>
                      <span className={`text-[11px] tracking-wider uppercase font-medium px-2 py-0.5 rounded-full ${sev.color}`}>
                        {sev.label}
                      </span>
                      <span className="text-[11px] tracking-wider uppercase font-medium px-2 py-0.5 rounded-full bg-charcoal/5 text-charcoal/40">
                        {catLabel(r.category)}
                      </span>
                    </div>
                    {r.description && <p className="text-sm text-charcoal/60 mt-1">{r.description}</p>}
                    <div className="mt-2 rounded-lg bg-charcoal/4 px-3 py-2">
                      <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-0.5">Action taken</p>
                      <p className="text-sm text-charcoal/70">{r.action_taken}</p>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-charcoal/40">
                      <span>Reported by {r.reporter?.name ?? 'Unknown'}</span>
                      <span>{formatDistanceToNow(new Date(r.reported_at), { addSuffix: true })}</span>
                      {r.status === 'resolved' && r.resolver && (
                        <span className="text-success">Resolved by {r.resolver.name}</span>
                      )}
                    </div>
                  </div>
                  {r.status === 'open' && isManager && (
                    <button
                      onClick={() => resolve(r.id)}
                      disabled={resolving === r.id}
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-success text-white text-xs font-medium hover:bg-success/90 transition-colors disabled:opacity-40"
                    >
                      {resolving === r.id ? '...' : 'Resolve'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add form modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Log Corrective Action">
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, category: c.value }))}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    form.category === c.value
                      ? 'bg-charcoal text-cream border-charcoal'
                      : 'bg-white text-charcoal/50 border-charcoal/15 hover:border-charcoal/30'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">Severity</label>
            <div className="grid grid-cols-3 gap-2">
              {SEVERITIES.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, severity: s.value }))}
                  className={`py-2 rounded-xl border text-xs font-medium transition-all text-center ${
                    form.severity === s.value
                      ? `${s.color} border-current`
                      : 'bg-white text-charcoal/50 border-charcoal/15 hover:border-charcoal/30'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">
              What happened? <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Fridge 2 above 8C"
              className="w-full px-4 py-2.5 rounded-xl border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>

          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">Details</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              placeholder="Any additional context..."
              className="w-full px-4 py-2.5 rounded-xl border border-charcoal/15 bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>

          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1">
              Action taken <span className="text-danger">*</span>
            </label>
            <textarea
              value={form.action_taken}
              onChange={e => setForm(f => ({ ...f, action_taken: e.target.value }))}
              rows={3}
              placeholder="e.g. Moved food to Fridge 1, called engineer, disposed of affected items"
              className="w-full px-4 py-2.5 rounded-xl border border-charcoal/15 bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>

          <button
            onClick={save}
            disabled={saving || !form.title.trim() || !form.action_taken.trim()}
            className="bg-charcoal text-cream py-3 rounded-xl text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40"
          >
            {saving ? 'Saving...' : 'Log Corrective Action'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
