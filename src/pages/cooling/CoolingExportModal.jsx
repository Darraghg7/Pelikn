import React, { useState } from 'react'
import { format, subDays } from 'date-fns'
import { loadPdfLibs, PDF } from '../../lib/pdfUtils'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { coolingOutcome, coolingMethodLabel, formatCoolingMinutes } from '../../lib/cooling'
import Modal from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import Button from '../../components/ui/Button'

const FIELD = 'w-full px-3 py-2 rounded-lg border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm text-charcoal dark:text-white focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20'
const LABEL = 'text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 block mb-1.5'

export default function CoolingExportModal({ open, onClose }) {
  const { venueId } = useVenue()
  const toast = useToast()
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
  const [dateTo,   setDateTo]   = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading,  setLoading]  = useState(false)

  const handleExport = async () => {
    setLoading(true)
    // Batches still cooling have no end temperature yet, so they aren't records
    const query = supabase
      .from('cooling_logs')
      .select('food_item, start_temp, end_temp, target_temp, cooling_method, started_at, finished_at, logged_by_name, notes')
      .eq('venue_id', venueId)
      .not('end_temp', 'is', null)
      .gte('started_at', new Date(`${dateFrom}T00:00:00`).toISOString())
      .lte('started_at', new Date(`${dateTo}T23:59:59`).toISOString())
      .order('started_at')

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
    doc.setTextColor(...PDF.muted)
    doc.text('Cooling Log Report', 14, 25)
    doc.text(`Period: ${dateFrom} – ${dateTo}`, 14, 31)
    doc.setTextColor(...PDF.ink)

    autoTable(doc, {
      startY: 37,
      head: [['Date', 'Started', 'Food item', 'Method', 'Start (°C)', 'End (°C)', 'Time', 'Result', 'Staff', 'Corrective action']],
      body: data.map(row => {
        const { fail, minutes } = coolingOutcome(row)
        return [
          format(new Date(row.started_at), 'dd/MM/yyyy'),
          format(new Date(row.started_at), 'HH:mm'),
          row.food_item ?? '—',
          coolingMethodLabel(row.cooling_method),
          Number(row.start_temp).toFixed(1),
          Number(row.end_temp).toFixed(1),
          formatCoolingMinutes(minutes),
          fail ? 'FAIL' : 'PASS',
          row.logged_by_name ?? '—',
          fail ? (row.notes ?? '') : '',
        ]
      }),
      headStyles: { fillColor: PDF.head, textColor: PDF.white, fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 7: { fontStyle: 'bold' } },
      didParseCell(hookData) {
        if (hookData.section === 'body' && hookData.column.index === 7 && hookData.cell.raw === 'FAIL') {
          hookData.cell.styles.textColor = PDF.bad
        }
      },
      alternateRowStyles: { fillColor: PDF.rowAlt },
    })

    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(7)
      doc.setTextColor(...PDF.faint)
      doc.text(
        `Generated ${format(new Date(), 'dd/MM/yyyy HH:mm')} · Page ${i} of ${pageCount}`,
        pageW / 2, doc.internal.pageSize.getHeight() - 8,
        { align: 'center' }
      )
    }

    doc.save(`cooling-log-${dateFrom}-to-${dateTo}.pdf`)
    toast('PDF exported')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Export Cooling Logs">
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

        <Button
          fullWidth
          loading={loading}
          onClick={handleExport}
          disabled={loading}
        >
          {loading ? 'Generating…' : 'Export PDF →'}
        </Button>
      </div>
    </Modal>
  )
}
