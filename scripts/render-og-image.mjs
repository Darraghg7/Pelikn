// Regenerates public/og-image.png — the link-preview image shown when
// pelikn.app is shared on WhatsApp/Slack/LinkedIn/X/iMessage etc.
//
// Renders real HTML/CSS through a headless browser so the image can never
// drift from the live site's actual type system again (it previously used a
// serif face nowhere else in the product). The Geist font files are vendored
// in scripts/assets/ and inlined as data URIs rather than fetched from
// Google Fonts at render time — fetching live during the screenshot is what
// silently fell back to a system sans font the first time this was tried.
//
// Usage: node scripts/render-og-image.mjs

import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outPath = path.resolve(__dirname, '../public/og-image.png')

const geistB64     = fs.readFileSync(path.join(__dirname, 'assets/geist-variable.woff2')).toString('base64')
const geistMonoB64 = fs.readFileSync(path.join(__dirname, 'assets/geist-mono-variable.woff2')).toString('base64')

const html = `<!doctype html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @font-face {
    font-family: 'Geist';
    font-style: normal;
    font-weight: 400 700;
    src: url(data:font/woff2;base64,${geistB64}) format('woff2');
  }
  @font-face {
    font-family: 'Geist Mono';
    font-style: normal;
    font-weight: 400 700;
    src: url(data:font/woff2;base64,${geistMonoB64}) format('woff2');
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; background: #13362a; font-family: 'Geist', -apple-system, sans-serif; overflow: hidden; }
  .canvas { position: relative; width: 1200px; height: 630px; background: #13362a; }
  .dots { position: absolute; inset: 0; background-image: radial-gradient(rgba(255,255,255,0.09) 1.5px, transparent 1.5px); background-size: 28px 28px; }
  .glow { position: absolute; top: -120px; right: -100px; width: 620px; height: 620px; background: radial-gradient(ellipse at top right, rgba(201,79,42,0.20) 0%, transparent 62%); }
  .content { position: relative; padding: 64px 72px; height: 100%; display: flex; flex-direction: column; justify-content: space-between; }
  .logo { display: flex; align-items: center; gap: 12px; }
  .logo .dot { width: 20px; height: 20px; border-radius: 50%; background: #c94f2a; }
  .logo .word { font-size: 20px; font-weight: 700; letter-spacing: 0.22em; color: #f5f4f1; text-transform: uppercase; }
  .middle { margin-top: 8px; }
  .eyebrow { display: flex; align-items: center; gap: 10px; margin-bottom: 22px; }
  .eyebrow .pulse { width: 9px; height: 9px; border-radius: 50%; background: #4ade80; }
  .eyebrow span { font-size: 15px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(245,244,241,0.62); }
  h1 { font-size: 68px; font-weight: 700; line-height: 1.04; letter-spacing: -0.025em; color: #f5f4f1; margin-bottom: 26px; }
  h1 .muted { color: rgba(245,244,241,0.42); }
  .sub { font-size: 22px; color: rgba(245,244,241,0.62); max-width: 620px; line-height: 1.5; }
  .footer { display: flex; align-items: baseline; justify-content: space-between; }
  .tags { font-family: 'Geist Mono', monospace; font-size: 15px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(245,244,241,0.38); }
  .url { font-family: 'Geist Mono', monospace; font-size: 17px; font-weight: 600; color: #e08361; }
</style>
</head>
<body>
  <div class="canvas">
    <div class="dots"></div>
    <div class="glow"></div>
    <div class="content">
      <div class="logo">
        <div class="dot"></div>
        <span class="word">Pelikn</span>
      </div>
      <div class="middle">
        <div class="eyebrow">
          <div class="pulse"></div>
          <span>Always inspection-ready</span>
        </div>
        <h1>Ditch the clipboard,<br>keep the <span class="muted">compliance.</span></h1>
        <p class="sub">Food-safety compliance &amp; team management for hospitality.</p>
      </div>
      <div class="footer">
        <div class="tags">Food safety &middot; Rota &middot; Timesheets &middot; Training</div>
        <div class="url">get-pelikn.com</div>
      </div>
    </div>
  </div>
</body>
</html>`

const browser = await chromium.launch({
  headless: true,
  // Optional override for environments with a pre-provisioned Chromium
  // binary (e.g. a sandbox image) instead of Playwright's own download.
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
})
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
await page.setContent(html, { waitUntil: 'load' })
await page.evaluate(() => document.fonts.ready)
await page.screenshot({ path: outPath })
await browser.close()

console.log(`Rendered ${outPath}`)
