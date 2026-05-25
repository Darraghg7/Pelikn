import React from 'react'
import { T } from './navConfig'

export default function NavTopbar({ venueName, catLabel, itemLabel }) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 5, height: 52,
      background: 'rgba(240,239,235,0.88)',
      backdropFilter: 'saturate(160%) blur(10px)',
      WebkitBackdropFilter: 'saturate(160%) blur(10px)',
      borderBottom: `1px solid ${T.mainLine}`,
      padding: '0 24px',
      display: 'flex', alignItems: 'center', gap: 12,
      fontFamily: 'Plus Jakarta Sans, sans-serif',
    }}>
      {/* Breadcrumb */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 12.5, color: T.mainInk3,
        minWidth: 0, flex: 1,
      }}>
        <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>{venueName || 'Venue'}</span>
        {catLabel && (
          <>
            <span style={{ color: T.mainInk4, flexShrink: 0 }}>/</span>
            <span style={{ color: T.mainInk2, whiteSpace: 'nowrap', flexShrink: 0 }}>{catLabel}</span>
          </>
        )}
        {itemLabel && (
          <>
            <span style={{ color: T.mainInk4, flexShrink: 0 }}>/</span>
            <b style={{
              color: T.mainInk, fontWeight: 500,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {itemLabel}
            </b>
          </>
        )}
      </div>

      {/* Export placeholder */}
      <button style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: '6px 11px', fontSize: 12.5, fontWeight: 500,
        background: T.paperWhite, border: `1px solid ${T.mainLine}`,
        borderRadius: 8, color: T.mainInk, cursor: 'pointer',
        flexShrink: 0, fontFamily: 'Plus Jakarta Sans, sans-serif',
      }}>
        Export
      </button>
    </div>
  )
}
