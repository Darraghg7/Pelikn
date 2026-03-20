import React, { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'

function useCalibrations(venueId) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    if (!venueId) return
    setLoading(true)
    const { data } = await supabase
      .from('probe_calibrations')
      .select('*, calibrator:staff!calibrated_by(name)')
      .eq('venue_id', venueId)
      .order('calibrated_at', { ascending: false })
      .limit(100)
    setRecords(data ?? [])
    setLoading(false)
  }, [venueId])
  useEffect(() => { load() }, [load])
  return { records, loading, reload: load }
}

const METHODS = [
  { value: 'ice_water', label: 'Ice Water (0.0C)', expected: 0.0 },
  { value: 'boiling_water', label: 'Boiling Water (100.0C)', expected: 100.0 },
]

const EMPTY_FORM = {
  probe_name: 'Probe 1',
  method: 'ice_water',
  actual_reading: '',
  tolerance: '1.0',
  notes: '',
}

export default function ProbeCalibrationPage() {
  const toast = useToast()
  const { venueId } = useVenue()
  const { session } = useSession()
  const { records, loading, reload } = useCalibrations(venueId)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const method = METHODS.find(m => m.value === form.method)
  const expectedTemp = method?.expected ?? 0
  const reading = parseFloat(form.actual_reading)
  const tolerance = parseFloat(form.tolerance) || 1.0
  const hasReading = !isNaN(reading)
  const wouldPass = hasReading && Math.abs(reading - expectedTemp) <= tolerance

  const save = async () => {
    if (!hasReading) { toast('Enter a temperature reading', 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('probe_calibrations').insert({
      probe_name: form.probe_name.trim() || 'Probe 1',
      method: form.method,
      expected_temp: expectedTemp,
      actual_reading: reading,
      tolerance,
      calibrated_by: session?.staffId,
      notes: form.notes.trim() || null,
      venue_id: venueId,
    })
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast(wouldPass ? 'Calibration recorded - PASS' : 'Calibration recorded - FAIL')
    setForm(EMPTY_FORM)
    setShowForm(false)
    reload()
  }

  // Stats
  const passCount = records.filter(r => r.pass).length
  const failCount = records.filter(r => !r.pass).length
  const lastCalibration = records[0]

  // Group by probe
  const probes = [...new Set(records.map(r => r.probe_name))]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl text-charcoal">Probe Calibration</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-charcoal text-cream px-4 py-2 rounded-lg text-sm font-medium hover:bg-charcoal/90 transition-colors"
        >
          + Calibrate
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-charcoal/10 p-4 text-center">
          <p className="text-[10px] tracking-widest uppercase text-charcoal/40">Last check</p>
          <p className="text-sm font-semibold text-charcoal mt-1">
            {lastCalibration ? format(new Date(lastCalibration.calibrated_at), 'd MMM') : '--'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-charcoal/10 p-4 text-center">
          <p className="text-[10px] tracking-widest uppercase text-charcoal/40">Passed</p>
          <p className="text-2xl font-bold text-success">{passCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-charcoal/10 p-4 text-center">
          <p className="text-[10px] tracking-widest uppercase text-charcoal/40">Failed</p>
          <p className="text-2xl font-bold text-danger">{failCount}</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-xl bg-charcoal/4 px-4 py-3 flex items-start gap-2">
        <span className="text-sm mt-0.5">*</span>
        <p className="text-xs text-charcoal/50">
          UK food safety law requires thermometer probes to be calibrated regularly.
          Use the <strong>ice water method</strong> (expected 0.0C +/-1.0C) or <strong>boiling water method</strong> (expected 100.0C +/-1.0C).
          Record a corrective action if a probe fails.
        </p>
      </div>

      {/* Records */}
      {loading ? (
        <div className="flex justify-center py-10"><LoadingSpinner /></div>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-xl border border-charcoal/10 p-10 text-center">
          <p className="text-charcoal/30 text-sm">No calibration records yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {records.map(r => (
            <div key={r.id} className={`bg-white rounded-xl border p-4 ${r.pass ? 'border-charcoal/10' : 'border-danger/25 bg-danger/3'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-charcoal text-sm">{r.probe_name}</h3>
                    <span className={`text-[10px] tracking-wider uppercase font-medium px-2 py-0.5 rounded-full ${
                      r.pass ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                    }`}>
                      {r.pass ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                  <p className="text-xs text-charcoal/50 mt-1">
                    {r.method === 'ice_water' ? 'Ice water' : 'Boiling water'} test
                    {' '} — Expected {r.expected_temp}C, Read <span className="font-mono font-semibold">{r.actual_reading}C</span>
                    {' '} (+/-{r.tolerance}C)
                  </p>
                  {r.notes && <p className="text-xs text-charcoal/40 mt-1 italic">{r.notes}</p>}
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-xs text-charcoal/40">{format(new Date(r.calibrated_at), 'd MMM HH:mm')}</p>
                  <p className="text-[10px] text-charcoal/30 mt-0.5">{r.calibrator?.name ?? 'Unknown'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Calibration modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Calibrate Probe">
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-1">Probe name</label>
            <input
              type="text"
              value={form.probe_name}
              onChange={e => setForm(f => ({ ...f, probe_name: e.target.value }))}
              placeholder="e.g. Probe 1, Kitchen probe"
              className="w-full px-4 py-2.5 rounded-xl border border-charcoal/15 bg-cream/30 text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>

          <div>
            <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-2">Method</label>
            <div className="grid grid-cols-2 gap-2">
              {METHODS.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, method: m.value }))}
                  className={`py-3 px-3 rounded-xl border text-sm font-medium transition-all text-center ${
                    form.method === m.value
                      ? 'bg-charcoal text-cream border-charcoal'
                      : 'bg-white text-charcoal/60 border-charcoal/15 hover:border-charcoal/30'
                  }`}
                >
                  <p className="font-semibold text-xs">{m.value === 'ice_water' ? 'Ice Water' : 'Boiling Water'}</p>
                  <p className={`text-[10px] mt-0.5 ${form.method === m.value ? 'opacity-60' : 'text-charcoal/35'}`}>
                    Expected {m.expected}C
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-1">
              Actual reading (C) <span className="text-danger">*</span>
            </label>
            <input
              type="number"
              step="0.1"
              value={form.actual_reading}
              onChange={e => setForm(f => ({ ...f, actual_reading: e.target.value }))}
              placeholder={`Expected: ${expectedTemp}C`}
              className="w-full px-4 py-3 rounded-xl border border-charcoal/15 bg-cream/30 text-lg font-mono text-center focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>

          <div>
            <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-1">Tolerance (+/-)</label>
            <input
              type="number"
              step="0.1"
              value={form.tolerance}
              onChange={e => setForm(f => ({ ...f, tolerance: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border border-charcoal/15 bg-cream/30 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>

          {/* Live result preview */}
          {hasReading && (
            <div className={`rounded-xl px-4 py-3 text-center ${
              wouldPass ? 'bg-success/10' : 'bg-danger/10'
            }`}>
              <p className={`text-sm font-semibold ${wouldPass ? 'text-success' : 'text-danger'}`}>
                {wouldPass ? 'PASS' : 'FAIL'} — {Math.abs(reading - expectedTemp).toFixed(1)}C deviation
              </p>
            </div>
          )}

          <div>
            <label className="text-[10px] tracking-widest uppercase text-charcoal/40 block mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Optional notes..."
              className="w-full px-4 py-2.5 rounded-xl border border-charcoal/15 bg-cream/30 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-charcoal/20"
            />
          </div>

          <button
            onClick={save}
            disabled={saving || !hasReading}
            className="bg-charcoal text-cream py-3 rounded-xl text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40"
          >
            {saving ? 'Saving...' : 'Record Calibration'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
