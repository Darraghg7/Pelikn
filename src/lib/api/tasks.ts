import { supabase } from '../supabase'
import type { TaskTemplate, TaskOneOff, TaskCompletion } from '../../types'

interface TasksResult {
  templates: TaskTemplate[]
  oneOffs: TaskOneOff[]
  completions: TaskCompletion[]
}

export async function fetchTasksForRole(venueId: string, today: string): Promise<TasksResult> {
  const [{ data: tData }, { data: oData }, { data: cData }] = await Promise.all([
    supabase
      .from('task_templates')
      .select('id, title, job_role, is_active, venue_id, created_at')
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .order('created_at'),
    supabase
      .from('task_one_offs')
      .select('id, title, job_role, due_date, assigned_to_staff_id, venue_id, created_at')
      .eq('venue_id', venueId)
      .eq('due_date', today)
      .order('created_at'),
    supabase
      .from('task_completions')
      .select('id, task_template_id, task_one_off_id, completion_date, staff_id, venue_id')
      .eq('venue_id', venueId)
      .eq('completion_date', today),
  ])

  return {
    templates:   (tData ?? []) as TaskTemplate[],
    oneOffs:     (oData ?? []) as TaskOneOff[],
    completions: (cData ?? []) as TaskCompletion[],
  }
}

export async function fetchAllTasks(venueId: string, dateStr: string): Promise<TasksResult> {
  const [{ data: tData }, { data: oData }, { data: cData }] = await Promise.all([
    supabase.from('task_templates').select('id, title, job_role, is_active, venue_id, created_at').eq('venue_id', venueId).eq('is_active', true).order('job_role').order('created_at'),
    supabase.from('task_one_offs').select('id, title, job_role, due_date, assigned_to_staff_id, venue_id, created_at').eq('venue_id', venueId).eq('due_date', dateStr).order('created_at'),
    supabase.from('task_completions').select('id, task_template_id, task_one_off_id, completion_date, staff_id, venue_id').eq('venue_id', venueId).eq('completion_date', dateStr),
  ])

  return {
    templates:   (tData ?? []) as TaskTemplate[],
    oneOffs:     (oData ?? []) as TaskOneOff[],
    completions: (cData ?? []) as TaskCompletion[],
  }
}
