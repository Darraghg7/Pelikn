import React, { useState } from 'react'
import { format, subDays } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import Modal from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { buildPdfReport } from '../../lib/pdfUtils'

export default function OpeningClosingExportModal({ open, onClose }) {
  const { venueId } = useVenue()
  const toast = useToast()
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
  const [dateTo,   setDateTo]   = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading,  setLoading]  = useState(false)

  const handleExport = async () => {
    setLoading(true)

    const { data: checks } = await supabase
      .from('opening_closing_checks')
      .select('id, title, type')
      .eq('venue_id', venueId)
      .eq('is_active', true)

    const { data: completions, error } = await supabase
      .from('opening_closing_completions')
      .select('check_id, session_date, session_type, staff_name, completed_at, notes')
      .eq('venue_id', venueId)
      .gte('session_date', dateFrom)
      .lte('session_date', dateTo)
      .order('session_date')
      .order('completed_at')

    setLoading(false)

    if (error) { toast(error.message, 'error'); return }
    if (!completions?.length && !checks?.length) { toast('No records found', 'error'); return }

    const rows = completions?.length
      ? completions.map(c => {
          const check = checks?.find(ch => ch.id === c.check_id)
          return [
            c.session_date,
            check?.title ?? '—',
            c.session_type === 'opening' ? 'Opening' : 'Closing',
            c.staff_name ?? '—',
            format(new Date(c.completed_at), 'HH:mm'),
            c.notes ?? '',
          ]
        })
      : [['No checks completed in this period', '', '', '', '', '']]

    buildPdfReport({
      title: 'SafeServ',
      subtitle: 'Opening & Closing Checks Report',
      periodLabel: `${dateFrom} – ${dateTo}`,
      columns: ['Date', 'Check', 'Type', 'Completed By', 'Time', 'Notes'],
      rows,
      filename: `opening-closing-${dateFrom}-to-${dateTo}.pdf`,
    })

    toast('PDF exported')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Export Opening & Closing Checks">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-1.5">From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-cream/30 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20" />
          </div>
          <div>
            <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-1.5">To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-cream/30 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-charcoal/20" />
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
