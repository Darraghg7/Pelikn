#!/usr/bin/env node
// Counts hand-written <button> elements per file against raw-buttons-baseline.json.
//
// Buttons should be drawn with the shared <Button> (src/components/ui/Button.jsx)
// so they look and behave the same everywhere. ~680 raw <button>s predate it and
// are being moved over a screen at a time. This keeps the count a ratchet:
//
//   - a file with MORE raw buttons than its baseline fails, and so does a new
//     file that has any;
//   - a file with FEWER also fails, asking you to lock the improvement in with
//     `npm run lint:buttons -- --update`, so counts only ever go down.
//
// Some raw buttons are right as they are — whole-row tap targets, tabs and
// segmented controls, number pads, toggles. Those stay counted; the baseline
// just never forces them to zero. A file whose remaining raw buttons are all
// like that can carry the count indefinitely.
//
// Usage:
//   node scripts/raw-buttons.mjs            check (CI runs this via npm run lint)
//   node scripts/raw-buttons.mjs --update   rewrite the baseline from the current counts

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const baselinePath = path.join(root, 'raw-buttons-baseline.json')
const update = process.argv.includes('--update')

// The shared components that are allowed to render a raw <button>.
const ALLOWED = new Set(['src/components/ui/Button.jsx'])

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
for (const abs of walk(path.join(root, 'src'))) {
  const file = path.relative(root, abs).replaceAll('\\', '/')
  if (ALLOWED.has(file)) continue
  const n = (readFileSync(abs, 'utf8').match(/<button\b/g) ?? []).length
  if (n) current[file] = n
}
const sorted = Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)))
const total = Object.values(sorted).reduce((a, b) => a + b, 0)

if (update) {
  writeFileSync(baselinePath, JSON.stringify(sorted, null, 2) + '\n')
  console.log(`raw-buttons — baseline written: ${total} raw <button>s in ${Object.keys(sorted).length} files.`)
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
  console.error('raw-buttons — new hand-written <button>s:\n')
  for (const { file, was, now } of worse) console.error(`  ${file}: ${now} (baseline ${was})`)
  console.error('\nUse <Button> from src/components/ui/Button.jsx instead — see "Buttons" in README.md.')
}

if (better.length) {
  const out = worse.length ? console.error : console.log
  out(`raw-buttons — ${better.length} file(s) now have fewer raw <button>s than the baseline:`)
  for (const { file, was, now } of better) out(`  ${file}: ${was} → ${now}`)
  out('Lock the improvement in: npm run lint:buttons -- --update, and commit raw-buttons-baseline.json.')
}

if (worse.length || better.length) process.exit(1)

console.log(`raw-buttons — passed (${total} raw <button>s left in ${Object.keys(sorted).length} files, none new).`)
