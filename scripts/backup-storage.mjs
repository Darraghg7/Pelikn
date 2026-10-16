// Nightly backup of Supabase Storage (uploaded files) to Cloudflare R2, encrypted.
// Run by .github/workflows/storage-backup.yml. See docs/restore-procedure.md.
//
// How it works (plain terms):
//   1. List every file in every Supabase Storage bucket (via its S3-compatible endpoint).
//   2. Compare with last night's manifest; only new/changed files are copied.
//   3. Each file is encrypted (AES-256, openssl) BEFORE it is uploaded to R2.
//   4. A manifest (path, size, sha256 of every file) is encrypted and stored too.
//   5. Files deleted in the app stay in the backup 30 days, then are purged.
//   6. Verify R2 now matches the manifest; exit non-zero (red run) on any problem.
//
// Secrets come ONLY from environment variables (GitHub Actions secrets). They are
// never put on a command line and never printed. File paths can contain people's
// names, so they are never printed either — logs show counts only.
//
// Usage:  node scripts/backup-storage.mjs [--dry-run]

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync, rmSync, createReadStream, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  isSafeKey, r2KeyFor, diffObjects, checkSafety, buildManifest, expiredManifestKeys,
  verifyAgainstR2, R2_FILES_PREFIX, R2_MANIFEST_PREFIX, LATEST_MANIFEST_KEY,
} from './lib/storageBackup.mjs'

const dryRun = process.argv.includes('--dry-run')
const today = new Date().toISOString().slice(0, 10)
const R2_BUCKET = process.env.R2_BUCKET || 'pelikn-backups'

function need(name) {
  const v = (process.env[name] || '').trim()
  if (!v) fail(`Missing required environment variable ${name} (add it as a GitHub secret).`)
  return v
}
function fail(msg) {
  console.error(`::error::${msg}`)
  process.exit(1)
}

