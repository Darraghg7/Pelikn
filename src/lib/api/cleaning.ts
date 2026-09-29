import { supabase } from '../supabase'

export interface CleaningTask {
  id: string
  title: string
  frequency: string
  department_id?: string | null
  is_active: boolean
  venue_id: string
  created_at?: string
}

export interface CleaningCompletion {
  id: string
  cleaning_task_id: string
  completed_at: string
  completed_by_staff_id?: string
  completed_by_name?: string
  venue_id: string
}

export interface CleaningResult {
  tasks: CleaningTask[]
  completions: CleaningCompletion[]
}

// Set once get_cleaning_state (migration 137) is known to be missing, so an
// unapplied migration costs one 404 per page load rather than one per fetch.
let cleaningRpcMissing = false

/**
 * Active tasks plus each task's latest completion. One request via
 * get_cleaning_state (137), which returns only the latest completion per
 * task — at or before `before` when given (a past day on the Tasks page).
 * Falls back to the newest 1,000 completions while 137 isn't applied.
 */
export async function fetchCleaningTasks(venueId: string, before: string | null = null): Promise<CleaningResult> {
  if (!cleaningRpcMissing) {
    const { data, error } = await supabase.rpc('get_cleaning_state', { p_venue_id: venueId, p_before: before })
    if (!error && data && Array.isArray(data.tasks) && Array.isArray(data.completions)) {
      return {
        tasks:       (data.tasks ?? []) as CleaningTask[],
        completions: (data.completions ?? []) as CleaningCompletion[],
      }
    }
    if (error?.code === 'PGRST202') cleaningRpcMissing = true
  }

  const [{ data: tData, error: tErr }, { data: cData, error: cErr }] = await Promise.all([
    supabase.from('cleaning_tasks').select('id, title, frequency, department_id, is_active, venue_id, created_at').eq('venue_id', venueId).eq('is_active', true).order('title'),
    supabase
      .from('cleaning_completions')
      .select('id, cleaning_task_id, completed_at, completed_by_staff_id, completed_by_name, venue_id')
      .eq('venue_id', venueId)
      .order('completed_at', { ascending: false })
      .limit(1000),
  ])

  // Reject rather than return an empty schedule — callers must be able to tell
  // "the fetch failed" from "this venue has no cleaning tasks".
  if (tErr) throw tErr
  if (cErr) throw cErr

  return {
    tasks:       (tData ?? []) as CleaningTask[],
    completions: (cData ?? []) as CleaningCompletion[],
  }
}
