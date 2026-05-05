import { supabase } from '../supabase'

interface CleaningTask {
  id: string
  title: string
  frequency: string
  assigned_role?: string
  is_active: boolean
  venue_id: string
}

interface CleaningCompletion {
  id: string
  cleaning_task_id: string
  completed_at: string
  completed_by_staff_id?: string
  completed_by_name?: string
  venue_id: string
}

interface CleaningResult {
  tasks: CleaningTask[]
  completions: CleaningCompletion[]
}

export async function fetchCleaningTasks(venueId: string): Promise<CleaningResult> {
  const [{ data: tData }, { data: cData }] = await Promise.all([
    supabase.from('cleaning_tasks').select('id, title, frequency, assigned_role, is_active, venue_id').eq('venue_id', venueId).eq('is_active', true).order('title'),
    supabase
      .from('cleaning_completions')
      .select('id, cleaning_task_id, completed_at, completed_by_staff_id, completed_by_name, venue_id')
      .eq('venue_id', venueId)
      .order('completed_at', { ascending: false })
      .limit(1000),
  ])

  return {
    tasks:       (tData ?? []) as CleaningTask[],
    completions: (cData ?? []) as CleaningCompletion[],
  }
}
