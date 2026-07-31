import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const outDir = path.resolve('ios/App/App/Assets.xcassets/Splash.imageset')
const outputFiles = [
  'Default@1x~universal~anyany.png',
  'Default@2x~universal~anyany.png',
  'Default@3x~universal~anyany.png',
  'Default@1x~universal~anyany-dark.png',
  'Default@2x~universal~anyany-dark.png',
  'Default@3x~universal~anyany-dark.png',
]

const html = `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>
      html, body {
        margin: 0;
        width: 1290px;
        height: 2796px;
        overflow: hidden;
      }
      .screen {
        position: relative;
        width: 1290px;
        height: 2796px;
        background: #2A4A40;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        color: #fff;
      }
      .word {
        position: relative;
        z-index: 1;
        font-size: 192px;
        line-height: 232px;
        font-weight: 700;
        letter-spacing: 0;
      }
    </style>
  </head>
  <body>
    <div class="screen">
      <div class="word">Pelikn</div>
    </div>
  </body>
</html>`

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: { width: 1290, height: 2796 },
  deviceScaleFactor: 1,
})
await page.setContent(html, { waitUntil: 'load' })
const tmp = '/private/tmp/pelikn-ios-native-splash.png'
await page.screenshot({ path: tmp })
await browser.close()

for (const file of outputFiles) {
  fs.copyFileSync(tmp, path.join(outDir, file))
}

console.log(`Rendered ${outputFiles.length} static iOS launch background assets with the Pelikn word.`)
