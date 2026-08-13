import React from 'react'
import { T } from './navConfig'
import { useTheme } from '../../contexts/ThemeContext'

// T's mainInk*/paperWhite/mainLine tokens are tuned for a light page — this is
// the one piece of desktop chrome that sits on the neutral page background
// (RailNav/NavPanel stay the same dark green in both themes on purpose, so
// they don't need this). Dark variants live here rather than in navConfig so
// the always-dark rail/panel tokens aren't touched.
const DARK = {
  bg:       'rgba(30,30,30,0.88)',
  line:     'rgba(255,255,255,0.08)',
  ink:      'rgba(255,255,255,0.92)',
  ink2:     'rgba(255,255,255,0.55)',
  ink3:     'rgba(255,255,255,0.38)',
  ink4:     'rgba(255,255,255,0.20)',
  paper:    'rgba(255,255,255,0.06)',
}

export default function NavTopbar({ venueName, catLabel, itemLabel }) {
  const { dark } = useTheme()

  return (
    <div
      className="font-sans sticky top-0 z-[5] h-[52px] flex items-center gap-3 px-6"
      style={{
        background: dark ? DARK.bg : 'rgba(240,239,235,0.88)',
        backdropFilter: 'saturate(160%) blur(10px)',
        WebkitBackdropFilter: 'saturate(160%) blur(10px)',
        borderBottom: `1px solid ${dark ? DARK.line : T.mainLine}`,
      }}
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[12.5px] flex-1 min-w-0" style={{ color: dark ? DARK.ink3 : T.mainInk3 }}>
        <span className="whitespace-nowrap shrink-0">{venueName || 'Venue'}</span>
        {catLabel && (
          <>
            <span className="shrink-0" style={{ color: dark ? DARK.ink4 : T.mainInk4 }}>/</span>
            <span className="whitespace-nowrap shrink-0" style={{ color: dark ? DARK.ink2 : T.mainInk2 }}>{catLabel}</span>
          </>
        )}
        {itemLabel && (
          <>
            <span className="shrink-0" style={{ color: dark ? DARK.ink4 : T.mainInk4 }}>/</span>
            <b className="font-medium overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: dark ? DARK.ink : T.mainInk }}>
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
          background: dark ? DARK.paper : T.paperWhite,
          border: `1px solid ${dark ? DARK.line : T.mainLine}`,
          color: dark ? DARK.ink : T.mainInk,
        }}
      >
        Export
      </button>
    </div>
  )
}
