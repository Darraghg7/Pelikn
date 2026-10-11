import { supabase } from '../supabase'

// Food items (the allergen registry) and PPDS items (Natasha's Law labels),
// plus the venue's written allergen procedure. Reads throw on any database
// error; writes that target one row by id ask for it back with `.select('id')`
// and throw when nothing came back, because RLS filtering a row out answers
// 200 with no error and the screen would otherwise say "saved".

type Row = Record<string, any>

class NoRowError extends Error {
  constructor(what: string) {
    super(`${what} could not be saved — it may have been removed. Please refresh and try again.`)
    this.name = 'NoRowError'
  }
}

// ── Food items ──────────────────────────────────────────────────────────────

export async function fetchFoodItems(venueId: string, search = '', includeInactive = false): Promise<Row[]> {
  let q = supabase
    .from('food_items')
    .select('*, food_allergens(allergen)')
    .eq('venue_id', venueId)
    .order('name')
  if (!includeInactive) q = q.eq('is_active', true)
  if (search) q = q.ilike('name', `%${search}%`)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function fetchFoodItem(venueId: string, id: string): Promise<Row | null> {
  const { data, error } = await supabase
    .from('food_items')
    .select('*, food_allergens(allergen)')
    .eq('id', id)
    .eq('venue_id', venueId)
    .single()
  if (error) throw error
  return data ?? null
}

/** Show or hide a dish (hiding is how a dish is "deleted"). */
export async function setFoodItemActive(venueId: string, id: string, isActive: boolean): Promise<void> {
  const { data, error } = await supabase
    .from('food_items')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('venue_id', venueId)
    .select('id')
  if (error) throw error
  if (!data?.length) throw new NoRowError('This dish')
}

/** Edit a dish and replace its allergen list in one database call. */
export async function replaceFoodItemAllergens(params: {
  sessionToken: string | undefined
  venueId: string
  id: string
  name: string
  description: string
  allergens: string[]
}): Promise<void> {
  const { error } = await supabase.rpc('replace_food_item_allergens', {
    p_session_token: params.sessionToken,
    p_food_item_id:  params.id,
    p_venue_id:      params.venueId,
    p_name:          params.name,
    p_description:   params.description || null,
    p_allergens:     params.allergens,
  })
  if (error) throw error
}

/** The "may contain" list and verbal note — separate from the RPC above. */
export async function updateFoodItemMayContain(
  venueId: string, id: string, mayContain: string[], verbalNote: string,
): Promise<void> {
  const { data, error } = await supabase.from('food_items').update({
    may_contain_allergens:    mayContain.length > 0 ? mayContain : null,
    verbal_confirmation_note: verbalNote.trim() || null,
  }).eq('id', id).eq('venue_id', venueId).select('id')
  if (error) throw error
  if (!data?.length) throw new NoRowError('The "may contain" list')
}

export async function createFoodItem(venueId: string, input: {
  name: string
  description: string
  mayContain: string[]
  verbalNote: string
}): Promise<Row> {
  const { data, error } = await supabase
    .from('food_items')
    .insert({
      name:                     input.name,
      description:              input.description || null,
      venue_id:                 venueId,
      may_contain_allergens:    input.mayContain.length > 0 ? input.mayContain : null,
      verbal_confirmation_note: input.verbalNote.trim() || null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function addFoodItemAllergens(venueId: string, foodItemId: string, allergens: string[]): Promise<void> {
  if (!allergens.length) return
  const { error } = await supabase.from('food_allergens').insert(
    allergens.map(a => ({ food_item_id: foodItemId, allergen: a, venue_id: venueId })),
  )
  if (error) throw error
}

// ── PPDS items ──────────────────────────────────────────────────────────────

export async function fetchPPDSItems(venueId: string): Promise<Row[]> {
  const { data, error } = await supabase
    .from('ppds_items')
    .select('id, name, description, ingredients, may_contain_allergens, is_active')
    .eq('venue_id', venueId)
    .order('name')
  if (error) throw error
  return data ?? []
}

/** One PPDS item, or null when it doesn't exist in this venue. */
export async function fetchPPDSItem(venueId: string, id: string): Promise<Row | null> {
  const { data, error } = await supabase
    .from('ppds_items')
    .select('*')
    .eq('id', id)
    .eq('venue_id', venueId)
    .maybeSingle()
  if (error) throw error
  return data ?? null
}

export async function setPPDSItemActive(venueId: string, id: string, isActive: boolean): Promise<void> {
  const { data, error } = await supabase
    .from('ppds_items')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('venue_id', venueId)
    .select('id')
  if (error) throw error
  if (!data?.length) throw new NoRowError('This item')
}

export async function deletePPDSItem(venueId: string, id: string): Promise<void> {
  const { data, error } = await supabase
    .from('ppds_items')
    .delete()
    .eq('id', id)
    .eq('venue_id', venueId)
    .select('id')
  if (error) throw error
  if (!data?.length) throw new NoRowError('This item')
}

export interface PPDSItemInput {
  name: string
  description: string | null
  ingredients: Row[]
  may_contain_allergens: string[]
}

/** Create (no id) or update (id) a PPDS item. */
export async function savePPDSItem(venueId: string, id: string | undefined, input: PPDSItemInput): Promise<void> {
  const payload = {
    venue_id:   venueId,
    ...input,
    updated_at: new Date().toISOString(),
    is_active:  true,
  }
  if (!id) {
    const { error } = await supabase.from('ppds_items').insert(payload)
    if (error) throw error
    return
  }
  const { data, error } = await supabase
    .from('ppds_items').update(payload).eq('id', id).eq('venue_id', venueId).select('id')
  if (error) throw error
  if (!data?.length) throw new NoRowError('This item')
}

// ── Allergen procedure ──────────────────────────────────────────────────────

export async function fetchAllergenProcedure(venueId: string): Promise<Row | null> {
  const { data, error } = await supabase
    .from('allergen_procedures')
    .select('*')
    .eq('venue_id', venueId)
    .maybeSingle()
  if (error) throw error
  return data ?? null
}

/** One procedure per venue: update it when it exists, otherwise create it. */
export async function saveAllergenProcedure(venueId: string, exists: boolean, payload: Row): Promise<void> {
  const body = { ...payload, venue_id: venueId }
  if (!exists) {
    const { error } = await supabase.from('allergen_procedures').insert(body)
    if (error) throw error
    return
  }
  const { data, error } = await supabase
    .from('allergen_procedures').update(body).eq('venue_id', venueId).select('venue_id') // keyed by venue, no id column
  if (error) throw error
  if (!data?.length) throw new NoRowError('The procedure')
}
