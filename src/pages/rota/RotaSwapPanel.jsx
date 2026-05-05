import React from 'react'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function RotaSwapPanel({
  showSwaps,
  setShowSwaps,
  swapsLoading,
  swaps,
  pendingSwaps,
  resolvedSwaps,
  rejectNote,
  setRejectNote,
  resolving,
  approveSwap,
  rejectSwap,
}) {
  if (!showSwaps) return null

  return (
    <div className="bg-white rounded-2xl border-charcoal/10 overflow-hidden">
      <div className="px-5 py-4 border-b border-charcoal/8 flex items-center justify-between">
        <p className="text-[11px] tracking-widest uppercase text-charcoal/40">Shift Swap Requests</p>
        <button
          onClick={() => setShowSwaps(false)}
          className="text-xs text-charcoal/30 hover:text-charcoal transition-colors"
        >
          Close ×
        </button>
      </div>

      {swapsLoading ? (
        <div className="flex justify-center py-6"><LoadingSpinner /></div>
      ) : swaps.length === 0 ? (
        <p className="text-sm text-charcoal/35 italic px-5 py-6">No swap requests yet.</p>
      ) : (
        <div className="flex flex-col divide-y divide-charcoal/6">
          {/* Pending first */}
          {pendingSwaps.map((swap) => (
            <div key={swap.id} className="p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-charcoal text-sm">{swap.requester_name}</span>
                    <span className="text-charcoal/30 text-xs">→ swap with</span>
                    <span className="font-semibold text-charcoal text-sm">{swap.target_staff_name}</span>
                    <span className="text-[11px] tracking-widest uppercase px-2 py-0.5 rounded-full bg-warning/15 text-warning font-medium">
                      Pending
                    </span>
                  </div>
                  {swap.shift && (
                    <p className="text-xs text-charcoal/50 mt-1">
                      Shift: {swap.shift.shift_date} · {swap.shift.start_time?.slice(0,5)}–{swap.shift.end_time?.slice(0,5)}
                    </p>
                  )}
                  {swap.message && (
                    <p className="text-xs text-charcoal/60 mt-1 italic">"{swap.message}"</p>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="Optional note for rejection…"
                  value={rejectNote[swap.id] ?? ''}
                  onChange={(e) => setRejectNote((n) => ({ ...n, [swap.id]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-charcoal/15 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-charcoal/20 placeholder-charcoal/25"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => approveSwap(swap)}
                    disabled={resolving === swap.id}
                    className="flex-1 py-2 rounded-lg bg-success text-white text-xs font-medium hover:bg-success/90 transition-colors disabled:opacity-40"
                  >
                    {resolving === swap.id ? '…' : <span className="inline-flex items-center gap-1"><svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg> Approve</span>}
                  </button>
                  <button
                    onClick={() => rejectSwap(swap)}
                    disabled={resolving === swap.id}
                    className="flex-1 py-2 rounded-lg border border-danger/25 text-danger text-xs font-medium hover:bg-danger/5 transition-colors disabled:opacity-40"
                  >
                    {resolving === swap.id ? '…' : <span className="inline-flex items-center gap-1"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Reject</span>}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Resolved requests */}
          {resolvedSwaps.length > 0 && (
            <>
              <div className="px-5 py-2 bg-charcoal/3">
                <p className="text-[11px] tracking-widest uppercase text-charcoal/30">Resolved</p>
              </div>
              {resolvedSwaps.map((swap) => (
                <div key={swap.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-charcoal/60">{swap.requester_name} → {swap.target_staff_name}</span>
                      <span className={`text-[11px] tracking-widest uppercase px-2 py-0.5 rounded-full font-medium ${
                        swap.status === 'approved'
                          ? 'bg-success/10 text-success'
                          : 'bg-danger/10 text-danger'
                      }`}>
                        {swap.status}
                      </span>
                    </div>
                    {swap.manager_note && (
                      <p className="text-xs text-charcoal/40 mt-0.5 italic">Note: {swap.manager_note}</p>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
