import React, { useState } from 'react'
import { format, subDays, differenceInDays } from 'date-fns'
import { useVenue } from '../../contexts/VenueContext'
import { useEquipmentLogs } from '../../hooks/useEquipmentMaintenance'
import { insertEquipmentLog, fetchEquipmentExport } from '../../lib/api/equipment'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import Modal from '../../components/ui/Modal'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { buildPdfReport } from '../../lib/pdfUtils'

const SERVICE_TYPES = ['service', 'repair', 'calibration', 'inspection', 'other']
const SERVICE_TYPE_LABELS = {
  service: 'Service',
  repair: 'Repair',
  calibration: 'Calibration',
  inspection: 'Inspection',
  other: 'Other',
}

function SectionLabel({ children }) {
  return <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-3">{children}</p>
}

function groupByDate(logs) {
  const groups = {}
  for (const log of logs) {
    const d = log.service_date
    if (!groups[d]) groups[d] = []
    groups[d].push(log)
  }
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
}

export default function EquipmentMaintenancePage() {
  const toast = useToast()
  const { venueId } = useVenue()
  const { session, isManager } = useSession()

  const today = format(new Date(), 'yyyy-MM-dd')

  // Data (React Query — cached + deduped, last 90 days)
  const { logs, loading, reload } = useEquipmentLogs()

  // Form state
  const [form, setForm] = useState({
    equipment_name: '',
    service_type: 'service',
    service_date: today,
    next_due_date: '',
    engineer_name: '',
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)

  // Export state
  const [showExport, setShowExport] = useState(false)
  const [exportFrom, setExportFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [exportTo, setExportTo] = useState(today)
  const [exporting, setExporting] = useState(false)

  const canSubmit = form.equipment_name.trim() !== ''

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    const { error } = await insertEquipmentLog({
      equipment_name:   form.equipment_name.trim(),
      service_type:     form.service_type,
      service_date:     form.service_date,
      next_due_date:    form.next_due_date || null,
      engineer_name:    form.engineer_name.trim() || null,
      notes:            form.notes.trim() || null,
      recorded_by:      session?.staffId,
      recorded_by_name: session?.staffName ?? 'Unknown',
      recorded_at:      new Date().toISOString(),
      venue_id:         venueId,
    })
    setSubmitting(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Service record logged')
    setForm({
      equipment_name: '',
      service_type: 'service',
      service_date: today,
      next_due_date: '',
      engineer_name: '',
      notes: '',
    })
    reload()
  }

  const handleExportPdf = async () => {
    setExporting(true)
    const { data, error } = await fetchEquipmentExport(venueId, exportFrom, exportTo)
    setExporting(false)
    if (error) { toast(error.message, 'error'); return }
    if (!data?.length) { toast('No records in this period', 'error'); return }
    buildPdfReport({
      title: 'Pelikn',
      subtitle: 'Equipment Maintenance Log',
      periodLabel: `${exportFrom} – ${exportTo}`,
      columns: ['Date', 'Equipment', 'Type', 'Next Due', 'Engineer', 'Logged By', 'Notes'],
      rows: data.map(r => [
        format(new Date(r.service_date + 'T12:00:00'), 'dd/MM/yyyy'),
        r.equipment_name,
        SERVICE_TYPE_LABELS[r.service_type] ?? r.service_type,
        r.next_due_date ? format(new Date(r.next_due_date + 'T12:00:00'), 'dd/MM/yyyy') : '—',
        r.engineer_name ?? '—',
        r.recorded_by_name ?? '—',
        r.notes ?? '',
      ]),
      filename: `equipment-maintenance-${exportFrom}-to-${exportTo}.pdf`,
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
        <h1 className="text-2xl font-bold text-charcoal">Equipment Maintenance</h1>
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
      <Modal open={showExport} onClose={() => setShowExport(false)} title="Export Maintenance Log">
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
        <SectionLabel>Log Service Record</SectionLabel>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">Equipment Name</label>
            <input
              value={form.equipment_name}
              onChange={e => setForm(f => ({ ...f, equipment_name: e.target.value }))}
              placeholder="e.g. Walk-in fridge, Dishwasher, Probe thermometer"
              className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>

          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">Service Type</label>
            <div className="flex flex-wrap gap-1.5">
              {SERVICE_TYPES.map(t => (
                <button key={t} type="button"
                  onClick={() => setForm(f => ({ ...f, service_type: t }))}
                  className={[
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                    form.service_type === t
                      ? 'bg-charcoal text-cream border-charcoal'
                      : 'bg-white text-charcoal/50 border-charcoal/15 hover:border-charcoal/35',
                  ].join(' ')}>
                  {SERVICE_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">Service Date</label>
              <input
                type="date"
                value={form.service_date}
                onChange={e => setForm(f => ({ ...f, service_date: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            </div>
            <div>
              <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">
                Next Due <span className="normal-case text-charcoal/30">(optional)</span>
              </label>
              <input
                type="date"
                value={form.next_due_date}
                onChange={e => setForm(f => ({ ...f, next_due_date: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">
              Engineer / Company <span className="normal-case text-charcoal/30">(optional)</span>
            </label>
            <input
              value={form.engineer_name}
              onChange={e => setForm(f => ({ ...f, engineer_name: e.target.value }))}
              placeholder="e.g. Acme Refrigeration Ltd"
              className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
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
            {submitting ? '…' : 'Log Service →'}
          </button>
        </form>
      </div>

      {/* Log list */}
      {grouped.length > 0 && (
        <div className="flex flex-col gap-4">
          <SectionLabel>Recent Records (last 90 days)</SectionLabel>
          {grouped.map(([date, entries]) => (
            <div key={date} className="bg-white rounded-2xl border-charcoal/10 overflow-hidden">
              <div className="px-5 py-3 border-b border-charcoal/8">
                <p className="text-xs font-medium text-charcoal/50 uppercase tracking-widest">
                  {format(new Date(date + 'T12:00:00'), 'EEEE d MMMM')}
                </p>
              </div>
              <div className="divide-y divide-charcoal/6">
                {entries.map(log => {
                  const daysUntilDue = log.next_due_date
                    ? differenceInDays(new Date(log.next_due_date + 'T12:00:00'), new Date())
                    : null
                  const dueSoon = daysUntilDue !== null && daysUntilDue <= 30

                  return (
                    <div key={log.id} className="flex items-start justify-between px-5 py-3 gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-charcoal">{log.equipment_name}</p>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-charcoal/8 text-charcoal/60 border border-charcoal/10">
                            {SERVICE_TYPE_LABELS[log.service_type] ?? log.service_type}
                          </span>
                        </div>
                        {log.engineer_name && (
                          <p className="text-xs text-charcoal/40 mt-0.5">{log.engineer_name}</p>
                        )}
                        {log.next_due_date && (
                          <p className={['text-xs mt-0.5', dueSoon ? 'text-amber-600 font-medium' : 'text-charcoal/40'].join(' ')}>
                            Next due: {format(new Date(log.next_due_date + 'T12:00:00'), 'd MMM yyyy')}
                            {dueSoon && daysUntilDue >= 0 && ` (${daysUntilDue}d)`}
                            {dueSoon && daysUntilDue < 0 && ' (overdue)'}
                          </p>
                        )}
                        {log.notes && <p className="text-xs text-charcoal/35 italic mt-0.5">"{log.notes}"</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-charcoal/40">{log.recorded_by_name}</p>
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
          <p className="text-charcoal/40 text-sm">No maintenance records in the last 90 days.</p>
        </div>
      )}
    </div>
  )
}
