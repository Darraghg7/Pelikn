// Regenerates the native iOS and Android app icons and launch screens from the
// Pelikn bird in src/components/ui/Logo.jsx, so they match the logo.
//
//   iOS      AppIcon (light), AppIconDark, AppIconMint  — the three choices in
//            Settings > App icon — plus the Splash.imageset launch background.
//   Android  legacy + round + adaptive launcher icons, and every splash.png.
//
// Colours come from src/lib/tokens.js (appIconColors, colors.pine). The icons are
// drawn full-bleed; iOS and Android apply their own corner masks.
// Usage: node scripts/render-native-icons.mjs   (then rebuild the native apps)

import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { colors, appIconColors } from '../src/lib/tokens.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const logo = fs.readFileSync(path.join(root, 'src/components/ui/Logo.jsx'), 'utf8')
const BIRD = logo.match(/const BIRD =\s*"([^"]+)"/)[1]
const BIRD_T = logo.match(/<path d=\{BIRD\} transform="([^"]+)"/)[1]
const W = 226, H = 184

/**
 * SVG of the bird centred on a w×h canvas. `fill` is the bird's width as a share of
 * the shorter side. `bg` null = transparent. `shape`: 'square' | 'round' | 'rounded'.
 */
function svg({ w, h, bg, fg, fill, shape = 'square' }) {
  const sc = (Math.min(w, h) * fill) / W
  const tx = (w - W * sc) / 2
  const ty = (h - H * sc) / 2
  const side = Math.min(w, h)
  const clip = shape === 'round' ? `rx="${side / 2}"` : shape === 'rounded' ? `rx="${side * 0.2}"` : ''
  const back = bg ? `<rect width="${w}" height="${h}" ${clip} fill="${bg}"/>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${back}<g transform="translate(${tx} ${ty}) scale(${sc}) translate(2 2)" fill="${fg}" fill-rule="evenodd"><path d="${BIRD}" transform="${BIRD_T}"/></g></svg>`
}

const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined })
let count = 0
async function png(file, opts) {
  const page = await browser.newPage({ viewport: { width: opts.w, height: opts.h }, deviceScaleFactor: 1 })
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg(opts)}`)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  await page.screenshot({ path: file, omitBackground: true })
  await page.close()
  count++
}

// ── iOS app icons (1024 square, no transparency) ────────────────────────────
const ios = path.join(root, 'ios/App/App/Assets.xcassets')
const iosIcons = {
  AppIcon:     { bg: appIconColors.white, fg: appIconColors.green },
  AppIconDark: { bg: appIconColors.green, fg: appIconColors.white },
  AppIconMint: { bg: appIconColors.black, fg: appIconColors.mint },
}
for (const [name, c] of Object.entries(iosIcons)) {
  await png(path.join(ios, `${name}.appiconset/AppIcon-512@2x.png`), { w: 1024, h: 1024, ...c, fill: 0.58 })
}

// ── Source art in resources/ (used if someone re-runs `capacitor-assets`) ───
const resDir = path.join(root, 'resources')
const sources = { icon: iosIcons.AppIcon, 'icon-dark': iosIcons.AppIconDark, 'icon-mint': iosIcons.AppIconMint }
for (const [name, c] of Object.entries(sources)) {
  fs.writeFileSync(path.join(resDir, `${name}.svg`), svg({ w: 1024, h: 1024, ...c, fill: 0.58 }))
  await png(path.join(resDir, name === 'icon' ? 'icon.png' : `${name}-1024.png`), { w: 1024, h: 1024, ...c, fill: 0.58 })
}
await png(path.join(resDir, 'icon-light-1024.png'), { w: 1024, h: 1024, ...iosIcons.AppIcon, fill: 0.58 })
fs.writeFileSync(path.join(resDir, 'icon-light.svg'), svg({ w: 1024, h: 1024, ...iosIcons.AppIcon, fill: 0.58 }))

// ── iOS launch background (the bird alone, to match the in-app splash) ──────
const splashFiles = ['Default@1x~universal~anyany', 'Default@2x~universal~anyany', 'Default@3x~universal~anyany']
for (const f of splashFiles) {
  for (const suffix of ['', '-dark']) {
    await png(path.join(ios, `Splash.imageset/${f}${suffix}.png`), { w: 1290, h: 2796, bg: colors.pine.DEFAULT, fg: '#ffffff', fill: 0.3 })
  }
}

// ── Android launcher icons ──────────────────────────────────────────────────
const res = path.join(root, 'android/app/src/main/res')
const dens = { ldpi: [36, 81], mdpi: [48, 108], hdpi: [72, 162], xhdpi: [96, 216], xxhdpi: [144, 324], xxxhdpi: [192, 432] }
for (const [d, [legacy, adaptive]] of Object.entries(dens)) {
  const dir = path.join(res, `mipmap-${d}`)
  const c = { bg: appIconColors.green, fg: '#ffffff' }
  await png(path.join(dir, 'ic_launcher.png'),       { w: legacy, h: legacy, ...c, fill: 0.62, shape: 'rounded' })
  await png(path.join(dir, 'ic_launcher_round.png'), { w: legacy, h: legacy, ...c, fill: 0.56, shape: 'round' })
  // Adaptive icon: the system crops to the inner ~66%, so keep the bird well inside.
  await png(path.join(dir, 'ic_launcher_foreground.png'), { w: adaptive, h: adaptive, bg: null, fg: '#ffffff', fill: 0.62 })
  await png(path.join(dir, 'ic_launcher_background.png'), { w: adaptive, h: adaptive, bg: appIconColors.green, fg: 'none', fill: 0.01 })
}
const bgXml = path.join(res, 'values/ic_launcher_background.xml')
fs.writeFileSync(bgXml, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${appIconColors.green}</color>\n</resources>`)

// ── Android launch screens (every splash.png keeps its existing size) ───────
const splashes = fs.readdirSync(res).filter(d => d.startsWith('drawable') && fs.existsSync(path.join(res, d, 'splash.png')))
for (const d of splashes) {
  const file = path.join(res, d, 'splash.png')
  const buf = fs.readFileSync(file)
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20)
  await png(file, { w, h, bg: colors.pine.DEFAULT, fg: '#ffffff', fill: 0.3 })
}

await browser.close()
console.log(`Rendered ${count} native icon and launch images.`)
