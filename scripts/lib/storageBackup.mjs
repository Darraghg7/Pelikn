// Pure helpers for scripts/backup-storage.mjs — no network, no disk, no secrets.
// Kept separate so they can be unit tested (src/lib/__tests__/storageBackup.test.js).

export const DELETED_RETENTION_DAYS = 30   // deleted-in-app files stay in the backup this long
export const MANIFEST_RETENTION_DAYS = 90  // dated manifests (the "snapshots") kept this long
export const MAX_DROP_FRACTION = 0.2       // refuse to run if >20% of files vanished overnight
export const MIN_DROP_COUNT = 3            // ...and at least this many (tiny buckets move in big %)

export const R2_FILES_PREFIX = 'storage/files/'
export const R2_MANIFEST_PREFIX = 'storage/manifests/'
export const LATEST_MANIFEST_KEY = `${R2_MANIFEST_PREFIX}manifest-latest.json.enc`

/** Identity of an object across runs. */
export const idOf = (bucket, key) => `${bucket}\u0000${key}`

/** Reject keys that could escape a prefix or confuse tools. Names are otherwise free-form. */
export function isSafeKey(key) {
  if (typeof key !== 'string' || key.length === 0 || key.length > 1024) return false
  if (key.startsWith('/') || key.endsWith('/')) return false
  if (key.includes('\u0000') || key.includes('\\')) return false
  return !key.split('/').some((seg) => seg === '..' || seg === '.' || seg === '')
}

/** Where an object's encrypted copy lives in R2. */
export const r2KeyFor = (bucket, key) => `${R2_FILES_PREFIX}${bucket}/${key}.enc`

/**
 * Size of `openssl enc -aes-256-cbc -pbkdf2` output for a plaintext of n bytes:
 * 16-byte "Salted__" header + PKCS7-padded ciphertext. Lets us verify R2 sizes exactly.
 */
export const expectedEncryptedSize = (n) => 16 + (Math.floor(n / 16) + 1) * 16

const dayNumber = (iso) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000)
export const daysBetween = (fromIso, toIso) => dayNumber(toIso) - dayNumber(fromIso)

const clean = (etag) => String(etag ?? '').replace(/"/g, '')

/**
 * Compare what Supabase has now against last night's manifest.
 * @param current  [{bucket,key,size,etag}] from the live listing
 * @param previous manifest entries ([] on first run); entries with `deletedAt` are tombstones
 * @returns {{toCopy: object[], entries: object[], newlyDeleted: object[], toPurge: object[], unchanged: number}}
 *   entries = surviving manifest entries for everything NOT being (re)copied
 */
export function diffObjects(current, previous, today, retentionDays = DELETED_RETENTION_DAYS) {
  const prev = new Map(previous.map((e) => [idOf(e.bucket, e.key), e]))
  const seen = new Set()
  const toCopy = []
  const entries = []
  let unchanged = 0

  for (const obj of current) {
    const id = idOf(obj.bucket, obj.key)
    seen.add(id)
    const old = prev.get(id)
    const same = old && !old.deletedAt && old.size === obj.size && clean(old.etag) === clean(obj.etag)
    if (same) { entries.push(old); unchanged += 1 } else toCopy.push(obj)
  }

  const newlyDeleted = []
  const toPurge = []
  for (const old of previous) {
    if (seen.has(idOf(old.bucket, old.key))) continue
    if (!old.deletedAt) {
      const tomb = { ...old, deletedAt: today }
      newlyDeleted.push(tomb)
      entries.push(tomb)
    } else if (daysBetween(old.deletedAt, today) >= retentionDays) {
      toPurge.push(old)
    } else {
      entries.push(old)
    }
  }
  return { toCopy, entries, newlyDeleted, toPurge, unchanged }
}

/**
 * "Backup must not be empty" guard. Run BEFORE copying/purging anything.
 * @returns {{ok: boolean, reason?: string}}
 */
export function checkSafety({ currentCount, previousLiveCount }) {
  if (currentCount === 0) {
    return { ok: false, reason: 'Supabase listing returned 0 files — refusing to continue (would look like everything was deleted).' }
  }
  const dropped = previousLiveCount - currentCount
  if (dropped >= MIN_DROP_COUNT && dropped / previousLiveCount > MAX_DROP_FRACTION) {
    return { ok: false, reason: `File count fell from ${previousLiveCount} to ${currentCount} overnight (more than ${MAX_DROP_FRACTION * 100}%). Check in the app that this is expected before re-running.` }
  }
  return { ok: true }
}

/** Deterministic manifest document. Entries sorted so diffs between nights are readable. */
export function buildManifest(entries, generatedAt) {
  const sorted = [...entries].sort((a, b) => idOf(a.bucket, a.key).localeCompare(idOf(b.bucket, b.key)))
  const live = sorted.filter((e) => !e.deletedAt)
  return {
    version: 1,
    generatedAt,
    totals: {
      liveFiles: live.length,
      liveBytes: live.reduce((s, e) => s + e.size, 0),
      deletedKept: sorted.length - live.length,
    },
    entries: sorted,
  }
}

/** Which dated manifests (manifest-YYYY-MM-DD.json.enc) are past retention. */
export function expiredManifestKeys(keys, today, retentionDays = MANIFEST_RETENTION_DAYS) {
  const re = /manifest-(\d{4}-\d{2}-\d{2})\.json\.enc$/
  return keys.filter((k) => {
    const m = re.exec(k)
    return m && daysBetween(m[1], today) > retentionDays
  })
}

/**
 * Compare R2's file listing with the manifest.
 * @param r2Objects [{key,size}] under storage/files/
 * @returns {{missing: object[], wrongSize: object[], orphans: object[]}}
 */
export function verifyAgainstR2(entries, r2Objects) {
  const have = new Map(r2Objects.map((o) => [o.key, o.size]))
  const expected = new Set()
  const missing = []
  const wrongSize = []
  for (const e of entries) {
    const k = r2KeyFor(e.bucket, e.key)
    expected.add(k)
    if (!have.has(k)) missing.push(e)
    else if (have.get(k) !== expectedEncryptedSize(e.size)) wrongSize.push(e)
  }
  const orphans = r2Objects.filter((o) => !expected.has(o.key))
  return { missing, wrongSize, orphans }
}
