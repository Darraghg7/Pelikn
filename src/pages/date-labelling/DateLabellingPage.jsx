import React, { useState, useEffect, useCallback } from 'react'
import { format, subDays, isPast } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import Modal from '../../components/ui/Modal'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { buildPdfReport } from '../../lib/pdfUtils'

const STORAGE_LOCATIONS = ['Walk-in fridge', 'Reach-in fridge', 'Freezer', 'Dry store', 'Counter']

function SectionLabel({ children }) {
  return <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-3">{children}</p>
}

function groupByDate(logs) {
  const groups = {}
  for (const log of logs) {
    const d = log.opened_date
    if (!groups[d]) groups[d] = []
    groups[d].push(log)
  }
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
}

export default function DateLabellingPage() {
  const toast = useToast()
  const { venueId } = useVenue()
  const { session, isManager } = useSession()

  const today = format(new Date(), 'yyyy-MM-dd')

  // Data state
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchLogs = useCallback(async () => {
    if (!venueId) return
    const weekAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd')
    const { data, error } = await supabase
      .from('date_labelling_logs')
      .select('*')
      .eq('venue_id', venueId)
      .gte('opened_date', weekAgo)
      .order('opened_date', { ascending: false })
    setLoading(false)
    if (error) { toast(error.message, 'error'); return }
    setLogs(data ?? [])
  }, [venueId, toast])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  // Form state
  const [form, setForm] = useState({
    item_name: '',
    opened_date: today,
    use_by_date: '',
    storage_location: '',
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)

  // Export state
  const [showExport, setShowExport] = useState(false)
  const [exportFrom, setExportFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [exportTo, setExportTo] = useState(today)
  const [exporting, setExporting] = useState(false)

  const canSubmit =
    form.item_name.trim() !== '' &&
    form.use_by_date !== '' &&
    form.use_by_date >= form.opened_date

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    const { error } = await supabase.from('date_labelling_logs').insert({
      item_name:         form.item_name.trim(),
      opened_date:       form.opened_date,
      use_by_date:       form.use_by_date,
      storage_location:  form.storage_location || null,
      notes:             form.notes.trim() || null,
      recorded_by:       session?.staffId,
      recorded_by_name:  session?.staffName ?? 'Unknown',
      recorded_at:       new Date().toISOString(),
      venue_id:          venueId,
    })
    setSubmitting(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Item logged')
    setForm({ item_name: '', opened_date: today, use_by_date: '', storage_location: '', notes: '' })
    fetchLogs()
  }

  const handleExportPdf = async () => {
    setExporting(true)
    const { data, error } = await supabase
      .from('date_labelling_logs')
      .select('opened_date, item_name, use_by_date, storage_location, recorded_by_name, notes')
      .eq('venue_id', venueId)
      .gte('opened_date', exportFrom)
      .lte('opened_date', exportTo)
      .order('opened_date')
    setExporting(false)
    if (error) { toast(error.message, 'error'); return }
    if (!data?.length) { toast('No records in this period', 'error'); return }
    buildPdfReport({
      title: 'Pelikn',
      subtitle: 'Date Labelling Report',
      periodLabel: `${exportFrom} – ${exportTo}`,
      columns: ['Opened', 'Item', 'Use By', 'Location', 'Logged By', 'Notes'],
      rows: data.map(r => [
        format(new Date(r.opened_date + 'T12:00:00'), 'dd/MM/yyyy'),
        r.item_name,
        format(new Date(r.use_by_date + 'T12:00:00'), 'dd/MM/yyyy'),
        r.storage_location ?? '—',
        r.recorded_by_name ?? '—',
        r.notes ?? '',
      ]),
      filename: `date-labelling-${exportFrom}-to-${exportTo}.pdf`,
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
        <h1 className="text-2xl font-bold text-charcoal">Date Labelling</h1>
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
      <Modal open={showExport} onClose={() => setShowExport(false)} title="Export Date Labelling Log">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1.5">From</label>
              <input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20" />
            </div>
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1.5">To</label>
              <input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20" />
            </div>
          </div>
          <button onClick={handleExportPdf} disabled={exporting}
            className="w-full bg-charcoal text-cream py-2.5 rounded-lg text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40">
            {exporting ? 'Generating…' : 'Export PDF →'}
          </button>
        </div>
      </Modal>

      {/* Log form */}
      <div className="bg-white rounded-2xl border-charcoal/10 p-5">
        <SectionLabel>Log Item</SectionLabel>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">Item Name</label>
            <input
              value={form.item_name}
              onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))}
              placeholder="e.g. Smoked salmon, Cooked chicken"
              className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">Opened Date</label>
              <input
                type="date"
                value={form.opened_date}
                onChange={e => setForm(f => ({ ...f, opened_date: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            </div>
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">Use By Date</label>
              <input
                type="date"
                value={form.use_by_date}
                min={form.opened_date}
                onChange={e => setForm(f => ({ ...f, use_by_date: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">
              Storage Location <span className="normal-case text-charcoal/30">(optional)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                key="none"
                type="button"
                onClick={() => setForm(f => ({ ...f, storage_location: '' }))}
                className={[
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                  form.storage_location === ''
                    ? 'bg-charcoal text-cream border-charcoal'
                    : 'bg-white text-charcoal/50 border-charcoal/15 hover:border-charcoal/35',
                ].join(' ')}
              >
                None
              </button>
              {STORAGE_LOCATIONS.map(loc => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, storage_location: loc }))}
                  className={[
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                    form.storage_location === loc
                      ? 'bg-charcoal text-cream border-charcoal'
                      : 'bg-white text-charcoal/50 border-charcoal/15 hover:border-charcoal/35',
                  ].join(' ')}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">
              Notes <span className="normal-case text-charcoal/30">(optional)</span>
            </label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Any additional details"
              rows={2}
              className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>

          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="bg-charcoal text-cream px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed self-start"
          >
            {submitting ? '…' : 'Log Item →'}
          </button>
        </form>
      </div>

      {/* Log list */}
      {grouped.length > 0 && (
        <div className="flex flex-col gap-4">
          <SectionLabel>Recent Labels (last 7 days)</SectionLabel>
          {grouped.map(([date, entries]) => (
            <div key={date} className="bg-white rounded-2xl border-charcoal/10 overflow-hidden">
              <div className="px-5 py-3 border-b border-charcoal/8">
                <p className="text-xs font-medium text-charcoal/50 uppercase tracking-widest">
                  Opened {format(new Date(date + 'T12:00:00'), 'EEEE d MMMM')}
                </p>
              </div>
              <div className="divide-y divide-charcoal/6">
                {entries.map(log => {
                  const useByExpired = isPast(new Date(log.use_by_date + 'T23:59:59'))
                  return (
                    <div key={log.id} className="flex items-center justify-between px-5 py-3 gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-charcoal truncate">{log.item_name}</p>
                        {log.storage_location && (
                          <p className="text-xs text-charcoal/40 mt-0.5">{log.storage_location}</p>
                        )}
                        {log.notes && <p className="text-xs text-charcoal/35 italic mt-0.5">"{log.notes}"</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className={[
                          'text-xs font-medium',
                          useByExpired ? 'text-red-500' : 'text-charcoal/60',
                        ].join(' ')}>
                          Use by: {format(new Date(log.use_by_date + 'T12:00:00'), 'd MMM yyyy')}
                        </p>
                        <p className="text-xs text-charcoal/40 mt-0.5">{log.recorded_by_name}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {grouped.length === 0 && (
        <div className="bg-white rounded-2xl border-charcoal/10 p-8 text-center">
          <p className="text-charcoal/40 text-sm">No items logged this week.</p>
        </div>
      )}
    </div>
  )
}
