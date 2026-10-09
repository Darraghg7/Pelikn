#!/usr/bin/env node
// Counts hard-coded colours (#hex, rgb(), rgba(), hsl(), hsla()) per file in
// src/ against hard-coded-colours-baseline.json.
//
// Colours belong in src/lib/tokens.js, which also feeds tailwind.config.js, so
// a brand tweak is a one-line change and every screen gets a dark-mode pair.
// Use a token class (`text-bad dark:text-badDark`), or import from tokens.js
// when the colour has to be a JS value. This keeps the count a ratchet:
//
//   - a file with MORE hard-coded colours than its baseline fails, and so does
//     a new file that has any;
//   - a file with FEWER also fails, asking you to lock the improvement in with
//     `npm run lint:colours -- --update`, so counts only ever go down.
//
// Comment lines are ignored. Usage:
//   node scripts/hard-coded-colours.mjs            check (CI runs this via npm run lint)
//   node scripts/hard-coded-colours.mjs --update   rewrite the baseline from the current counts

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const baselinePath = path.join(root, 'hard-coded-colours-baseline.json')
const update = process.argv.includes('--update')

// The token file is the one place colours may be written out.
const ALLOWED = new Set(['src/lib/tokens.js'])

// #abc #abcd #aabbcc #aabbccdd not followed by more word characters (so ids
// like #bowlCut and HTML entities don't count), and colour functions.
const COLOUR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])|\b(?:rgba?|hsla?)\(/g

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === '__tests__' || name === '__dev__' || name === 'assets') continue
      walk(p, out)
    } else if (/\.(jsx|tsx|js|ts|css)$/.test(name) && !/\.(test|spec)\./.test(name)) {
      out.push(p)
    }
  }
  return out
}

function count(text) {
  let n = 0
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue
    n += (line.match(COLOUR) ?? []).length
  }
  return n
}

const current = {}
for (const abs of walk(path.join(root, 'src'))) {
  const file = path.relative(root, abs).replaceAll('\\', '/')
  if (ALLOWED.has(file)) continue
  const n = count(readFileSync(abs, 'utf8'))
  if (n) current[file] = n
}
const sorted = Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)))
const total = Object.values(sorted).reduce((a, b) => a + b, 0)

if (update) {
  writeFileSync(baselinePath, JSON.stringify(sorted, null, 2) + '\n')
  console.log(`hard-coded-colours — baseline written: ${total} in ${Object.keys(sorted).length} files.`)
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
  console.error('hard-coded-colours — new hard-coded colours:\n')
  for (const { file, was, now } of worse) console.error(`  ${file}: ${now} (baseline ${was})`)
  console.error('\nUse a token from src/lib/tokens.js instead — see "Colours" in README.md.')
}

if (better.length) {
  const out = worse.length ? console.error : console.log
  out(`hard-coded-colours — ${better.length} file(s) now have fewer hard-coded colours than the baseline:`)
  for (const { file, was, now } of better) out(`  ${file}: ${was} → ${now}`)
  out('Lock the improvement in: npm run lint:colours -- --update, and commit hard-coded-colours-baseline.json.')
}

if (worse.length || better.length) process.exit(1)

console.log(`hard-coded-colours — passed (${total} left in ${Object.keys(sorted).length} files, none new).`)
