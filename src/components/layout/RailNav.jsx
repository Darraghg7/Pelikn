import React, { useState } from 'react'
import { T, IcoCogNav } from './navConfig'

function BrandMark({ initial, notifCount, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label="Go to dashboard"
      style={{
        display: 'block', margin: '0 auto 4px', background: 'none',
        border: 'none', padding: 0, cursor: 'pointer',
        borderRadius: 12,
        outline: 'none',
      }}
    >
      <div
        className="font-sans font-bold text-[15px] tracking-[-0.02em] grid place-items-center relative transition-[background] duration-[120ms]"
        style={{
          width: 40, height: 40, borderRadius: 10,
          background: hovered ? T.inkMuted : T.inkBright, color: T.bg,
        }}
      >
        {initial}
        {notifCount > 0 && (
          <span
            className="font-mono text-[11px] font-bold text-white grid place-items-center absolute"
            style={{
              top: -3, right: -4, minWidth: 15, height: 15, padding: '0 4px',
              borderRadius: 8, background: T.alertRed,
              border: `1.5px solid ${T.bg}`,
            }}
          >{notifCount}</span>
        )}
      </div>
    </button>
  )
}

function RailTile({ cat, isActive, isCurrent, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: isActive ? T.bgActive : hovered ? T.bgHover : 'transparent',
        border: 'none', borderRadius: 9,
        padding: '10px 4px 8px', cursor: 'pointer',
        color: isActive || hovered ? T.inkBright : T.ink,
        position: 'relative', width: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
        transition: 'background .12s, color .12s',
      }}
    >
      {isActive && (
        <span style={{
          position: 'absolute', left: -8, top: '18%', bottom: '18%', width: 3,
          background: T.inkBright, borderRadius: '0 3px 3px 0',
        }} />
      )}
      <span style={{
        width: 18, height: 18,
        opacity: isActive || hovered ? 1 : 0.72,
        display: 'inline-flex', position: 'relative',
      }}>
        {cat.icon}
        {isCurrent && !isActive && (
          <span style={{
            position: 'absolute', top: -2, right: -3, width: 6, height: 6,
            borderRadius: '50%', background: T.accent,
            border: `1.5px solid ${T.bg}`,
          }} />
        )}
      </span>
      <span className={['text-[11px] tracking-[-0.003em] leading-none', isActive ? 'font-medium' : 'font-[450]'].join(' ')}>
        {cat.label}
      </span>
      {cat.alert > 0 && !isActive && (
        <span
          className="font-mono text-[11px] font-bold text-white grid place-items-center absolute"
          style={{
            top: 6, right: 8, minWidth: 14, height: 14, padding: '0 4px',
            borderRadius: 7, background: T.accent,
            border: `1.5px solid ${T.bg}`,
          }}
        >{cat.alert}</span>
      )}
    </button>
  )
}

function SettingsTile({ isActive, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      aria-label="Settings"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: isActive ? T.bgActive : hovered ? T.bgHover : 'transparent',
        border: 'none', borderRadius: 9,
        padding: '10px 4px 8px', cursor: 'pointer',
        color: isActive || hovered ? T.inkBright : T.ink,
        position: 'relative', width: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
        transition: 'background .12s, color .12s',
      }}
    >
      {isActive && (
        <span style={{
          position: 'absolute', left: -8, top: '18%', bottom: '18%', width: 3,
          background: T.inkBright, borderRadius: '0 3px 3px 0',
        }} />
      )}
      <span style={{ width: 18, height: 18, opacity: isActive || hovered ? 1 : 0.72, display: 'inline-flex' }}>
        <IcoCogNav />
      </span>
      <span className={['text-[11px] tracking-[-0.003em] leading-none', isActive ? 'font-medium' : 'font-[450]'].join(' ')}>
        Settings
      </span>
    </button>
  )
}

export default function Rail({
  cats, browseCat, mainCat,
  onPickCat, onOpenSettings, onClickBrand,
  venueName, initials, onSignOut,
  isSettingsRoute, notifCount = 0,
  notificationBell,
}) {
  const venueInitial = (venueName || 'S')[0].toUpperCase()

  return (
    <aside
      className="font-sans"
      style={{
        width: 80, background: T.bg, color: T.ink,
        display: 'flex', flexDirection: 'column',
        padding: '14px 8px 12px',
        borderRight: `1px solid ${T.divider}`,
        flexShrink: 0,
        position: 'fixed', top: 0, height: '100vh', left: 0,
        zIndex: 40,
      }}
    aria-label="Category navigation"
    >
      {/* Brand mark */}
      <BrandMark initial={venueInitial} notifCount={notifCount} onClick={onClickBrand} />

      {/* Venue mono label */}
      <div
        className="font-mono text-[11px] font-medium uppercase tracking-[0.09em] text-center overflow-hidden text-ellipsis whitespace-nowrap"
        style={{ color: T.inkFaint, marginBottom: 12, padding: '0 4px' }}
      >
        {(venueName || 'Venue').slice(0, 8)}
      </div>

      {/* Notification bell */}
      {notificationBell && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          {notificationBell}
        </div>
      )}

      {/* Category tiles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {cats.map(c => (
          <RailTile
            key={c.id}
            cat={c}
            isActive={c.id === browseCat && !isSettingsRoute}
            isCurrent={c.id === mainCat && !isSettingsRoute}
            onClick={() => onPickCat(c.id)}
          />
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* Settings tile */}
      <div style={{ padding: '8px 0 4px', borderTop: `1px solid ${T.divider}`, marginBottom: 8 }}>
        <SettingsTile isActive={isSettingsRoute} onClick={onOpenSettings} />
      </div>

      {/* User area */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        paddingTop: 10, borderTop: `1px solid ${T.divider}`,
      }}>
        {/* Avatar */}
        <div
          className="font-sans font-semibold text-xs grid place-items-center shrink-0"
          style={{ width: 32, height: 32, borderRadius: 8, background: T.inkBright, color: T.bg }}
        >
          {initials || venueInitial}
        </div>

        {/* Sign out */}
        <button
          onClick={onSignOut}
          title="Sign out"
          style={{
            width: 30, height: 30, borderRadius: 7,
            background: 'transparent', border: 'none',
            color: T.inkMuted, cursor: 'pointer',
            display: 'grid', placeItems: 'center',
            transition: 'color .12s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = T.inkBright}
          onMouseLeave={e => e.currentTarget.style.color = T.inkMuted}
          aria-label="Sign out"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </aside>
  )
}
