import { supabase, supabaseUrl, supabaseAnonKey } from '../supabase'
import type { VenueBilling } from '../billing'

/**
 * Billing state for one venue (get_venue_billing, migration 138). Resolves to
 * null on any error, including the function not being applied yet: callers
 * treat null as "not on billing" and never lock (see billingAccess).
 */
export async function fetchVenueBilling(venueId: string): Promise<VenueBilling | null> {
  const { data, error } = await supabase.rpc('get_venue_billing', { p_venue_id: venueId })
  if (error || !data) return null
  return data as VenueBilling
}

/** Owner picks a plan during the free trial, before any card is on file. */
export function setTrialPlan(venueId: string, plan: 'starter' | 'pro', extra: { qrAddon?: boolean; additionalVenues?: number } = {}) {
  return supabase.rpc('set_trial_plan', {
    p_venue_id:          venueId,
    p_plan:              plan,
    p_qr_addon:          extra.qrAddon ?? null,
    p_additional_venues: extra.additionalVenues ?? null,
  })
}

// ── `billing` edge function ──────────────────────────────────────────────────
// Authenticated with the owner's Supabase Auth session (email sign-in), not a
// PIN session: only the person who owns the venue can pay for it.

async function callBilling<T>(body: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Sign in with your owner email to manage billing')

  const res = await fetch(`${supabaseUrl}/functions/v1/billing`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error ?? 'Something went wrong with billing. Please try again.')
  return data as T
}

export function startCheckout(venueId: string, plan: 'starter' | 'pro', interval: 'month' | 'year', returnPath: string) {
  return callBilling<{ url: string }>({ action: 'checkout', venueId, plan, interval, returnPath })
}

export function changePlan(venueId: string, plan: 'starter' | 'pro') {
  return callBilling<{ ok: true }>({ action: 'change_plan', venueId, plan })
}

/** Re-price the subscription after a venue is added. Safe to call when not subscribed. */
export function syncBillingVenues(venueId: string) {
  return callBilling<{ ok: true }>({ action: 'sync_venues', venueId })
}

export function openBillingPortal(venueId: string, returnPath: string) {
  return callBilling<{ url: string }>({ action: 'portal', venueId, returnPath })
}
