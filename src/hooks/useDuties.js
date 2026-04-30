import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useVenue } from '../contexts/VenueContext'
import { useSession } from '../contexts/SessionContext'

// All active templates with their items — used in Settings and Rota picker
export function useDutyTemplates() {
  const { venueId } = useVenue()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!venueId) return
    setLoading(true)
    const { data: tmpl } = await supabase
      .from('duty_templates')
      .select('id, title, created_at')
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (!tmpl?.length) { setTemplates([]); setLoading(false); return }

    const { data: items } = await supabase
      .from('duty_template_items')
      .select('id, duty_template_id, title, sort_order')
      .in('duty_template_id', tmpl.map(t => t.id))
      .order('sort_order', { ascending: true })

    const itemsByTemplate = (items ?? []).reduce((acc, item) => {
      ;(acc[item.duty_template_id] ??= []).push(item)
      return acc
    }, {})

    setTemplates(tmpl.map(t => ({ ...t, items: itemsByTemplate[t.id] ?? [] })))
    setLoading(false)
  }, [venueId])

  useEffect(() => { load() }, [load])

  const addTemplate = useCallback(async (title, itemTitles) => {
    const { data: tmpl, error } = await supabase
      .from('duty_templates')
      .insert({ venue_id: venueId, title: title.trim() })
      .select('id')
      .single()
    if (error) return { error }
    if (itemTitles.length) {
      const rows = itemTitles
        .filter(t => t.trim())
        .map((t, i) => ({ duty_template_id: tmpl.id, title: t.trim(), sort_order: i }))
      if (rows.length) await supabase.from('duty_template_items').insert(rows)
    }
    await load()
    return { error: null }
  }, [venueId, load])

  const deleteTemplate = useCallback(async (id) => {
    const { error } = await supabase
      .from('duty_templates')
      .update({ is_active: false })
      .eq('id', id)
    if (!error) await load()
    return { error }
  }, [load])

  const updateItems = useCallback(async (templateId, itemTitles) => {
    await supabase.from('duty_template_items').delete().eq('duty_template_id', templateId)
    const rows = itemTitles
      .filter(t => t.trim())
      .map((t, i) => ({ duty_template_id: templateId, title: t.trim(), sort_order: i }))
    if (rows.length) await supabase.from('duty_template_items').insert(rows)
    await load()
  }, [load])

  return { templates, loading, reload: load, addTemplate, deleteTemplate, updateItems }
}

// Duties assigned to a specific staff member today, with completions
export function useTodayDuties(staffId) {
  const { venueId, venueSlug } = useVenue()
  const { session } = useSession()
  const [duties, setDuties] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!venueId || !staffId) { setLoading(false); return }
    const todayStr = format(new Date(), 'yyyy-MM-dd')

    // Find shifts for this staff member today, then their duty assignments
    const { data: shifts } = await supabase
      .from('shifts')
      .select('id')
      .eq('venue_id', venueId)
      .eq('staff_id', staffId)
      .eq('shift_date', todayStr)

    if (!shifts?.length) { setDuties([]); setLoading(false); return }

    const shiftIds = shifts.map(s => s.id)
    const { data: assignments } = await supabase
      .from('duty_assignments')
      .select(`
        id,
        shift_id,
        duty_template_id,
        duty_templates ( id, title ),
        duty_template_items ( id, title, sort_order )
      `)
      .in('shift_id', shiftIds)

    if (!assignments?.length) { setDuties([]); setLoading(false); return }

    // Fetch completions for these assignments
    const assignmentIds = assignments.map(a => a.id)
    const { data: completions } = await supabase
      .from('duty_item_completions')
      .select('duty_assignment_id, duty_template_item_id')
      .in('duty_assignment_id', assignmentIds)

    const completedSet = new Set(
      (completions ?? []).map(c => `${c.duty_assignment_id}:${c.duty_template_item_id}`)
    )

    const result = assignments.map(a => {
      const items = (a.duty_template_items ?? [])
        .sort((x, y) => x.sort_order - y.sort_order)
        .map(item => ({
          ...item,
          completed: completedSet.has(`${a.id}:${item.id}`),
        }))
      return {
        assignmentId: a.id,
        templateId:   a.duty_template_id,
        title:        a.duty_templates?.title ?? '',
        items,
      }
    })

    setDuties(result)
    setLoading(false)
  }, [venueId, staffId])

  useEffect(() => { load() }, [load])

  const toggleItem = useCallback(async (assignmentId, itemId, currentlyDone) => {
    const fn = currentlyDone ? 'uncomplete_duty_item' : 'complete_duty_item'
    const { error } = await supabase.rpc(fn, {
      p_token:         session?.token,
      p_venue_slug:    venueSlug,
      p_assignment_id: assignmentId,
      p_item_id:       itemId,
    })
    if (!error) await load()
    return { error }
  }, [session, venueSlug, load])

  return { duties, loading, reload: load, toggleItem }
}

// All duty assignments for today — manager overview
export function useAllTodayDuties() {
  const { venueId } = useVenue()
  const [duties, setDuties] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!venueId) return
    const todayStr = format(new Date(), 'yyyy-MM-dd')

    const { data: shifts } = await supabase
      .from('shifts')
      .select('id, staff_id, staff ( name )')
      .eq('venue_id', venueId)
      .eq('shift_date', todayStr)

    if (!shifts?.length) { setDuties([]); setLoading(false); return }

    const shiftIds = shifts.map(s => s.id)
    const staffById = Object.fromEntries(shifts.map(s => [s.id, s.staff]))

    const { data: assignments } = await supabase
      .from('duty_assignments')
      .select(`
        id, shift_id,
        duty_templates ( title ),
        duty_template_items ( id )
      `)
      .in('shift_id', shiftIds)

    if (!assignments?.length) { setDuties([]); setLoading(false); return }

    const assignmentIds = assignments.map(a => a.id)
    const { data: completions } = await supabase
      .from('duty_item_completions')
      .select('duty_assignment_id')
      .in('duty_assignment_id', assignmentIds)

    const completedByAssignment = (completions ?? []).reduce((acc, c) => {
      acc[c.duty_assignment_id] = (acc[c.duty_assignment_id] ?? 0) + 1
      return acc
    }, {})

    setDuties(assignments.map(a => ({
      assignmentId: a.id,
      staffName:    staffById[a.shift_id]?.name ?? '—',
      title:        a.duty_templates?.title ?? '',
      total:        a.duty_template_items?.length ?? 0,
      completed:    completedByAssignment[a.id] ?? 0,
    })))
    setLoading(false)
  }, [venueId])

  useEffect(() => { load() }, [load])

  return { duties, loading }
}

// Duty assignment for a specific shift (used in Rota modal to pre-populate)
export function useShiftDuty(shiftId) {
  const [assignment, setAssignment] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!shiftId) { setAssignment(null); return }
    setLoading(true)
    supabase
      .from('duty_assignments')
      .select('id, duty_template_id')
      .eq('shift_id', shiftId)
      .maybeSingle()
      .then(({ data }) => { setAssignment(data ?? null); setLoading(false) })
  }, [shiftId])

  return { assignment, loading }
}
