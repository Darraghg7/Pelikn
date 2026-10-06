/**
 * The plan definition in lib/plans.ts is what every pricing screen shows AND
 * what the app actually locks. These tests fail if copy and enforcement drift
 * apart again (1 Oct 2026 audit: three screens disagreed with each other and
 * with the gate).
 */
import fs from 'fs'
import path from 'path'
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import {
  PLAN_ORDER, PLAN_DETAILS, PRO_ONLY, PRO_GATES, PRO_FEATURES, STARTER_FEATURES,
  STARTER_STAFF_LIMIT, isProFeature,
} from '../plans'
import { ALL_FEATURE_IDS, PRO_ONLY_FEATURE_IDS } from '../../hooks/useVenueFeatures'

const root = path.resolve(__dirname, '../../..')
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')

vi.mock('../../contexts/VenueContext', () => ({
  useVenue: () => ({ venueId: 'v1', venueSlug: 'demo', venuePlan: 'starter', refreshVenue: () => {} }),
}))
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' }, venues: [{ id: 'v1' }] }),
}))
vi.mock('../../components/ui/Toast', () => ({ useToast: () => () => {} }))
vi.mock('../../hooks/useBilling', () => ({
  default: () => ({
    billing: { managed: true, plan: 'starter', active_staff: 2, venue_count: 1, trial_ends_at: null, subscription_status: 'active' },
    access: { state: 'subscribed' },
    loading: false,
    reload: () => {},
  }),
}))

/** Plan-name labels (elements whose whole text is a plan name), in page order. */
function planNameOrder(container) {
  const names = PLAN_ORDER.map(id => PLAN_DETAILS[id].name)
  return [...container.querySelectorAll('p, span, div')]
    .filter(el => el.children.length === 0 && names.includes(el.textContent.trim()))
    .map(el => el.textContent.trim())
}

describe('the gate matches the Pro feature list', () => {
  const app = read('src/App.jsx')
  const gatedInApp = [
    ...[...app.matchAll(/wrapPro\(\s*\w+\s*,\s*\w+\s*,\s*'([^']+)'\s*\)/g)].map(m => m[1]),
    ...[...app.matchAll(/wrapPerm\(\s*\w+\s*,\s*'[^']+'\s*,\s*'([^']+)'\s*\)/g)].map(m => m[1]),
  ]

  it('finds the gated routes in App.jsx', () => {
    expect(gatedInApp.length).toBeGreaterThan(5)
  })

  it('every page App.jsx puts behind PlanGate is named in the Pro list', () => {
    for (const key of gatedInApp) expect(PRO_GATES, `"${key}" is gated but not in PRO_ONLY`).toContain(key)
  })

  it('every Pro gate is a real route or a real feature toggle', () => {
    for (const key of PRO_GATES) {
      expect(gatedInApp.includes(key) || ALL_FEATURE_IDS.includes(key), `"${key}" gates nothing`).toBe(true)
    }
  })

  it('Starter compliance pages are not locked', () => {
    for (const id of ['date_labelling', 'equipment_maintenance', 'probe', 'pest_control', 'corrective']) {
      expect(isProFeature(id)).toBe(false)
    }
    expect(PRO_ONLY_FEATURE_IDS).toEqual(['waste', 'orders', 'rota', 'timesheet', 'training', 'time_off', 'tips'])
  })

  it('every Pro line appears in the Pro copy', () => {
    for (const f of PRO_ONLY) expect(PRO_FEATURES).toContain(f.label)
  })
})

describe('the staff limit', () => {
  it('copy states the enforced number', () => {
    expect(STARTER_FEATURES.some(f => f === `Up to ${STARTER_STAFF_LIMIT} staff`)).toBe(true)
  })

  it('matches the database trigger (migration 138)', () => {
    const sql = read('supabase/migrations/138_billing_accounts.sql')
    expect(sql).toMatch(new RegExp(`IF v_count >= ${STARTER_STAFF_LIMIT} THEN`))
  })

  it('marketing no longer promises "no per-user fees"', () => {
    expect(read('src/pages/marketing/MarketingPage.jsx')).not.toMatch(/per-user fees/i)
  })
})

describe('the three pricing screens render the plan definition', () => {
  beforeAll(() => {
    global.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }
    window.scrollTo = () => {}
  })

  function expectAllFeatures(scope) {
    for (const f of [...STARTER_FEATURES, ...PRO_FEATURES]) {
      expect(scope.getAllByText(f, { exact: false }).length, f).toBeGreaterThan(0)
    }
  }

  it('signup plan step', async () => {
    const { default: StepPlan } = await import('../../pages/signup/StepPlan')
    const { container } = render(
      <StepPlan selected="starter" onSelect={() => {}} extraVenues={0} onExtraVenues={() => {}} qrAddon={false} onQrAddon={() => {}} onNext={() => {}} />,
    )
    expectAllFeatures(screen)
    expect(planNameOrder(container)).toEqual(PLAN_ORDER.map(id => PLAN_DETAILS[id].name))
    expect(container.textContent).not.toMatch(/most popular/i)
  })

  it('marketing pricing section', async () => {
    const { default: MarketingPage } = await import('../../pages/marketing/MarketingPage')
    const { container } = render(<MemoryRouter><MarketingPage /></MemoryRouter>)
    const pricing = container.querySelector('#pricing')
    expectAllFeatures(within(pricing))
    expect(planNameOrder(pricing)).toEqual(PLAN_ORDER.map(id => PLAN_DETAILS[id].name))
    expect(pricing.textContent).not.toMatch(/most popular/i)
  })

  it('Settings → Plan & Billing shows the current plan\'s list', async () => {
    const { default: BillingSettingsPage } = await import('../../pages/settings/BillingSettingsPage')
    render(<MemoryRouter><BillingSettingsPage /></MemoryRouter>)
    for (const f of STARTER_FEATURES) expect(screen.getAllByText(f).length).toBeGreaterThan(0)
  })
})
