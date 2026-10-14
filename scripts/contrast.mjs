#!/usr/bin/env node
// Colour contrast check (WCAG 2.1 AA). Dependency-free.
//
// What it measures:
//   1. Every text colour token on the surfaces it is used on (light and dark).
//   2. Every `text-<colour>/NN` opacity class found in src/, as it will actually
//      render once tailwind.config.js has applied the readable-text floor from
//      tokens.js (`textAlphaFloor`), on the worst surface for that mode.
//
// AA wants 4.5:1 for normal text. Anything below that has to be in
// KNOWN_EXCEPTIONS below with a reason, or the check fails (and so does CI).
//
//   node scripts/contrast.mjs            check (npm run lint:contrast, part of npm run lint)
//   node scripts/contrast.mjs --report   print the full tables, passing rows too
//   node scripts/contrast.mjs --raw      ignore the floor: how src/ would look
//                                        if the classes were taken at face value

import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { colors, textAlphaFloor, effectiveTextAlpha } from '../src/lib/tokens.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const report = process.argv.includes('--report')
const raw = process.argv.includes('--raw')
const AA = 4.5

// ── Colour maths ────────────────────────────────────────────────────────
const parse = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
const blend = (fg, bg, a) => fg.map((v, i) => v * a + bg[i] * (1 - a))
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const rgbOf = name => {
  const v = name.split('.').reduce((o, k) => o?.[k], colors)
  const s = typeof v === 'string' ? v : v?.DEFAULT
  return s ? parse(s) : null
}

// ── Surfaces text sits on ───────────────────────────────────────────────
// Light mode: white cards, the page background, the cream input fill, brand and
// status tints. Dark mode: card, page, and a card with a white/8 hover overlay.
const dark = hex => parse(hex)
const overlay = (base, a) => blend([255, 255, 255], parse(base), a)
const LIGHT = {
  paper: parse(colors.paper), bg: parse(colors.bg), cream: parse(colors.cream), 'brand.tint': parse(colors.brand.tint),
}
// Coloured text sits on white or on its own tint.
const OWN_TINT = {
  accent: 'accentBg', danger: 'badBg', bad: 'badBg', warning: 'warnBg', warn: 'warnBg',
  success: 'goodBg', good: 'goodBg', brand: 'brand.tint',
}
const DARK = {
  paperDark: dark(colors.paperDark), bgDark: dark(colors.bgDark),
  'paperDark+white/5': overlay(colors.paperDark, 0.05),
}
// Text on the dark-green cards and sidebar (any mode).
const ON_BRAND = {
  brand: parse(colors.brand.DEFAULT), 'sidebar.panel': parse(colors.sidebar.panel),
}

// Which colour a class name means, and which family of surfaces it sits on.
// `dark:` classes sit on DARK surfaces; plain `text-white` and `text-cream`
// are only ever used on dark-green surfaces; everything else on LIGHT.
const FG = {
  charcoal: 'charcoal', white: 'paper', cream: 'cream', brand: 'brand.DEFAULT', accent: 'accent',
  danger: 'danger.DEFAULT', warning: 'warning.DEFAULT', success: 'success.DEFAULT',
  bad: 'bad', warn: 'warn', good: 'good', ink: 'ink', ink2: 'ink2', ink3: 'ink3', ink4: 'ink4',
  accentDark: 'accentDark', badDark: 'badDark', warnDark: 'warnDark', goodDark: 'goodDark', infoDark: 'infoDark',
}

// ── Approved exceptions ─────────────────────────────────────────────────
// key = "<class> on <surface>" as printed in the table. Add only with a reason.
const KNOWN_EXCEPTIONS = {
  // (none yet)
}

