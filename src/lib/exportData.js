/**
 * Data export utilities — PDF downloads for all compliance data.
 * Each function fetches data and renders a formatted jsPDF report
 * suitable for EHO inspections.
 */
import { format, subDays } from 'date-fns'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
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

/* ── EHO Inspection Report (single comprehensive PDF) ─────────────────── */
export async function exportEHOReport(venueId, venueName = '', days = 90) {
  const since = subDays(new Date(), days).toISOString()
  const now   = new Date()

  // Fetch all data in parallel
  const [temps, deliveries, probes, actions, training, cooling, hotHolding, pest, cleaning] =
    await Promise.all([
      supabase.from('fridge_temperature_logs')
        .select('temperature, logged_at, exceedance_reason, is_resolved, fridge:fridge_id(name, min_temp, max_temp), logged_by_name')
        .eq('venue_id', venueId).gte('logged_at', since).order('logged_at', { ascending: false }),
      supabase.from('delivery_checks')
        .select('supplier_name, overall_pass, is_resolved, checked_at')
        .eq('venue_id', venueId).gte('checked_at', since).order('checked_at', { ascending: false }),
      supabase.from('probe_calibrations')
        .select('probe_name, pass, is_resolved, calibrated_at')
        .eq('venue_id', venueId).gte('calibrated_at', since).order('calibrated_at', { ascending: false }),
      supabase.from('corrective_actions')
        .select('title, severity, status, action_taken, reported_at, resolved_at')
        .eq('venue_id', venueId).gte('reported_at', since).order('reported_at', { ascending: false }),
      supabase.from('staff_training')
        .select('title, expiry_date, staff:staff_id(name)')
        .eq('venue_id', venueId).order('expiry_date'),
      supabase.from('cooling_logs')
        .select('food_item, start_temp, end_temp, target_temp, logged_at, logged_by_name')
        .eq('venue_id', venueId).gte('logged_at', since).order('logged_at', { ascending: false }),
      supabase.from('hot_holding_logs')
        .select('item_name, temperature, logged_at, logged_by_name')
        .eq('venue_id', venueId).gte('logged_at', since).order('logged_at', { ascending: false }),
      supabase.from('pest_control_logs')
        .select('log_type, pest_type, severity, status, logged_at, logged_by_name')
        .eq('venue_id', venueId).gte('logged_at', since).order('logged_at', { ascending: false }),
      supabase.from('cleaning_completions')
        .select('completed_at, task:cleaning_task_id(title), completer:completed_by(name)')
        .eq('venue_id', venueId).gte('completed_at', since).order('completed_at', { ascending: false }),
    ])

  // ── Compute summary stats ────────────────────────────────────────────────
  const EXPLAINED = ['delivery', 'defrost', 'service_access']
  const t = temps.data ?? []
  const tempFails    = t.filter(x => x.fridge && (x.temperature < x.fridge.min_temp || x.temperature > x.fridge.max_temp) && !EXPLAINED.includes(x.exceedance_reason) && !x.is_resolved).length
  const tempPassRate = t.length > 0 ? Math.round(((t.length - tempFails) / t.length) * 100) : 100

  const d = deliveries.data ?? []
  const delivFails = d.filter(x => !x.overall_pass && !x.is_resolved).length

  const c = probes.data ?? []
  const probeFails = c.filter(x => !x.pass && !x.is_resolved).length

  const a = actions.data ?? []
  const openCritical = a.filter(x => x.status === 'open' && x.severity === 'critical').length
  const openActions  = a.filter(x => x.status === 'open').length

  const tr = training.data ?? []
  const expiredCerts = tr.filter(x => x.expiry_date && new Date(x.expiry_date) < now).length

  const cl = cooling.data ?? []
  const coolingFails = cl.filter(x => Number(x.end_temp) > Number(x.target_temp ?? 8)).length

  const p = pest.data ?? []
  const openPest = p.filter(x => x.status === 'open' && (x.log_type === 'sighting' || x.log_type === 'treatment')).length

  // ── Build PDF ─────────────────────────────────────────────────────────────
  const doc     = new jsPDF()
  const pageW   = doc.internal.pageSize.getWidth()
  const R = [180, 30, 30], G = [22, 100, 46], O = [160, 100, 0]
  const periodLabel = `Last ${days} days (${format(subDays(now, days), 'dd/MM/yyyy')} – ${format(now, 'dd/MM/yyyy')})`

  // Cover header
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20)
  doc.text('EHO Compliance Report', 14, 20)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(100)
  if (venueName) { doc.text(venueName, 14, 28) }
  doc.text(`Period: ${periodLabel}`, 14, venueName ? 34 : 28)
  doc.text(`Generated: ${format(now, 'dd/MM/yyyy HH:mm')}`, 14, venueName ? 40 : 34)
  doc.setTextColor(0)

  // Helper: section heading band
  let y = venueName ? 50 : 44
  const sectionHead = (label) => {
    doc.setFillColor(40, 40, 40)
    doc.rect(14, y, pageW - 28, 8, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255, 255, 255)
    doc.text(label, 17, y + 5.5)
    doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal')
    y += 8
  }

  const nextY = () => { y = (doc.lastAutoTable?.finalY ?? y) + 8 }

  // ── 1. Summary ─────────────────────────────────────────────────────────────
  sectionHead('COMPLIANCE SUMMARY')
  autoTable(doc, {
    startY: y,
    head: [['Category', 'Records', 'Issues', 'Status']],
    body: [
      ['Temperature Monitoring', t.length, tempFails, tempPassRate >= 95 ? 'GOOD' : tempFails > 0 ? 'ACTION REQUIRED' : 'REVIEW'],
      ['Delivery Checks',        d.length, delivFails, delivFails === 0 ? 'GOOD' : 'ACTION REQUIRED'],
      ['Probe Calibrations',     c.length, probeFails, probeFails === 0 ? 'GOOD' : 'ACTION REQUIRED'],
      ['Corrective Actions',     a.length, openActions, openCritical > 0 ? 'CRITICAL OPEN' : openActions === 0 ? 'GOOD' : 'REVIEW'],
      ['Staff Training',         tr.length, expiredCerts, expiredCerts === 0 ? 'GOOD' : 'ACTION REQUIRED'],
      ['Cooling Logs',           cl.length, coolingFails, coolingFails === 0 ? 'GOOD' : 'REVIEW'],
      ['Hot Holding',            (hotHolding.data ?? []).length, 0, (hotHolding.data ?? []).length > 0 ? 'GOOD' : 'NO DATA'],
      ['Pest Control',           p.length, openPest, openPest === 0 ? 'GOOD' : 'ACTION REQUIRED'],
      ['Cleaning Records',       (cleaning.data ?? []).length, 0, (cleaning.data ?? []).length > 0 ? 'GOOD' : 'NO DATA'],
    ],
    headStyles: { fillColor: [40, 40, 40], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } },
    didParseCell(hook) {
      if (hook.section !== 'body' || hook.column.index !== 3) return
      const v = hook.cell.raw
      if (v === 'GOOD')             { hook.cell.styles.textColor = G; hook.cell.styles.fontStyle = 'bold' }
      if (v === 'ACTION REQUIRED')  { hook.cell.styles.textColor = R; hook.cell.styles.fontStyle = 'bold' }
      if (v === 'CRITICAL OPEN')    { hook.cell.styles.textColor = R; hook.cell.styles.fontStyle = 'bold' }
      if (v === 'REVIEW')           { hook.cell.styles.textColor = O; hook.cell.styles.fontStyle = 'bold' }
    },
  })
  nextY()

  // ── 2. Temperature logs ────────────────────────────────────────────────────
  if (t.length > 0) {
    sectionHead('TEMPERATURE MONITORING')
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Fridge', 'Temp (°C)', 'Status', 'Recorded By']],
      body: t.slice(0, 100).map(r => {
        const oor = r.fridge ? (r.temperature < r.fridge.min_temp || r.temperature > r.fridge.max_temp) : false
        const exp = oor && EXPLAINED.includes(r.exceedance_reason)
        return [
          format(new Date(r.logged_at), 'dd/MM/yy HH:mm'),
          r.fridge?.name ?? '—',
          Number(r.temperature).toFixed(1),
          oor ? (exp ? 'EXPLAINED' : 'OUT OF RANGE') : 'PASS',
          r.logged_by_name ?? '—',
        ]
      }),
      headStyles: { fillColor: [40, 40, 40], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      didParseCell(hook) {
        if (hook.section !== 'body' || hook.column.index !== 3) return
        if (hook.cell.raw === 'PASS')         { hook.cell.styles.textColor = G; hook.cell.styles.fontStyle = 'bold' }
        if (hook.cell.raw === 'OUT OF RANGE') { hook.cell.styles.textColor = R; hook.cell.styles.fontStyle = 'bold' }
        if (hook.cell.raw === 'EXPLAINED')    { hook.cell.styles.textColor = O; hook.cell.styles.fontStyle = 'bold' }
      },
    })
    nextY()
  }

  // ── 3. Delivery checks ─────────────────────────────────────────────────────
  if (d.length > 0) {
    sectionHead('DELIVERY CHECKS')
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Supplier', 'Overall Result']],
      body: d.map(r => [
        format(new Date(r.checked_at), 'dd/MM/yy HH:mm'),
        r.supplier_name ?? '—',
        r.overall_pass ? 'PASS' : 'FAIL',
      ]),
      headStyles: { fillColor: [40, 40, 40], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      didParseCell(hook) {
        if (hook.section === 'body' && hook.column.index === 2) {
          hook.cell.styles.textColor = hook.cell.raw === 'PASS' ? G : R
          hook.cell.styles.fontStyle = 'bold'
        }
      },
    })
    nextY()
  }

  // ── 4. Probe calibrations ──────────────────────────────────────────────────
  if (c.length > 0) {
    sectionHead('PROBE CALIBRATIONS')
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Probe', 'Result']],
      body: c.map(r => [
        format(new Date(r.calibrated_at), 'dd/MM/yy'),
        r.probe_name ?? '—',
        r.pass ? 'PASS' : 'FAIL',
      ]),
      headStyles: { fillColor: [40, 40, 40], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      didParseCell(hook) {
        if (hook.section === 'body' && hook.column.index === 2) {
          hook.cell.styles.textColor = hook.cell.raw === 'PASS' ? G : R
          hook.cell.styles.fontStyle = 'bold'
        }
      },
    })
    nextY()
  }

  // ── 5. Cooling logs ────────────────────────────────────────────────────────
  if (cl.length > 0) {
    sectionHead('COOLING RECORDS')
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Food Item', 'Start (°C)', 'End (°C)', 'Target', 'Result']],
      body: cl.map(r => {
        const fail = Number(r.end_temp) > Number(r.target_temp ?? 8)
        return [
          format(new Date(r.logged_at), 'dd/MM/yy'),
          r.food_item ?? '—',
          Number(r.start_temp).toFixed(1),
          Number(r.end_temp).toFixed(1),
          `≤${r.target_temp ?? 8}°C`,
          fail ? 'EXCEEDED' : 'PASS',
        ]
      }),
      headStyles: { fillColor: [40, 40, 40], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      didParseCell(hook) {
        if (hook.section === 'body' && hook.column.index === 5) {
          hook.cell.styles.textColor = hook.cell.raw === 'PASS' ? G : R
          hook.cell.styles.fontStyle = 'bold'
        }
      },
    })
    nextY()
  }

  // ── 6. Hot holding ─────────────────────────────────────────────────────────
  const hh = hotHolding.data ?? []
  if (hh.length > 0) {
    sectionHead('HOT HOLDING')
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Item', 'Temp (°C)', 'Status']],
      body: hh.map(r => {
        const pass = Number(r.temperature) >= 63
        return [
          format(new Date(r.logged_at), 'dd/MM/yy HH:mm'),
          r.item_name ?? '—',
          Number(r.temperature).toFixed(1),
          pass ? 'PASS' : 'BELOW 63°C',
        ]
      }),
      headStyles: { fillColor: [40, 40, 40], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      didParseCell(hook) {
        if (hook.section === 'body' && hook.column.index === 3) {
          hook.cell.styles.textColor = hook.cell.raw === 'PASS' ? G : R
          hook.cell.styles.fontStyle = 'bold'
        }
      },
    })
    nextY()
  }

  // ── 7. Corrective actions ──────────────────────────────────────────────────
  if (a.length > 0) {
    sectionHead('CORRECTIVE ACTIONS')
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Issue', 'Severity', 'Status', 'Action Taken', 'Resolved']],
      body: a.map(r => [
        format(new Date(r.reported_at), 'dd/MM/yy'),
        r.title ?? '—',
        (r.severity ?? '').toUpperCase(),
        (r.status ?? '').toUpperCase(),
        r.action_taken ?? '—',
        r.resolved_at ? format(new Date(r.resolved_at), 'dd/MM/yy') : '—',
      ]),
      headStyles: { fillColor: [40, 40, 40], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      columnStyles: { 4: { cellWidth: 45 } },
      didParseCell(hook) {
        if (hook.section !== 'body') return
        if (hook.column.index === 2) {
          if (hook.cell.raw === 'CRITICAL') { hook.cell.styles.textColor = R; hook.cell.styles.fontStyle = 'bold' }
          if (hook.cell.raw === 'HIGH')     { hook.cell.styles.textColor = O; hook.cell.styles.fontStyle = 'bold' }
        }
        if (hook.column.index === 3) {
          hook.cell.styles.textColor = hook.cell.raw === 'OPEN' ? R : G
          hook.cell.styles.fontStyle = 'bold'
        }
      },
    })
    nextY()
  }

  // ── 8. Staff training ──────────────────────────────────────────────────────
  if (tr.length > 0) {
    sectionHead('STAFF TRAINING RECORDS')
    autoTable(doc, {
      startY: y,
      head: [['Staff', 'Certificate', 'Expiry', 'Status']],
      body: tr.map(r => {
        const expiry = r.expiry_date ? new Date(r.expiry_date) : null
        const status = !expiry ? 'No expiry' : expiry < now ? 'EXPIRED' : 'VALID'
        return [
          r.staff?.name ?? '—',
          r.title ?? '—',
          expiry ? format(expiry, 'dd/MM/yyyy') : '—',
          status,
        ]
      }),
      headStyles: { fillColor: [40, 40, 40], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      didParseCell(hook) {
        if (hook.section === 'body' && hook.column.index === 3) {
          if (hook.cell.raw === 'EXPIRED') { hook.cell.styles.textColor = R; hook.cell.styles.fontStyle = 'bold' }
          if (hook.cell.raw === 'VALID')   { hook.cell.styles.textColor = G; hook.cell.styles.fontStyle = 'bold' }
        }
      },
    })
    nextY()
  }

  // ── 9. Pest control ────────────────────────────────────────────────────────
  if (p.length > 0) {
    sectionHead('PEST CONTROL')
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Type', 'Pest', 'Severity', 'Status']],
      body: p.map(r => [
        format(new Date(r.logged_at), 'dd/MM/yy'),
        r.log_type ?? '—',
        r.pest_type ?? '—',
        (r.severity ?? '—').toUpperCase(),
        (r.status ?? '—').toUpperCase(),
      ]),
      headStyles: { fillColor: [40, 40, 40], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      didParseCell(hook) {
        if (hook.section === 'body' && hook.column.index === 4) {
          hook.cell.styles.textColor = hook.cell.raw === 'OPEN' ? R : G
          hook.cell.styles.fontStyle = 'bold'
        }
      },
    })
    nextY()
  }

  // ── 10. Cleaning ───────────────────────────────────────────────────────────
  const clean = cleaning.data ?? []
  if (clean.length > 0) {
    sectionHead('CLEANING RECORDS')
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Task', 'Completed By']],
      body: clean.slice(0, 60).map(r => [
        format(new Date(r.completed_at), 'dd/MM/yy HH:mm'),
        r.task?.title ?? '—',
        r.completer?.name ?? '—',
      ]),
      headStyles: { fillColor: [40, 40, 40], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 7 },
    })
  }

  // ── Footer on all pages ────────────────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7); doc.setTextColor(150)
    doc.text(
      `${venueName || 'SafeServ'} · EHO Compliance Report · Generated ${format(now, 'dd/MM/yyyy HH:mm')} · Page ${i} of ${pageCount}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    )
  }

  doc.save(`eho-report-${format(now, 'yyyy-MM-dd')}.pdf`)
}
