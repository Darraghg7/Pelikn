/**
 * What each plan includes — the one list shown on the marketing page, the
 * signup plan step and Plan & Billing. Edit here, never inline.
 *
 * Matches what the app actually gates: PRO_ONLY_ROUTES / PRO_ONLY_FEATURE_IDS
 * in hooks/useVenueFeatures.ts, and the Starter staff limit (lib/billing.ts).
 */
import { STARTER_STAFF_LIMIT } from './billing'

export const STARTER_FEATURES = [
  'Temperature logs (fridge, cooking, hot-holding)',
  'Cleaning schedules & records',
  "Allergen registry (Natasha's Law)",
  'Delivery checks & probe calibration',
  'Opening & closing checklists',
  'Pest control & corrective actions',
  'Document vault & compliance PDF exports',
  `Up to ${STARTER_STAFF_LIMIT} staff`,
]

export const PRO_FEATURES = [
  'Everything in Starter',
  'Rota builder with smart auto-fill',
  'Timesheets & payroll export',
  'Clock in/out & break tracking',
  'Training records & expiry alerts',
  'Time off & shift swaps',
  'Tip distribution',
  'HACCP generator & EHO mock inspection',
  'Supplier orders & waste logging',
  'Unlimited staff · multiple venues',
]