// ── Collect usage from src/ ─────────────────────────────────────────────
function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f)
    if (statSync(p).isDirectory()) { if (f !== '__tests__') walk(p, out) } else if (/\.(jsx?|tsx?)$/.test(f) && !/\.test\./.test(f)) out.push(p)
  }
  return out
}
const classRe = /((?:[a-zA-Z-]+:)*)text-(charcoal|white|cream|brand|accent|danger|warning|success|ink[234]?|bad|warn|good|badDark|warnDark|goodDark|infoDark|accentDark)(?:\/(\d+))?(?![\w-])/g
const usage = new Map() // "key" -> {count, mode, name, alpha}
for (const file of walk(path.join(root, 'src'))) {
  const text = readFileSync(file, 'utf8')
  for (const m of text.matchAll(classRe)) {
    const variants = m[1]
    if (/(^|:)disabled:|idle-disabled:/.test(variants)) continue // inactive controls are exempt from WCAG
    const name = m[2]
    // dark:text-charcoal / dark:text-ink are dark text on a white chip (dark:bg-white), not on the dark surface.
    if (/(^|:)dark:/.test(variants) && !m[3] && (name === 'charcoal' || name === 'ink')) continue
    const a = m[3] ? Number(m[3]) / 100 : 1
    const mode = /(^|:)dark:/.test(variants) ? 'dark' : (name === 'white' || name === 'cream') ? 'onBrand' : 'light'
    const k = `${mode}|${name}|${a}`
    usage.set(k, { ...(usage.get(k) || { count: 0 }), count: (usage.get(k)?.count || 0) + 1, mode, name, a })
  }
}

// index.css turns every plain `text-charcoal/NN` into inkDark/NN in dark mode
// (with !important, so it beats a `dark:text-white/NN` on the same element).
const css = readFileSync(path.join(root, 'src/index.css'), 'utf8')
const charcoalInDark = new Map([...css.matchAll(/html\.dark \.text-charcoal\\\/(\d+)\s*\{\s*color: theme\(colors\.inkDark\/(\d+)%\)/g)].map(m => [Number(m[1]) / 100, Number(m[2]) / 100]))

// ── Dark-mode partners ──────────────────────────────────────────────────
// text-ink / ink2 / ink3 are dark-on-light colours with no automatic dark-mode
// swap. A line that uses one without any `dark:text-` partner would show it on a
// dark surface at ~1.2-3.2:1. The public marketing page is exempt: it is drawn
// light-only (useForceLight takes the `dark` class off <html> while it is shown).
const LIGHT_ONLY_DIRS = ['src/pages/marketing/']
const missingPartner = []
for (const file of walk(path.join(root, 'src'))) {
  const rel = path.relative(root, file).split(path.sep).join('/')
  if (LIGHT_ONLY_DIRS.some(d => rel.startsWith(d))) continue
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (/dark:text-/.test(line)) return
    const hit = line.match(/(?<![\w:-])text-(ink[23]?)(?![\w/-])/)
    if (hit) missingPartner.push(`${rel}:${i + 1}  text-${hit[1]} has no dark:text- partner`)
  })
}

// ── Measure ─────────────────────────────────────────────────────────────
const rows = []
for (const { mode, name, a, count } of usage.values()) {
  const fgRgb = rgbOf(FG[name])
  if (!fgRgb) continue
  const eff = raw ? a : effectiveTextAlpha(name, a)
  let surfaces = mode === 'dark' ? DARK : mode === 'onBrand' ? ON_BRAND : LIGHT
  // Coloured text sits on white or on its own tint, never on the neutral greys.
  if (mode === 'light' && OWN_TINT[name]) surfaces = { paper: LIGHT.paper, [OWN_TINT[name]]: parse(colors[OWN_TINT[name]] ?? colors.brand.tint) }
  // Solid light-mode text colours are covered by the token pairs below.
  if (a === 1 && mode !== 'dark' && name !== 'white' && name !== 'cream' && name !== 'charcoal') continue
  let worst = null
  for (const [sName, s] of Object.entries(surfaces)) {
    const r = ratio(blend(fgRgb, s, eff), s)
    if (!worst || r < worst.r) worst = { r, sName }
  }
  rows.push({ cls: `${mode === 'dark' ? 'dark:' : ''}text-${name}${a < 1 ? '/' + Math.round(a * 100) : ''}`, eff, ...worst, count })
}
// Plain charcoal text as it shows in dark mode.
for (const { mode, name, a, count } of usage.values()) {
  if (mode !== 'light' || name !== 'charcoal') continue
  const eff = charcoalInDark.has(a) ? charcoalInDark.get(a) : a
  const fg = parse(colors.inkDark)
  let worst = null
  for (const [sName, s] of Object.entries(DARK)) {
    const r = ratio(blend(fg, s, eff), s)
    if (!worst || r < worst.r) worst = { r, sName }
  }
  rows.push({ cls: `text-charcoal${a < 1 ? '/' + Math.round(a * 100) : ''} (shown in dark mode)`, eff, ...worst, count })
}
rows.sort((x, y) => x.r - y.r)

