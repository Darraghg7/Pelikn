import puppeteer from 'puppeteer'
import { readdir } from 'fs/promises'
import { resolve, join, basename } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function generatePDFs() {
  const dir = __dirname
  const files = (await readdir(dir)).filter(f => f.endsWith('.html'))

  console.log(`Found ${files.length} HTML files to convert...`)

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox'],
  })

  for (const file of files) {
    const htmlPath = resolve(dir, file)
    const pdfName = file.replace('.html', '.pdf')
    const pdfPath = join(dir, pdfName)

    console.log(`  Converting: ${file} → ${pdfName}`)

    const page = await browser.newPage()

    await page.goto(`file://${htmlPath}`, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    })

    // Wait for fonts to load
    await page.evaluate(() => document.fonts.ready)
    await new Promise(r => setTimeout(r, 1500))

    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })

    await page.close()
    console.log(`  ✓ ${pdfName}`)
  }

  await browser.close()
  console.log(`\nDone! ${files.length} PDFs generated in ${dir}`)
}

generatePDFs().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
