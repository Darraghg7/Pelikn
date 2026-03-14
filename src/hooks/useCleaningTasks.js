import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const FREQ_DAYS = { daily: 1, weekly: 7, fortnightly: 14, monthly: 30, quarterly: 90 }

export function cleaningStatus(task, lastCompletion) {
  if (!lastCompletion) return 'overdue'
  const daysSince = (Date.now() - new Date(lastCompletion.completed_at)) / 86400000
  const threshold = FREQ_DAYS[task.frequency] ?? 1
  if (daysSince <= threshold * 0.8) return 'done'
  if (daysSince <= threshold)       return 'due_soon'
  return 'overdue'
}

export function useCleaningTasks(jobRole = null) {
  const [tasks, setTasks]             = useState([])
  const [completions, setCompletions] = useState([])
  const [loading, setLoading]         = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: tData }, { data: cData }] = await Promise.all([
      supabase.from('cleaning_tasks').select('*').eq('is_active', true).order('title'),
      supabase
        .from('cleaning_completions')
        .select('*')
        .order('completed_at', { ascending: false }),
    ])

    let filtered = tData ?? []
    if (jobRole) {
      filtered = filtered.filter((t) => t.assigned_role === jobRole || t.assigned_role === 'all')
    }

    setTasks(filtered)
    setCompletions(cData ?? [])
    setLoading(false)
  }, [jobRole])

  useEffect(() => { load() }, [load])

  // Enrich tasks with status + last completion
  const enriched = tasks.map((t) => {
    const last = completions.find((c) => c.cleaning_task_id === t.id) ?? null
    return { ...t, lastCompletion: last, status: cleaningStatus(t, last) }
  })

  const overdueCount = enriched.filter((t) => t.status === 'overdue').length

  return { tasks: enriched, loading, reload: load, overdueCount }
}
