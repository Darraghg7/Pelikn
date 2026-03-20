/**
 * Data export utilities — CSV downloads for all compliance data.
 */
import { format, subDays } from 'date-fns'
import { supabase } from './supabase'
import { downloadCsv } from './utils'

function toCsvRow(values) {
  return values.map(v => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }).join(',')
}

function buildCsv(headers, rows) {
  return [toCsvRow(headers), ...rows.map(r => toCsvRow(r))].join('\n')
}

/** Export temperature logs */
export async function exportTempLogs(venueId, days = 90) {
  const since = subDays(new Date(), days).toISOString()
  const { data } = await supabase
    .from('fridge_temperature_logs')
    .select('temperature, logged_at, notes, fridge:fridge_id(name, min_temp, max_temp), logged_by_name')
    .eq('venue_id', venueId)
    .gte('logged_at', since)
    .order('logged_at', { ascending: false })

  const csv = buildCsv(
    ['Date', 'Time', 'Fridge', 'Temperature (C)', 'Status', 'Recorded By', 'Notes'],
    (data ?? []).map(r => {
      const pass = r.fridge ? (r.temperature >= r.fridge.min_temp && r.temperature <= r.fridge.max_temp) : true
      return [
        format(new Date(r.logged_at), 'yyyy-MM-dd'),
        format(new Date(r.logged_at), 'HH:mm'),
        r.fridge?.name ?? '',
        r.temperature,
        pass ? 'PASS' : 'FAIL',
        r.logged_by_name ?? '',
        r.notes ?? '',
      ]
    })
  )
  downloadCsv(csv, `temp-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`)
}

/** Export cleaning records */
export async function exportCleaningRecords(venueId, days = 90) {
  const since = subDays(new Date(), days).toISOString()
  const { data } = await supabase
    .from('cleaning_completions')
    .select('completed_at, notes, task:cleaning_task_id(title, frequency), completer:completed_by(name)')
    .eq('venue_id', venueId)
    .gte('completed_at', since)
    .order('completed_at', { ascending: false })

  const csv = buildCsv(
    ['Date', 'Time', 'Task', 'Frequency', 'Completed By', 'Notes'],
    (data ?? []).map(r => [
      format(new Date(r.completed_at), 'yyyy-MM-dd'),
      format(new Date(r.completed_at), 'HH:mm'),
      r.task?.title ?? '',
      r.task?.frequency ?? '',
      r.completer?.name ?? '',
      r.notes ?? '',
    ])
  )
  downloadCsv(csv, `cleaning-records-${format(new Date(), 'yyyy-MM-dd')}.csv`)
}

/** Export delivery checks */
export async function exportDeliveryChecks(venueId, days = 90) {
  const since = subDays(new Date(), days).toISOString()
  const { data } = await supabase
    .from('delivery_checks')
    .select('supplier_name, items_desc, temp_reading, temp_pass, packaging_ok, use_by_ok, overall_pass, notes, checked_at, checker:staff!checked_by(name)')
    .eq('venue_id', venueId)
    .gte('checked_at', since)
    .order('checked_at', { ascending: false })

  const csv = buildCsv(
    ['Date', 'Time', 'Supplier', 'Items', 'Temp (C)', 'Temp OK', 'Packaging OK', 'Use-by OK', 'Overall', 'Checked By', 'Notes'],
    (data ?? []).map(r => [
      format(new Date(r.checked_at), 'yyyy-MM-dd'),
      format(new Date(r.checked_at), 'HH:mm'),
      r.supplier_name,
      r.items_desc ?? '',
      r.temp_reading ?? '',
      r.temp_pass ? 'PASS' : 'FAIL',
      r.packaging_ok ? 'PASS' : 'FAIL',
      r.use_by_ok ? 'PASS' : 'FAIL',
      r.overall_pass ? 'PASS' : 'FAIL',
      r.checker?.name ?? '',
      r.notes ?? '',
    ])
  )
  downloadCsv(csv, `delivery-checks-${format(new Date(), 'yyyy-MM-dd')}.csv`)
}

