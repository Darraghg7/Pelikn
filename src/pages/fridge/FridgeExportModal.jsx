import React, { useState } from 'react'
import { format, subDays } from 'date-fns'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../../lib/supabase'
import { useFridges } from '../../hooks/useFridgeLogs'
import { useVenue } from '../../contexts/VenueContext'
import Modal from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'

export default function FridgeExportModal({ open, onClose }) {
  const { venueId } = useVenue()
  const toast = useToast()
  const { fridges } = useFridges()
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
  const [dateTo,   setDateTo]   = useState(format(new Date(), 'yyyy-MM-dd'))
  const [fridgeId, setFridgeId] = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleExport = async () => {
    setLoading(true)
    let query = supabase
      .from('fridge_temperature_logs')
      .select('temperature, logged_at, logged_by_name, notes, check_period, fridge:fridge_id(name, min_temp, max_temp)')
      .eq('venue_id', venueId)
      .gte('logged_at', dateFrom)
      .lte('logged_at', dateTo + 'T23:59:59')
      .order('logged_at')

    if (fridgeId) query = query.eq('fridge_id', fridgeId)

    const { data, error } = await query
    setLoading(false)

    if (error) { toast(error.message, 'error'); return }
    if (!data?.length) { toast('No records found for this period', 'error'); return }

    const doc = new jsPDF()
    const pageW = doc.internal.pageSize.getWidth()

    // Header
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text('SafeServ', 14, 18)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text('Temperature Log Report', 14, 25)
    doc.text(`Period: ${dateFrom} – ${dateTo}`, 14, 31)
    if (fridgeId) {
      const fridge = fridges.find(f => f.id === fridgeId)
      doc.text(`Fridge: ${fridge?.name ?? fridgeId}`, 14, 37)
    }
    doc.setTextColor(0)

    // Table
    autoTable(doc, {
      startY: fridgeId ? 43 : 37,
      head: [['Date', 'Time', 'AM/PM', 'Fridge', 'Temp (°C)', 'Status', 'Staff', 'Notes']],
      body: data.map(row => {
        const oor = row.fridge
          ? (row.temperature < row.fridge.min_temp || row.temperature > row.fridge.max_temp)
          : false
        return [
          format(new Date(row.logged_at), 'dd/MM/yyyy'),
          format(new Date(row.logged_at), 'HH:mm'),
          row.check_period?.toUpperCase() ?? '—',
          row.fridge?.name ?? '—',
          row.temperature.toFixed(1),
          oor ? 'OUT OF RANGE' : 'OK',
          row.logged_by_name ?? '—',
          row.notes ?? '',
        ]
      }),
      headStyles: { fillColor: [40, 40, 40], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 5: { fontStyle: 'bold' } },
      didParseCell(hookData) {
        if (hookData.section === 'body' && hookData.column.index === 5 && hookData.cell.raw === 'OUT OF RANGE') {
          hookData.cell.styles.textColor = [180, 30, 30]
        }
      },
      alternateRowStyles: { fillColor: [248, 248, 248] },
    })

    // Footer
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

    doc.save(`temp-log-${dateFrom}-to-${dateTo}.pdf`)
    toast('PDF exported')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Export Temperature Logs">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1.5">From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20" />
          </div>
          <div>
            <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1.5">To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20" />
          </div>
        </div>

        <div>
          <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-1.5">Fridge</label>
          <select value={fridgeId} onChange={e => setFridgeId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20">
            <option value="">All fridges</option>
            {fridges.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
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
