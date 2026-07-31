import { supabase } from '../supabase'

export interface CleaningTask {
  id: string
  title: string
  frequency: string
  assigned_role?: string
  is_active: boolean
  venue_id: string
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

export async function fetchCleaningTasks(venueId: string): Promise<CleaningResult> {
  const [{ data: tData, error: tErr }, { data: cData, error: cErr }] = await Promise.all([
    supabase.from('cleaning_tasks').select('id, title, frequency, assigned_role, is_active, venue_id').eq('venue_id', venueId).eq('is_active', true).order('title'),
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
