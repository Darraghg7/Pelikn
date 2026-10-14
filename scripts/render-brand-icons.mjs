// Regenerates the favicon, PWA and home-screen icons from the Pelikn bird in
// src/components/ui/Logo.jsx, so they can never drift from the logo.
//
//   default  white bird on deep green  (icon.svg, favicon-*, icon-192/512, maskable, apple-touch)
//   cream    green bird on cream       (icon-cream.svg, favicon-cream-*) — the optional
//                                       "Browser tab icon" choice in Settings
//
// Does not touch the native iOS/Android icons or splash. Usage: node scripts/render-brand-icons.mjs

import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { colors } from '../src/lib/tokens.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '../public/icons')
const logo = fs.readFileSync(path.resolve(__dirname, '../src/components/ui/Logo.jsx'), 'utf8')
const BIRD = logo.match(/const BIRD =\s*"([^"]+)"/)[1]
const BIRD_T = logo.match(/<path d=\{BIRD\} transform="([^"]+)"/)[1]

const GREEN = colors.brand.DEFAULT
const CREAM = '#f3f1ee'
const W = 226, H = 184 // bird viewBox (-2 -2 226 184)

/** Square icon SVG: `fill` is the bird's share of the width, `radius` the corner (0 = full bleed). */
function iconSvg({ bg, fg, fill, radius }) {
  const sc = (100 * fill) / W
  const tx = (100 - W * sc) / 2
  const ty = (100 - H * sc) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="${radius}" fill="${bg}"/><g transform="translate(${tx} ${ty}) scale(${sc}) translate(2 2)" fill="${fg}" fill-rule="evenodd"><path d="${BIRD}" transform="${BIRD_T}"/></g></svg>`
}

const green = { bg: GREEN, fg: '#ffffff' }
const cream = { bg: CREAM, fg: GREEN }

const svgs = {
  'icon.svg':       iconSvg({ ...green, fill: 0.74, radius: 20 }),
  'icon-cream.svg': iconSvg({ ...cream, fill: 0.74, radius: 20 }),
}
for (const [name, svg] of Object.entries(svgs)) fs.writeFileSync(path.join(outDir, name), svg)

const pngs = [
  ['favicon-16.png',        16,  { ...green, fill: 0.84, radius: 20 }],
  ['favicon-32.png',        32,  { ...green, fill: 0.80, radius: 20 }],
  ['favicon-cream-16.png',  16,  { ...cream, fill: 0.84, radius: 20 }],
  ['favicon-cream-32.png',  32,  { ...cream, fill: 0.80, radius: 20 }],
  ['icon-192.png',          192, { ...green, fill: 0.62, radius: 0 }],
  ['icon-512.png',          512, { ...green, fill: 0.62, radius: 0 }],
  ['icon-512-maskable.png', 512, { ...green, fill: 0.50, radius: 0 }],
  ['apple-touch-icon.png',  512, { ...green, fill: 0.62, radius: 0 }],
]

const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined })
for (const [file, size, opts] of pngs) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${iconSvg(opts)}`)
  await page.screenshot({ path: path.join(outDir, file), omitBackground: true })
  await page.close()
}
await browser.close()
console.log(`Rendered ${Object.keys(svgs).length} SVGs and ${pngs.length} PNGs into ${outDir}`)
