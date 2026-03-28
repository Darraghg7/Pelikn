/**
 * Data export utilities — PDF downloads for all compliance data.
 * Each function fetches data and renders a formatted jsPDF report
 * suitable for EHO inspections.
 */
import { format, subDays } from 'date-fns'
import { supabase } from './supabase'
import { buildPdfReport } from './pdfUtils'

/* ── Shared colour helpers ─────────────────────────────────────────────── */
const RED   = [180, 30,  30]
const GREEN = [22,  100, 46]

function passFailCell(hookData, colIndex, passValue = 'PASS') {
  if (hookData.section !== 'body' || hookData.column.index !== colIndex) return
  if (hookData.cell.raw === passValue) {
    hookData.cell.styles.textColor = GREEN
    hookData.cell.styles.fontStyle = 'bold'
  } else if (hookData.cell.raw && hookData.cell.raw !== '—' && hookData.cell.raw !== passValue) {
    hookData.cell.styles.textColor = RED
    hookData.cell.styles.fontStyle = 'bold'
  }
}

/* ── Temperature logs ──────────────────────────────────────────────────── */
export async function exportTempLogs(venueId, days = 90) {
  const since = subDays(new Date(), days).toISOString()
  const { data } = await supabase
    .from('fridge_temperature_logs')
    .select('temperature, logged_at, notes, exceedance_reason, check_period, fridge:fridge_id(name, min_temp, max_temp), logged_by_name')
    .eq('venue_id', venueId)
    .gte('logged_at', since)
    .order('logged_at', { ascending: false })

  const EXPLAINED = ['delivery', 'defrost', 'service_access']
  const REASON_LABELS = {
    delivery:       'Delivery / restock',
    defrost:        'Defrost cycle',
    service_access: 'Busy service',
    equipment:      'Equipment concern',
    other:          'Other',
  }

  const rows = (data ?? []).map(r => {
    const oor = r.fridge
      ? (r.temperature < r.fridge.min_temp || r.temperature > r.fridge.max_temp)
      : false
    const explained = oor && EXPLAINED.includes(r.exceedance_reason)
    let status = oor ? (explained ? 'EXPLAINED' : 'OUT OF RANGE') : 'PASS'
    return [
      format(new Date(r.logged_at), 'dd/MM/yyyy'),
      format(new Date(r.logged_at), 'HH:mm'),
      r.check_period?.toUpperCase() ?? '—',
      r.fridge?.name ?? '—',
      `${Number(r.temperature).toFixed(1)} °C`,
      status,
      r.exceedance_reason ? (REASON_LABELS[r.exceedance_reason] ?? r.exceedance_reason) : '—',
      r.logged_by_name ?? '—',
      r.notes ?? '',
    ]
  })

  buildPdfReport({
    title: 'SafeServ',
    subtitle: 'Temperature Log Report',
    periodLabel: `Last ${days} days`,
    columns: ['Date', 'Time', 'AM/PM', 'Fridge', 'Temp', 'Status', 'Reason', 'Recorded By', 'Notes'],
    rows,
    didParseCell(hookData) {
      if (hookData.section !== 'body' || hookData.column.index !== 5) return
      if (hookData.cell.raw === 'PASS') {
        hookData.cell.styles.textColor = GREEN
        hookData.cell.styles.fontStyle = 'bold'
      } else if (hookData.cell.raw === 'OUT OF RANGE') {
        hookData.cell.styles.textColor = RED
        hookData.cell.styles.fontStyle = 'bold'
      } else if (hookData.cell.raw === 'EXPLAINED') {
        hookData.cell.styles.textColor = [160, 100, 0]
        hookData.cell.styles.fontStyle = 'bold'
      }
    },
    filename: `temp-logs-${format(new Date(), 'yyyy-MM-dd')}.pdf`,
  })
}

