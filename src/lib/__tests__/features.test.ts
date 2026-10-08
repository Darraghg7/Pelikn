import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  EXTRA_FEATURES, EXTRA_FEATURE_IDS, isSwitchedOn, extraForPath, withExtra,
  featureNeedsPro, planGateFor, checkTileEnabled, CHECK_TILE_FEATURE,
  type FeatureConfig,
} from '../features'
import { ALL_FEATURE_IDS } from '../../hooks/useVenueFeatures'

const all: FeatureConfig = { mode: 'all', enabled: ALL_FEATURE_IDS }

describe('optional extras are off unless switched on', () => {
  it('a brand-new venue (no settings row) sees no extras but every core module', () => {
    for (const id of EXTRA_FEATURE_IDS) expect(isSwitchedOn(null, id), id).toBe(false)
    for (const id of ALL_FEATURE_IDS) expect(isSwitchedOn(null, id), id).toBe(true)
  })

  it('"All modules" does not switch extras on', () => {
    for (const id of EXTRA_FEATURE_IDS) expect(isSwitchedOn(all, id), id).toBe(false)
  })

  it('an extra listed in `extras` is on, others stay off', () => {
    const cfg = { ...all, extras: ['recall', 'tips'] }
    expect(isSwitchedOn(cfg, 'recall')).toBe(true)
    expect(isSwitchedOn(cfg, 'tips')).toBe(true)
    expect(isSwitchedOn(cfg, 'complaints')).toBe(false)
  })

  it('an old custom config listing an extra in `enabled` does not turn it on (143 decides)', () => {
    const cfg: FeatureConfig = { mode: 'custom', enabled: ['fridge', 'waste', 'date_labelling'] }
    expect(isSwitchedOn(cfg, 'waste')).toBe(false)
    expect(isSwitchedOn(cfg, 'date_labelling')).toBe(false)
  })

  it('core modules still follow all/custom mode', () => {
    const custom: FeatureConfig = { mode: 'custom', enabled: ['fridge'], extras: ['fitness'] }
    expect(isSwitchedOn(custom, 'fridge')).toBe(true)
    expect(isSwitchedOn(custom, 'cleaning')).toBe(false)
  })
})

describe('withExtra', () => {
  it('adds and removes one extra without touching anything else', () => {
    const cfg: FeatureConfig = { mode: 'custom', enabled: ['fridge'], extras: ['tips'] }
    const on = withExtra(cfg, 'recall', true)
    expect(on).toEqual({ mode: 'custom', enabled: ['fridge'], extras: ['tips', 'recall'] })
    expect(withExtra(on, 'tips', false).extras).toEqual(['recall'])
    expect(withExtra(on, 'recall', true).extras).toEqual(['tips', 'recall'])
    expect(withExtra({ mode: 'all', enabled: [] }, 'waste', true).extras).toEqual(['waste'])
  })
})

describe('extraForPath (route guard)', () => {
  it('matches each extra page and pages below it', () => {
    expect(extraForPath('/recall')?.id).toBe('recall')
    expect(extraForPath('/haccp/step-2')?.id).toBe('haccp')
    expect(extraForPath('/eho-mock')?.id).toBe('eho_mock')
    expect(extraForPath('/orders')?.id).toBe('orders')
  })

  it('leaves core pages and look-alike paths alone', () => {
    for (const p of ['/dashboard', '/fridge', '/audit', '/settings/hub-tiles', '/tipsy', '/wastes', '/allergens/ppds', '/suppliers']) {
      expect(extraForPath(p), p).toBeUndefined()
    }
  })

  it('every extra path is a real route in App.jsx', () => {
    const app = readFileSync('src/App.jsx', 'utf8')
    for (const f of EXTRA_FEATURES) expect(app, f.path).toContain(`path="${f.path.slice(1)}"`)
  })
})

describe('plans are unchanged by the switches', () => {
  it('Pro extras still need Pro, Starter extras do not', () => {
    for (const id of ['haccp', 'eho_mock', 'tips', 'noticeboard', 'waste', 'orders']) expect(featureNeedsPro(id), id).toBe(true)
    for (const id of ['fitness', 'recall', 'complaints', 'equipment_maintenance', 'date_labelling']) expect(featureNeedsPro(id), id).toBe(false)
  })

  it('mock inspection checks the same gate as its route', () => {
    expect(planGateFor('eho_mock')).toBe('eho-mock')
    expect(planGateFor('fridge')).toBe('fridge')
  })

  it('extras and core modules never share an id', () => {
    for (const id of EXTRA_FEATURE_IDS) expect(ALL_FEATURE_IDS).not.toContain(id)
  })
})

describe('Checks tiles follow the switches', () => {
  it('hides a tile whose feature is off and keeps unswitchable tiles', () => {
    const isEnabled = (id: string) => id !== 'fitness' && id !== 'haccp'
    expect(checkTileEnabled('fitness', isEnabled)).toBe(false)
    expect(checkTileEnabled('haccp', isEnabled)).toBe(false)
    expect(checkTileEnabled('fridge', isEnabled)).toBe(true)
    expect(checkTileEnabled('docs', isEnabled)).toBe(true)
  })

  it('maps tiles only to real feature ids', () => {
    for (const id of Object.values(CHECK_TILE_FEATURE)) {
      expect([...ALL_FEATURE_IDS, ...EXTRA_FEATURE_IDS], id).toContain(id)
    }
  })
})

describe('migration 143 knows every extra', () => {
  it('backfills each extra id', () => {
    const sql = readFileSync('supabase/migrations/143_feature_extras_backfill.sql', 'utf8')
    for (const id of EXTRA_FEATURE_IDS) expect(sql, id).toContain(`('${id}',`)
  })
})
