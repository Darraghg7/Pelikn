import React, { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { useQueryClient } from '@tanstack/react-query'
import { useVenue } from '../../contexts/VenueContext'
import { useToast } from '../../components/ui/Toast'
import { useAuditSummary } from '../../hooks/useAuditSummary'
import { resolveAuditRecord, resolveCorrectiveAction } from '../../lib/api/audit'
import { SkeletonList } from '../../components/ui/Skeleton'
import { exportTempLogs, exportCleaningRecords, exportDeliveryChecks, exportCorrectiveActions, exportProbeCalibrations, exportTrainingRecords, exportFullReport, exportEHOReport } from '../../lib/exportData'
import { computeComplianceScore, COMPLIANCE_RANGE_DAYS } from '../../lib/compliance'

const RANGE_OPTIONS = [
  { label: '7 days',   days: 7 },
  { label: '30 days',  days: 30 },
  { label: '90 days',  days: 90 },
]

function StatRow({ label, value, sub, warn }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-charcoal/70 dark:text-white/60">{label}</span>
      <div className="text-right">
        <span className={`text-sm font-semibold ${warn ? 'text-danger' : 'text-charcoal dark:text-white'}`}>{value}</span>
        {sub && <p className="text-[11px] text-charcoal/35 dark:text-white/30">{sub}</p>}
      </div>
    </div>
  )
}

