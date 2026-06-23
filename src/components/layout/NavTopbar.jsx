import React from 'react'
import { T } from './navConfig'

export default function NavTopbar({ venueName, catLabel, itemLabel }) {
  return (
    <div
      className="font-sans sticky top-0 z-[5] h-[52px] flex items-center gap-3 px-6"
      style={{
        background: 'rgba(240,239,235,0.88)',
        backdropFilter: 'saturate(160%) blur(10px)',
        WebkitBackdropFilter: 'saturate(160%) blur(10px)',
        borderBottom: `1px solid ${T.mainLine}`,
      }}
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[12.5px] flex-1 min-w-0" style={{ color: T.mainInk3 }}>
        <span className="whitespace-nowrap shrink-0">{venueName || 'Venue'}</span>
        {catLabel && (
          <>
            <span className="shrink-0" style={{ color: T.mainInk4 }}>/</span>
            <span className="whitespace-nowrap shrink-0" style={{ color: T.mainInk2 }}>{catLabel}</span>
          </>
        )}
        {itemLabel && (
          <>
            <span className="shrink-0" style={{ color: T.mainInk4 }}>/</span>
            <b className="font-medium overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: T.mainInk }}>
              {itemLabel}
            </b>
          </>
        )}
      </div>

      {/* Export placeholder */}
      <button
        className="font-sans inline-flex items-center gap-[7px] text-[12.5px] font-medium shrink-0 cursor-pointer rounded-lg"
        style={{
          padding: '6px 11px',
          background: T.paperWhite, border: `1px solid ${T.mainLine}`,
          color: T.mainInk,
        }}
      >
        Export
      </button>
    </div>
  )
}
