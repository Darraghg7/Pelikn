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

/** Close an open issue. */
export function markPestIssueResolved(venueId: string, issueId: string): Promise<void> {
  return updateRowById('pest_control_logs', issueId, { status: 'resolved' }, venueId, 'That issue no longer exists')
}
