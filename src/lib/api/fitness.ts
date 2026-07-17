import { supabase } from '../supabase'

export interface FitnessDeclaration {
  id: string
  is_fit: boolean
  declared_at: string
  shift_type?: string | null
  staff_name?: string | null
  staff_id?: string | null
  [key: string]: unknown
}

export interface IllnessPolicy {
  id: string
  venue_id: string
  [key: string]: unknown
}

const DECLARATION_COLUMNS =
  'id, is_fit, declared_at, shift_type, staff_name, staff_id, has_dv_symptoms, ' +
  'has_skin_infection, has_other_illness, illness_details, confirm_handwashing, ' +
  'confirm_clean_uniform, confirm_no_jewellery'

/** Fitness-to-work declarations for a venue on a given date, newest first. */
export async function fetchDeclarations(venueId: string, date: string): Promise<FitnessDeclaration[]> {
  const { data } = await supabase
    .from('fitness_declarations')
    .select(DECLARATION_COLUMNS)
    .eq('venue_id', venueId)
    .eq('declaration_date', date)
    .order('declared_at', { ascending: false })
  return (data ?? []) as unknown as FitnessDeclaration[]
}

export async function fetchIllnessPolicy(venueId: string): Promise<IllnessPolicy | null> {
  const { data } = await supabase
    .from('illness_exclusion_policies')
    .select('*')
    .eq('venue_id', venueId)
    .maybeSingle()
  return (data ?? null) as IllnessPolicy | null
}

/** The signed-in staff member's own declaration for a given date, if any. */
export async function fetchOwnDeclaration(
  venueId: string, staffId: string, date: string,
): Promise<FitnessDeclaration | null> {
  const { data } = await supabase
    .from('fitness_declarations')
    .select('id, is_fit, declared_at, shift_type, has_dv_symptoms, has_skin_infection, has_other_illness, illness_details, confirm_handwashing, confirm_clean_uniform, confirm_no_jewellery')
    .eq('venue_id', venueId)
    .eq('staff_id', staffId)
    .eq('declaration_date', date)
    .order('declared_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data ?? null) as FitnessDeclaration | null
}

export function insertDeclaration(payload: Record<string, unknown>) {
  return supabase.from('fitness_declarations').insert(payload)
}

export function insertIllnessPolicy(payload: Record<string, unknown>) {
  return supabase.from('illness_exclusion_policies').insert(payload)
}

export function updateIllnessPolicy(venueId: string, payload: Record<string, unknown>) {
  return supabase.from('illness_exclusion_policies').update(payload).eq('venue_id', venueId)
}
