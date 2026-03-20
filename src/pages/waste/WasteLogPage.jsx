import React, { useState } from 'react'
import { format, subDays } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useWasteLogs } from '../../hooks/useWasteLogs'
import { useToast } from '../../components/ui/Toast'
import Modal from '../../components/ui/Modal'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { buildPdfReport } from '../../lib/pdfUtils'

const UNITS   = ['kg', 'portions', 'items', 'litres']
const REASONS = ['expired', 'spoiled', 'preparation', 'overproduction', 'other']
const REASON_LABELS = {
  expired: 'Expired', spoiled: 'Spoiled', preparation: 'Preparation Waste',
  overproduction: 'Overproduction', other: 'Other',
}

function nowLocal() {
  return format(new Date(), "yyyy-MM-dd'T'HH:mm")
}

function SectionLabel({ children }) {
  return <p className="text-[10px] tracking-widest uppercase text-charcoal/40 mb-3">{children}</p>
}

function groupByDate(logs) {
  const groups = {}
  for (const log of logs) {
    const d = format(new Date(log.recorded_at), 'yyyy-MM-dd')
    if (!groups[d]) groups[d] = []
    groups[d].push(log)
  }
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
}

export default function WasteLogPage() {
  const toast = useToast()
  const { venueId } = useVenue()
  const { session, isManager } = useSession()

  const today   = format(new Date(), 'yyyy-MM-dd')
  const weekAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd')

  const { logs, loading, reload } = useWasteLogs(weekAgo, today)

  // Form state
  const [form, setForm] = useState({
    item_name: '', quantity: '', unit: 'kg', reason: 'expired', notes: '', recorded_at: nowLocal(),
  })
  const [submitting, setSubmitting] = useState(false)

  // Export state
  const [showExport, setShowExport] = useState(false)
  const [exportFrom, setExportFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [exportTo,   setExportTo]   = useState(today)
  const [exporting,  setExporting]  = useState(false)

  const canSubmit = form.item_name.trim() && form.quantity !== '' && parseFloat(form.quantity) > 0

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    const { error } = await supabase.from('waste_logs').insert({
      item_name:        form.item_name.trim(),
      quantity:         parseFloat(form.quantity),
      unit:             form.unit,
      reason:           form.reason,
      notes:            form.notes.trim() || null,
      recorded_by:      session?.staffId,
      recorded_by_name: session?.staffName ?? 'Unknown',
      recorded_at:      new Date(form.recorded_at).toISOString(),
      venue_id:         venueId,
    })
    setSubmitting(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Waste logged')
    setForm({ item_name: '', quantity: '', unit: 'kg', reason: 'expired', notes: '', recorded_at: nowLocal() })
    reload()
  }

  const handleExportPdf = async () => {
    setExporting(true)
    const { data, error } = await supabase
      .from('waste_logs')
      .select('*')
      .eq('venue_id', venueId)
      .gte('recorded_at', exportFrom)
      .lte('recorded_at', exportTo + 'T23:59:59')
      .order('recorded_at')
    setExporting(false)
    if (error) { toast(error.message, 'error'); return }
    if (!data?.length) { toast('No waste records in this period', 'error'); return }
    buildPdfReport({
      title: 'SafeServ',
      subtitle: 'Waste Log Report',
      periodLabel: `${exportFrom} – ${exportTo}`,
      columns: ['Date & Time', 'Item', 'Qty', 'Unit', 'Reason', 'Logged By', 'Notes'],
      rows: data.map(r => [
        format(new Date(r.recorded_at), 'dd/MM/yyyy HH:mm'),
        r.item_name,
        r.quantity.toString(),
        r.unit,
        REASON_LABELS[r.reason] ?? r.reason,
        r.recorded_by_name ?? '—',
        r.notes ?? '',
      ]),
      filename: `waste-log-${exportFrom}-to-${exportTo}.pdf`,
    })
    toast('PDF exported')
    setShowExport(false)
  }

  if (loading) return <div className="flex justify-center pt-20"><LoadingSpinner size="lg" /></div>

  const grouped = groupByDate(logs)

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl text-charcoal">Waste Log</h1>
        {isManager && (
          <button
            onClick={() => setShowExport(true)}
            className="text-[11px] tracking-widest uppercase text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20"
          >
            Export PDF
          </button>
        )}
      </div>

      {/* Export modal */}
      <Modal open={showExport} onClose={() => setShowExport(false)} title="Export Waste Log">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-1.5">From</label>
              <input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-cream/30 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20" />
            </div>
            <div>
              <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-1.5">To</label>
              <input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-cream/30 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20" />
            </div>
          </div>
          <button onClick={handleExportPdf} disabled={exporting}
            className="w-full bg-charcoal text-cream py-2.5 rounded-lg text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40">
            {exporting ? 'Generating…' : 'Export PDF →'}
          </button>
        </div>
      </Modal>

      {/* Log form */}
      <div className="bg-white rounded-xl border border-charcoal/10 p-5">
        <SectionLabel>Log Waste</SectionLabel>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          <div>
            <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-2">Item Name</label>
            <input
              value={form.item_name}
              onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))}
              placeholder="e.g. Chicken breast, Mixed salad"
              className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-2">Quantity</label>
              <input
                type="number" step="0.1" min="0"
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder="0.0"
                className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            </div>
            <div>
              <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-2">Unit</label>
              <div className="flex flex-wrap gap-1.5">
                {UNITS.map(u => (
                  <button key={u} type="button"
                    onClick={() => setForm(f => ({ ...f, unit: u }))}
                    className={[
                      'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                      form.unit === u
                        ? 'bg-charcoal text-cream border-charcoal'
                        : 'bg-white text-charcoal/50 border-charcoal/15 hover:border-charcoal/35',
                    ].join(' ')}>
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-2">Reason</label>
            <div className="flex flex-wrap gap-1.5">
              {REASONS.map(r => (
                <button key={r} type="button"
                  onClick={() => setForm(f => ({ ...f, reason: r }))}
                  className={[
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                    form.reason === r
                      ? 'bg-charcoal text-cream border-charcoal'
                      : 'bg-white text-charcoal/50 border-charcoal/15 hover:border-charcoal/35',
                  ].join(' ')}>
                  {REASON_LABELS[r]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-2">Time of Waste</label>
            <input
              type="datetime-local"
              value={form.recorded_at}
              onChange={e => setForm(f => ({ ...f, recorded_at: e.target.value }))}
              max={nowLocal()}
              className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-cream/30 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>

          <div>
            <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-2">Notes <span className="normal-case text-charcoal/30">(optional)</span></label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Any additional details"
              rows={2}
              className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-cream/30 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>

          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="bg-charcoal text-cream px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed self-start"
          >
            {submitting ? '…' : 'Log Waste →'}
          </button>
        </form>
      </div>

      {/* Log list */}
      {grouped.length > 0 && (
        <div className="flex flex-col gap-4">
          <SectionLabel>Recent Waste (last 7 days)</SectionLabel>
          {grouped.map(([date, entries]) => (
            <div key={date} className="bg-white rounded-xl border border-charcoal/10 overflow-hidden">
              <div className="px-5 py-3 border-b border-charcoal/8">
                <p className="text-xs font-medium text-charcoal/50 uppercase tracking-widest">
                  {format(new Date(date + 'T12:00:00'), 'EEEE d MMMM')}
                </p>
              </div>
              <div className="divide-y divide-charcoal/6">
                {entries.map(log => (
                  <div key={log.id} className="flex items-center justify-between px-5 py-3 gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-charcoal truncate">{log.item_name}</p>
                      <p className="text-xs text-charcoal/40 mt-0.5">
                        {REASON_LABELS[log.reason]} · {log.recorded_by_name}
                      </p>
                      {log.notes && <p className="text-xs text-charcoal/35 italic mt-0.5">"{log.notes}"</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-sm font-semibold text-charcoal">{log.quantity} {log.unit}</p>
                      <p className="text-xs text-charcoal/40">{format(new Date(log.recorded_at), 'HH:mm')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {grouped.length === 0 && (
        <div className="bg-white rounded-xl border border-charcoal/10 p-8 text-center">
          <p className="text-charcoal/40 text-sm">No waste logged this week.</p>
        </div>
      )}
    </div>
  )
}