const supa = {
  endpoint: need('SUPABASE_S3_ENDPOINT'),
  env: {
    AWS_ACCESS_KEY_ID: need('SUPABASE_S3_ACCESS_KEY_ID'),
    AWS_SECRET_ACCESS_KEY: need('SUPABASE_S3_SECRET_ACCESS_KEY'),
    AWS_DEFAULT_REGION: need('SUPABASE_S3_REGION'),
  },
}
const r2 = {
  endpoint: `https://${need('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
  env: {
    AWS_ACCESS_KEY_ID: need('R2_ACCESS_KEY_ID'),
    AWS_SECRET_ACCESS_KEY: need('R2_SECRET_ACCESS_KEY'),
    AWS_DEFAULT_REGION: 'auto',
  },
}
need('STORAGE_BACKUP_PASSPHRASE') // used by openssl via env:, never as an argument

/** Run the aws CLI against one side. Errors are redacted: they may not leak object names. */
function aws(side, args, { step, secretText = [] } = {}) {
  try {
    return execFileSync('aws', [...args, '--endpoint-url', side.endpoint], {
      env: {
        ...process.env, ...side.env,
        // Neither Supabase's S3 nor R2 wants the newer default checksums.
        AWS_REQUEST_CHECKSUM_CALCULATION: 'when_required',
        AWS_RESPONSE_CHECKSUM_VALIDATION: 'when_required',
      },
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (err) {
    let detail = String(err.stderr || err.message || '').split('\n').find(Boolean) || 'unknown error'
    for (const s of secretText) detail = detail.split(s).join('<redacted>')
    throw new Error(`aws step failed (${step}): ${detail}`)
  }
}

function openssl(mode, input, output) {
  execFileSync('openssl', [
    'enc', ...(mode === 'dec' ? ['-d'] : []), '-aes-256-cbc', '-pbkdf2', '-iter', '100000',
    '-in', input, '-out', output, '-pass', 'env:STORAGE_BACKUP_PASSPHRASE',
  ], { stdio: ['ignore', 'ignore', 'ignore'] })
}

const sha256File = (file) => new Promise((resolve, reject) => {
  const h = createHash('sha256')
  createReadStream(file).on('data', (d) => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', reject)
})

const parseList = (out) => (out.trim() ? JSON.parse(out) : {})

function listSupabase() {
  const buckets = (parseList(aws(supa, ['s3api', 'list-buckets', '--output', 'json'], { step: 'list buckets' })).Buckets || [])
    .map((b) => b.Name)
  const objects = []
  for (const bucket of buckets) {
    const res = parseList(aws(supa, ['s3api', 'list-objects-v2', '--bucket', bucket, '--output', 'json'], { step: `list bucket ${bucket}` }))
    for (const o of res.Contents || []) {
      // Folder placeholder objects (Supabase keeps ".emptyFolderPlaceholder") are not user files.
      if (o.Key.endsWith('/') || o.Key.endsWith('.emptyFolderPlaceholder')) continue
      if (!isSafeKey(o.Key)) fail(`Bucket "${bucket}" has a file name this backup refuses to handle (unsafe path). Investigate before re-running.`)
      objects.push({ bucket, key: o.Key, size: o.Size, etag: o.ETag })
    }
  }
  return { buckets, objects }
}

function listR2(prefix) {
  const res = parseList(aws(r2, ['s3api', 'list-objects-v2', '--bucket', R2_BUCKET, '--prefix', prefix, '--output', 'json'], { step: `list R2 ${prefix}` }))
  return (res.Contents || []).map((o) => ({ key: o.Key, size: o.Size }))
}

function loadPreviousManifest(work) {
  const enc = path.join(work, 'prev.enc')
  const plain = path.join(work, 'prev.json')
  const exists = listR2(LATEST_MANIFEST_KEY).some((o) => o.key === LATEST_MANIFEST_KEY)
  if (!exists) return []
  aws(r2, ['s3api', 'get-object', '--bucket', R2_BUCKET, '--key', LATEST_MANIFEST_KEY, enc, '--output', 'json'], { step: 'download previous manifest' })
  try { openssl('dec', enc, plain) } catch { fail('Could not decrypt the previous manifest — wrong STORAGE_BACKUP_PASSPHRASE? Refusing to continue.') }
  return JSON.parse(readFileSync(plain, 'utf8')).entries
}

function putR2(file, key, step) {
  aws(r2, ['s3api', 'put-object', '--bucket', R2_BUCKET, '--key', key, '--body', file, '--output', 'json'], { step })
}

async function main() {
  const work = mkdtempSync(path.join(tmpdir(), 'storage-backup-'))
  try {
    const { buckets, objects } = listSupabase()
    console.log(`Supabase: ${buckets.length} buckets, ${objects.length} files, ${objects.reduce((s, o) => s + o.size, 0)} bytes`)

    const previous = loadPreviousManifest(work)
    const previousLive = previous.filter((e) => !e.deletedAt).length
    console.log(`Previous manifest: ${previous.length} entries (${previousLive} live)`)

    const safety = checkSafety({ currentCount: objects.length, previousLiveCount: previousLive })
    if (!safety.ok) fail(safety.reason)

    const diff = diffObjects(objects, previous, today)
    console.log(`To copy: ${diff.toCopy.length} | unchanged: ${diff.unchanged} | newly deleted in app: ${diff.newlyDeleted.length} | to purge from backup: ${diff.toPurge.length}`)

    if (dryRun) {
      console.log('DRY RUN: nothing was uploaded, changed or deleted.')
      return
    }

    // 1. Copy new/changed files: download -> hash -> encrypt -> upload (temp names are numbers, not file names).
    const copied = []
    let n = 0
    for (const o of diff.toCopy) {
      n += 1
      const plain = path.join(work, `${n}.bin`)
      const enc = path.join(work, `${n}.enc`)
      aws(supa, ['s3api', 'get-object', '--bucket', o.bucket, '--key', o.key, plain, '--output', 'json'], { step: `download file ${n}`, secretText: [o.key] })
      const size = statSync(plain).size
      if (size !== o.size) fail(`Downloaded file ${n} is ${size} bytes but the listing said ${o.size}. Aborting.`)
      const sha256 = await sha256File(plain)
      openssl('enc', plain, enc)
      putR2(enc, r2KeyFor(o.bucket, o.key), `upload file ${n}`)
      rmSync(plain); rmSync(enc)
      copied.push({ ...o, sha256, backedUpAt: today })
      if (n % 50 === 0) console.log(`  copied ${n}/${diff.toCopy.length}`)
    }

    // 2. Purge deleted-in-app files that are past the retention window.
    for (const e of diff.toPurge) {
      aws(r2, ['s3api', 'delete-object', '--bucket', R2_BUCKET, '--key', r2KeyFor(e.bucket, e.key)], { step: 'purge expired deleted file', secretText: [e.key] })
    }

    // 3. Write the new manifest (dated snapshot + "latest").
    const manifest = buildManifest([...diff.entries, ...copied], new Date().toISOString())
    const plainManifest = path.join(work, 'manifest.json')
    const encManifest = path.join(work, 'manifest.enc')
    writeFileSync(plainManifest, JSON.stringify(manifest))
    openssl('enc', plainManifest, encManifest)
    putR2(encManifest, `${R2_MANIFEST_PREFIX}manifest-${today}.json.enc`, 'upload dated manifest')
    putR2(encManifest, LATEST_MANIFEST_KEY, 'upload latest manifest')

    // 4. Drop dated manifests past retention.
    for (const key of expiredManifestKeys(listR2(R2_MANIFEST_PREFIX).map((o) => o.key), today)) {
      aws(r2, ['s3api', 'delete-object', '--bucket', R2_BUCKET, '--key', key], { step: 'delete old manifest' })
    }

    // 5. Verify R2 now matches the manifest exactly (every file present, exact encrypted size).
    const check = verifyAgainstR2(manifest.entries, listR2(R2_FILES_PREFIX))
    console.log(`Verify: ${check.missing.length} missing, ${check.wrongSize.length} wrong size, ${check.orphans.length} stray copies in R2`)
    if (check.missing.length || check.wrongSize.length) fail('Backup verification failed: R2 does not match the manifest.')
    if (check.orphans.length) console.log(`::warning::${check.orphans.length} file(s) in R2 are not in the manifest (harmless, but worth a look).`)

    console.log(`OK: ${manifest.totals.liveFiles} live files (${manifest.totals.liveBytes} bytes) backed up; ${manifest.totals.deletedKept} deleted-in-app file(s) still held for ${30} days.`)
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

main().catch((err) => fail(err.message))
