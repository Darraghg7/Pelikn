import React, { memo, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useCleaningTasks } from '../../hooks/useCleaningTasks'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../ui/Toast'
import { WidgetShell, BigNumber, TitleBadge } from './shared'

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
      <WidgetShell title="Cleaning" to="/cleaning" linkLabel="View all">
        <BigNumber value={0} label="All on track" />
      </WidgetShell>
    )
  }

  return (
    <WidgetShell
      title="Cleaning"
      badge={<TitleBadge tone={status === 'bad' ? 'bad' : 'warn'}>{overdueCount} overdue</TitleBadge>}
      to="/cleaning"
      linkLabel="View all"
      flush
    >
      <div className="divide-y divide-line dark:divide-white/10">
        {pageItems.map(t => {
          const days = t.lastCompletion
            ? Math.floor((Date.now() - new Date(t.lastCompletion.completed_at)) / 86400000)
            : null
          const threshold = FREQ_DAYS[t.frequency] ?? 1
          const overBy = days !== null ? days - threshold : null
          return (
            <div key={t.id} className="flex items-center gap-3 px-4 sm:px-4 py-2.5">
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); completeTask(t.id) }}
                disabled={completing === t.id}
                aria-label={`Mark "${t.title}" done`}
                className={[
                  'w-9 h-8 rounded-full shrink-0 p-0 grid place-items-center border-2 cursor-pointer',
                  'border-bad text-transparent hover:bg-good hover:border-good hover:text-white transition-colors',
                  'disabled:opacity-40 disabled:cursor-wait',
                ].join(' ')}
              >
                {completing === t.id
                  ? <span className="w-3.5 h-3.5 rounded-full border-2 border-good/25 border-t-good animate-spin" />
                  : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
              </button>
              <p className="flex-1 min-w-0 text-[14px] min-[420px]:text-[15px] leading-snug text-ink dark:text-white line-clamp-2 break-words">{t.title}</p>
              <span className="shrink-0 font-mono text-[13px] font-semibold text-bad dark:text-[#f19a86] whitespace-nowrap">
                {overBy !== null ? `${overBy}d overdue` : 'never done'}
              </span>
            </div>
          )
        })}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-6 py-3 border-t border-line dark:border-white/10">
          <button
            type="button"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            aria-label="Previous tasks"
            className="w-9 h-8 inline-flex items-center justify-center rounded-full text-ink2 dark:text-white/70 hover:bg-cream dark:hover:bg-white/10 disabled:opacity-25"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <span className="font-mono text-[13px] text-ink3 dark:text-white/45">{page + 1}/{totalPages}</span>
          <button
            type="button"
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            aria-label="More tasks"
            className="w-9 h-8 inline-flex items-center justify-center rounded-full text-ink2 dark:text-white/70 hover:bg-cream dark:hover:bg-white/10 disabled:opacity-25"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
      )}
    </WidgetShell>
  )
}

export default memo(CleaningOverdueWidget)
