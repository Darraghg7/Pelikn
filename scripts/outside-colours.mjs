#!/usr/bin/env node
// Colours that live outside src/ — native app settings, the PWA manifest and
// the pre-React launch screen in index.html. Those files can't import
// src/lib/tokens.js, so this writes the token values into them, and
// `npm run lint:colours` fails if any of them drift.
//
// Usage:
//   node scripts/outside-colours.mjs           check (lint:colours runs this too)
//   node scripts/outside-colours.mjs --write   rewrite the files from the tokens
//                                              (npm run colours:sync)
//
// Launch/splash backgrounds are pine, so the native splash image
// (scripts/render-ios-splash.mjs), Capacitor and index.html all match and the
// app doesn't flash between greens on open. The status bar matches the brand
// top bar (src/main.jsx sets the same at runtime).

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { colors } from '../src/lib/tokens.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const JSON_TARGETS = {
  'capacitor.config.json': {
    'ios.backgroundColor':                  colors.pine.DEFAULT,
    'android.backgroundColor':              colors.pine.DEFAULT,
    'plugins.StatusBar.backgroundColor':    colors.brand.DEFAULT,
    'plugins.SplashScreen.backgroundColor': colors.pine.DEFAULT,
  },
  'public/manifest.json': {
    background_color: colors.surface,
    theme_color:      colors.brand.DEFAULT,
  },
}

// [regex with the value in group 2, token value]
const TEXT_TARGETS = {
  'index.html': [
    [/(<meta name="theme-color" content=")(#[0-9a-fA-F]+)(")/, colors.charcoal],
    [/(--pk-launch-bg: )(#[0-9a-fA-F]+)(;)/, colors.pine.DEFAULT],
  ],
}

/** @returns {string[]} one line per value that doesn't match its token */
export function syncOutsideColours({ write = false } = {}) {
  const drift = []
  for (const [file, paths] of Object.entries(JSON_TARGETS)) {
    const abs = path.join(root, file)
    const data = JSON.parse(readFileSync(abs, 'utf8'))
    let changed = false
    for (const [dotted, want] of Object.entries(paths)) {
      const keys = dotted.split('.')
      const parent = keys.slice(0, -1).reduce((o, k) => o[k], data)
      const last = keys[keys.length - 1]
      if (String(parent[last]).toLowerCase() !== want) {
        drift.push(`${file} ${dotted}: ${parent[last]} → ${want}`)
        parent[last] = want
        changed = true
      }
    }
    if (write && changed) writeFileSync(abs, JSON.stringify(data, null, 2) + '\n')
  }
  for (const [file, rules] of Object.entries(TEXT_TARGETS)) {
    const abs = path.join(root, file)
    let text = readFileSync(abs, 'utf8')
    const before = text
    for (const [re, want] of rules) {
      const m = text.match(re)
      if (!m) { drift.push(`${file}: marker not found for ${re}`); continue }
      if (m[2].toLowerCase() !== want) {
        drift.push(`${file} ${m[1].trim()}: ${m[2]} → ${want}`)
        text = text.replace(re, `$1${want}$3`)
      }
    }
    if (write && text !== before) writeFileSync(abs, text)
  }
  return drift
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const write = process.argv.includes('--write')
  const drift = syncOutsideColours({ write })
  if (!drift.length) console.log('outside-colours — all match the tokens.')
  else if (write) { console.log('outside-colours — updated:'); for (const d of drift) console.log(`  ${d}`) }
  else { console.error('outside-colours — out of step with src/lib/tokens.js:'); for (const d of drift) console.error(`  ${d}`); console.error('Run: npm run colours:sync'); process.exit(1) }
}
