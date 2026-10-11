#!/usr/bin/env node
// Counts corner radii that are not on the radius scale, per file in src/,
// against one-off-radii-baseline.json.
//
// The scale lives in src/lib/tokens.js (`radius`) and Tailwind exposes it as
// rounded-tag (6px), rounded-control (12px), rounded-card (16px) and
// rounded-sheet (24px), plus rounded-full and rounded-none. In inline styles
// use `radius.card` etc. What counts as off-scale:
//
//   - Tailwind's own sizes (rounded, rounded-sm … rounded-3xl) and arbitrary
//     ones (rounded-[14px]), including the per-side forms (rounded-t-xl);
//   - a literal number or px string in an inline `borderRadius`.
//     '50%', 999 and 0 are fine (circles, pills, square corners).
//
// A ratchet, like lint:type: a file with MORE than its baseline fails, and so
// does a new file that has any; a file with FEWER also fails, asking you to
// lock the improvement in with `npm run lint:radius -- --update`.
//
// The two marketing files draw phone frames and hardware buttons with their
// own measurements, so they are not counted. Comment lines are ignored. Usage:
//   node scripts/one-off-radii.mjs            check (CI runs this via npm run lint)
//   node scripts/one-off-radii.mjs --update   rewrite the baseline from the current counts

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const baselinePath = path.join(root, 'one-off-radii-baseline.json')
const update = process.argv.includes('--update')

const EXEMPT = new Set([
  'src/pages/marketing/MarketingPage.jsx',
  'src/pages/marketing/DesktopDashboardMock.jsx',
])

const CLASS = /(?<![\w{-])rounded(?:-(?:t|b|l|r|tl|tr|bl|br))?(?:-(?:sm|md|lg|xl|2xl|3xl|\[[^\]]+\]))?(?![\w\[=.-])/g
const BARE_OK = /(?<![\w-])rounded(?:-(?:t|b|l|r|tl|tr|bl|br))?(?:-(?:tag|control|card|sheet|full|none))(?![\w-])/
const INLINE = /borderRadius\s*:\s*(?!\s|radius\.|`[^`]*\$\{radius|'50%'|999\b|0\b|[a-zA-Z_(])/g

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

function count(text) {
  let n = 0
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue
    for (const m of line.matchAll(CLASS)) {
      // a bare "rounded" only counts inside a class string, not prose or a variable name
      if (m[0] === 'rounded' && (/\brounded\s*=/.test(line) || !/["'`][^"'`]*\b(?:bg|border|flex|inline|px?|py|w|h|text|overflow|shrink|items|gap)-?[\w:[]*[^"'`]*\brounded\b|["'`][^"'`]*\brounded\b[^"'`]*\b(?:bg|border|flex|px?|py|w|h|text|overflow|shrink|items|gap)-/.test(line))) continue
      n++
    }
    n += [...line.matchAll(INLINE)].length
  }
  return n
}

const current = {}
for (const abs of walk(path.join(root, 'src'))) {
  const file = path.relative(root, abs).replaceAll('\\', '/')
  const n = EXEMPT.has(file) ? 0 : count(readFileSync(abs, 'utf8'))
  if (n) current[file] = n
}
const sorted = Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)))
const total = Object.values(sorted).reduce((a, b) => a + b, 0)

if (update) {
  writeFileSync(baselinePath, JSON.stringify(sorted, null, 2) + '\n')
  console.log(`one-off-radii — baseline written: ${total} in ${Object.keys(sorted).length} files.`)
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
  console.error('one-off-radii — new off-scale corner radii:\n')
  for (const { file, was, now } of worse) console.error(`  ${file}: ${now} (baseline ${was})`)
  console.error('\nUse a step from the radius scale (rounded-tag, rounded-control, rounded-card, rounded-sheet, rounded-full) instead — see "Radius" in README.md.')
}

if (better.length) {
  const out = worse.length ? console.error : console.log
  out(`one-off-radii — ${better.length} file(s) now have fewer off-scale radii than the baseline:`)
  for (const { file, was, now } of better) out(`  ${file}: ${was} → ${now}`)
  out('Lock the improvement in: npm run lint:type -- --update, and commit one-off-radii-baseline.json.')
}

if (worse.length || better.length) process.exit(1)

console.log(`one-off-radii — passed (${total} left in ${Object.keys(sorted).length} files, none new).`)
