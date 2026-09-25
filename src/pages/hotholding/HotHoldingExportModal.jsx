import React, { useState } from 'react'
import { format, subDays } from 'date-fns'
import { loadPdfLibs } from '../../lib/pdfUtils'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useHotHoldingItems, isHotHoldingFail } from '../../hooks/useHotHolding'
import Modal from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'

const FIELD = 'w-full px-3 py-2 rounded-lg border border-charcoal/15 dark:border-white/15 bg-white dark:bg-paperDark text-sm text-charcoal dark:text-white focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20'
const LABEL = 'text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 block mb-1.5'

export default function HotHoldingExportModal({ open, onClose }) {
  const { venueId } = useVenue()
  const toast = useToast()
  const { items } = useHotHoldingItems()
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
  const [dateTo,   setDateTo]   = useState(format(new Date(), 'yyyy-MM-dd'))
  const [itemId,   setItemId]   = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleExport = async () => {
    setLoading(true)
    let query = supabase
      .from('hot_holding_logs')
      .select('item_name, temperature, logged_at, logged_by_name, notes, check_period, hot_holding_items(min_temp, max_temp)')
      .eq('venue_id', venueId)
      .gte('logged_at', dateFrom)
      .lte('logged_at', dateTo + 'T23:59:59')
      .order('logged_at')

    if (itemId) query = query.eq('item_id', itemId)

    const { data, error } = await query
    setLoading(false)

    if (error) { toast(error.message, 'error'); return }
    if (!data?.length) { toast('No records found for this period', 'error'); return }

    const { jsPDF, autoTable } = await loadPdfLibs()
    const doc = new jsPDF()
    const pageW = doc.internal.pageSize.getWidth()

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text('Pelikn', 14, 18)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text('Hot Holding Report', 14, 25)
    doc.text(`Period: ${dateFrom} – ${dateTo}`, 14, 31)
    if (itemId) {
      const item = items.find(i => i.id === itemId)
      doc.text(`Item: ${item?.name ?? itemId}`, 14, 37)
    }
    doc.setTextColor(0)

    autoTable(doc, {
      startY: itemId ? 43 : 37,
      head: [['Date', 'Time', 'AM/PM', 'Item', 'Temp (°C)', 'Status', 'Staff', 'Corrective action']],
      body: data.map(row => [
        format(new Date(row.logged_at), 'dd/MM/yyyy'),
        format(new Date(row.logged_at), 'HH:mm'),
        row.check_period?.toUpperCase() ?? '—',
        row.item_name ?? '—',
        Number(row.temperature).toFixed(1),
        isHotHoldingFail(row.temperature, row.hot_holding_items) ? 'FAIL' : 'SAFE',
        row.logged_by_name ?? '—',
        row.notes ?? '',
      ]),
      headStyles: { fillColor: [40, 40, 40], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 5: { fontStyle: 'bold' } },
      didParseCell(hookData) {
        if (hookData.section === 'body' && hookData.column.index === 5 && hookData.cell.raw === 'FAIL') {
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

    doc.save(`hot-holding-${dateFrom}-to-${dateTo}.pdf`)
    toast('PDF exported')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Export Hot Holding Logs">
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

        <div>
          <label className={LABEL}>Item</label>
          <select value={itemId} onChange={e => setItemId(e.target.value)} className={FIELD}>
            <option value="">All items</option>
            {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
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