// Token pairings that are not opacity classes (solid colours on their usual surfaces).
const PAIRS = [
  ['ink', 'paper'], ['ink2', 'paper'], ['ink3', 'paper'], ['ink3', 'bg'], ['ink3', 'cream'], ['ink3', 'brand.tint'],
  ['brand', 'paper'], ['accent', 'paper'], ['accent', 'accentBg'],
  ['good', 'paper'], ['good', 'goodBg'], ['warn', 'paper'], ['warn', 'warnBg'], ['bad', 'paper'], ['bad', 'badBg'],
  ['info', 'paper'], ['info', 'infoBg'], ['severe', 'severeBg'],
  ['goodDark', 'paperDark'], ['warnDark', 'paperDark'], ['badDark', 'paperDark'], ['infoDark', 'paperDark'],
  ['goodDark', 'brand'], ['warnDark', 'brand'], ['badDark', 'brand'], ['inkDark', 'paperDark'], ['inkDark', 'bgDark'],
  ['ink4', 'paper'],
]
const pairRows = PAIRS.map(([f, b]) => ({ cls: `${f} on ${b}`, r: ratio(rgbOf(f), rgbOf(b)) }))

const label = r => `${r.cls} on ${r.sName}`
const fails = rows.filter(r => r.r < AA && !(label(r) in KNOWN_EXCEPTIONS))
const pairFails = pairRows.filter(r => r.r < AA && !(r.cls in KNOWN_EXCEPTIONS) && !(r.cls === 'ink4 on paper' ))
const f1 = n => n.toFixed(2)

if (report) {
  console.log('| Class | Renders as (opacity) | Worst surface | Ratio | Uses | AA |\n|---|---|---|---|---|---|')
  for (const r of rows) console.log(`| \`${r.cls}\` | ${Math.round(r.eff * 100)}% | ${r.sName} | ${f1(r.r)} | ${r.count} | ${r.r >= AA ? 'pass' : 'FAIL'} |`)
  console.log('\n| Token pairing | Ratio | AA |\n|---|---|---|')
  for (const r of pairRows) console.log(`| ${r.cls} | ${f1(r.r)} | ${r.r >= AA ? 'pass' : 'fail'} |`)
  const bad = rows.filter(r => r.r < AA)
  console.log(`\n${bad.length} failing classes, ${bad.reduce((n, r) => n + r.count, 0)} uses (of ${rows.reduce((n, r) => n + r.count, 0)}).`)
}

// ink4 is a border/divider/decorative colour. As text it is remapped (tokens.js
// textColor), so the raw token pair is informational only and never fails.
if (fails.length || pairFails.length || missingPartner.length) {
  console.error('\nContrast check failed (WCAG AA wants 4.5:1 for text):')
  for (const r of pairFails) console.error(`  ${r.cls}  ${f1(r.r)}:1`)
  for (const m of missingPartner) console.error(`  ${m}`)
  for (const r of fails) console.error(`  ${label(r)}  ${f1(r.r)}:1  (${r.count} uses)`)
  console.error('\nFix the token in src/lib/tokens.js (colour or textAlphaFloor), or — for a deliberate exception — add it to KNOWN_EXCEPTIONS in scripts/contrast.mjs with a reason.')
  process.exit(1)
}
if (!report) console.log(`contrast: all ${rows.length} text colour classes and ${pairRows.length} token pairs pass AA; no ink text lacks a dark-mode partner`)
