/**
 * Incident rules shared by the Incidents page: severity, RIDDOR deadlines and
 * display names. Old rows (before migration 122) have no title/type/status and
 * may carry RIDDOR as severity = 'riddor'.
 */
import { addDays, differenceInCalendarDays } from 'date-fns'

export const INCIDENT_TYPES = [
  { value: 'injury',    label: 'Injury' },
  { value: 'near_miss', label: 'Near miss' },
  { value: 'illness',   label: 'Illness' },
  { value: 'damage',    label: 'Damage' },
  { value: 'other',     label: 'Other' },
]

export const SEVERITIES = [
  { value: 'minor',    label: 'Minor' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'serious',  label: 'Serious' },
]

// HSE reporting windows, counted from the day of the incident
export const RIDDOR_CATEGORIES = [
  { value: 'specified_injury',     label: 'Specified injury to a worker', days: 10 },
  { value: 'over_7_day',           label: 'Worker off for over 7 days',   days: 15 },
  { value: 'non_worker_hospital',  label: 'Member of public taken to hospital', days: 10 },
  { value: 'dangerous_occurrence', label: 'Dangerous occurrence',         days: 10 },
  { value: 'other',                label: 'Other reportable',            days: 10 },
]

export interface IncidentLike {
  incident_date?: string | null
  created_at?: string | null
  severity?: string
  riddor?: boolean
  riddor_category?: string | null
  riddor_reported_at?: string | null
  status?: string
  title?: string | null
  description?: string
}

export const typeLabel = (value?: string | null) => INCIDENT_TYPES.find(t => t.value === value)?.label ?? null

/** Old 'riddor' severity reads as Serious; the RIDDOR flag is shown separately. */
export function severityOf(incident: IncidentLike): string {
  return incident.severity === 'riddor' ? 'serious' : (incident.severity ?? 'minor')
}

export function isRiddor(incident: IncidentLike): boolean {
  return !!incident.riddor || incident.severity === 'riddor'
}

export function isOpen(incident: IncidentLike): boolean {
  return (incident.status ?? 'open') !== 'closed'
}

/** Short name: the title, or for older incidents the description's first clause. */
export function incidentTitle(incident: IncidentLike): string {
  if (incident.title?.trim()) return incident.title.trim()
  const text = (incident.description ?? '').trim()
  const first = text.split(/[.;\n]/)[0].trim() || text
  return first.length > 60 ? `${first.slice(0, 58).trimEnd()}…` : first
}

/** When the HSE report is due, and how many days are left (negative = overdue). */
export function riddorDeadline(incident: IncidentLike, today = new Date()): { due: Date; daysLeft: number } | null {
  if (!isRiddor(incident) || incident.riddor_reported_at) return null
  const days = RIDDOR_CATEGORIES.find(c => c.value === incident.riddor_category)?.days ?? 10
  const due = addDays(new Date(incident.incident_date ?? incident.created_at ?? today), days)
  return { due, daysLeft: differenceInCalendarDays(due, today) }
}

export function dueText(daysLeft: number): string {
  if (daysLeft < 0) return `overdue by ${-daysLeft} day${daysLeft === -1 ? '' : 's'}`
  if (daysLeft === 0) return 'due today'
  return `due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`
}
