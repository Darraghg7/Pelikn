import React, { useState, useEffect } from 'react'
import { format, subDays, subMonths } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { exportTempLogs, exportCleaningRecords, exportDeliveryChecks, exportCorrectiveActions, exportProbeCalibrations, exportTrainingRecords, exportFullReport } from '../../lib/exportData'

const RANGE_OPTIONS = [
  { label: '7 days',   days: 7 },
  { label: '30 days',  days: 30 },
  { label: '90 days',  days: 90 },
]

function SectionCard({ title, status, children }) {
  const statusColors = {
    good:    'border-success/30 bg-success/3',
    warning: 'border-warning/30 bg-warning/3',
    bad:     'border-danger/30 bg-danger/3',
    neutral: 'border-charcoal/10',
  }
  const dotColors = { good: 'bg-success', warning: 'bg-warning', bad: 'bg-danger', neutral: 'bg-charcoal/20' }

  return (
    <div className={`rounded-xl border p-5 ${statusColors[status] ?? statusColors.neutral}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2 h-2 rounded-full ${dotColors[status]}`} />
        <h3 className="text-[10px] tracking-widest uppercase text-charcoal/50 font-medium">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function StatRow({ label, value, sub, warn }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-charcoal/70">{label}</span>
      <div className="text-right">
        <span className={`text-sm font-semibold ${warn ? 'text-danger' : 'text-charcoal'}`}>{value}</span>
        {sub && <p className="text-[10px] text-charcoal/35">{sub}</p>}
      </div>
    </div>
  )
}

export default function EHOAuditPage() {
  const [range, setRange] = useState(90)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const since = format(subDays(new Date(), range), 'yyyy-MM-dd')
      const sinceTs = subDays(new Date(), range).toISOString()

      // Fetch all data in parallel
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
        supabase.from('fridge_temperature_logs').select('id, temperature, status, recorded_at').gte('recorded_at', sinceTs),
        supabase.from('cleaning_tasks').select('id, title, frequency').eq('is_active', true),
        supabase.from('cleaning_completions').select('id, cleaning_task_id, completed_at').gte('completed_at', sinceTs),
        supabase.from('delivery_checks').select('id, overall_pass, checked_at').gte('checked_at', sinceTs),
        supabase.from('probe_calibrations').select('id, pass, calibrated_at').gte('calibrated_at', sinceTs),
        supabase.from('corrective_actions').select('id, status, severity, reported_at').gte('reported_at', sinceTs),
        supabase.from('staff_training').select('id, expiry_date, title'),
        supabase.from('staff').select('id, name').eq('is_active', true),
      ])

      const temps = tempLogs.data ?? []
      const tasks = cleaningTasks.data ?? []
      const completions = cleaningCompletions.data ?? []
      const deliveries = deliveryChecks.data ?? []
      const calibrations = probeCalibrations.data ?? []
      const actions = correctiveActions.data ?? []
      const certs = training.data ?? []
      const activeStaff = staff.data ?? []

      // Temp analysis
      const tempTotal = temps.length
      const tempFails = temps.filter(t => t.status === 'fail' || t.temperature > 8 || t.temperature < -25).length
      const tempPassRate = tempTotal > 0 ? Math.round(((tempTotal - tempFails) / tempTotal) * 100) : 100

      // Cleaning analysis
      const cleaningTotal = completions.length
      const cleaningTaskCount = tasks.length

      // Delivery analysis
      const deliveryTotal = deliveries.length
      const deliveryFails = deliveries.filter(d => !d.overall_pass).length

      // Probe analysis
      const probeTotal = calibrations.length
      const probeFails = calibrations.filter(p => !p.pass).length
      const lastProbe = calibrations.length > 0
        ? format(new Date(calibrations.sort((a, b) => new Date(b.calibrated_at) - new Date(a.calibrated_at))[0].calibrated_at), 'd MMM yyyy')
        : 'Never'

      // Corrective actions
      const caOpen = actions.filter(a => a.status === 'open').length
      const caCritical = actions.filter(a => a.status === 'open' && a.severity === 'critical').length

      // Training - check for expired
      const today = new Date()
      const expiredCerts = certs.filter(c => c.expiry_date && new Date(c.expiry_date) < today).length
      const validCerts = certs.filter(c => !c.expiry_date || new Date(c.expiry_date) >= today).length

      setData({
        tempTotal, tempFails, tempPassRate,
        cleaningTotal, cleaningTaskCount,
        deliveryTotal, deliveryFails,
        probeTotal, probeFails, lastProbe,
        caOpen, caCritical, caTotal: actions.length,
        expiredCerts, validCerts, totalCerts: certs.length,
        staffCount: activeStaff.length,
      })
      setLoading(false)
    }
    load()
  }, [range])

  // Overall score
  const getOverallStatus = () => {
    if (!data) return 'neutral'
    if (data.caCritical > 0 || data.tempPassRate < 90 || data.expiredCerts > 2) return 'bad'
    if (data.caOpen > 3 || data.tempPassRate < 95 || data.probeFails > 0 || data.deliveryFails > 0 || data.expiredCerts > 0) return 'warning'
    return 'good'
  }

  const overallLabels = {
    good: 'Compliant - ready for inspection',
    warning: 'Some items need attention',
    bad: 'Action required before inspection',
  }

  const overall = getOverallStatus()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl text-charcoal">EHO Audit Trail</h1>
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
            >
              <StatRow label="Total readings" value={data.tempTotal} />
              <StatRow label="Pass rate" value={`${data.tempPassRate}%`} warn={data.tempPassRate < 95} />
              <StatRow label="Failed readings" value={data.tempFails} warn={data.tempFails > 0} />
            </SectionCard>

            {/* Cleaning */}
            <SectionCard
              title="Cleaning Schedule"
              status={data.cleaningTotal > 0 ? 'good' : 'warning'}
            >
              <StatRow label="Active tasks" value={data.cleaningTaskCount} />
              <StatRow label="Completions" value={data.cleaningTotal} sub={`in last ${range} days`} />
            </SectionCard>

            {/* Delivery Checks */}
            <SectionCard
              title="Delivery Checks"
              status={data.deliveryFails === 0 && data.deliveryTotal > 0 ? 'good' : data.deliveryFails > 0 ? 'warning' : 'neutral'}
            >
              <StatRow label="Deliveries checked" value={data.deliveryTotal} />
              <StatRow label="Failed checks" value={data.deliveryFails} warn={data.deliveryFails > 0} />
              {data.deliveryTotal === 0 && (
                <p className="text-xs text-warning mt-2">No delivery checks recorded. EHOs expect these.</p>
              )}
            </SectionCard>

            {/* Probe Calibration */}
            <SectionCard
              title="Probe Calibration"
              status={data.probeFails === 0 && data.probeTotal > 0 ? 'good' : data.probeFails > 0 ? 'warning' : 'neutral'}
            >
              <StatRow label="Calibrations" value={data.probeTotal} />
              <StatRow label="Failed" value={data.probeFails} warn={data.probeFails > 0} />
              <StatRow label="Last calibration" value={data.lastProbe} />
              {data.probeTotal === 0 && (
                <p className="text-xs text-warning mt-2">No calibrations on record. Probes should be checked regularly.</p>
              )}
            </SectionCard>

            {/* Corrective Actions */}
            <SectionCard
              title="Corrective Actions"
              status={data.caCritical > 0 ? 'bad' : data.caOpen > 0 ? 'warning' : 'good'}
            >
              <StatRow label="Total logged" value={data.caTotal} />
              <StatRow label="Open issues" value={data.caOpen} warn={data.caOpen > 0} />
              <StatRow label="Critical open" value={data.caCritical} warn={data.caCritical > 0} />
            </SectionCard>

            {/* Staff Training */}
            <SectionCard
              title="Staff Training"
              status={data.expiredCerts === 0 ? 'good' : 'warning'}
            >
              <StatRow label="Active staff" value={data.staffCount} />
              <StatRow label="Valid certificates" value={data.validCerts} />
              <StatRow label="Expired certificates" value={data.expiredCerts} warn={data.expiredCerts > 0} />
            </SectionCard>
          </div>

          {/* Data Export */}
          <div className="rounded-xl bg-white border border-charcoal/10 px-5 py-4">
            <p className="text-[10px] tracking-widest uppercase text-charcoal/40 mb-3">Export Records (CSV)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { label: 'Temp Logs', fn: () => exportTempLogs(range) },
                { label: 'Cleaning', fn: () => exportCleaningRecords(range) },
                { label: 'Deliveries', fn: () => exportDeliveryChecks(range) },
                { label: 'Actions', fn: () => exportCorrectiveActions(range) },
                { label: 'Probe Cal.', fn: () => exportProbeCalibrations(range) },
                { label: 'Training', fn: () => exportTrainingRecords() },
              ].map(btn => (
                <button
                  key={btn.label}
                  onClick={btn.fn}
                  className="px-3 py-2 rounded-lg border border-charcoal/15 text-xs font-medium text-charcoal/60 hover:text-charcoal hover:border-charcoal/30 transition-colors"
                >
                  {btn.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => exportFullReport(range)}
              className="w-full mt-3 px-4 py-2.5 rounded-lg bg-charcoal text-cream text-xs font-medium hover:bg-charcoal/90 transition-colors"
            >
              Download All Reports
            </button>
          </div>

          {/* Guidance note */}
          <div className="rounded-xl bg-charcoal/4 px-5 py-4">
            <p className="text-[10px] tracking-widest uppercase text-charcoal/40 mb-2">EHO Inspection Tips</p>
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
