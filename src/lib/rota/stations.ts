import { colors } from '../tokens'

/** The four station groups a role name can fall into, in legend order. */
export const STATION_ORDER = ['Kitchen', 'FOH', 'Bar', 'KP'] as const

/** Same category colours as calendar events (src/lib/tokens.js). */
export const STATION_COLOR: Record<string, string> = {
  Kitchen: colors.warn,
  FOH: colors.category.teal,
  Bar: colors.category.plum,
  KP: colors.category.slate,
}

/** Which station a role name belongs to ("Head Chef" → Kitchen). Unknown roles keep their own name. */
export function stationFromRole(role: string | null | undefined): string | null {
  if (!role) return null
  const r = role.toLowerCase()
  if (r.includes('kitchen') || r.includes('chef') || r.includes('cook')) return 'Kitchen'
  if (r.includes('kp') || r.includes('porter')) return 'KP'
  if (r.includes('bar') || r.includes('barista')) return 'Bar'
  if (r.includes('foh') || r.includes('front') || r.includes('floor') || r.includes('server') || r.includes('host') || r.includes('supervisor')) return 'FOH'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

/** Colour for a role's station, or the brand colour when it has none. */
export function stationColor(roleLabel: string | null | undefined): string {
  const station = stationFromRole(roleLabel)
  return (station && STATION_COLOR[station]) || colors.brand.DEFAULT
}
