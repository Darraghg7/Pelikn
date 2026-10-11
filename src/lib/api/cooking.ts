import { insertRow } from './writes'

export function insertCookingLog(row: Record<string, any>): Promise<void> {
  return insertRow('cooking_temp_logs', row)
}
