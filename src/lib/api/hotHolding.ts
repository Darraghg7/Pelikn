import { insertRow, updateRowById } from './writes'

type Row = Record<string, any>

export function insertHotHoldingLog(row: Row): Promise<void> {
  return insertRow('hot_holding_logs', row)
}

export function addHotHoldingItem(venueId: string, name: string): Promise<void> {
  return insertRow('hot_holding_items', { venue_id: venueId, name })
}

/** Removing an item hides it; its past readings stay. */
export function deactivateHotHoldingItem(venueId: string, itemId: string): Promise<void> {
  return updateRowById('hot_holding_items', itemId, { is_active: false }, venueId, 'That item no longer exists')
}

export function updateHotHoldingItem(venueId: string, itemId: string, values: Row): Promise<void> {
  return updateRowById('hot_holding_items', itemId, values, venueId, 'That item no longer exists')
}
