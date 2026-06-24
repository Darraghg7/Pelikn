import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { useAppSettings } from '../../hooks/useSettings'
import { useVenueFeatures, FEATURE_GROUPS, ALL_FEATURE_IDS, PRO_ONLY_FEATURE_IDS } from '../../hooks/useVenueFeatures'
import { PLANS } from '../../lib/constants'
import NavOrderSection from './NavOrderSection'
import SettingsSubHeader from '../../components/layout/SettingsSubHeader'

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

function Toggle({ on, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className="relative w-10 h-6 rounded-full border-0 cursor-pointer shrink-0 transition-colors duration-[180ms] p-0"
      style={{ background: on ? '#1a7a4c' : '#e4e6e2' }}
    >
      <span
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all duration-[180ms]"
        style={{ left: on ? 18 : 2, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
      />
    </button>
  )
}

function Row({ label, sub, on, onToggle, last }) {
  return (
    <div className={`flex items-center gap-3 px-[15px] py-[13px] ${last === false ? 'border-t border-charcoal/6' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-charcoal tracking-[-0.005em]">{label}</div>
        {sub && <div className="text-[11.5px] text-charcoal/50 mt-0.5 leading-[1.4]">{sub}</div>}
      </div>
      <Toggle on={on} onClick={onToggle} />
    </div>
  )
}

function Group({ label, children, foot }) {
  return (
    <div>
      {label && (
        <div className="font-mono text-[11px] font-semibold tracking-[0.08em] uppercase text-charcoal/50 px-0.5 pb-1.5">{label}</div>
      )}
      <div className="bg-white dark:bg-[#1e1e1e] border border-charcoal/10 rounded-[14px] overflow-hidden">
        {children}
      </div>
      {foot && (
        <div className="text-[11.5px] text-charcoal/50 px-1 pt-2 leading-[1.45]">{foot}</div>
      )}
    </div>
  )
}

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
    <div className="min-h-screen bg-surface">
      <SettingsSubHeader title="Features" onBack={() => navigate(vp('/settings/hub'))} />

      <div className="px-4 pb-24 max-w-[480px] mx-auto">
      <div className="flex flex-col gap-4">

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

        <div>
          <div className="font-mono text-[11px] font-semibold tracking-[0.08em] uppercase text-charcoal/50 px-0.5 pb-1.5">Modules</div>
          <div className="bg-white dark:bg-[#1e1e1e] border border-charcoal/10 rounded-[14px] overflow-hidden py-1">
            <div className="px-[14px] py-2">
              <div className="inline-flex bg-charcoal/6 rounded-[9px] p-[3px] gap-0.5 mb-3">
                {['all', 'custom'].map(mode => (
                  <button
                    key={mode}
                    onClick={() => saveFeatures({ mode, enabled: mode === 'all' ? ALL_FEATURE_IDS : (featuresConfig.enabled ?? ALL_FEATURE_IDS) })}
                    className={`px-[14px] py-[5px] rounded-[7px] border-0 cursor-pointer text-xs font-semibold transition-all duration-150 ${featuresConfig.mode === mode ? 'bg-white text-charcoal shadow-sm' : 'bg-transparent text-charcoal/50'}`}
                  >{mode === 'all' ? 'All modules' : 'Custom'}</button>
                ))}
              </div>

              {featuresConfig.mode === 'custom' && (
                <div className="flex flex-col gap-2.5">
                  {FEATURE_GROUPS.map(group => {
                    const allOn = group.features.every(f => featuresConfig.enabled?.includes(f.id))
                    return (
                      <div key={group.id} className="border border-charcoal/10 rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-[9px] bg-charcoal/6 border-b border-charcoal/10">
                          <div>
                            <div className="text-[13px] font-semibold text-charcoal">{group.label}</div>
                            <div className="text-[11px] text-charcoal/50 mt-px">{group.description}</div>
                          </div>
                          <button
                            onClick={() => {
                              const groupIds = group.features.map(f => f.id)
                              const next = allOn
                                ? (featuresConfig.enabled ?? ALL_FEATURE_IDS).filter(id => !groupIds.includes(id))
                                : [...new Set([...(featuresConfig.enabled ?? []), ...groupIds])]
                              saveFeatures({ ...featuresConfig, enabled: next })
                            }}
                            className="relative w-10 h-6 rounded-full border-0 cursor-pointer shrink-0 p-0 transition-colors duration-[180ms]"
                            style={{ background: allOn ? '#1a7a4c' : '#e4e6e2' }}
                            aria-pressed={allOn}
                          >
                            <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all duration-[180ms]" style={{ left: allOn ? 18 : 2, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                          </button>
                        </div>
                        {group.features.map((feature, fi) => {
                          const isProOnly = PRO_ONLY_FEATURE_IDS.includes(feature.id)
                          const locked = isProOnly && venuePlan !== PLANS.PRO
                          const on = !locked && (featuresConfig.enabled?.includes(feature.id) ?? true)
                          return (
                            <div key={feature.id} className={`flex items-center gap-2.5 px-3 py-[9px] ${fi === 0 ? '' : 'border-t border-charcoal/6'} ${locked ? 'opacity-50' : ''}`}>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <div className={`text-[13px] font-medium ${on ? 'text-charcoal' : 'text-charcoal/50'}`}>{feature.label}</div>
                                  {locked && <span className="font-mono text-[11px] font-bold text-[#d97706] bg-[#fffbeb] px-[5px] py-0.5 rounded uppercase tracking-[0.04em]">Pro</span>}
                                </div>
                                <div className="text-[11px] text-charcoal/50 mt-px">{feature.description}</div>
                              </div>
                              <button
                                onClick={locked ? undefined : () => {
                                  const current = featuresConfig.enabled ?? ALL_FEATURE_IDS
                                  const next = current.includes(feature.id) ? current.filter(id => id !== feature.id) : [...current, feature.id]
                                  saveFeatures({ ...featuresConfig, enabled: next })
                                }}
                                disabled={locked}
                                className="relative w-10 h-6 rounded-full border-0 shrink-0 p-0 transition-colors duration-[180ms]"
                                style={{ background: on ? '#1a7a4c' : '#e4e6e2', cursor: locked ? 'default' : 'pointer' }}
                                aria-pressed={on}
                              >
                                <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all duration-[180ms]" style={{ left: on ? 18 : 2, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
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
                <div className="text-xs text-charcoal/30 italic mb-1">
                  All {ALL_FEATURE_IDS.length} modules are enabled. Switch to Custom to hide features that don't apply.
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="font-mono text-[11px] font-semibold tracking-[0.08em] uppercase text-charcoal/50 px-0.5 pb-1.5">Navigation order</div>
          <div className="bg-white dark:bg-[#1e1e1e] border border-charcoal/10 rounded-[14px] overflow-hidden py-1">
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