/** Export corrective actions */
export async function exportCorrectiveActions(venueId, days = 90) {
  const since = subDays(new Date(), days).toISOString()
  const { data } = await supabase
    .from('corrective_actions')
    .select('title, category, severity, status, description, action_taken, reported_at, resolved_at, reporter:staff!reported_by(name), resolver:staff!resolved_by(name)')
    .eq('venue_id', venueId)
    .gte('reported_at', since)
    .order('reported_at', { ascending: false })

  const csv = buildCsv(
    ['Date', 'Title', 'Category', 'Severity', 'Status', 'Description', 'Action Taken', 'Reported By', 'Resolved By', 'Resolved Date'],
    (data ?? []).map(r => [
      format(new Date(r.reported_at), 'yyyy-MM-dd'),
      r.title,
      r.category,
      r.severity,
      r.status,
      r.description ?? '',
      r.action_taken,
      r.reporter?.name ?? '',
      r.resolver?.name ?? '',
      r.resolved_at ? format(new Date(r.resolved_at), 'yyyy-MM-dd') : '',
    ])
  )
  downloadCsv(csv, `corrective-actions-${format(new Date(), 'yyyy-MM-dd')}.csv`)
}

/** Export probe calibrations */
export async function exportProbeCalibrations(venueId, days = 90) {
  const since = subDays(new Date(), days).toISOString()
  const { data } = await supabase
    .from('probe_calibrations')
    .select('probe_name, method, expected_temp, actual_reading, tolerance, pass, calibrated_at, notes, calibrator:staff!calibrated_by(name)')
    .eq('venue_id', venueId)
    .gte('calibrated_at', since)
    .order('calibrated_at', { ascending: false })

  const csv = buildCsv(
    ['Date', 'Probe', 'Method', 'Expected (C)', 'Actual (C)', 'Tolerance', 'Result', 'Calibrated By', 'Notes'],
    (data ?? []).map(r => [
      format(new Date(r.calibrated_at), 'yyyy-MM-dd'),
      r.probe_name,
      r.method,
      r.expected_temp,
      r.actual_reading,
      r.tolerance,
      r.pass ? 'PASS' : 'FAIL',
      r.calibrator?.name ?? '',
      r.notes ?? '',
    ])
  )
  downloadCsv(csv, `probe-calibrations-${format(new Date(), 'yyyy-MM-dd')}.csv`)
}

/** Export training records */
export async function exportTrainingRecords(venueId) {
  const { data } = await supabase
    .from('staff_training')
    .select('title, category, issued_date, expiry_date, notes, staff:staff_id(name)')
    .eq('venue_id', venueId)
    .order('expiry_date')

  const csv = buildCsv(
    ['Staff', 'Title', 'Category', 'Issued', 'Expiry', 'Status', 'Notes'],
    (data ?? []).map(r => {
      const now = new Date()
      const expiry = r.expiry_date ? new Date(r.expiry_date) : null
      const status = !expiry ? 'No expiry' : expiry < now ? 'EXPIRED' : 'Valid'
      return [
        r.staff?.name ?? '',
        r.title,
        r.category ?? '',
        r.issued_date ?? '',
        r.expiry_date ?? '',
        status,
        r.notes ?? '',
      ]
    })
  )
  downloadCsv(csv, `training-records-${format(new Date(), 'yyyy-MM-dd')}.csv`)
}

/** Export all compliance data as a combined report */
export async function exportFullReport(venueId, days = 90) {
  await Promise.all([
    exportTempLogs(venueId, days),
    exportCleaningRecords(venueId, days),
    exportDeliveryChecks(venueId, days),
    exportCorrectiveActions(venueId, days),
    exportProbeCalibrations(venueId, days),
    exportTrainingRecords(venueId),
  ])
}
