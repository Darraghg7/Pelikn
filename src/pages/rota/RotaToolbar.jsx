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
                className="inline-flex items-center gap-1.5 bg-charcoal text-cream text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-charcoal/85 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {emailing ? 'Sending…' : 'Send notification'}
              </button>
              <button
                onClick={shareViaWhatsApp}
                disabled={shiftsCount === 0 || sharing}
                className="inline-flex items-center gap-1.5 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#25D366' }}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                </svg>
                {sharing ? 'Exporting…' : 'WhatsApp'}
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
