import { supabase } from '../supabase'
import { insertRow, updateRowById } from './writes'

type Row = Record<string, any>

/**
 * Insert a pest log. Before migration 121 there's no issue_id column, so an
 * entry about an existing issue falls back to naming the issue in its text
 * (`legacyPrefix`, e.g. "Re: Mice in dry store").
 */
export async function insertPestLog(input: Row, legacyPrefix: string | null): Promise<void> {
  // Only send issue_id when there is one, so unlinked entries never depend on 121
  const { issue_id: issueId, ...legacy } = input
  try {
    await insertRow('pest_control_logs', issueId ? input : legacy)
  } catch (error: any) {
    if (!issueId || !/issue_id/.test(error?.message ?? '')) throw error
    await insertRow('pest_control_logs', {
      ...legacy,
      description: `Re: ${legacyPrefix} — ${legacy.description}`,
    })
  }
}

/**
 * Close an open issue, and the open treatments / follow-ups logged against it.
 * Those entries are saved "open" unless the user ticked "resolved" at the time,
 * and closing the issue used to leave them open for good, so the EHO report
 * kept showing Pest Control as ACTION REQUIRED for an issue that was dealt with.
 */
export async function markPestIssueResolved(venueId: string, issueId: string): Promise<void> {
  await updateRowById('pest_control_logs', issueId, { status: 'resolved' }, venueId, 'That issue no longer exists')
  const { error } = await supabase.from('pest_control_logs')
    .update({ status: 'resolved' })
    .eq('venue_id', venueId).eq('issue_id', issueId).eq('status', 'open')
  // Before migration 121 there is no issue_id to link on; the issue itself is already closed.
  if (error && !/issue_id/.test(error.message ?? '')) throw error
}

/**
 * Ids of the issues, among those the given entries refer to, that are resolved.
 * Used by reports to treat an entry about a closed issue as closed (entries
 * written before issues cascaded their closure, which are still stored open).
 * Reads the few referenced issues that fall outside the report's date range.
 */
export async function resolvedPestIssueIds(venueId: string, rows: Row[]): Promise<Set<string>> {
  const status = new Map<string, string>(rows.map(r => [r.id, r.status]))
  const missing = [...new Set(rows.map(r => r.issue_id).filter((id): id is string => !!id && !status.has(id)))]
  if (missing.length) {
    const { data } = await supabase.from('pest_control_logs').select('id, status').eq('venue_id', venueId).in('id', missing)
    for (const r of data ?? []) status.set(r.id, r.status)
  }
  return new Set([...status].filter(([, s]) => s === 'resolved').map(([id]) => id))
}

/** An entry's status for a report: closed if it, or the issue it is about, is closed. */
export const pestStatusOf = (row: Row, resolvedIssues: Set<string>): string =>
  row.status === 'resolved' || (row.issue_id && resolvedIssues.has(row.issue_id)) ? 'resolved' : row.status
