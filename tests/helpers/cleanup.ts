/**
 * Auto-cleanup fixture: delete every row a test creates, when it finishes.
 *
 * The suite runs against the real brew-and-bloom venue, so any test that
 * submits a form leaves a permanent row behind. Nothing tracked those rows, so
 * they accumulated for five months — 187 of them across seven tables by
 * 22 Sep 2026, including 43 "Playwright Tester" staff in a venue that only has
 * five real ones.
 *
 * Fixing this per-spec would mean hand-writing a delete for each creating test
 * and knowing which table each form writes to. Instead this watches what
 * actually gets written: every successful POST to PostgREST is recorded, and
 * the rows are deleted in reverse order after the test. A spec author does not
 * have to remember anything, and a test added later is covered automatically.
 *
 * Why the Prefer header is rewritten: the app inserts with
 * `supabase.from(t).insert({...})` and no `.select()`, which sends
 * `Prefer: return=minimal` — PostgREST then replies 201 with an empty body and
 * we never learn the new row's id. Forcing `return=representation` makes the
 * response carry the row. Call sites destructure `{ error }` and ignore `data`,
 * so handing them a body they didn't ask for changes nothing.
 *
 * Usage — import `test` from here instead of from @playwright/test:
 *
 *   import { test, expect } from './helpers/cleanup'
 */

import { test as base, expect, type Page } from '@playwright/test'
import { getTestSession, SUPABASE_URL, ANON_KEY } from './auth-bypass'

/** A row this test caused to exist, newest last. */
interface Created {
  table: string
  id:    string
}

/** Guards against treating an arbitrary string result as a row id. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Tables we must never delete from, however a test touched them. */
const NEVER_DELETE = new Set(['venues', 'staff_sessions'])

/**
 * RPCs that create a row and return its uuid.
 *
 * Most writes are plain PostgREST inserts and are caught generically, but a
 * few go through SECURITY DEFINER functions instead — `create_staff_member`
 * is why "Playwright Tester" reached 43 rows while every other table was
 * being reclaimed. There is no way to infer the target table from an RPC name,
 * so these are listed explicitly. Add to this map if a new RPC starts
 * creating rows; a leak shows up as a rising row count, not a test failure.
 */
const ROW_CREATING_RPCS: Record<string, string> = {
  create_staff_member: 'staff',
}

async function trackWrites(page: Page, created: Created[]) {
  await page.route(`${SUPABASE_URL}/rest/v1/**`, async route => {
    const req = route.request()
    if (req.method() !== 'POST') return route.continue()

    // /rest/v1/<table>?... for a plain insert, /rest/v1/rpc/<fn> for a
    // function call. Only the handful of RPCs known to create rows are
    // tracked; the rest pass straight through.
    const path = new URL(req.url()).pathname.replace('/rest/v1/', '')
    const isRpc = path.startsWith('rpc/')
    const table = isRpc ? ROW_CREATING_RPCS[path.slice(4)] : path.split('/')[0]
    if (!table) return route.continue()

    // Only swap the `return=` directive. Prefer carries more than one token —
    // an upsert sends `resolution=merge-duplicates`, and overwriting the whole
    // header drops it, silently turning the upsert into a plain insert that
    // then fails on a duplicate key. Keep every other directive intact.
    const prefer = (req.headers()['prefer'] ?? '')
      .split(',')
      .map(p => p.trim())
      .filter(p => p && !p.startsWith('return='))
      .concat('return=representation')
      .join(',')

    let response
    try {
      response = await route.fetch({ headers: { ...req.headers(), prefer } })
    } catch {
      // The page can close with a write still in flight — a test whose last
      // assertion doesn't wait for the save will end mid-request. Nothing to
      // track and nothing to forward; failing here would turn the test's own
      // loose assertion into a fixture error.
      return route.abort().catch(() => {})
    }

    if (response.ok() && !NEVER_DELETE.has(table)) {
      try {
        const body = await response.json()
        for (const row of Array.isArray(body) ? body : [body]) {
          // An insert returns the row; a row-creating RPC returns the bare
          // uuid it generated (`RETURNS UUID`), so handle both shapes.
          const id = typeof row === 'string' ? row : row?.id
          if (typeof id === 'string' && UUID.test(id)) created.push({ table, id })
        }
      } catch {
        // Not JSON, or no representation came back. Nothing to reclaim —
        // the test's own assertions still decide pass/fail.
      }
    }

    return route.fulfill({ response })
  })
}

