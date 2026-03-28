import React, { useState, useEffect, useCallback } from 'react'
import { format, subDays } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { exportTempLogs, exportCleaningRecords, exportDeliveryChecks, exportCorrectiveActions, exportProbeCalibrations, exportTrainingRecords, exportFullReport } from '../../lib/exportData'

const RANGE_OPTIONS = [
  { label: '7 days',   days: 7 },
  { label: '30 days',  days: 30 },
  { label: '90 days',  days: 90 },
]

function StatRow({ label, value, sub, warn }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-charcoal/70">{label}</span>
      <div className="text-right">
        <span className={`text-sm font-semibold ${warn ? 'text-danger' : 'text-charcoal'}`}>{value}</span>
        {sub && <p className="text-[11px] text-charcoal/35">{sub}</p>}
      </div>
    </div>
  )
}

function DrillTable({ headers, rows }) {
  if (!rows.length) return <p className="text-xs text-charcoal/40 italic py-2">No records to display.</p>
  return (
    <div className="overflow-x-auto -mx-5 px-5">
      <table className="w-full text-xs min-w-[480px]">
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h} className="text-left text-[10px] tracking-widest uppercase text-charcoal/40 font-medium pb-2 pr-3 border-b border-charcoal/8">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-charcoal/5 last:border-0">
              {row.cells.map((cell, j) => (
                <td key={j} className={`py-2 pr-3 ${cell.bold ? 'font-semibold' : ''} ${cell.color ?? 'text-charcoal/70'}`}>
                  {cell.text}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SectionCard({ title, status, children, sectionId, openSection, onToggle, failCount, failLabel }) {
  const isOpen = openSection === sectionId
  const statusColors = {
    good:    'border-success/30 bg-success/3',
    warning: 'border-warning/30 bg-warning/3',
    bad:     'border-danger/30 bg-danger/3',
    neutral: 'border-charcoal/10',
  }
  const dotColors = { good: 'bg-success', warning: 'bg-warning', bad: 'bg-danger', neutral: 'bg-charcoal/20' }

  return (
    <div id={sectionId} className={`rounded-xl border ${statusColors[status] ?? statusColors.neutral}`}>
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${dotColors[status]}`} />
            <h3 className="text-[11px] tracking-widest uppercase text-charcoal/50 font-medium">{title}</h3>
          </div>
          {failCount > 0 && sectionId && (
            <button
              onClick={() => onToggle(sectionId)}
              className={`text-[11px] font-medium px-2 py-1 rounded-lg transition-colors ${
                isOpen
                  ? 'text-charcoal/60 bg-charcoal/8'
                  : status === 'bad' ? 'text-danger/80 bg-danger/8 hover:bg-danger/15'
                  : 'text-warning/80 bg-warning/8 hover:bg-warning/15'
              }`}
            >
              {isOpen ? 'Hide ▲' : `${failLabel ?? `${failCount} failed`} ▼`}
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}

export default function EHOAuditPage() {
  const { venueId } = useVenue()
  const [range, setRange] = useState(90)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [openSection, setOpenSection] = useState(null)

  // Auto-open section from URL hash (e.g. /audit#temps)
  useEffect(() => {
    const hash = window.location.hash?.slice(1)
    if (hash) setOpenSection(hash)
  }, [])

  const toggleSection = useCallback((id) => {
    setOpenSection(prev => prev === id ? null : id)
  }, [])

  useEffect(() => {
    if (!venueId) return
    const load = async () => {
      setLoading(true)
      const sinceTs = subDays(new Date(), range).toISOString()

      const [
        tempLogs,
        cleaningTasks,
        cleaningCompletions,
        deliveryChecks,
        probeCalibrations,
        correctiveActions,
        training,
        staff,
      ] = await Promise.all([
        supabase.from('fridge_temperature_logs')
          .select('id, temperature, logged_at, exceedance_reason, logged_by_name, fridge:fridge_id(name, min_temp, max_temp)')
          .eq('venue_id', venueId).gte('logged_at', sinceTs).order('logged_at', { ascending: false }),
        supabase.from('cleaning_tasks')
          .select('id, title, frequency').eq('venue_id', venueId).eq('is_active', true),
        supabase.from('cleaning_completions')
          .select('id, cleaning_task_id, completed_at').eq('venue_id', venueId).gte('completed_at', sinceTs),
        supabase.from('delivery_checks')
          .select('id, overall_pass, checked_at, supplier_name, temp_reading, temp_pass, packaging_ok, use_by_ok, notes')
          .eq('venue_id', venueId).gte('checked_at', sinceTs).order('checked_at', { ascending: false }),
        supabase.from('probe_calibrations')
          .select('id, pass, calibrated_at, probe_name, expected_temp, actual_reading')
          .eq('venue_id', venueId).gte('calibrated_at', sinceTs).order('calibrated_at', { ascending: false }),
        supabase.from('corrective_actions')
          .select('id, status, severity, reported_at, title, description')
          .eq('venue_id', venueId).gte('reported_at', sinceTs).order('reported_at', { ascending: false }),
        supabase.from('staff_training')
          .select('id, expiry_date, title, staff:staff_id(name)').eq('venue_id', venueId).order('expiry_date'),
        supabase.from('staff')
          .select('id, name').eq('venue_id', venueId).eq('is_active', true),
      ])

      const temps        = tempLogs.data          ?? []
      const tasks        = cleaningTasks.data      ?? []
      const completions  = cleaningCompletions.data ?? []
      const deliveries   = deliveryChecks.data     ?? []
      const calibrations = probeCalibrations.data  ?? []
      const actions      = correctiveActions.data  ?? []
      const certs        = training.data           ?? []
      const activeStaff  = staff.data              ?? []

      const EXPLAINED = ['delivery', 'defrost', 'service_access']

      // ── Temp analysis ──────────────────────────────────────────────────
      const tempTotal = temps.length
      const failedTemps = temps.filter(t =>
        t.fridge &&
        (t.temperature < t.fridge.min_temp || t.temperature > t.fridge.max_temp) &&
        !EXPLAINED.includes(t.exceedance_reason)
      )
      const tempFails = failedTemps.length
      const tempPassRate = tempTotal > 0 ? Math.round(((tempTotal - tempFails) / tempTotal) * 100) : 100

      // ── Delivery analysis ─────────────────────────────────────────────
      const deliveryTotal = deliveries.length
      const failedDeliveries = deliveries.filter(d => !d.overall_pass)
      const deliveryFails = failedDeliveries.length

      // ── Probe analysis ────────────────────────────────────────────────
      const probeTotal = calibrations.length
      const failedProbes = calibrations.filter(p => !p.pass)
      const probeFails = failedProbes.length
      const lastProbe = calibrations.length > 0
        ? format(new Date(calibrations[0].calibrated_at), 'd MMM yyyy')
        : 'Never'

      // ── Corrective actions ────────────────────────────────────────────
      const openActions = actions.filter(a => a.status === 'open')
      const caOpen = openActions.length
      const caCritical = openActions.filter(a => a.severity === 'critical').length

      // ── Training ──────────────────────────────────────────────────────
      const today = new Date()
      const expiredCertsList = certs.filter(c => c.expiry_date && new Date(c.expiry_date) < today)
      const expiredCerts = expiredCertsList.length
      const validCerts = certs.filter(c => !c.expiry_date || new Date(c.expiry_date) >= today).length

      setData({
        tempTotal, tempFails, tempPassRate, failedTemps: failedTemps.slice(0, 15),
        cleaningTotal: completions.length, cleaningTaskCount: tasks.length,
        deliveryTotal, deliveryFails, failedDeliveries: failedDeliveries.slice(0, 10),
        probeTotal, probeFails, lastProbe, failedProbes: failedProbes.slice(0, 10),
        caOpen, caCritical, caTotal: actions.length, openActions: openActions.slice(0, 10),
        expiredCerts, validCerts, totalCerts: certs.length, expiredCertsList: expiredCertsList.slice(0, 10),
        staffCount: activeStaff.length,
      })
      setLoading(false)
    }
    load()
  }, [range, venueId])

  const getOverallStatus = () => {
    if (!data) return 'neutral'
    if (data.caCritical > 0 || data.tempPassRate < 90 || data.expiredCerts > 2) return 'bad'
    if (data.caOpen > 3 || data.tempPassRate < 95 || data.probeFails > 0 || data.deliveryFails > 0 || data.expiredCerts > 0) return 'warning'
    return 'good'
  }

  const overallLabels = {
    good: 'Compliant — ready for inspection',
    warning: 'Some items need attention',
    bad: 'Action required before inspection',
  }

  const overall = getOverallStatus()

  const REASON_LABELS = {
    delivery: 'Delivery/restock', defrost: 'Defrost cycle',
    service_access: 'Busy service', equipment: 'Equipment concern', other: 'Other',
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl text-brand">EHO Audit Trail</h1>
        <p className="text-sm text-charcoal/40 mt-1">
          Everything an Environmental Health Officer needs to see — in one place.
        </p>
      </div>

      {/* Range selector */}
      <div className="flex gap-2">
        {RANGE_OPTIONS.map(r => (
          <button
            key={r.days}
            onClick={() => setRange(r.days)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              range === r.days
                ? 'bg-charcoal text-cream border-charcoal'
                : 'bg-white text-charcoal/50 border-charcoal/15 hover:border-charcoal/30'
            }`}
          >
            Last {r.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : !data ? null : (
        <>
          {/* Overall banner */}
          <div className={`rounded-xl border-2 p-5 text-center ${
            overall === 'good' ? 'border-success bg-success/5' :
            overall === 'warning' ? 'border-warning bg-warning/5' :
            'border-danger bg-danger/5'
          }`}>
            <p className={`text-lg font-serif font-semibold ${
              overall === 'good' ? 'text-success' : overall === 'warning' ? 'text-warning' : 'text-danger'
            }`}>
              {overallLabels[overall]}
            </p>
            <p className="text-xs text-charcoal/40 mt-1">Based on the last {range} days of records</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Temperature Monitoring */}
            <SectionCard
              title="Temperature Monitoring"
              status={data.tempPassRate >= 95 ? 'good' : data.tempPassRate >= 90 ? 'warning' : 'bad'}
              sectionId="temps"
              openSection={openSection}
              onToggle={toggleSection}
              failCount={data.tempFails}
              failLabel={`${data.tempFails} failed reading${data.tempFails !== 1 ? 's' : ''}`}
            >
              <StatRow label="Total readings" value={data.tempTotal} />
              <StatRow label="Pass rate" value={`${data.tempPassRate}%`} warn={data.tempPassRate < 95} />
              <StatRow label="Failed readings" value={data.tempFails} warn={data.tempFails > 0} />
              {openSection === 'temps' && data.failedTemps.length > 0 && (
                <div className="mt-3 pt-3 border-t border-charcoal/10">
                  <DrillTable
                    headers={['Date', 'Time', 'Fridge', 'Temp', 'Reason', 'Recorded By']}
                    rows={data.failedTemps.map(t => ({
                      cells: [
                        { text: format(new Date(t.logged_at), 'dd/MM/yy') },
                        { text: format(new Date(t.logged_at), 'HH:mm') },
                        { text: t.fridge?.name ?? '—' },
                        { text: `${Number(t.temperature).toFixed(1)} °C`, color: 'text-danger', bold: true },
                        { text: t.exceedance_reason ? (REASON_LABELS[t.exceedance_reason] ?? t.exceedance_reason) : '—' },
                        { text: t.logged_by_name ?? '—' },
                      ]
                    }))}
                  />
                </div>
              )}
            </SectionCard>

            {/* Cleaning */}
            <SectionCard
              title="Cleaning Schedule"
              status={data.cleaningTotal > 0 ? 'good' : 'warning'}
              sectionId={null}
              openSection={openSection}
              onToggle={toggleSection}
              failCount={0}
            >
              <StatRow label="Active tasks" value={data.cleaningTaskCount} />
              <StatRow label="Completions" value={data.cleaningTotal} sub={`in last ${range} days`} />
            </SectionCard>

            {/* Delivery Checks */}
            <SectionCard
              title="Delivery Checks"
              status={data.deliveryFails === 0 && data.deliveryTotal > 0 ? 'good' : data.deliveryFails > 0 ? 'warning' : 'neutral'}
              sectionId="deliveries"
              openSection={openSection}
              onToggle={toggleSection}
              failCount={data.deliveryFails}
              failLabel={`${data.deliveryFails} failed`}
            >
              <StatRow label="Deliveries checked" value={data.deliveryTotal} />
              <StatRow label="Failed checks" value={data.deliveryFails} warn={data.deliveryFails > 0} />
              {data.deliveryTotal === 0 && (
                <p className="text-xs text-warning mt-2">No delivery checks recorded. EHOs expect these.</p>
              )}
              {openSection === 'deliveries' && data.failedDeliveries.length > 0 && (
                <div className="mt-3 pt-3 border-t border-charcoal/10">
                  <DrillTable
                    headers={['Date', 'Supplier', 'Temp', 'Temp ✓', 'Pack ✓', 'Use-By ✓', 'Notes']}
                    rows={data.failedDeliveries.map(d => ({
                      cells: [
                        { text: format(new Date(d.checked_at), 'dd/MM/yy HH:mm') },
                        { text: d.supplier_name ?? '—', bold: true },
                        { text: d.temp_reading != null ? `${d.temp_reading} °C` : '—' },
                        { text: d.temp_pass ? 'PASS' : 'FAIL', color: d.temp_pass ? 'text-success' : 'text-danger', bold: true },
                        { text: d.packaging_ok ? 'PASS' : 'FAIL', color: d.packaging_ok ? 'text-success' : 'text-danger', bold: true },
                        { text: d.use_by_ok ? 'PASS' : 'FAIL', color: d.use_by_ok ? 'text-success' : 'text-danger', bold: true },
                        { text: d.notes ?? '—' },
                      ]
                    }))}
                  />
                </div>
              )}
            </SectionCard>

            {/* Probe Calibration */}
            <SectionCard
              title="Probe Calibration"
              status={data.probeFails === 0 && data.probeTotal > 0 ? 'good' : data.probeFails > 0 ? 'warning' : 'neutral'}
              sectionId="probes"
              openSection={openSection}
              onToggle={toggleSection}
              failCount={data.probeFails}
              failLabel={`${data.probeFails} failed`}
            >
              <StatRow label="Calibrations" value={data.probeTotal} />
              <StatRow label="Failed" value={data.probeFails} warn={data.probeFails > 0} />
              <StatRow label="Last calibration" value={data.lastProbe} />
              {data.probeTotal === 0 && (
                <p className="text-xs text-warning mt-2">No calibrations on record. Probes should be checked regularly.</p>
              )}
              {openSection === 'probes' && data.failedProbes.length > 0 && (
                <div className="mt-3 pt-3 border-t border-charcoal/10">
                  <DrillTable
                    headers={['Date', 'Probe', 'Expected', 'Actual', 'Result']}
                    rows={data.failedProbes.map(p => ({
                      cells: [
                        { text: format(new Date(p.calibrated_at), 'dd/MM/yy') },
                        { text: p.probe_name ?? '—', bold: true },
                        { text: p.expected_temp != null ? `${p.expected_temp} °C` : '—' },
                        { text: p.actual_reading != null ? `${p.actual_reading} °C` : '—' },
                        { text: 'FAIL', color: 'text-danger', bold: true },
                      ]
                    }))}
                  />
                </div>
              )}
            </SectionCard>

            {/* Corrective Actions */}
            <SectionCard
              title="Corrective Actions"
              status={data.caCritical > 0 ? 'bad' : data.caOpen > 0 ? 'warning' : 'good'}
              sectionId="actions"
              openSection={openSection}
              onToggle={toggleSection}
              failCount={data.caOpen}
              failLabel={`${data.caOpen} open`}
            >
              <StatRow label="Total logged" value={data.caTotal} />
              <StatRow label="Open issues" value={data.caOpen} warn={data.caOpen > 0} />
              <StatRow label="Critical open" value={data.caCritical} warn={data.caCritical > 0} />
              {openSection === 'actions' && data.openActions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-charcoal/10">
                  <DrillTable
                    headers={['Date', 'Title', 'Severity', 'Description']}
                    rows={data.openActions.map(a => ({
                      cells: [
                        { text: format(new Date(a.reported_at), 'dd/MM/yy') },
                        { text: a.title ?? '—', bold: true },
                        {
                          text: (a.severity ?? '').toUpperCase(),
                          color: a.severity === 'critical' ? 'text-danger' : a.severity === 'major' ? 'text-warning' : 'text-charcoal/60',
                          bold: true,
                        },
                        { text: a.description ?? '—' },
                      ]
                    }))}
                  />
                </div>
              )}
            </SectionCard>

            {/* Staff Training */}
            <SectionCard
              title="Staff Training"
              status={data.expiredCerts === 0 ? 'good' : 'warning'}
              sectionId="training"
              openSection={openSection}
              onToggle={toggleSection}
              failCount={data.expiredCerts}
              failLabel={`${data.expiredCerts} expired`}
            >
              <StatRow label="Active staff" value={data.staffCount} />
              <StatRow label="Valid certificates" value={data.validCerts} />
              <StatRow label="Expired certificates" value={data.expiredCerts} warn={data.expiredCerts > 0} />
              {openSection === 'training' && data.expiredCertsList.length > 0 && (
                <div className="mt-3 pt-3 border-t border-charcoal/10">
                  <DrillTable
                    headers={['Staff', 'Certificate', 'Expired']}
                    rows={data.expiredCertsList.map(c => ({
                      cells: [
                        { text: c.staff?.name ?? '—', bold: true },
                        { text: c.title ?? '—' },
                        { text: format(new Date(c.expiry_date), 'dd/MM/yyyy'), color: 'text-danger', bold: true },
                      ]
                    }))}
                  />
                </div>
              )}
            </SectionCard>
          </div>

          {/* Data Export */}
          <div className="rounded-xl bg-white border border-charcoal/10 px-5 py-4">
            <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-3">Export Records (PDF)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { label: 'Temp Logs',  fn: () => exportTempLogs(venueId, range) },
                { label: 'Cleaning',   fn: () => exportCleaningRecords(venueId, range) },
                { label: 'Deliveries', fn: () => exportDeliveryChecks(venueId, range) },
                { label: 'Actions',    fn: () => exportCorrectiveActions(venueId, range) },
                { label: 'Probe Cal.', fn: () => exportProbeCalibrations(venueId, range) },
                { label: 'Training',   fn: () => exportTrainingRecords(venueId) },
              ].map(btn => (
                <button key={btn.label} onClick={btn.fn}
                  className="px-3 py-2 rounded-lg border border-charcoal/15 text-xs font-medium text-charcoal/60 hover:text-charcoal hover:border-charcoal/30 transition-colors">
                  ↓ {btn.label}
                </button>
              ))}
            </div>
            <button onClick={() => exportFullReport(venueId, range)}
              className="w-full mt-3 px-4 py-2.5 rounded-lg bg-charcoal text-cream text-xs font-medium hover:bg-charcoal/90 transition-colors">
              ↓ Download All Reports (PDF)
            </button>
          </div>

          {/* Guidance note */}
          <div className="rounded-xl bg-charcoal/4 px-5 py-4">
            <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-2">EHO Inspection Tips</p>
            <ul className="text-xs text-charcoal/50 space-y-1.5 list-disc list-inside">
              <li>Ensure all fridge temps are logged at least twice daily (opening and closing)</li>
              <li>Every delivery should have a temperature check recorded</li>
              <li>Probes should be calibrated at least monthly</li>
              <li>All corrective actions should be resolved before an inspection</li>
              <li>Staff food safety certificates must be current — expired certs are a common finding</li>
              <li>Cleaning schedules must show consistent completion, not just task lists</li>
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
