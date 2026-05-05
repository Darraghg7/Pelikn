import React from 'react'

export default function RotaToolbar({
  isManager,
  closureMode,
  showConfig,
  setShowConfig,
  setShowAI,
  emailRota,
  emailing,
  shiftsCount,
  shareViaWhatsApp,
  sharing,
  enterClosureMode,
  cancelClosureMode,
  saveClosures,
  savingClosures,
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-y-3">
      <h1 className="text-2xl font-bold text-charcoal">
        {isManager ? 'Rota Manager' : 'Rota'}
      </h1>
      {isManager && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {!closureMode && (
            <>
              <button
                onClick={() => setShowConfig(true)}
                className="text-[11px] tracking-widest uppercase text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20 hover:border-charcoal/40"
              >
                <span className="inline-flex items-center gap-1"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg> Configure</span>
              </button>
              <button
                onClick={() => setShowAI(true)}
                className="text-[11px] tracking-widest uppercase text-accent/70 hover:text-accent transition-colors border-b border-accent/30 hover:border-accent/50"
              >
                <span className="inline-flex items-center gap-1"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg> Auto-Fill</span>
              </button>
              <button
                onClick={emailRota}
                disabled={emailing || shiftsCount === 0}
                className="text-[11px] tracking-widest uppercase text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {emailing ? 'Notifying…' : <span className="inline-flex items-center gap-1"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> Notify Staff</span>}
              </button>
              <button
                onClick={shareViaWhatsApp}
                disabled={shiftsCount === 0 || sharing}
                className="text-[11px] tracking-widest uppercase text-success/70 hover:text-success transition-colors border-b border-success/30 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {sharing ? 'Exporting…' : '↗ Share'}
              </button>
              <button
                onClick={enterClosureMode}
                className="text-[11px] tracking-widest uppercase text-danger/60 hover:text-danger transition-colors border-b border-danger/25 hover:border-danger/40"
              >
                Mark Closed
              </button>
            </>
          )}
          {closureMode && (
            <div className="flex items-center gap-2">
              <button
                onClick={cancelClosureMode}
                className="text-[11px] tracking-widest uppercase text-charcoal/40 hover:text-charcoal transition-colors border-b border-charcoal/20"
              >
                Cancel
              </button>
              <button
                onClick={saveClosures}
                disabled={savingClosures}
                className="text-[11px] tracking-widest uppercase bg-brand text-cream border border-brand/80 px-3 py-1.5 rounded-lg hover:bg-brand/90 transition-colors font-medium disabled:opacity-50"
              >
                {savingClosures ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