async function deleteCreated(page: Page, created: Created[]) {
  if (created.length === 0) return

  const session = await getTestSession(page)
  // return=representation makes PostgREST echo the rows it actually removed.
  // Without it a DELETE that RLS filters to zero rows still answers 204, so a
  // policy that forbids deleting looks identical to a successful cleanup —
  // the silent no-op that let these rows accumulate unnoticed.
  const headers = {
    apikey: ANON_KEY,
    Authorization: `Bearer ${session.jwt}`,
    Prefer: 'return=representation',
  }
  const failed: string[] = []

  // `staff` has no DELETE policy at all — since 091 every write to it is
  // denied, which is why 55 "Playwright Tester" rows survived this fixture
  // and had to be cleared by hand. Migration 115 added a manager-scoped RPC,
  // and getTestSession already holds a real manager token, so the rows this
  // suite creates can finally be reclaimed the same way the app deletes them.
  const deleteRow = async (table: string, id: string) => {
    if (table === 'staff') {
      const res = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/delete_staff_member`, {
        headers: { ...headers, 'Content-Type': 'application/json' },
        data: { p_session_token: session.token, p_staff_id: id },
      })
      // The RPC raises when it matches no row, so a non-ok response here is a
      // real failure rather than the silent 204 a blocked DELETE would give.
      return { ok: res.ok(), status: res.status(), body: await res.text() }
    }
    const res = await page.request.delete(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, { headers })
    const body = await res.text()
    const removed = (() => { try { return JSON.parse(body) } catch { return [] } })()
    return { ok: res.ok() && Array.isArray(removed) && removed.length > 0, status: res.status(), body }
  }

  // Reverse order: a row created later may reference an earlier one, and
  // deleting the child first keeps a foreign key from blocking the parent.
  for (const { table, id } of [...created].reverse()) {
    try {
      const { ok, status, body } = await deleteRow(table, id)
      if (ok) continue

      // Removing nothing is not automatically a leak: several specs delete
      // their own row in a `finally`, so by the time the fixture runs it is
      // already gone. Warning on those made the output noisy and trained the
      // reader to ignore it — which defeats the point of warning at all.
      // Ask whether the row still exists and only complain if it does.
      const check = await page.request.get(
        `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}&select=id`,
        { headers: { apikey: ANON_KEY, Authorization: `Bearer ${session.jwt}` } }
      )
      const still = check.ok() ? await check.json().catch(() => []) : []
      if (Array.isArray(still) && still.length === 0) continue  // already gone

      failed.push(`${table}/${id} -> still present after delete (HTTP ${status}) ${body.slice(0, 120)}`)
    } catch (err) {
      failed.push(`${table}/${id} -> ${(err as Error).message}`)
    }
  }

  // Loud on purpose. A silent failure here is exactly how the pile built up
  // the first time, so a leak should be visible in the run output.
  if (failed.length) {
    console.warn(`[cleanup] ${failed.length} row(s) could not be removed:\n  ${failed.join('\n  ')}`)
  }
}

/**
 * A label no other run can produce.
 *
 * Cleanup alone is not enough to make a creating test honest. Asserting that a
 * fixed string like "PW Test Bread" is on screen passes as soon as *any* row
 * with that name exists — which is how allergens.spec.ts went months matching
 * a leftover from an earlier run instead of the row it had just submitted.
 * A unique label means the assertion can only be satisfied by this test's own
 * write, and it makes any row that does survive traceable to the run that
 * leaked it.
 */
export function uniq(label: string): string {
  return `${label} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export const test = base.extend<{ autoCleanup: void }>({
  autoCleanup: [async ({ page }, use) => {
    const created: Created[] = []
    await trackWrites(page, created)
    await use()
    await deleteCreated(page, created)
  }, { auto: true }],
})

export { expect }
