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
      className={['font-sans text-[13px] text-left cursor-pointer transition-[background,color] duration-100', isActive ? 'font-medium' : 'font-[450]'].join(' ')}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: 'calc(100% - 16px)', margin: '1px 8px',
        padding: '8px 10px', borderRadius: 8,
        background: isActive ? T.bgActive : hovered ? T.bgHover : 'transparent',
        border: isActive ? `1px solid rgba(255,255,255,0.10)` : '1px solid transparent',
        color: isActive ? T.inkBright : isWarn ? T.warn : T.ink,
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
          <span
            className="block text-[10.5px] overflow-hidden text-ellipsis whitespace-nowrap"
            style={{ color: isActive ? 'rgba(243,237,224,0.55)' : T.inkFaint, marginTop: 1 }}
          >
            {item.sub}
          </span>
        )}
      </span>
      {item.badge > 0 && (
        <span
          className="font-mono text-[9.5px] font-bold grid place-items-center"
          style={{
            minWidth: 18, height: 17, padding: '0 5px', borderRadius: 8,
            background: isWarn ? T.warnBg : 'rgba(255,255,255,0.12)',
            color: isWarn ? T.warn : T.inkBright,
          }}
        >
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
        className="font-sans text-[11.5px] font-semibold cursor-pointer transition-[background,color,border-color] duration-[120ms] flex items-center gap-[7px] w-full"
        style={{
          padding: '7px 10px', borderRadius: 8,
          background: open ? 'rgba(255,255,255,0.16)' : hovered ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.09)',
          border: open ? '1px solid rgba(255,255,255,0.22)' : '1px solid rgba(255,255,255,0.12)',
          color: hovered || open ? T.inkBright : 'rgba(239,234,222,0.80)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M8 9l4-4 4 4M16 15l-4 4-4-4"/>
        </svg>
        <span style={{ flex: 1, textAlign: 'left' }}>Switch venue</span>
        <span
          className="text-[9px] opacity-55 inline-block transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >▾</span>
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
      }}>
        <p
          className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em]"
          style={{ padding: '9px 12px 6px', color: 'rgba(14,20,17,0.40)' }}
        >
          Your venues
        </p>
        {/* Group Overview link */}
        <button
          onClick={() => { setOpen(false); onOverview?.() }}
          className="font-sans block w-full text-left text-[12.5px] font-bold cursor-pointer border-none"
          style={{ padding: '8px 12px', color: '#2D4F45', background: 'none' }}
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
              className={['font-sans flex items-center gap-2 w-full text-left text-[12.5px] border-none cursor-pointer transition-[background] duration-100', isCurrent ? 'font-bold' : 'font-[450]'].join(' ')}
              style={{
                padding: '8px 12px',
                color: isCurrent ? '#2D4F45' : 'rgba(14,20,17,0.65)',
                background: isCurrent ? 'rgba(45,79,69,0.06)' : 'none',
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
    <div
      className="font-sans"
      style={{
        width: 260, background: T.bgPanel, color: T.ink,
        display: 'flex', flexDirection: 'column',
        borderRight: '1px solid rgba(0,0,0,0.12)',
        flexShrink: 0,
        position: 'fixed', top: 0, height: '100vh', left: 80,
        zIndex: 39,
      }}
    >
      {/* Header */}
      <header style={{ padding: '18px 18px 14px', borderBottom: `1px solid ${T.divider}` }}>
        {/* Category mono label row */}
        <div
          className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.12em] flex items-center gap-[7px]"
          style={{ color: T.inkFaint, marginBottom: 6 }}
        >
          <span style={{ width: 11, height: 11, display: 'inline-flex', opacity: 0.7 }}>
            {cat.icon}
          </span>
          {cat.label}
          {isPreview && (
            <span
              className="font-mono text-[9px] font-bold tracking-[0.08em] ml-auto"
              style={{ padding: '2px 7px', borderRadius: 5, background: 'rgba(196,99,64,0.18)', color: T.warn }}
            >
              Browsing
            </span>
          )}
          {onCollapse && <CollapseChevronButton onClick={onCollapse} isPreview={isPreview} />}
        </div>

        {/* Title */}
        <div
          className="text-[19px] font-semibold tracking-[-0.015em] leading-[1.15]"
          style={{ color: T.inkBright }}
        >
          {panelTitle}
        </div>

        {/* Subtitle */}
        <div className="text-[11.5px]" style={{ color: T.inkMuted, marginTop: 3 }}>
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
