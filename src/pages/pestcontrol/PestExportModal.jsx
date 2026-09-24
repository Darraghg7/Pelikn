import React, { useState } from 'react'
import { format, subDays } from 'date-fns'
import { loadPdfLibs } from '../../lib/pdfUtils'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { PEST_LOG_TYPES, PEST_TYPES } from '../../hooks/usePestControl'

const label = (list, value) => list.find(x => x.value === value)?.label ?? value ?? '—'
import Modal from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'

const FIELD = 'w-full px-3 py-2 rounded-lg border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm text-charcoal dark:text-white focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20'
const LABEL = 'text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 block mb-1.5'

export default function PestExportModal({ open, onClose }) {
  const { venueId } = useVenue()
  const toast = useToast()
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
  const [dateTo,   setDateTo]   = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading,  setLoading]  = useState(false)

  const handleExport = async () => {
    setLoading(true)
    const query = supabase
      .from('pest_control_logs')
      .select('log_type, pest_type, severity, location, description, action_taken, contractor, status, logged_at, logged_by_name')
      .eq('venue_id', venueId)
      .gte('logged_at', new Date(`${dateFrom}T00:00:00`).toISOString())
      .lte('logged_at', new Date(`${dateTo}T23:59:59`).toISOString())
      .order('logged_at')

    const { data, error } = await query
    setLoading(false)

    if (error) { toast(error.message, 'error'); return }
    if (!data?.length) { toast('No records found for this period', 'error'); return }

    const { jsPDF, autoTable } = await loadPdfLibs()
    const doc = new jsPDF({ orientation: 'landscape' })
    const pageW = doc.internal.pageSize.getWidth()

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text('Pelikn', 14, 18)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text('Pest Control Report', 14, 25)
    doc.text(`Period: ${dateFrom} – ${dateTo}`, 14, 31)
    doc.setTextColor(0)

    autoTable(doc, {
      startY: 37,
      head: [['Date', 'Time', 'Entry', 'Pest', 'Severity', 'Location', 'Details', 'Action / contractor', 'Status', 'Staff']],
      body: data.map(row => {
        const tracked = row.log_type === 'sighting' || row.log_type === 'treatment'
        return [
          format(new Date(row.logged_at), 'dd/MM/yyyy'),
          format(new Date(row.logged_at), 'HH:mm'),
          label(PEST_LOG_TYPES, row.log_type),
          row.pest_type ? label(PEST_TYPES, row.pest_type) : '—',
          row.severity ? row.severity.toUpperCase() : '—',
          row.location ?? '—',
          row.description ?? '',
          [row.action_taken, row.contractor].filter(Boolean).join(' · '),
          tracked ? (row.status === 'resolved' ? 'RESOLVED' : 'OPEN') : '—',
          row.logged_by_name ?? '—',
        ]
      }),
      headStyles: { fillColor: [40, 40, 40], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 8: { fontStyle: 'bold' } },
      didParseCell(hookData) {
        if (hookData.section === 'body' && hookData.column.index === 8 && hookData.cell.raw === 'OPEN') {
          hookData.cell.styles.textColor = [180, 30, 30]
        }
      },
      alternateRowStyles: { fillColor: [248, 248, 248] },
    })

    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(7)
      doc.setTextColor(150)
      doc.text(
        `Generated ${format(new Date(), 'dd/MM/yyyy HH:mm')} · Page ${i} of ${pageCount}`,
        pageW / 2, doc.internal.pageSize.getHeight() - 8,
        { align: 'center' }
      )
    }

    doc.save(`pest-control-${dateFrom}-to-${dateTo}.pdf`)
    toast('PDF exported')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Export Pest Control Log">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={FIELD} />
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={loading}
          className="w-full bg-charcoal text-cream py-2.5 rounded-lg text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40"
        >
          {loading ? 'Generating…' : 'Export PDF →'}
        </button>
      </div>
    </Modal>
  )
}
