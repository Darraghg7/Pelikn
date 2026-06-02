import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { useAppSettings } from '../../hooks/useSettings'

const MC = {
  brand:  '#13362a',
  good:   '#16a34a',
  ink:    '#111827', ink2: '#374151', ink3: '#6b7280', ink4: '#9ca3af',
  line:   '#e5e7eb', line2: '#f3f4f6',
  paper:  '#ffffff',
}
const MONO = 'ui-monospace, SFMono-Regular, monospace'

function Toggle({ on, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      style={{
        width: 46, height: 28, borderRadius: 999, border: 'none', cursor: 'pointer', flexShrink: 0,
        background: on ? MC.good : MC.line, position: 'relative', transition: 'background .18s', padding: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: on ? 21 : 3, width: 22, height: 22,
        borderRadius: 999, background: '#fff',
        boxShadow: '0 1px 3px rgba(9,18,13,0.25)', transition: 'left .18s',
      }} />
    </button>
  )
}

function Row({ label, sub, on, onToggle, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px',
      borderTop: last === false ? `1px solid ${MC.line2}` : 'none',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: MC.ink, letterSpacing: '-0.005em' }}>{label}</div>
        {sub && <div style={{ fontSize: 11.5, color: MC.ink3, marginTop: 2, lineHeight: 1.4 }}>{sub}</div>}
      </div>
      <Toggle on={on} onClick={onToggle} />
    </div>
  )
}

function Group({ label, children, foot }) {
  return (
    <div>
      {label && (
        <div style={{
          fontFamily: MONO, fontSize: 10.5, color: MC.ink3, letterSpacing: '0.08em',
          textTransform: 'uppercase', fontWeight: 600, padding: '0 2px 7px',
        }}>{label}</div>
      )}
      <div style={{ background: MC.paper, border: `1px solid ${MC.line}`, borderRadius: 14, overflow: 'hidden' }}>
        {children}
      </div>
      {foot && (
        <div style={{ fontSize: 11.5, color: MC.ink3, padding: '8px 4px 0', lineHeight: 1.45 }}>{foot}</div>
      )}
    </div>
  )
}

const CHECK_TILES = [
  { id: 'fitness',   label: 'Fitness to Work',  sub: 'Daily staff declarations' },
  { id: 'openclose', label: 'Opening Checks',    sub: 'Morning & closing checklists' },
  { id: 'fridge',    label: 'Fridge Temps',      sub: 'Refrigeration temperature logs' },
  { id: 'cooking',   label: 'Cooking Temps',     sub: 'Safe cooking temperature records' },
  { id: 'hot',       label: 'Hot Holding',       sub: 'Hot holding temperature logs' },
  { id: 'cooling',   label: 'Cooling Logs',      sub: 'Cooling process records' },
  { id: 'delivery',  label: 'Deliveries',        sub: 'Incoming delivery checks' },
  { id: 'probe',     label: 'Probe Calibration', sub: 'Thermometer calibration records' },
  { id: 'allergen',  label: 'Allergens',         sub: 'Food allergen register' },
  { id: 'pest',      label: 'Pest Control',      sub: 'Pest sighting & treatment logs' },
  { id: 'cleaning',  label: 'Cleaning',          sub: 'Cleaning schedule & records' },
  { id: 'haccp',     label: 'HACCP',             sub: 'HACCP plan documentation' },
  { id: 'docs',      label: 'Documents',         sub: 'Uploaded compliance documents' },
  { id: 'incident',  label: 'Incidents',         sub: 'Incident & accident log' },
]

const TEAM_TILES = [
  { id: 'rota',      label: 'Rota',         sub: 'Weekly shift schedule' },
  { id: 'timesheet', label: 'Hours',        sub: 'Timesheets & clock records' },
  { id: 'training',  label: 'Training',     sub: 'Staff training & certifications' },
  { id: 'time-off',  label: 'Time Off',     sub: 'Holiday & absence requests' },
  { id: 'staff',     label: 'Staff Members',sub: 'Staff list & roles' },
]

export default function HubTilesPage() {
  const navigate = useNavigate()
  const { venueSlug } = useVenue()
  const { hiddenCheckTiles, hiddenTeamTiles, saveHiddenCheckTiles, saveHiddenTeamTiles } = useAppSettings()

  const vp = (path) => `/v/${venueSlug}${path}`

  const toggleCheck = (id) => {
    const next = hiddenCheckTiles.includes(id)
      ? hiddenCheckTiles.filter(x => x !== id)
      : [...hiddenCheckTiles, id]
    saveHiddenCheckTiles(next)
  }

  const toggleTeam = (id) => {
    const next = hiddenTeamTiles.includes(id)
      ? hiddenTeamTiles.filter(x => x !== id)
      : [...hiddenTeamTiles, id]
    saveHiddenTeamTiles(next)
  }

  return (
    <div style={{ padding: '16px 16px 96px', maxWidth: 480, margin: '0 auto' }}>

      <button
        onClick={() => navigate(vp('/settings/hub'))}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16,
          background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
          color: MC.brand, fontSize: 14, fontWeight: 500,
        }}
      >
        <svg width="7" height="12" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(180deg)' }}>
          <path d="M1 1l4 4-4 4"/>
        </svg>
        Settings
      </button>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.025em', margin: 0, color: MC.ink }}>Hub Tiles</h1>
        <div style={{ fontSize: 12.5, color: MC.ink3, marginTop: 4 }}>Choose which tiles appear on each hub</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        <Group label="Checks hub" foot="Hidden tiles won't show on the Checks hub but their pages remain accessible from the menu.">
          {CHECK_TILES.map((t, i) => (
            <Row
              key={t.id}
              label={t.label}
              sub={t.sub}
              on={!hiddenCheckTiles.includes(t.id)}
              onToggle={() => toggleCheck(t.id)}
              last={i === 0 ? undefined : false}
            />
          ))}
        </Group>

        <Group label="Team hub" foot="Hidden tiles won't show on the Team hub.">
          {TEAM_TILES.map((t, i) => (
            <Row
              key={t.id}
              label={t.label}
              sub={t.sub}
              on={!hiddenTeamTiles.includes(t.id)}
              onToggle={() => toggleTeam(t.id)}
              last={i === 0 ? undefined : false}
            />
          ))}
        </Group>

      </div>
    </div>
  )
}
