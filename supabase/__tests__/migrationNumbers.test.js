import { readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Guards the numbering rules in supabase/migrations/README.md.
const dir = path.resolve(__dirname, '../migrations')
const files = readdirSync(dir).filter((f) => f.endsWith('.sql'))

const ROLLBACK = /^\d{3}[a-z]?_rollback\.sql$/
const FORWARD = /^(\d{3}[a-z]?)_[a-z0-9_]+\.sql$/

// Both files of each pair were applied before this check existed. Renaming them
// gains nothing (no tool tracks applied migrations by name), so they stay.
const KNOWN_DUPLICATES = {
  '085': ['085_hr_rls_and_private_documents.sql', '085_manager_session_revocation.sql'],
  '086': ['086_private_training_files.sql', '086_venue_group_code.sql'],
}

describe('supabase migrations', () => {
  it('names every file NNN_description.sql or NNN_rollback.sql', () => {
    const badNames = files.filter((f) => !ROLLBACK.test(f) && !FORWARD.test(f))
    expect(badNames).toEqual([])
  })

  it('never gives two forward migrations the same number', () => {
    const byNumber = {}
    for (const f of files) {
      if (ROLLBACK.test(f)) continue
      const m = FORWARD.exec(f)
      if (!m) continue
      ;(byNumber[m[1]] ??= []).push(f)
    }
    const duplicates = Object.fromEntries(
      Object.entries(byNumber).filter(([, names]) => names.length > 1),
    )
    // A failure here means a new migration reused a number: give it the next free one.
    expect(duplicates).toEqual(KNOWN_DUPLICATES)
  })
})
