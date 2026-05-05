import React from 'react'
import { format } from 'date-fns'

export default function RotaSwapRequestModal({
  swapModal,
  setSwapModal,
  swapForm,
  setSwapForm,
  swapSaving,
  submitSwapRequest,
  swapCandidates,
}) {
  if (!swapModal) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-charcoal/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 flex flex-col gap-5 shadow-2xl" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>

        <div>
          <p className="text-[11px] tracking-widest uppercase text-charcoal/40 mb-1">Request Shift Swap</p>
          <h3 className="font-semibold text-charcoal text-lg">
            {swapModal.shift.start_time?.slice(0,5) ?? ''} – {swapModal.shift.end_time?.slice(0,5) ?? ''}
          </h3>
          <p className="text-sm text-charcoal/50 mt-0.5">
            {format(swapModal.date, 'EEEE d MMMM')} · {swapModal.shift.role_label}
          </p>
        </div>

        <div>
          <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">
            Swap with <span className="text-danger">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {swapCandidates.length === 0 ? (
              <p className="text-sm text-charcoal/40 italic">No other staff members found.</p>
            ) : (
              swapCandidates.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSwapForm((f) => ({ ...f, targetStaffId: s.id }))}
                  className={[
                    'px-4 py-2 rounded-lg border text-sm font-medium transition-all',
                    swapForm.targetStaffId === s.id
                      ? 'bg-charcoal text-cream border-charcoal'
                      : 'bg-white text-charcoal/60 border-charcoal/15 hover:border-charcoal/35',
                  ].join(' ')}
                >
                  {s.name}
                </button>
              ))
            )}
          </div>
        </div>

        <div>
          <label className="text-[11px] tracking-widest uppercase text-charcoal/40 block mb-2">
            Message (optional)
          </label>
          <textarea
            value={swapForm.message}
            onChange={(e) => setSwapForm((f) => ({ ...f, message: e.target.value }))}
            placeholder="e.g. I have a dentist appointment that morning…"
            rows={3}
            className="w-full px-4 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-charcoal/20"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={submitSwapRequest}
            disabled={swapSaving || !swapForm.targetStaffId}
            className="flex-1 bg-charcoal text-cream py-2.5 rounded-lg text-sm font-medium hover:bg-charcoal/90 transition-colors disabled:opacity-40"
          >
            {swapSaving ? 'Sending…' : 'Request Swap →'}
          </button>
          <button
            onClick={() => setSwapModal(null)}
            className="px-4 py-2.5 rounded-lg border border-charcoal/15 text-sm text-charcoal/50 hover:text-charcoal transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
