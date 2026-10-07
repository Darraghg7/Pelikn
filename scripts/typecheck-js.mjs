#!/usr/bin/env node
// Type-checks the app's .js/.jsx files against a per-file error baseline.
//
// tsconfig.json checks the .ts files strictly but skips JS (checkJs: false), and
// almost all of the UI is .jsx. This runs tsc over tsconfig.checkjs.json (JS on,
// lenient) and compares the error count in each file to typecheck-js-baseline.json:
//
//   - a file with MORE errors than its baseline fails (new problems), and so does
//     any file not in the baseline that has errors at all;
//   - a file with FEWER errors also fails, asking you to lock the improvement in
//     with `npm run typecheck:js -- --update`. That keeps the baseline a ratchet:
//     counts only ever go down.
//
// Usage:
//   node scripts/typecheck-js.mjs            check (CI runs this)
//   node scripts/typecheck-js.mjs --update   rewrite the baseline from the current errors

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const baselinePath = path.join(root, 'typecheck-js-baseline.json')
const update = process.argv.includes('--update')

const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc')
const run = spawnSync(process.execPath, [tsc, '--noEmit', '--pretty', 'false', '-p', 'tsconfig.checkjs.json'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
})
const output = `${run.stdout ?? ''}${run.stderr ?? ''}`

// One diagnostic per line in --pretty false mode: path(line,col): error TSxxxx: message
// Continuation lines (elaborations) are indented and belong to the line above.
const errorsByFile = new Map()
let parsed = 0
for (const line of output.split('\n')) {
  const m = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/.exec(line)
  if (!m) continue
  parsed++
  const file = m[1].replaceAll('\\', '/')
  if (!errorsByFile.has(file)) errorsByFile.set(file, [])
  errorsByFile.get(file).push(`${file}:${m[2]}:${m[3]} ${m[4]} ${m[5]}`)
}

// tsc exits non-zero whenever there are errors, so only treat a failure with no
// parseable diagnostics (bad config, crash) as fatal.
if (run.status !== 0 && parsed === 0) {
  console.error('typecheck:js — tsc failed without reporting type errors:\n')
  console.error(output || run.error?.message)
  process.exit(1)
}

const current = Object.fromEntries([...errorsByFile].map(([f, errs]) => [f, errs.length]).sort(([a], [b]) => a.localeCompare(b)))
const total = Object.values(current).reduce((a, b) => a + b, 0)

if (update) {
  writeFileSync(baselinePath, JSON.stringify(current, null, 2) + '\n')
  console.log(`typecheck:js — baseline written: ${total} errors in ${Object.keys(current).length} files.`)
  process.exit(0)
}

const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : {}
const worse = []
const better = []
for (const file of new Set([...Object.keys(baseline), ...Object.keys(current)])) {
  const was = baseline[file] ?? 0
  const now = current[file] ?? 0
  if (now > was) worse.push({ file, was, now })
  else if (now < was) better.push({ file, was, now })
}

if (worse.length) {
  console.error('typecheck:js — new type errors in JS/JSX files:\n')
  for (const { file, was, now } of worse) {
    console.error(`${file}: ${now} errors (baseline ${was})`)
    for (const e of errorsByFile.get(file) ?? []) console.error(`  ${e}`)
    console.error('')
  }
  console.error('Fix the new errors above. The baseline only goes down — see "Type checking" in README.md.')
}

if (better.length) {
  const out = worse.length ? console.error : console.log
  out(`typecheck:js — ${better.length} file(s) now have fewer errors than the baseline:`)
  for (const { file, was, now } of better) out(`  ${file}: ${was} → ${now}`)
  out('Lock the improvement in: npm run typecheck:js -- --update, and commit typecheck-js-baseline.json.')
}

if (worse.length || better.length) process.exit(1)

console.log(`typecheck:js — passed (${total} known errors in ${Object.keys(current).length} files, none new).`)
