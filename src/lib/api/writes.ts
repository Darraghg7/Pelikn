import { supabase } from '../supabase'

// Shared by the compliance-log writes. Both throw on a database error so the
// screen can show the message in a toast, and updates check that a row really
// changed: the database answers "success, 0 rows" when a permission rule or a
// wrong id filters the update out, which used to read as a saved change.

type Row = Record<string, any>

export async function insertRow(table: string, row: Row): Promise<void> {
  const { error } = await supabase.from(table).insert(row)
  if (error) throw error
}

export async function updateRowById(
  table: string,
  id: string,
  values: Row,
  venueId: string,
  missingMessage: string,
): Promise<void> {
  const { data, error } = await supabase
    .from(table)
    .update(values)
    .eq('venue_id', venueId)
    .eq('id', id)
    .select('id')
  if (error) throw error
  if (!data?.length) throw new Error(missingMessage)
}

/**
 * Lets a screen that shows the failure in a toast keep its "if (error) …; return"
 * flow: resolves to the error a write threw, or null when it succeeded.
 */
export async function errorOf(write: Promise<unknown>): Promise<{ message: string } | null> {
  try {
    await write
    return null
  } catch (error: any) {
    return { message: error?.message ?? 'Something went wrong' }
  }
}
