import { supabase } from '../supabase'
import { fetchStaffPayRates, fetchStaffPrivateFields, withPrivateFields } from './staffRestricted'
import { fetchTimeOffPrivateFields, withTimeOffPrivate } from './timeOffPrivate'

export interface HRStaffRow {
  id: string
  name: string
  job_role: string | null
  employment_type: string | null
  start_date: string | null
}

export interface HRSummaryData {
  staff: HRStaffRow[]
  formalActionStaffIds: string[]
  expiringDocs: { staff_id: string; expiry_date: string }[]
}

/** HR hub summary: active staff + last-90-day formal actions + docs expiring within 30 days. One Promise.all, not three sequential fetches per visit. */
export async function fetchHRSummary(venueId: string, since90: string, in30: string): Promise<HRSummaryData> {
  // start_date left out of the select for the same reason as fetchStaffHeader:
  // 118 revoked it, so requesting it fails the whole query. Merged back below.
  const [staffRes, actRes, docsRes, priv] = await Promise.all([
    supabase.from('staff')
      .select('id, name, job_role, employment_type')
      .eq('venue_id', venueId)
      .eq('is_active', true)
      .order('name'),
    supabase.from('hr_formal_actions')
      .select('staff_id')
      .eq('venue_id', venueId)
      .gte('occurred_at', since90),
    supabase.from('staff_hr_documents')
      .select('staff_id, expiry_date')
      .eq('venue_id', venueId)
      .not('expiry_date', 'is', null)
      .lte('expiry_date', in30),
    fetchStaffPrivateFields(),
  ])

  return {
    staff: withPrivateFields((staffRes.data ?? []) as any[], priv) as unknown as HRStaffRow[],
    formalActionStaffIds: (actRes.data ?? []).map((a: any) => a.staff_id),
    expiringDocs: (docsRes.data ?? []) as unknown as { staff_id: string; expiry_date: string }[],
  }
}

// ── Employee record panel (single staff, six tabs) ─────────────────────────

export interface StaffHeaderData {
  staff: any | null
  docsCount: number
  strikesCount: number
}

/** Profile tab header: full staff row + doc count + open-strike count. One Promise.all per staff click, not three. */
export async function fetchStaffHeader(staffId: string): Promise<StaffHeaderData> {
  // hourly_rate (117) plus start_date, contracted_hours and the emergency
  // contacts (118) are dropped from the select: both migrations revoked them
  // from the column grant, so asking for them fails the whole query rather
  // than returning null. They are merged back from the RPCs below.
  const [staffRes, docsRes, strikesRes, rates, priv] = await Promise.all([
    supabase.from('staff')
      .select('id, name, job_role, employment_type, working_days, is_under_18, holiday_pay_eligible')
      .eq('id', staffId)
      .maybeSingle(),
    supabase.from('staff_hr_documents').select('*', { count: 'exact', head: true }).eq('staff_id', staffId),
    supabase.from('staff_disciplinary_log').select('*', { count: 'exact', head: true }).eq('staff_id', staffId).is('dismissed_at', null),
    fetchStaffPayRates(),
    fetchStaffPrivateFields(),
  ])
  return {
    staff: staffRes.data
      ? { ...staffRes.data, hourly_rate: rates.get(staffId), ...(priv.get(staffId) ?? {}) }
      : staffRes.data,
    docsCount: docsRes.count ?? 0,
    strikesCount: strikesRes.count ?? 0,
  }
}

/** Documents tab. */
export async function fetchHRDocuments(staffId: string) {
  const { data } = await supabase.from('staff_hr_documents').select('*').eq('staff_id', staffId).order('created_at', { ascending: false })
  return data ?? []
}
export function insertHRDocument(payload: Record<string, unknown>) {
  return supabase.from('staff_hr_documents').insert(payload)
}
export function deleteHRDocumentRow(id: string) {
  return supabase.from('staff_hr_documents').delete().eq('id', id)
}
export function uploadHRAttachment(bucket: string, path: string, file: File) {
  return supabase.storage.from(bucket).upload(path, file, { upsert: false })
}
export function removeHRAttachment(bucket: string, path: string) {
  return supabase.storage.from(bucket).remove([path])
}

