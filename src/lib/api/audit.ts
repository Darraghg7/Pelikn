import { supabase } from '../supabase'

export interface AuditRawData {
  temps: any[]
  cleaningTasks: any[]
  cleaningCompletions: any[]
  deliveries: any[]
  calibrations: any[]
  actions: any[]
  certs: any[]
  activeStaff: any[]
}

/** All EHO-audit source tables for a venue, since a given timestamp. One round trip (Promise.all), not eight sequential ones. */
export async function fetchAuditData(venueId: string, sinceTs: string): Promise<AuditRawData> {
  const [tempLogs, cleaningTasks, cleaningCompletions, deliveryChecks, probeCalibrations, correctiveActions, training, staff] = await Promise.all([
    supabase.from('fridge_temperature_logs')
      .select('id, temperature, logged_at, exceedance_reason, logged_by_name, is_resolved, fridge:fridge_id(name, min_temp, max_temp)')
      .eq('venue_id', venueId).gte('logged_at', sinceTs).order('logged_at', { ascending: false }),
    supabase.from('cleaning_tasks')
      .select('id, title, frequency').eq('venue_id', venueId).eq('is_active', true),
    supabase.from('cleaning_completions')
      .select('id, cleaning_task_id, completed_at').eq('venue_id', venueId).gte('completed_at', sinceTs),
    supabase.from('delivery_checks')
      .select('id, overall_pass, checked_at, supplier_name, temp_reading, temp_pass, packaging_ok, use_by_ok, notes, is_resolved')
      .eq('venue_id', venueId).gte('checked_at', sinceTs).order('checked_at', { ascending: false }),
    supabase.from('probe_calibrations')
      .select('id, pass, calibrated_at, probe_name, expected_temp, actual_reading, is_resolved')
      .eq('venue_id', venueId).gte('calibrated_at', sinceTs).order('calibrated_at', { ascending: false }),
    supabase.from('corrective_actions')
      .select('id, status, severity, reported_at, title, description')
      .eq('venue_id', venueId).gte('reported_at', sinceTs).order('reported_at', { ascending: false }),
    supabase.from('staff_training')
      .select('id, expiry_date, title, is_resolved, staff:staff_id(name)').eq('venue_id', venueId).order('expiry_date'),
    supabase.from('staff')
      .select('id, name').eq('venue_id', venueId).eq('is_active', true),
  ])

  return {
    temps: tempLogs.data ?? [],
    cleaningTasks: cleaningTasks.data ?? [],
    cleaningCompletions: cleaningCompletions.data ?? [],
    deliveries: deliveryChecks.data ?? [],
    calibrations: probeCalibrations.data ?? [],
    actions: correctiveActions.data ?? [],
    certs: training.data ?? [],
    activeStaff: staff.data ?? [],
  }
}

/** Generic resolve for tables with an is_resolved column (fridge temps, delivery checks, probe calibrations, staff training). */
export function resolveAuditRecord(table: string, id: string) {
  return supabase.from(table).update({ is_resolved: true, resolved_at: new Date().toISOString() }).eq('id', id)
}

/** Corrective actions use a status field instead of is_resolved. */
export function resolveCorrectiveAction(id: string) {
  return supabase.from('corrective_actions').update({ status: 'resolved' }).eq('id', id)
}