/* ── Cleaning records ──────────────────────────────────────────────────── */
export async function exportCleaningRecords(venueId, days = 90) {
  const since = subDays(new Date(), days).toISOString()
  const { data } = await supabase
    .from('cleaning_completions')
    .select('completed_at, notes, task:cleaning_task_id(title, frequency), completer:completed_by(name)')
    .eq('venue_id', venueId)
    .gte('completed_at', since)
    .order('completed_at', { ascending: false })

  const rows = (data ?? []).map(r => [
    format(new Date(r.completed_at), 'dd/MM/yyyy'),
    format(new Date(r.completed_at), 'HH:mm'),
    r.task?.title ?? '—',
    r.task?.frequency ?? '—',
    r.completer?.name ?? '—',
    r.notes ?? '',
  ])

  buildPdfReport({
    title: 'SafeServ',
    subtitle: 'Cleaning Records Report',
    periodLabel: `Last ${days} days`,
    columns: ['Date', 'Time', 'Task', 'Frequency', 'Completed By', 'Notes'],
    rows,
    filename: `cleaning-records-${format(new Date(), 'yyyy-MM-dd')}.pdf`,
  })
}

/* ── Delivery checks ───────────────────────────────────────────────────── */
export async function exportDeliveryChecks(venueId, days = 90) {
  const since = subDays(new Date(), days).toISOString()
  const { data } = await supabase
    .from('delivery_checks')
    .select('supplier_name, items_desc, temp_reading, temp_pass, packaging_ok, use_by_ok, overall_pass, notes, checked_at, checker:staff!checked_by(name)')
    .eq('venue_id', venueId)
    .gte('checked_at', since)
    .order('checked_at', { ascending: false })

  const yn = (v) => v ? 'PASS' : 'FAIL'

  const rows = (data ?? []).map(r => [
    format(new Date(r.checked_at), 'dd/MM/yyyy'),
    format(new Date(r.checked_at), 'HH:mm'),
    r.supplier_name ?? '—',
    r.items_desc ?? '—',
    r.temp_reading != null ? `${r.temp_reading} °C` : '—',
    yn(r.temp_pass),
    yn(r.packaging_ok),
    yn(r.use_by_ok),
    yn(r.overall_pass),
    r.checker?.name ?? '—',
    r.notes ?? '',
  ])

  // Colour-code columns 5-8 (Temp, Packaging, Use-By, Overall)
  buildPdfReport({
    title: 'SafeServ',
    subtitle: 'Delivery Checks Report',
    periodLabel: `Last ${days} days`,
    columns: ['Date', 'Time', 'Supplier', 'Items', 'Temp', 'Temp ✓', 'Pack ✓', 'Use-By ✓', 'Overall', 'Checked By', 'Notes'],
    rows,
    didParseCell(hookData) {
      if (hookData.section !== 'body') return
      const ci = hookData.column.index
      if (ci >= 5 && ci <= 8) passFailCell(hookData, ci)
    },
    filename: `delivery-checks-${format(new Date(), 'yyyy-MM-dd')}.pdf`,
  })
}

/* ── Corrective actions ────────────────────────────────────────────────── */
export async function exportCorrectiveActions(venueId, days = 90) {
  const since = subDays(new Date(), days).toISOString()
  const { data } = await supabase
    .from('corrective_actions')
    .select('title, category, severity, status, description, action_taken, reported_at, resolved_at, reporter:staff!reported_by(name), resolver:staff!resolved_by(name)')
    .eq('venue_id', venueId)
    .gte('reported_at', since)
    .order('reported_at', { ascending: false })

  const rows = (data ?? []).map(r => [
    format(new Date(r.reported_at), 'dd/MM/yyyy'),
    r.title ?? '—',
    r.category ?? '—',
    (r.severity ?? '').toUpperCase(),
    (r.status ?? '').toUpperCase(),
    r.description ?? '',
    r.action_taken ?? '',
    r.reporter?.name ?? '—',
    r.resolver?.name ?? '—',
    r.resolved_at ? format(new Date(r.resolved_at), 'dd/MM/yyyy') : '—',
  ])

  buildPdfReport({
    title: 'SafeServ',
    subtitle: 'Corrective Actions Report',
    periodLabel: `Last ${days} days`,
    columns: ['Date', 'Title', 'Category', 'Severity', 'Status', 'Description', 'Action Taken', 'Reported By', 'Resolved By', 'Resolved'],
    rows,
    didParseCell(hookData) {
      if (hookData.section !== 'body') return
      // Severity column (3): critical = red, high = orange
      if (hookData.column.index === 3) {
        if (hookData.cell.raw === 'CRITICAL') {
          hookData.cell.styles.textColor = RED
          hookData.cell.styles.fontStyle = 'bold'
        } else if (hookData.cell.raw === 'HIGH') {
          hookData.cell.styles.textColor = [180, 90, 0]
          hookData.cell.styles.fontStyle = 'bold'
        }
      }
      // Status column (4): open = red, resolved = green
      if (hookData.column.index === 4) {
        if (hookData.cell.raw === 'OPEN') {
          hookData.cell.styles.textColor = RED
          hookData.cell.styles.fontStyle = 'bold'
        } else if (hookData.cell.raw === 'RESOLVED') {
          hookData.cell.styles.textColor = GREEN
          hookData.cell.styles.fontStyle = 'bold'
        }
      }
    },
    filename: `corrective-actions-${format(new Date(), 'yyyy-MM-dd')}.pdf`,
  })
}

