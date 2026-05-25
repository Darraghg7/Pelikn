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

export default function NavPanel({ cat, activeItemId, onPickItem, isPreview, onCollapse }) {
  if (!cat) return null

  const needsAttention = cat.items.filter(i => i.warn || i.badge > 0).length

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
          {cat.label === 'Today' ? 'Today' : cat.label}
        </div>

        {/* Subtitle */}
        <div style={{ color: T.inkMuted, fontSize: 11.5, marginTop: 3 }}>
          {isPreview
            ? 'Pick an item to open'
            : (
              <>
                {cat.items.length} {cat.items.length === 1 ? 'item' : 'items'}
                {needsAttention > 0 && (
                  <> · <span style={{ color: T.warn }}>{needsAttention} needs attention</span></>
                )}
              </>
            )
          }
        </div>
      </header>

      {/* Optional filter (Compliance only) */}
      {cat.id === 'compliance' && (
        <div style={{ padding: '10px 14px 6px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '6px 9px', borderRadius: 7,
            background: 'rgba(0,0,0,0.20)', border: `1px solid ${T.divider}`,
            color: T.inkMuted, fontSize: 12,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, flexShrink: 0 }}>
              <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <span style={{ flex: 1, color: T.inkFaint }}>Filter…</span>
          </div>
        </div>
      )}

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
