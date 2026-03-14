import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

/** Fetch all active task templates + today's completions for a given role. */
export function useTasksForRole(jobRole) {
  const [templates, setTemplates]   = useState([])
  const [oneOffs, setOneOffs]       = useState([])
  const [completions, setCompletions] = useState([])
  const [loading, setLoading]       = useState(true)

  const today = format(new Date(), 'yyyy-MM-dd')

  const load = useCallback(async () => {
    setLoading(true)

    // Templates visible to this role (matching role or 'all')
    const tQuery = supabase
      .from('task_templates')
      .select('*')
      .eq('is_active', true)
      .order('created_at')

    const oQuery = supabase
      .from('task_one_offs')
      .select('*')
      .eq('due_date', today)
      .order('created_at')

    const cQuery = supabase
      .from('task_completions')
      .select('*')
      .eq('completion_date', today)

    const [{ data: tData }, { data: oData }, { data: cData }] = await Promise.all([tQuery, oQuery, cQuery])

    const allTemplates = (tData ?? []).filter(
      (t) => t.job_role === jobRole || t.job_role === 'all'
    )
    const allOneOffs = (oData ?? []).filter(
      (o) => o.job_role === jobRole || o.job_role === 'all'
    )

    setTemplates(allTemplates)
    setOneOffs(allOneOffs)
    setCompletions(cData ?? [])
    setLoading(false)
  }, [jobRole, today])

  useEffect(() => { load() }, [load])

  return { templates, oneOffs, completions, loading, reload: load }
}

/** Fetch ALL templates + one-offs for manager view. */
export function useAllTasks(selectedDate) {
  const [templates, setTemplates]   = useState([])
  const [oneOffs, setOneOffs]       = useState([])
  const [completions, setCompletions] = useState([])
  const [loading, setLoading]       = useState(true)

  const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: tData }, { data: oData }, { data: cData }] = await Promise.all([
      supabase.from('task_templates').select('*').eq('is_active', true).order('job_role').order('created_at'),
      supabase.from('task_one_offs').select('*').eq('due_date', dateStr).order('created_at'),
      supabase.from('task_completions').select('*').eq('completion_date', dateStr),
    ])
    setTemplates(tData ?? [])
    setOneOffs(oData ?? [])
    setCompletions(cData ?? [])
    setLoading(false)
  }, [dateStr])

  useEffect(() => { load() }, [load])

  return { templates, oneOffs, completions, loading, reload: load }
}