function DrillTable({ headers, rows }) {
  const hasAction = rows.some(r => r.action)
  if (!rows.length) return <p className="text-xs text-charcoal/40 dark:text-white/35 italic py-2">No records to display.</p>
  return (
    <div className="overflow-x-auto -mx-5 px-5">
      <table className="w-full text-xs min-w-[480px]">
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h} className="text-left text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 font-medium pb-2 pr-3 border-b border-charcoal/8 dark:border-white/8">{h}</th>
            ))}
            {hasAction && <th className="border-b border-charcoal/8 dark:border-white/8 pb-2" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-charcoal/5 dark:border-white/5 last:border-0">
              {row.cells.map((cell, j) => (
                <td key={j} className={`py-2 pr-3 ${cell.bold ? 'font-semibold' : ''} ${cell.color ?? 'text-charcoal/70 dark:text-white/60'}`}>
                  {cell.text}
                </td>
              ))}
              {hasAction && (
                <td className="py-2 pl-1 text-right">
                  {row.action && (
                    <button
                      onClick={row.action.fn}
                      disabled={row.action.loading}
                      className="text-[11px] font-medium px-2 py-1 rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors disabled:opacity-40 whitespace-nowrap"
                    >
                      {row.action.loading ? '…' : <span className="inline-flex items-center gap-1"><svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg> Resolved</span>}
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SectionCard({ title, status, children, sectionId, openSection, onToggle, failCount, failLabel }) {
  const isOpen = openSection === sectionId
  const dotColors = { good: 'bg-success', warning: 'bg-warning', bad: 'bg-danger', neutral: 'bg-charcoal/20 dark:bg-white/20' }

  return (
    <div id={sectionId} className="bg-white dark:bg-paperDark rounded-2xl overflow-hidden">
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${dotColors[status] ?? dotColors.neutral}`} />
            <h3 className="text-[11px] font-bold tracking-widest uppercase text-charcoal/50 dark:text-white/40">{title}</h3>
          </div>
          {failCount > 0 && sectionId && (
            <button
              onClick={() => onToggle(sectionId)}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
                isOpen
                  ? 'text-charcoal/50 dark:text-white/40 bg-charcoal/8 dark:bg-white/8'
                  : status === 'bad' ? 'text-danger bg-danger/10 hover:bg-danger/15'
                  : 'text-warning bg-warning/10 hover:bg-warning/15'
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
  const { venueId, venueName } = useVenue()
  const toast = useToast()
  const queryClient = useQueryClient()
  // Default must stay in step with the widget's window, or the dashboard score
  // and this page's score disagree the moment you click through.
  const [range, setRange] = useState(COMPLIANCE_RANGE_DAYS)
  const [openSection, setOpenSection] = useState(null)
  const [resolving, setResolving] = useState(null) // id of reading being resolved

  const { data, loading, markResolvedInCache } = useAuditSummary(range)

  // Auto-open section from URL hash (e.g. /audit#temps)
  useEffect(() => {
    const hash = window.location.hash?.slice(1)
    if (hash) setOpenSection(hash)
  }, [])

  const toggleSection = useCallback((id) => {
    setOpenSection(prev => prev === id ? null : id)
  }, [])

  // Generic resolve for tables with is_resolved column. rawKey is the key in
  // the underlying cached dataset (temps/deliveries/calibrations/certs), not
  // the derived stat shown on screen.
  const resolveRecord = useCallback(async (table, id, rawKey) => {
    setResolving(id)
    const { error } = await resolveAuditRecord(table, id)
    setResolving(null)
    if (error) { toast(error.message ?? 'Failed to resolve', 'error'); return }
    toast('Marked as resolved')
    // Match the DB write exactly — patch is_resolved in place rather than
    // dropping the row, or *Total stats (array.length) shrink incorrectly.
    markResolvedInCache(rawKey, id, { is_resolved: true, resolved_at: new Date().toISOString() })
    queryClient.invalidateQueries({ queryKey: ['widget', 'compliance_score', venueId] })
  }, [toast, queryClient, venueId, markResolvedInCache])

  // Corrective actions use status field instead of is_resolved
  const resolveAction = useCallback(async (id) => {
    setResolving(id)
    const { error } = await resolveCorrectiveAction(id)
    setResolving(null)
    if (error) { toast(error.message ?? 'Failed to resolve', 'error'); return }
    toast('Action marked resolved')
    markResolvedInCache('actions', id, { status: 'resolved' })
    queryClient.invalidateQueries({ queryKey: ['widget', 'compliance_score', venueId] })
  }, [toast, queryClient, venueId, markResolvedInCache])

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

  // Overall compliance score — shared with ComplianceScoreWidget so the
  // dashboard number and this page can never disagree again.
  const { score: overallScore, points: scorePoints, max: scoreMax } =
    data ? computeComplianceScore(data) : { score: 0, points: 0, max: 100 }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-charcoal dark:text-white">EHO Audit Trail</h1>
        <p className="text-sm text-charcoal/45 dark:text-white/40 mt-0.5">Environmental Health Officer inspection readiness</p>
      </div>

      {/* Range selector */}
      <div className="flex gap-2">
        {RANGE_OPTIONS.map(r => (
          <button
            key={r.days}
            onClick={() => setRange(r.days)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              range === r.days
                ? 'bg-brand text-white border-brand'
                : 'bg-white dark:bg-paperDark text-charcoal/50 dark:text-white/40 border-charcoal/15 dark:border-white/15 hover:border-charcoal/30 dark:hover:border-white/30'
            }`}
          >
            Last {r.label}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonList rows={5} />
      ) : !data ? null : (
        <>
          {/* Overall status banner */}
          <div className={`rounded-2xl border px-4 py-3.5 flex items-center gap-3 ${
            overall === 'good' ? 'border-success/25 bg-success/8' :
            overall === 'warning' ? 'border-warning/25 bg-warning/8' :
            'border-danger/25 bg-danger/8'
          }`}>
            <span className={`shrink-0 ${overall === 'good' ? 'text-success' : overall === 'warning' ? 'text-warning' : 'text-danger'}`}>
              {overall === 'good' ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /></svg>
              )}
            </span>
            <div className="flex-1 min-w-0">
              <p className={`font-bold text-sm ${overall === 'good' ? 'text-success' : overall === 'warning' ? 'text-warning' : 'text-danger'}`}>
                {overall === 'good' ? 'Exemplary — ready for inspection' : overallLabels[overall]}
              </p>
              <p className="text-[11px] text-charcoal/40 dark:text-white/35 mt-0.5">Score calculated at {format(new Date(), 'dd/MM/yy HH:mm')}</p>
            </div>
          </div>

          {/* Overall score card */}
          <div className="bg-white dark:bg-paperDark rounded-2xl p-5">
            <p className="text-[11px] font-bold tracking-widest uppercase text-charcoal/40 dark:text-white/35 mb-3">Overall Score</p>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-4xl font-bold text-midgreen">{overallScore}%</span>
              {overallScore >= 80 && (
                <svg className="w-5 h-5 text-midgreen" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" /></svg>
              )}
            </div>
            <div className="w-full h-2 bg-charcoal/8 dark:bg-white/8 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-charcoal rounded-full transition-all duration-500"
                style={{ width: `${overallScore}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-charcoal/6 dark:border-white/8">
              <div className="text-center">
                <p className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 mb-0.5">Points</p>
                <p className="font-bold text-charcoal dark:text-white text-base">{Math.round(scorePoints)}</p>
              </div>
              <div className="text-center">
                <p className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 mb-0.5">Max</p>
                <p className="font-bold text-charcoal dark:text-white text-base">{scoreMax}</p>
              </div>
              <div className="text-center">
                <p className="text-[11px] tracking-widest uppercase text-charcoal/40 dark:text-white/35 mb-0.5">Rate</p>
                <p className="font-bold text-midgreen text-base">{overallScore}%</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <div className="mt-3 pt-3 border-t border-charcoal/10 dark:border-white/10">
                  <p className="text-[11px] text-charcoal/40 dark:text-white/35 mb-2">These readings are out of range with no accepted explanation. Mark as resolved once actioned.</p>
                  <DrillTable
                    headers={['Date', 'Time', 'Fridge', 'Temp', 'Reason', 'Recorded By']}
                    rows={data.failedTemps.map(t => ({
                      cells: [
                        { text: format(new Date(t.logged_at), 'dd/MM/yy') },
                        { text: format(new Date(t.logged_at), 'HH:mm') },
                        { text: t.fridge?.name ?? '—' },
                        { text: `${Number(t.temperature).toFixed(1)} °C`, color: 'text-danger', bold: true },
                        { text: t.exceedance_reason ? (REASON_LABELS[t.exceedance_reason] ?? t.exceedance_reason) : 'No reason given' },
                        { text: t.logged_by_name ?? '—' },
                      ],
                      action: {
                        label: 'Resolved',
                        loading: resolving === t.id,
                        fn: () => resolveRecord('fridge_temperature_logs', t.id, 'temps'),
                      },
                    }))}
                  />
                </div>
              )}
              {openSection === 'temps' && data.failedTemps.length === 0 && (
                <p className="mt-3 pt-3 border-t border-charcoal/10 dark:border-white/10 text-xs text-success font-medium">All temperature alerts resolved</p>
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
                <div className="mt-3 pt-3 border-t border-charcoal/10 dark:border-white/10">
                  <DrillTable
                    headers={['Date', 'Supplier', 'Temp', 'Temp OK', 'Pack OK', 'Use-By OK', 'Notes']}
                    rows={data.failedDeliveries.map(d => ({
                      cells: [
                        { text: format(new Date(d.checked_at), 'dd/MM/yy HH:mm') },
                        { text: d.supplier_name ?? '—', bold: true },
                        { text: d.temp_reading != null ? `${d.temp_reading} °C` : '—' },
                        { text: d.temp_pass ? 'PASS' : 'FAIL', color: d.temp_pass ? 'text-success' : 'text-danger', bold: true },
                        { text: d.packaging_ok ? 'PASS' : 'FAIL', color: d.packaging_ok ? 'text-success' : 'text-danger', bold: true },
                        { text: d.use_by_ok ? 'PASS' : 'FAIL', color: d.use_by_ok ? 'text-success' : 'text-danger', bold: true },
                        { text: d.notes ?? '—' },
                      ],
                      action: { label: 'Resolved', loading: resolving === d.id, fn: () => resolveRecord('delivery_checks', d.id, 'deliveries') },
                    }))}
                  />
                </div>
              )}
              {openSection === 'deliveries' && data.failedDeliveries.length === 0 && data.deliveryTotal > 0 && (
                <p className="mt-3 pt-3 border-t border-charcoal/10 dark:border-white/10 text-xs text-success font-medium">All delivery failures resolved</p>
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
              <StatRow label="Last calibration" value={data.lastProbe ? format(new Date(data.lastProbe), 'd MMM yyyy') : 'Never'} />
              {data.probeTotal === 0 && (
                <p className="text-xs text-warning mt-2">No calibrations on record. Probes should be checked regularly.</p>
              )}
              {openSection === 'probes' && data.failedProbes.length > 0 && (
                <div className="mt-3 pt-3 border-t border-charcoal/10 dark:border-white/10">
                  <DrillTable
                    headers={['Date', 'Probe', 'Expected', 'Actual', 'Result']}
                    rows={data.failedProbes.map(p => ({
                      cells: [
                        { text: format(new Date(p.calibrated_at), 'dd/MM/yy') },
                        { text: p.probe_name ?? '—', bold: true },
                        { text: p.expected_temp != null ? `${p.expected_temp} °C` : '—' },
                        { text: p.actual_reading != null ? `${p.actual_reading} °C` : '—' },
                        { text: 'FAIL', color: 'text-danger', bold: true },
                      ],
                      action: { label: 'Resolved', loading: resolving === p.id, fn: () => resolveRecord('probe_calibrations', p.id, 'calibrations') },
                    }))}
                  />
                </div>
              )}
              {openSection === 'probes' && data.failedProbes.length === 0 && data.probeTotal > 0 && (
                <p className="mt-3 pt-3 border-t border-charcoal/10 dark:border-white/10 text-xs text-success font-medium">All probe failures resolved</p>
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
                <div className="mt-3 pt-3 border-t border-charcoal/10 dark:border-white/10">
                  <DrillTable
                    headers={['Date', 'Title', 'Severity', 'Description']}
                    rows={data.openActions.map(a => ({
                      cells: [
                        { text: format(new Date(a.reported_at), 'dd/MM/yy') },
                        { text: a.title ?? '—', bold: true },
                        {
                          text: (a.severity ?? '').toUpperCase(),
                          color: a.severity === 'critical' ? 'text-danger' : a.severity === 'major' ? 'text-warning' : 'text-charcoal/60 dark:text-white/50',
                          bold: true,
                        },
                        { text: a.description ?? '—' },
                      ],
                      action: { label: 'Resolved', loading: resolving === a.id, fn: () => resolveAction(a.id) },
                    }))}
                  />
                </div>
              )}
              {openSection === 'actions' && data.openActions.length === 0 && data.caTotal > 0 && (
                <p className="mt-3 pt-3 border-t border-charcoal/10 dark:border-white/10 text-xs text-success font-medium">All corrective actions resolved</p>
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
                <div className="mt-3 pt-3 border-t border-charcoal/10 dark:border-white/10">
                  <DrillTable
                    headers={['Staff', 'Certificate', 'Expired']}
                    rows={data.expiredCertsList.map(c => ({
                      cells: [
                        { text: c.staff?.name ?? '—', bold: true },
                        { text: c.title ?? '—' },
                        { text: format(new Date(c.expiry_date), 'dd/MM/yyyy'), color: 'text-danger', bold: true },
                      ],
                      action: { label: 'Renewed', loading: resolving === c.id, fn: () => resolveRecord('staff_training', c.id, 'certs') },
                    }))}
                  />
                </div>
              )}
              {openSection === 'training' && data.expiredCertsList.length === 0 && (
                <p className="mt-3 pt-3 border-t border-charcoal/10 dark:border-white/10 text-xs text-success font-medium">All certificates up to date</p>
              )}
            </SectionCard>
          </div>

          {/* EHO Inspection Report */}
          <div className="bg-white dark:bg-paperDark rounded-2xl px-5 py-4">
            <p className="text-[11px] font-bold tracking-widest uppercase text-charcoal/40 dark:text-white/35 mb-1">EHO Inspection Report</p>
            <p className="text-xs text-charcoal/45 dark:text-white/40 mb-3">One comprehensive PDF covering all compliance areas — ready to show an EHO inspector.</p>
            <button
              onClick={() => exportEHOReport(venueId, venueName, range)}
              className="w-full px-4 py-3 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand/90 transition-colors"
            >
              ↓ Download EHO Inspection Report
            </button>
          </div>

          {/* Data Export */}
          <div className="bg-white dark:bg-paperDark rounded-2xl px-5 py-4">
            <p className="text-[11px] font-bold tracking-widest uppercase text-charcoal/40 dark:text-white/35 mb-3">Export Records (PDF)</p>
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
                  className="px-3 py-2 rounded-xl border border-charcoal/15 dark:border-white/15 text-xs font-semibold text-charcoal/60 dark:text-white/50 hover:text-charcoal dark:hover:text-white hover:border-charcoal/30 dark:hover:border-white/30 transition-colors">
                  ↓ {btn.label}
                </button>
              ))}
            </div>
            <button onClick={() => exportFullReport(venueId, range)}
              className="w-full mt-3 px-4 py-2.5 rounded-xl bg-charcoal text-white text-xs font-bold hover:bg-charcoal/90 transition-colors">
              ↓ Download All Reports (PDF)
            </button>
          </div>

          {/* Guidance note */}
          <div className="bg-white dark:bg-paperDark rounded-2xl px-5 py-4">
            <p className="text-[11px] font-bold tracking-widest uppercase text-charcoal/40 dark:text-white/35 mb-2">EHO Inspection Tips</p>
            <ul className="text-xs text-charcoal/50 dark:text-white/40 space-y-1.5 list-disc list-inside">
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