/* ── Probe calibrations ────────────────────────────────────────────────── */
export async function exportProbeCalibrations(venueId, days = 90) {
  const since = subDays(new Date(), days).toISOString()
  const { data } = await supabase
    .from('probe_calibrations')
    .select('probe_name, method, expected_temp, actual_reading, tolerance, pass, calibrated_at, notes, calibrator:staff!calibrated_by(name)')
    .eq('venue_id', venueId)
    .gte('calibrated_at', since)
    .order('calibrated_at', { ascending: false })

  const rows = (data ?? []).map(r => [
    format(new Date(r.calibrated_at), 'dd/MM/yyyy'),
    r.probe_name ?? '—',
    r.method ?? '—',
    r.expected_temp != null ? `${r.expected_temp} °C` : '—',
    r.actual_reading != null ? `${r.actual_reading} °C` : '—',
    r.tolerance != null ? `±${r.tolerance} °C` : '—',
    r.pass ? 'PASS' : 'FAIL',
    r.calibrator?.name ?? '—',
    r.notes ?? '',
  ])

  buildPdfReport({
    title: 'SafeServ',
    subtitle: 'Probe Calibration Report',
    periodLabel: `Last ${days} days`,
    columns: ['Date', 'Probe', 'Method', 'Expected', 'Actual', 'Tolerance', 'Result', 'Calibrated By', 'Notes'],
    rows,
    didParseCell(hookData) { passFailCell(hookData, 6) },
    filename: `probe-calibrations-${format(new Date(), 'yyyy-MM-dd')}.pdf`,
  })
}

/* ── Training records ──────────────────────────────────────────────────── */
export async function exportTrainingRecords(venueId) {
  const { data } = await supabase
    .from('staff_training')
    .select('title, category, issued_date, expiry_date, notes, staff:staff_id(name)')
    .eq('venue_id', venueId)
    .order('expiry_date')

  const now = new Date()
  const rows = (data ?? []).map(r => {
    const expiry = r.expiry_date ? new Date(r.expiry_date) : null
    const status = !expiry ? 'No expiry' : expiry < now ? 'EXPIRED' : 'VALID'
    return [
      r.staff?.name ?? '—',
      r.title ?? '—',
      r.category ?? '—',
      r.issued_date ? format(new Date(r.issued_date), 'dd/MM/yyyy') : '—',
      expiry ? format(expiry, 'dd/MM/yyyy') : '—',
      status,
      r.notes ?? '',
    ]
  })

  buildPdfReport({
    title: 'SafeServ',
    subtitle: 'Staff Training Records',
    periodLabel: `All records as of ${format(now, 'dd/MM/yyyy')}`,
    columns: ['Staff', 'Certificate', 'Category', 'Issued', 'Expiry', 'Status', 'Notes'],
    rows,
    didParseCell(hookData) {
      if (hookData.section !== 'body' || hookData.column.index !== 5) return
      if (hookData.cell.raw === 'EXPIRED') {
        hookData.cell.styles.textColor = RED
        hookData.cell.styles.fontStyle = 'bold'
      } else if (hookData.cell.raw === 'VALID') {
        hookData.cell.styles.textColor = GREEN
        hookData.cell.styles.fontStyle = 'bold'
      }
    },
    filename: `training-records-${format(new Date(), 'yyyy-MM-dd')}.pdf`,
  })
}

/* ── Full report (all 6 PDFs) ──────────────────────────────────────────── */
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
