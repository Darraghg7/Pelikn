import React, { memo, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useCleaningTasks } from '../../hooks/useCleaningTasks'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../ui/Toast'
import { WidgetShell, BigNumber } from './shared'

export const CLEANING_PAGE_SIZE = 3
export const FREQ_DAYS = { daily: 1, weekly: 7, fortnightly: 14, monthly: 30, quarterly: 90 }

function CleaningOverdueWidget() {
  const { tasks, overdueCount, reload } = useCleaningTasks()
  const { session } = useSession()
  const toast = useToast()
  const [page, setPage] = useState(0)
  const [completing, setCompleting] = useState(null)
  const status = overdueCount > 3 ? 'bad' : overdueCount > 0 ? 'warning' : 'good'

  const completeTask = async (taskId) => {
    if (completing) return
    setCompleting(taskId)
    const { error } = await supabase.rpc('complete_cleaning_task', {
      p_token: session?.token,
      p_cleaning_task_id: taskId,
      p_notes: null,
    })
    setCompleting(null)
    if (error) { toast(error.message, 'error'); return }
    toast('Task completed ✓')
    reload()
  }

  const overdueTasks = tasks.filter(t => t.status === 'overdue')
  const totalPages = Math.ceil(overdueTasks.length / CLEANING_PAGE_SIZE)
  const pageItems = overdueTasks.slice(page * CLEANING_PAGE_SIZE, (page + 1) * CLEANING_PAGE_SIZE)

  // Reset page if tasks change
  useEffect(() => { setPage(0) }, [overdueTasks.length])

  if (overdueCount === 0) {
    return (
      <WidgetShell title="Cleaning" to="/cleaning" status={status}>
        <BigNumber value={0} label="All on track" alert={false} />
      </WidgetShell>
    )
  }

  return (
    <WidgetShell title="Cleaning" to="/cleaning" status={status}>
      <p className="text-xs font-semibold text-danger mb-2">{overdueCount} task{overdueCount !== 1 ? 's' : ''} overdue</p>
      <div className="flex flex-col gap-1">
        {pageItems.map(t => {
          const days = t.lastCompletion
            ? Math.floor((Date.now() - new Date(t.lastCompletion.completed_at)) / 86400000)
            : null
          const threshold = FREQ_DAYS[t.frequency] ?? 1
          const overBy = days !== null ? days - threshold : null
          return (
            <div key={t.id} className="flex items-center justify-between gap-2 py-2 border-b border-charcoal/6 last:border-0">
              <button
                onClick={(e) => { e.preventDefault(); completeTask(t.id) }}
                disabled={completing === t.id}
                className="shrink-0 w-10 h-10 rounded-xl border-2 border-charcoal/20 flex items-center justify-center hover:border-success hover:bg-success/10 transition-colors disabled:opacity-40 disabled:cursor-wait text-success text-xs"
                title="Mark complete"
              >
                {completing === t.id ? <span className="w-4 h-4 rounded-full border-2 border-success/25 border-t-success animate-spin" /> : <svg className="w-4 h-4" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg>}
              </button>
              <p className="text-xs text-charcoal truncate flex-1">{t.title}</p>
              <span className="text-[11px] text-danger/70 whitespace-nowrap shrink-0">
                {overBy !== null ? `${overBy}d overdue` : 'Never done'}
              </span>
            </div>
          )
        })}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-2 pt-1 border-t border-charcoal/6">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="text-[11px] text-charcoal/40 hover:text-charcoal disabled:opacity-20"
          >
            ‹
          </button>
          <span className="text-[11px] text-charcoal/30">{page + 1}/{totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="text-[11px] text-charcoal/40 hover:text-charcoal disabled:opacity-20"
          >
            ›
          </button>
        </div>
      )}
    </WidgetShell>
  )
}

export default memo(CleaningOverdueWidget)
