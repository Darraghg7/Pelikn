import React, { useState, useRef, useEffect } from 'react'
import { T } from './navConfig'

function PanelItem({ item, isActive, onClick }) {
  const [hovered, setHovered] = useState(false)
  const isWarn = item.warn
  return (
    <button
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: 'calc(100% - 16px)', margin: '1px 8px',
        padding: '8px 10px', borderRadius: 8,
        background: isActive ? T.bgActive : hovered ? T.bgHover : 'transparent',
        border: isActive ? `1px solid rgba(255,255,255,0.10)` : '1px solid transparent',
        color: isActive ? T.inkBright : isWarn ? T.warn : T.ink,
        fontSize: 13, fontWeight: isActive ? 500 : 450,
        textAlign: 'left', cursor: 'pointer',
        transition: 'background .1s, color .1s',
        fontFamily: 'Plus Jakarta Sans, sans-serif',
      }}
    >
      <span style={{
        width: 15, height: 15, flexShrink: 0,
        opacity: isActive ? 1 : 0.78,
        display: 'inline-flex',
      }}>
        {item.icon}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          display: 'block', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.label}
        </span>
        {item.sub && (
          <span style={{
            display: 'block',
            color: isActive ? 'rgba(243,237,224,0.55)' : T.inkFaint,
            fontSize: 10.5, marginTop: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {item.sub}
          </span>
        )}
      </span>
      {item.badge > 0 && (
        <span style={{
          minWidth: 18, height: 17, padding: '0 5px', borderRadius: 8,
          background: isWarn ? T.warnBg : 'rgba(255,255,255,0.12)',
          color: isWarn ? T.warn : T.inkBright,
          fontFamily: 'DM Mono, monospace', fontSize: 9.5, fontWeight: 700,
          display: 'grid', placeItems: 'center',
        }}>
          {item.badge}
        </span>
      )}
    </button>
  )
}

function CollapseChevronButton({ onClick, isPreview }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      title="Collapse panel (⌘\)"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        marginLeft: isPreview ? 6 : 'auto',
        width: 22, height: 22, borderRadius: 5, padding: 0,
        background: hovered ? 'rgba(255,255,255,0.07)' : 'transparent',
        border: 'none', cursor: 'pointer',
        color: hovered ? T.inkBright : T.inkMuted,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background .12s, color .12s', flexShrink: 0,
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 6 9 12 15 18"/>
      </svg>
    </button>
  )
}