/** Disciplinary tab: strikes + formal actions + the raw clock/shift data late-clock-in history is derived from. */
export interface DisciplinaryRawData {
  strikes: any[]
  formals: any[]
  clockIns: { id: string; occurred_at: string }[]
  shifts: { shift_date: string; start_time: string }[]
}
export async function fetchDisciplinaryData(staffId: string, venueId: string): Promise<DisciplinaryRawData> {
  const [strikeRes, formalRes, clockRes, shiftRes] = await Promise.all([
    supabase.from('staff_disciplinary_log').select('*, dismissed_by_staff:dismissed_by(name)').eq('staff_id', staffId).order('occurred_at', { ascending: false }),
    supabase.from('hr_formal_actions').select('*, added_by_staff:added_by(name)').eq('staff_id', staffId).order('occurred_at', { ascending: false }),
    supabase.from('clock_events').select('id, occurred_at').eq('staff_id', staffId).eq('venue_id', venueId).eq('event_type', 'clock_in').order('occurred_at', { ascending: false }),
    supabase.from('shifts').select('shift_date, start_time').eq('staff_id', staffId).eq('venue_id', venueId),
  ])
  return {
    strikes: strikeRes.data ?? [],
    formals: formalRes.data ?? [],
    clockIns: clockRes.data ?? [],
    shifts: shiftRes.data ?? [],
  }
}
export function insertFormalAction(payload: Record<string, unknown>) {
  return supabase.from('hr_formal_actions').insert(payload)
}
export function deleteFormalActionRow(id: string) {
  return supabase.from('hr_formal_actions').delete().eq('id', id)
}
export function dismissStrikeRow(strikeId: string, dismissedBy: string | null) {
  return supabase.from('staff_disciplinary_log').update({ dismissed_at: new Date().toISOString(), dismissed_by: dismissedBy }).eq('id', strikeId)
}
export function dismissAllStrikesRows(staffId: string, dismissedBy: string | null) {
  return supabase.from('staff_disciplinary_log')
    .update({ dismissed_at: new Date().toISOString(), dismissed_by: dismissedBy })
    .eq('staff_id', staffId)
    .is('dismissed_at', null)
}

/** Leave tab. */
export async function fetchStaffLeaveRequests(staffId: string) {
  // select('*') fails under 119's column grant — see useTimeOffData.
  const [{ data }, priv] = await Promise.all([
    supabase.from('time_off_requests').select('id, staff_id, venue_id, start_date, end_date, status, leave_type, reviewed_by, reviewed_at, cancelled_at, cancelled_by, created_at').eq('staff_id', staffId).order('start_date', { ascending: false }),
    fetchTimeOffPrivateFields(),
  ])
  return withTimeOffPrivate(data ?? [], priv)
}

/** Training tab: certificates + induction sign-offs. */
export async function fetchStaffTrainingRecord(staffId: string) {
  const [certRes, indRes] = await Promise.all([
    supabase.from('staff_training').select('*').eq('staff_id', staffId).order('expiry_date', { ascending: true }),
    supabase.from('training_sign_offs').select('*').eq('staff_id', staffId).order('training_date', { ascending: false }),
  ])
  return { certs: certRes.data ?? [], inductions: indRes.data ?? [] }
}

/** Security tab: active PIN sessions for this staff member. */
export async function fetchStaffSessions(sessionToken: string, staffId: string) {
  const { data, error } = await supabase.rpc('list_staff_sessions', { p_session_token: sessionToken, p_staff_id: staffId })
  return { data: data ?? [], error }
}
export function revokeStaffSessionRpc(sessionToken: string, targetToken: string) {
  return supabase.rpc('revoke_staff_session', { p_session_token: sessionToken, p_target_token: targetToken })
}
