/**
 * What each plan includes: the one definition behind the marketing page, the
 * signup plan step, Plan & Billing AND the Pro gate itself. Edit here, never
 * inline.
 *
 * Every Pro line names the pages/feature toggles it unlocks (`gates`).
 * PRO_GATES is built from those, and PlanGate / isPlanLocked read it, so a
 * page can't be locked without the Pro copy saying so (and vice versa).
 * plans.test.ts checks App.jsx against it.
 */
import { STARTER_STAFF_LIMIT } from './billing'
import {
  STARTER_PRICE, PRO_PRICE, EXTRA_VENUE_PRICE,
  STARTER_ANNUAL, PRO_ANNUAL, EXTRA_VENUE_ANNUAL,
} from './pricing'
import { PLANS, type Plan } from './constants'

export { STARTER_STAFF_LIMIT }

/** Display order everywhere plans sit side by side: cheapest first. */
export const PLAN_ORDER: Plan[] = [PLANS.STARTER, PLANS.PRO]

export const STARTER_FEATURES = [
  'Temperature logs (fridge, cooking, hot-holding)',
  'Cleaning schedules & records',
  "Allergen registry (Natasha's Law)",
  'Delivery checks & probe calibration',
  'Opening & closing checklists',
  'Pest control & corrective actions',
  'Date labelling & equipment maintenance',
  'Document vault & compliance PDF exports',
  `Up to ${STARTER_STAFF_LIMIT} staff`,
]

interface ProFeature {
  label: string
  /** Route keys (App.jsx wrapPro/wrapPerm) and feature-toggle ids this line unlocks. */
  gates: string[]
}

export const PRO_ONLY: ProFeature[] = [
  { label: 'Rota builder with auto-fill from your staffing needs', gates: ['rota'] },
  { label: 'Timesheets & payroll export',        gates: ['timesheet'] },
  { label: 'Clock in/out & break tracking',      gates: ['clock-in'] },
  { label: 'Training records & expiry alerts',   gates: ['training'] },
  { label: 'Time off & shift swaps',             gates: ['time-off', 'time_off'] },
  { label: 'Team noticeboard & calendar',        gates: ['noticeboard', 'calendar'] },
  { label: 'HR records & staff files',           gates: ['hr'] },
  { label: 'Incident & accident log',            gates: ['incidents'] },
  { label: 'Tip distribution',                   gates: ['tips'] },
  { label: 'HACCP generator & EHO mock inspection', gates: ['haccp', 'eho-mock'] },
  { label: 'Supplier directory, orders & waste logging', gates: ['suppliers', 'orders', 'waste'] },
]

export const PRO_FEATURES = [
  'Everything in Starter',
  ...PRO_ONLY.map(f => f.label),
  'Unlimited staff · multiple venues',
]

/** Every route key / feature id that needs Pro. */
export const PRO_GATES: ReadonlySet<string> = new Set(PRO_ONLY.flatMap(f => f.gates))

export function isProFeature(id: string | null | undefined): boolean {
  return !!id && PRO_GATES.has(id)
}

export const PLAN_DETAILS = {
  [PLANS.STARTER]: {
    name: 'Starter',
    price: STARTER_PRICE,
    annualPrice: STARTER_ANNUAL,
    venueNote: 'one venue',
    staffLimit: STARTER_STAFF_LIMIT as number | null,
    features: STARTER_FEATURES,
  },
  [PLANS.PRO]: {
    name: 'Pro',
    price: PRO_PRICE,
    annualPrice: PRO_ANNUAL,
    venueNote: 'first venue',
    extraVenuePrice: EXTRA_VENUE_PRICE,
    extraVenueAnnualPrice: EXTRA_VENUE_ANNUAL,
    staffLimit: null as number | null,
    features: PRO_FEATURES,
  },
} as const
