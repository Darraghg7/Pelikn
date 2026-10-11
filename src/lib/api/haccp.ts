import { subDays } from 'date-fns'
import { supabase } from '../supabase'

type Row = Record<string, any>

export async function fetchHACCPPlan(venueId: string): Promise<Row | null> {
  const { data, error } = await supabase
    .from('haccp_plans')
    .select('*')
    .eq('venue_id', venueId)
    .maybeSingle()
  if (error) throw error
  return data ?? null
}

/** Update the plan (planId) or create the first one. */
export async function saveHACCPPlan(venueId: string, planId: string | undefined, payload: Row): Promise<void> {
  const body = { ...payload, venue_id: venueId }
  if (!planId) {
    const { error } = await supabase.from('haccp_plans').insert({ ...body, is_complete: false }).select().single()
    if (error) throw error
    return
  }
  const { data, error } = await supabase
    .from('haccp_plans').update(body).eq('id', planId).eq('venue_id', venueId).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('Your HACCP plan could not be saved — please refresh and try again.')
}

/** How many records of each kind the venue has in the last 30 days (allergen items: all time). */
export async function fetchHACCPSummary(venueId: string) {
  const since = subDays(new Date(), 30).toISOString()
  const count = (table: string, dateColumn?: string) => {
    let q = supabase.from(table).select('id', { count: 'exact', head: true }).eq('venue_id', venueId)
    if (dateColumn) q = q.gte(dateColumn, since)
    return q
  }
  const [fridge, cooking, cleaning, deliveries, allergens, probes] = await Promise.all([
    count('fridge_temperature_logs', 'logged_at'),
    count('cooking_temp_logs', 'logged_at'),
    count('cleaning_completions', 'completed_at'),
    count('delivery_checks', 'checked_at'),
    count('food_items'),
    count('probe_calibrations', 'calibrated_at'),
  ])
  for (const r of [fridge, cooking, cleaning, deliveries, allergens, probes]) {
    if (r.error) throw r.error
  }
  return {
    fridgeCount:   fridge.count ?? 0,
    cookingCount:  cooking.count ?? 0,
    cleaningCount: cleaning.count ?? 0,
    deliveryCount: deliveries.count ?? 0,
    allergenCount: allergens.count ?? 0,
    probeCount:    probes.count ?? 0,
  }
}