/* ── Desktop switch venue button (inside nav panel header) ──────────────────── */
function PanelVenueSwitcher({ venues, currentSlug, onSelect, onOverview }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const [hovered, setHovered] = useState(false)

  return (
    <div ref={ref} style={{ marginTop: 10, position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7, width: '100%',
          padding: '7px 10px', borderRadius: 8,
          background: open ? 'rgba(255,255,255,0.16)' : hovered ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.09)',
          border: open ? '1px solid rgba(255,255,255,0.22)' : '1px solid rgba(255,255,255,0.12)',
          color: hovered || open ? T.inkBright : 'rgba(239,234,222,0.80)',
          fontSize: 11.5, fontWeight: 600,
          cursor: 'pointer', transition: 'background .12s, color .12s, border-color .12s',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M8 9l4-4 4 4M16 15l-4 4-4-4"/>
        </svg>
        <span style={{ flex: 1, textAlign: 'left' }}>Switch venue</span>
        <span style={{
          fontSize: 9, opacity: 0.55,
          display: 'inline-block',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform .2s',
        }}>▾</span>
      </button>

      {/* Dropdown */}
      <div style={{
        position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
        background: '#ffffff',
        borderRadius: 10, overflow: 'hidden',
        border: '1px solid rgba(14,20,17,0.08)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.14)',
        zIndex: 50,
        maxHeight: open ? 320 : 0,
        opacity: open ? 1 : 0,
        transition: 'max-height 220ms cubic-bezier(0.4,0,0.2,1), opacity 150ms',
        pointerEvents: open ? 'auto' : 'none',
        overflow: 'hidden',
      }}>
        <p style={{
          padding: '9px 12px 6px',
          fontFamily: 'DM Mono, monospace', fontSize: 9,
          letterSpacing: '0.12em', textTransform: 'uppercase',
          color: 'rgba(14,20,17,0.40)', fontWeight: 600,
        }}>
          Your venues
        </p>
        {/* Group Overview link */}
        <button
          onClick={() => { setOpen(false); onOverview?.() }}
          style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: '8px 12px', fontSize: 12.5, fontWeight: 700,
            color: '#2D4F45', background: 'none', border: 'none',
            cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(45,79,69,0.06)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          Group Overview
        </button>
        <div style={{ height: 1, background: 'rgba(14,20,17,0.06)', margin: '2px 0' }} />
        {venues.map(v => {
          const isCurrent = v.slug === currentSlug
          return (
            <button
              key={v.id}
              onClick={() => { setOpen(false); onSelect(v.slug) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', textAlign: 'left',
                padding: '8px 12px', fontSize: 12.5,
                fontWeight: isCurrent ? 700 : 450,
                color: isCurrent ? '#2D4F45' : 'rgba(14,20,17,0.65)',
                background: isCurrent ? 'rgba(45,79,69,0.06)' : 'none',
                border: 'none', cursor: 'pointer',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                transition: 'background .1s',
              }}
              onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = 'rgba(14,20,17,0.04)' }}
              onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = 'none' }}
            >
              <span style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: isCurrent ? '#2D4F45' : 'rgba(14,20,17,0.20)',
              }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span>
              {isCurrent && (
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5 }}>
                  <polyline points="2,6 5,9 10,3"/>
                </svg>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function NavPanel({
  cat, activeItemId, onPickItem, isPreview, onCollapse,
  isMultiVenue, venues, currentSlug, onSwitchVenue, onNavigateOverview,
}) {
  if (!cat) return null

  const needsAttention = cat.items.filter(i => i.warn || i.badge > 0).length

  const panelTitle    = cat.title ?? (cat.label === 'Today' ? 'Today' : cat.label)
  const panelSubtitle = cat.subtitle ?? (
    isPreview
      ? 'Pick an item to open'
      : (
        <>
          {cat.items.length} {cat.items.length === 1 ? 'item' : 'items'}
          {needsAttention > 0 && (
            <> · <span style={{ color: T.warn }}>{needsAttention} needs attention</span></>
          )}
        </>
      )
  )

  // Preserve scroll position per category
  const navRef    = useRef(null)
  const scrollMap = useRef(new Map()) // catId → scrollTop
  const prevCatId = useRef(cat.id)
  if (prevCatId.current !== cat.id) {
    if (navRef.current) scrollMap.current.set(prevCatId.current, navRef.current.scrollTop)
    prevCatId.current = cat.id
  }
  useEffect(() => {
    if (navRef.current) {
      navRef.current.scrollTop = scrollMap.current.get(cat.id) ?? 0
    }
  }, [cat.id])

  return (
    <div style={{
      width: 260, background: T.bgPanel, color: T.ink,
      display: 'flex', flexDirection: 'column',
      borderRight: '1px solid rgba(0,0,0,0.12)',
      flexShrink: 0,
      position: 'fixed', top: 0, height: '100vh', left: 80,
      zIndex: 39,
      fontFamily: 'Plus Jakarta Sans, sans-serif',
    }}>
      {/* Header */}
      <header style={{ padding: '18px 18px 14px', borderBottom: `1px solid ${T.divider}` }}>
        {/* Category mono label row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6,
          fontFamily: 'DM Mono, monospace', fontSize: 9.5,
          letterSpacing: '0.12em', color: T.inkFaint,
          textTransform: 'uppercase', fontWeight: 600,
        }}>
          <span style={{ width: 11, height: 11, display: 'inline-flex', opacity: 0.7 }}>
            {cat.icon}
          </span>
          {cat.label}
          {isPreview && (
            <span style={{
              marginLeft: 'auto', padding: '2px 7px', borderRadius: 5,
              background: 'rgba(196,99,64,0.18)', color: T.warn,
              fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
              fontFamily: 'DM Mono, monospace',
            }}>
              Browsing
            </span>
          )}
          {onCollapse && <CollapseChevronButton onClick={onCollapse} isPreview={isPreview} />}
        </div>

        {/* Title */}
        <div style={{
          color: T.inkBright, fontSize: 19, fontWeight: 600,
          letterSpacing: '-0.015em', lineHeight: 1.15,
        }}>
          {panelTitle}
        </div>

        {/* Subtitle */}
        <div style={{ color: T.inkMuted, fontSize: 11.5, marginTop: 3 }}>
          {panelSubtitle}
        </div>

        {/* Switch venue button — multi-venue managers only */}
        {isMultiVenue && venues?.length > 1 && (
          <PanelVenueSwitcher
            venues={venues}
            currentSlug={currentSlug}
            onSelect={onSwitchVenue}
            onOverview={onNavigateOverview}
          />
        )}
      </header>

      {/* Nav items */}
      <nav ref={navRef} style={{ flex: 1, overflowY: 'auto', padding: '6px 0 12px', overscrollBehavior: 'contain' }} aria-label={`${cat.label} navigation`}>
        {cat.items.map(item => (
          <PanelItem
            key={item.id}
            item={item}
            isActive={!isPreview && item.id === activeItemId}
            onClick={() => onPickItem(item)}
          />
        ))}
      </nav>
    </div>
  )
}
