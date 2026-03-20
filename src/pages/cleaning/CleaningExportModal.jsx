import React, { useState } from 'react'
import { format, subDays } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import Modal from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { buildPdfReport } from '../../lib/pdfUtils'

export default function CleaningExportModal({ open, onClose }) {
  const { venueId } = useVenue()
  const toast = useToast()
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [dateTo,   setDateTo]   = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading,  setLoading]  = useState(false)

  const handleExport = async () => {
    setLoading(true)

    // Fetch all active cleaning tasks
    const { data: tasks } = await supabase
      .from('cleaning_tasks')
      .select('id, title, frequency, assigned_role')
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .order('title')

    // Fetch completions in the date range
    const { data: completions, error } = await supabase
      .from('cleaning_completions')
      .select('cleaning_task_id, completed_by_name, completed_at, notes')
      .eq('venue_id', venueId)
      .gte('completed_at', dateFrom)
      .lte('completed_at', dateTo + 'T23:59:59')
      .order('completed_at')

    setLoading(false)

    if (error) { toast(error.message, 'error'); return }
    if (!tasks?.length) { toast('No cleaning tasks found', 'error'); return }

    // Build rows — one row per completion, with tasks that had no completions shown separately
    const rows = completions?.length
      ? completions.map(c => {
          const task = tasks.find(t => t.id === c.cleaning_task_id)
          return [
            task?.title ?? '—',
            task ? capitalize(task.frequency) : '—',
            task ? capitalize(task.assigned_role === 'all' ? 'All roles' : task.assigned_role) : '—',
            c.completed_by_name ?? '—',
            format(new Date(c.completed_at), 'dd/MM/yyyy HH:mm'),
            c.notes ?? '',
          ]
        })
      : [['No completions recorded in this period', '', '', '', '', '']]

    // Append tasks with zero completions in period (red)
    const completedTaskIds = new Set(completions?.map(c => c.cleaning_task_id) ?? [])
    const neverDone = tasks.filter(t => !completedTaskIds.has(t.id))
    for (const t of neverDone) {
      rows.push([t.title, capitalize(t.frequency), capitalize(t.assigned_role === 'all' ? 'All roles' : t.assigned_role), 'NOT COMPLETED', '', ''])
    }

    buildPdfReport({
      title: 'SafeServ',
      subtitle: 'Cleaning Records Report',
      periodLabel: `${dateFrom} – ${dateTo}`,
      columns: ['Task', 'Frequency', 'Role', 'Completed By', 'Date & Time', 'Notes'],
      rows,
      didParseCell(hookData) {
        if (hookData.section === 'body' && hookData.cell.raw === 'NOT COMPLETED') {
          hookData.cell.styles.textColor = [180, 30, 30]
          hookData.cell.styles.fontStyle = 'bold'
        }
      },
      filename: `cleaning-report-${dateFrom}-to-${dateTo}.pdf`,
    })

    toast('PDF exported')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Export Cleaning Records">
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
        <p className="text-xs text-charcoal/40">Tasks with no completions in this period will appear highlighted in red.</p>
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

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : '' }
