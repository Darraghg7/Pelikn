#!/usr/bin/env node
// Counts interactive elements with no accessible name (icon-only buttons and
// links, <img> without alt, unlabelled form fields) per file against
// unnamed-controls-baseline.json. The rule itself is eslint-rules/accessible-name.js.
//
// Same ratchet as the other lint:* checks: a file with MORE violations than its
// baseline fails; fewer also fails until you lock it in with `--update`. The aim
// is an empty baseline — new code should never add to it.
//
//   node scripts/unnamed-controls.mjs            check (npm run lint runs this)
//   node scripts/unnamed-controls.mjs --update   rewrite the baseline

import { ESLint } from 'eslint'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tsParser from '@typescript-eslint/parser'
import rule from '../eslint-rules/accessible-name.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const baselinePath = path.join(root, 'unnamed-controls-baseline.json')
const update = process.argv.includes('--update')
const verbose = process.argv.includes('--list')

const eslint = new ESLint({
  cwd: root,
  overrideConfigFile: true,
  overrideConfig: [{
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    ignores: ['src/**/__tests__/**', 'src/**/*.test.*', 'src/**/__dev__/**'],
    languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { local: { rules: { 'accessible-name': rule } } },
    rules: { 'local/accessible-name': 'error' },
    linterOptions: { reportUnusedDisableDirectives: false },
  }],
})

const results = await eslint.lintFiles(['src'])
const current = {}
const details = []
for (const r of results) {
  const msgs = r.messages.filter((m) => m.ruleId === 'local/accessible-name')
  if (!msgs.length) continue
  const file = path.relative(root, r.filePath).replaceAll('\\', '/')
  current[file] = msgs.length
  for (const m of msgs) details.push(`${file}:${m.line}  ${m.message}`)
}
const sorted = Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)))
const total = Object.values(sorted).reduce((a, b) => a + b, 0)
if (verbose) console.log(details.join('\n'))

if (update) {
  writeFileSync(baselinePath, JSON.stringify(sorted, null, 2) + '\n')
  console.log(`unnamed-controls — baseline written: ${total} in ${Object.keys(sorted).length} files.`)
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
  console.error('unnamed-controls — controls with no accessible name:\n')
  for (const { file, was, now } of worse) {
    console.error(`  ${file}: ${now} (baseline ${was})`)
    for (const d of details.filter((x) => x.startsWith(file + ':'))) console.error(`    ${d.slice(file.length + 1)}`)
  }
  console.error('\nGive each an aria-label (or aria-hidden on a decorative icon) — see "Accessibility" in README.md.')
}
if (better.length) {
  const out = worse.length ? console.error : console.log
  out(`unnamed-controls — ${better.length} file(s) now have fewer than the baseline:`)
  for (const { file, was, now } of better) out(`  ${file}: ${was} → ${now}`)
  out('Lock the improvement in: npm run lint:a11y -- --update, and commit unnamed-controls-baseline.json.')
}
if (worse.length || better.length) process.exit(1)
console.log(`unnamed-controls — passed (${total} left in ${Object.keys(sorted).length} files, none new).`)
