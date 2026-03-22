import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'
import { format } from 'date-fns'

/**
 * Fetch task templates + one-offs for a staff member.
 * Includes:
 *   - Templates for their job role (or 'all')
 *   - One-offs for their job role (or 'all')
 *   - One-offs personally assigned to them via assigned_to_staff_id
 */
export function useTasksForRole(jobRole, staffId) {
  const { venueId } = useVenue()
  const [templates, setTemplates]     = useState([])
  const [oneOffs, setOneOffs]         = useState([])
  const [completions, setCompletions] = useState([])
  const [loading, setLoading]         = useState(true)

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

    // Fetch one-offs for today — filter by role or personal assignment
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

    // Filter templates: role match
    const allTemplates = (tData ?? []).filter(
      (t) => t.job_role === jobRole || t.job_role === 'all'
    )

    // Filter one-offs: role match OR personally assigned to this staff member
    const allOneOffs = (oData ?? []).filter(
      (o) =>
        o.job_role === jobRole ||
        o.job_role === 'all' ||
        (staffId && o.assigned_to_staff_id === staffId)
    )

    // De-duplicate (in case a personally-assigned task also matches job_role)
    const seen = new Set()
    const deduped = allOneOffs.filter(o => { if (seen.has(o.id)) return false; seen.add(o.id); return true })

    setTemplates(allTemplates)
    setOneOffs(deduped)
    setCompletions(cData ?? [])
    setLoading(false)
  }, [venueId, jobRole, staffId, today])

  useEffect(() => { load() }, [load])

  return { templates, oneOffs, completions, loading, reload: load }
}

/** Fetch ALL templates + one-offs for manager view. */
export function useAllTasks(selectedDate) {
  const { venueId } = useVenue()
  const [templates, setTemplates]     = useState([])
  const [oneOffs, setOneOffs]         = useState([])
  const [completions, setCompletions] = useState([])
  const [loading, setLoading]         = useState(true)

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
