#!/usr/bin/env node
// Counts direct database calls (`supabase.from(...)` / `supabase.rpc(...)`) per file in
// src/pages and src/components against raw-queries-baseline.json.
//
// Screens should read and write through src/lib/api/* functions and the React Query
// hooks in src/hooks/*, so every screen shares one cache, errors are reported in one
// place, and it is easy to see what each screen touches. Older screens still call the
// database directly and are being moved over a few at a time. This keeps the count a ratchet:
//
//   - a file with MORE direct calls than its baseline fails, and so does a new file
//     that has any;
//   - a file with FEWER also fails, asking you to lock the improvement in with
//     `npm run lint:queries -- --update`, so counts only ever go down.
//
// Some calls can stay (sign-in and sign-up before a venue exists, the public allergen
// page). Those stay counted; the baseline just never forces them to zero.
//
// Usage:
//   node scripts/raw-queries.mjs            check (CI runs this via npm run lint)
//   node scripts/raw-queries.mjs --update   rewrite the baseline from the current counts

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const baselinePath = path.join(root, 'raw-queries-baseline.json')
const update = process.argv.includes('--update')

const ROOTS = ['src/pages', 'src/components']

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === '__tests__' || name === '__dev__') continue
      walk(p, out)
    } else if (/\.(jsx|tsx|js|ts)$/.test(name) && !/\.(test|spec)\./.test(name)) {
      out.push(p)
    }
  }
  return out
}

const current = {}
for (const abs of ROOTS.flatMap((r) => walk(path.join(root, r)))) {
  const file = path.relative(root, abs).replaceAll('\\', '/')
  const n = (readFileSync(abs, 'utf8').match(/\bsupabase\s*\.\s*(from|rpc)\s*\(/g) ?? []).length
  if (n) current[file] = n
}
const sorted = Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)))
const total = Object.values(sorted).reduce((a, b) => a + b, 0)

if (update) {
  writeFileSync(baselinePath, JSON.stringify(sorted, null, 2) + '\n')
  console.log(`raw-queries — baseline written: ${total} direct calls in ${Object.keys(sorted).length} files.`)
  process.exit(0)
}

const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : {}
const worse = []
const better = []
for (const file of new Set([...Object.keys(baseline), ...Object.keys(sorted)])) {
  const was = baseline[file] ?? 0
  const now = sorted[file] ?? 0
  if (now > was) worse.push({ file, was, now })
  else if (now < was) better.push({ file, was, now })
}

if (worse.length) {
  console.error('raw-queries — new direct database calls in screens:\n')
  for (const { file, was, now } of worse) console.error(`  ${file}: ${now} (baseline ${was})`)
  console.error('\nAdd a function in src/lib/api/<domain>.ts and a hook in src/hooks/ instead — see "Data fetching" in README.md.')
}

if (better.length) {
  const out = worse.length ? console.error : console.log
  out(`raw-queries — ${better.length} file(s) now have fewer direct calls than the baseline:`)
  for (const { file, was, now } of better) out(`  ${file}: ${was} → ${now}`)
  out('Lock the improvement in: npm run lint:queries -- --update, and commit raw-queries-baseline.json.')
}

if (worse.length || better.length) process.exit(1)

console.log(`raw-queries — passed (${total} direct calls left in ${Object.keys(sorted).length} files, none new).`)
