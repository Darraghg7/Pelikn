#!/usr/bin/env node
// Counts one-off text sizes (text-[13px], text-[0.8rem], sm:text-[15px] …) per
// file in src/ against one-off-text-sizes-baseline.json.
//
// Text sizes come from the type scale in src/lib/tokens.js: text-micro,
// text-caption, text-body-sm, text-body, text-body-lg, text-title-sm,
// text-title, text-display and text-stat. This keeps the count a ratchet:
//
//   - a file with MORE one-off sizes than its baseline fails, and so does a
//     new file that has any;
//   - a file with FEWER also fails, asking you to lock the improvement in with
//     `npm run lint:type -- --update`, so counts only ever go down.
//
// The dense views below may use sizes under 11px (the rota week grid, the
// Gantt chart, and the shrunken app pictures on the marketing page). Those
// tiny sizes aren't counted; anything 11px or bigger in them still is.
//
// Comment lines are ignored. Usage:
//   node scripts/one-off-text-sizes.mjs            check (CI runs this via npm run lint)
//   node scripts/one-off-text-sizes.mjs --update   rewrite the baseline from the current counts

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const baselinePath = path.join(root, 'one-off-text-sizes-baseline.json')
const update = process.argv.includes('--update')

const DENSE = new Set([
  'src/pages/rota/RotaWeekView.jsx',
  'src/pages/rota/RotaMobileGrid.jsx',
  'src/pages/rota/GanttChart.jsx',
  'src/pages/marketing/MarketingPage.jsx',
  'src/pages/marketing/DesktopDashboardMock.jsx',
])

const SIZE = /\btext-\[(\d*\.?\d+)(px|rem|em)\]/g

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === '__tests__' || name === '__dev__' || name === 'assets') continue
      walk(p, out)
    } else if (/\.(jsx|tsx|js|ts)$/.test(name) && !/\.(test|spec)\./.test(name)) {
      out.push(p)
    }
  }
  return out
}

function count(text, dense) {
  let n = 0
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue
    for (const [, num, unit] of line.matchAll(SIZE)) {
      const px = unit === 'px' ? Number(num) : Number(num) * 16
      if (dense && px < 11) continue
      n++
    }
  }
  return n
}

const current = {}
for (const abs of walk(path.join(root, 'src'))) {
  const file = path.relative(root, abs).replaceAll('\\', '/')
  const n = count(readFileSync(abs, 'utf8'), DENSE.has(file))
  if (n) current[file] = n
}
const sorted = Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)))
const total = Object.values(sorted).reduce((a, b) => a + b, 0)

if (update) {
  writeFileSync(baselinePath, JSON.stringify(sorted, null, 2) + '\n')
  console.log(`one-off-text-sizes — baseline written: ${total} in ${Object.keys(sorted).length} files.`)
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
  console.error('one-off-text-sizes — new one-off text sizes:\n')
  for (const { file, was, now } of worse) console.error(`  ${file}: ${now} (baseline ${was})`)
  console.error('\nUse a step from the type scale (text-micro … text-stat) instead — see "Type" in README.md.')
}

if (better.length) {
  const out = worse.length ? console.error : console.log
  out(`one-off-text-sizes — ${better.length} file(s) now have fewer one-off text sizes than the baseline:`)
  for (const { file, was, now } of better) out(`  ${file}: ${was} → ${now}`)
  out('Lock the improvement in: npm run lint:type -- --update, and commit one-off-text-sizes-baseline.json.')
}

if (worse.length || better.length) process.exit(1)

console.log(`one-off-text-sizes — passed (${total} left in ${Object.keys(sorted).length} files, none new).`)
