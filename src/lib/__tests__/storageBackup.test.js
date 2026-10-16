import { describe, it, expect } from 'vitest'
import {
  isSafeKey, r2KeyFor, expectedEncryptedSize, diffObjects, checkSafety,
  buildManifest, expiredManifestKeys, verifyAgainstR2, daysBetween,
} from '../../../scripts/lib/storageBackup.mjs'

const obj = (key, size = 10, etag = 'a', bucket = 'b') => ({ bucket, key, size, etag })

describe('isSafeKey', () => {
  it('accepts normal nested keys with spaces', () => {
    expect(isSafeKey('venue/staff/My contract.pdf')).toBe(true)
  })
  it.each(['', '/abs', 'a/../b', 'a//b', 'a/', './x', 'a\\b', 'a\u0000b'])('rejects %j', (k) => {
    expect(isSafeKey(k)).toBe(false)
  })
})

describe('r2KeyFor / expectedEncryptedSize', () => {
  it('prefixes bucket and appends .enc', () => {
    expect(r2KeyFor('hr-documents', 'v/s/a.pdf')).toBe('storage/files/hr-documents/v/s/a.pdf.enc')
  })
  it('matches openssl salted AES-CBC sizing', () => {
    expect(expectedEncryptedSize(0)).toBe(32)
    expect(expectedEncryptedSize(15)).toBe(32)
    expect(expectedEncryptedSize(16)).toBe(48)
    expect(expectedEncryptedSize(14)).toBe(32)
  })
})

describe('diffObjects', () => {
  const today = '2026-10-16'
  it('copies everything on first run', () => {
    const d = diffObjects([obj('x'), obj('y')], [], today)
    expect(d.toCopy).toHaveLength(2)
    expect(d.entries).toHaveLength(0)
  })
  it('skips unchanged and ignores etag quotes', () => {
    const prev = [{ ...obj('x', 10, 'a'), sha256: 'h' }]
    const d = diffObjects([obj('x', 10, '"a"')], prev, today)
    expect(d.toCopy).toHaveLength(0)
    expect(d.unchanged).toBe(1)
    expect(d.entries[0].sha256).toBe('h')
  })
  it('re-copies when etag or size changes', () => {
    const prev = [obj('x', 10, 'a')]
    expect(diffObjects([obj('x', 10, 'b')], prev, today).toCopy).toHaveLength(1)
    expect(diffObjects([obj('x', 11, 'a')], prev, today).toCopy).toHaveLength(1)
  })
  it('turns a vanished file into a tombstone, not a purge', () => {
    const d = diffObjects([], [obj('x')], today)
    expect(d.newlyDeleted[0].deletedAt).toBe(today)
    expect(d.toPurge).toHaveLength(0)
    expect(d.entries).toHaveLength(1)
  })
  it('keeps a tombstone inside the window and purges it after', () => {
    const tomb = { ...obj('x'), deletedAt: '2026-09-20' } // 26 days
    expect(diffObjects([], [tomb], today).toPurge).toHaveLength(0)
    const old = { ...obj('x'), deletedAt: '2026-09-16' }  // 30 days
    const d = diffObjects([], [old], today)
    expect(d.toPurge).toHaveLength(1)
    expect(d.entries).toHaveLength(0)
  })
  it('treats a re-uploaded deleted file as new', () => {
    const tomb = { ...obj('x'), deletedAt: '2026-10-10' }
    const d = diffObjects([obj('x')], [tomb], today)
    expect(d.toCopy).toHaveLength(1)
    expect(d.toPurge).toHaveLength(0)
  })
  it('keeps same key in different buckets apart', () => {
    const d = diffObjects([obj('x', 1, 'a', 'one'), obj('x', 1, 'a', 'two')], [obj('x', 1, 'a', 'one')], today)
    expect(d.toCopy).toHaveLength(1)
    expect(d.toCopy[0].bucket).toBe('two')
  })
})

describe('checkSafety', () => {
  it('fails on an empty listing', () => {
    expect(checkSafety({ currentCount: 0, previousLiveCount: 0 }).ok).toBe(false)
  })
  it('fails on a big overnight drop', () => {
    expect(checkSafety({ currentCount: 50, previousLiveCount: 100 }).ok).toBe(false)
  })
  it('allows a normal small drop and tiny-bucket deletes', () => {
    expect(checkSafety({ currentCount: 95, previousLiveCount: 100 }).ok).toBe(true)
    expect(checkSafety({ currentCount: 8, previousLiveCount: 9 }).ok).toBe(true)
    expect(checkSafety({ currentCount: 5, previousLiveCount: 8 }).ok).toBe(false)
  })
  it('allows growth and first run', () => {
    expect(checkSafety({ currentCount: 9, previousLiveCount: 0 }).ok).toBe(true)
  })
})

describe('buildManifest', () => {
  it('sorts deterministically and totals live files only', () => {
    const m = buildManifest([obj('b', 5), { ...obj('a', 7), deletedAt: '2026-10-01' }, obj('a2', 3)], 'now')
    expect(m.entries.map((e) => e.key)).toEqual(['a', 'a2', 'b'])
    expect(m.totals).toEqual({ liveFiles: 2, liveBytes: 8, deletedKept: 1 })
  })
})

describe('expiredManifestKeys', () => {
  it('returns dated manifests older than retention, never "latest"', () => {
    const keys = [
      'storage/manifests/manifest-2026-07-01.json.enc',
      'storage/manifests/manifest-2026-09-01.json.enc',
      'storage/manifests/manifest-latest.json.enc',
    ]
    expect(expiredManifestKeys(keys, '2026-10-16')).toEqual([keys[0]])
  })
})

describe('verifyAgainstR2', () => {
  const e = obj('x', 10)
  const good = { key: r2KeyFor('b', 'x'), size: expectedEncryptedSize(10) }
  it('passes when sizes line up', () => {
    const r = verifyAgainstR2([e], [good])
    expect(r.missing).toHaveLength(0)
    expect(r.wrongSize).toHaveLength(0)
    expect(r.orphans).toHaveLength(0)
  })
  it('reports missing, wrong size and orphans', () => {
    expect(verifyAgainstR2([e], []).missing).toHaveLength(1)
    expect(verifyAgainstR2([e], [{ ...good, size: 1 }]).wrongSize).toHaveLength(1)
    expect(verifyAgainstR2([], [good]).orphans).toHaveLength(1)
  })
})

describe('daysBetween', () => {
  it('counts calendar days', () => {
    expect(daysBetween('2026-10-01', '2026-10-16')).toBe(15)
  })
})
