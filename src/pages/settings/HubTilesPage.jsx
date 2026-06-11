import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { useAppSettings } from '../../hooks/useSettings'
import { useVenueFeatures, FEATURE_GROUPS, ALL_FEATURE_IDS, PRO_ONLY_FEATURE_IDS } from '../../hooks/useVenueFeatures'
import { PLANS } from '../../lib/constants'
import NavOrderSection from './NavOrderSection'

const MC = {
  brand:  '#13362a', brandTint: '#eef4f0',
  good:   '#1a7a4c',
  ink:    '#0d1a14', ink2: '#3d4a44', ink3: '#76817b', ink4: '#b3b9b5',
  line:   '#e4e6e2', line2: '#eef0ec',
  paper:  '#ffffff', bg: '#f3f3ef',
}
const MONO = 'ui-monospace, SFMono-Regular, monospace'
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

function SubHeader({ title, onBack }) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 10,
      background: 'rgba(243,243,239,0.92)',
      backdropFilter: 'saturate(180%) blur(20px)',
      WebkitBackdropFilter: 'saturate(180%) blur(20px)',
      borderBottom: `1px solid ${MC.line}`,
      padding: '12px 16px 10px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        color: MC.brand, background: 'none', border: 'none',
        cursor: 'pointer', padding: '4px 0', fontFamily: SANS, fontSize: 15, fontWeight: 500,
      }}>
        <svg width="9" height="15" viewBox="0 0 9 15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 1L1.5 7.5 8 14"/>
        </svg>
        Settings
      </button>
      <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em', color: MC.ink }}>{title}</span>
      <span style={{ width: 70 }} />
    </div>
  )
}

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
  const { venueId, venueSlug, venuePlan } = useVenue()
  const { hiddenCheckTiles, hiddenTeamTiles, saveHiddenCheckTiles, saveHiddenTeamTiles, complianceNavOrder, saveComplianceNavOrder } = useAppSettings()
  const { config: featuresConfig, save: saveFeatures, isEnabled } = useVenueFeatures()

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
    <div style={{ minHeight: '100vh', background: MC.bg, fontFamily: SANS }}>
      <SubHeader title="Features" onBack={() => navigate(vp('/settings/hub'))} />

      <div style={{ padding: '0 16px 96px', maxWidth: 480, margin: '0 auto' }}>
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

        {/* Modules */}
        <div>
          <div style={{ fontFamily: MONO, fontSize: 10.5, color: MC.ink3, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, padding: '0 2px 7px' }}>Modules</div>
          <div style={{ background: MC.paper, border: `1px solid ${MC.line}`, borderRadius: 14, overflow: 'hidden', padding: '4px 0' }}>
            <div style={{ padding: '8px 14px' }}>
              <div style={{ display: 'inline-flex', background: MC.line2, borderRadius: 9, padding: 3, gap: 2, marginBottom: 12 }}>
                {['all', 'custom'].map(mode => (
                  <button
                    key={mode}
                    onClick={() => saveFeatures({ mode, enabled: mode === 'all' ? ALL_FEATURE_IDS : (featuresConfig.enabled ?? ALL_FEATURE_IDS) })}
                    style={{
                      padding: '5px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      background: featuresConfig.mode === mode ? MC.paper : 'transparent',
                      color: featuresConfig.mode === mode ? MC.ink : MC.ink3,
                      boxShadow: featuresConfig.mode === mode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all .15s',
                    }}
                  >{mode === 'all' ? 'All modules' : 'Custom'}</button>
                ))}
              </div>

              {featuresConfig.mode === 'custom' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {FEATURE_GROUPS.map(group => {
                    const allOn = group.features.every(f => featuresConfig.enabled?.includes(f.id))
                    return (
                      <div key={group.id} style={{ border: `1px solid ${MC.line}`, borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', background: MC.line2, borderBottom: `1px solid ${MC.line}` }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: MC.ink }}>{group.label}</div>
                            <div style={{ fontSize: 11, color: MC.ink3, marginTop: 1 }}>{group.description}</div>
                          </div>
                          <button
                            onClick={() => {
                              const groupIds = group.features.map(f => f.id)
                              const next = allOn
                                ? (featuresConfig.enabled ?? ALL_FEATURE_IDS).filter(id => !groupIds.includes(id))
                                : [...new Set([...(featuresConfig.enabled ?? []), ...groupIds])]
                              saveFeatures({ ...featuresConfig, enabled: next })
                            }}
                            style={{ width: 40, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer', flexShrink: 0, background: allOn ? MC.good : MC.line, position: 'relative', transition: 'background .18s', padding: 0 }}
                            aria-pressed={allOn}
                          >
                            <span style={{ position: 'absolute', top: 2, left: allOn ? 18 : 2, width: 20, height: 20, borderRadius: 999, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left .18s' }} />
                          </button>
                        </div>
                        {group.features.map((feature, fi) => {
                          const isProOnly = PRO_ONLY_FEATURE_IDS.includes(feature.id)
                          const locked = isProOnly && venuePlan !== PLANS.PRO
                          const on = !locked && (featuresConfig.enabled?.includes(feature.id) ?? true)
                          return (
                            <div key={feature.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderTop: fi === 0 ? 'none' : `1px solid ${MC.line2}`, opacity: locked ? 0.5 : 1 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <div style={{ fontSize: 13, fontWeight: 500, color: on ? MC.ink : MC.ink3 }}>{feature.label}</div>
                                  {locked && <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: '#d97706', background: '#fffbeb', padding: '2px 5px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pro</span>}
                                </div>
                                <div style={{ fontSize: 11, color: MC.ink3, marginTop: 1 }}>{feature.description}</div>
                              </div>
                              <button
                                onClick={locked ? undefined : () => {
                                  const current = featuresConfig.enabled ?? ALL_FEATURE_IDS
                                  const next = current.includes(feature.id) ? current.filter(id => id !== feature.id) : [...current, feature.id]
                                  saveFeatures({ ...featuresConfig, enabled: next })
                                }}
                                disabled={locked}
                                style={{ width: 40, height: 24, borderRadius: 999, border: 'none', cursor: locked ? 'default' : 'pointer', flexShrink: 0, background: on ? MC.good : MC.line, position: 'relative', transition: 'background .18s', padding: 0 }}
                                aria-pressed={on}
                              >
                                <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 20, height: 20, borderRadius: 999, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left .18s' }} />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )}
              {featuresConfig.mode === 'all' && (
                <div style={{ fontSize: 12, color: MC.ink4, fontStyle: 'italic', marginBottom: 4 }}>
                  All {ALL_FEATURE_IDS.length} modules are enabled. Switch to Custom to hide features that don't apply.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation order */}
        <div>
          <div style={{ fontFamily: MONO, fontSize: 10.5, color: MC.ink3, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, padding: '0 2px 7px' }}>Navigation order</div>
          <div style={{ background: MC.paper, border: `1px solid ${MC.line}`, borderRadius: 14, overflow: 'hidden', padding: '4px 0' }}>
            <NavOrderSection
              isEnabled={isEnabled}
              venuePlan={venuePlan}
              complianceNavOrder={complianceNavOrder}
              saveComplianceNavOrder={saveComplianceNavOrder}
            />
          </div>
        </div>

      </div>
      </div>
    </div>
  )
}
