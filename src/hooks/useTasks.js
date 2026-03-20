import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'
import { format } from 'date-fns'

/** Fetch all active task templates + today's completions for a given role. */
export function useTasksForRole(jobRole) {
  const { venueId } = useVenue()
  const [templates, setTemplates]   = useState([])
  const [oneOffs, setOneOffs]       = useState([])
  const [completions, setCompletions] = useState([])
  const [loading, setLoading]       = useState(true)

  const today = format(new Date(), 'yyyy-MM-dd')

  const load = useCallback(async () => {
    if (!venueId) { setLoading(false); return }
    setLoading(true)

    const tQuery = supabase
      .from('task_templates')
      .select('*')
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .order('created_at')

    const oQuery = supabase
      .from('task_one_offs')
      .select('*')
      .eq('venue_id', venueId)
      .eq('due_date', today)
      .order('created_at')

    const cQuery = supabase
      .from('task_completions')
      .select('*')
      .eq('venue_id', venueId)
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
  }, [venueId, jobRole, today])

  useEffect(() => { load() }, [load])

  return { templates, oneOffs, completions, loading, reload: load }
}

/** Fetch ALL templates + one-offs for manager view. */
export function useAllTasks(selectedDate) {
  const { venueId } = useVenue()
  const [templates, setTemplates]   = useState([])
  const [oneOffs, setOneOffs]       = useState([])
  const [completions, setCompletions] = useState([])
  const [loading, setLoading]       = useState(true)

  const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')

  const load = useCallback(async () => {
    if (!venueId) { setLoading(false); return }
    setLoading(true)
    const [{ data: tData }, { data: oData }, { data: cData }] = await Promise.all([
      supabase.from('task_templates').select('*').eq('venue_id', venueId).eq('is_active', true).order('job_role').order('created_at'),
      supabase.from('task_one_offs').select('*').eq('venue_id', venueId).eq('due_date', dateStr).order('created_at'),
      supabase.from('task_completions').select('*').eq('venue_id', venueId).eq('completion_date', dateStr),
    ])
    setTemplates(tData ?? [])
    setOneOffs(oData ?? [])
    setCompletions(cData ?? [])
    setLoading(false)
  }, [venueId, dateStr])

  useEffect(() => { load() }, [load])

  return { templates, oneOffs, completions, loading, reload: load }
}
