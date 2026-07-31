import { createClient } from '@supabase/supabase-js'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_VENUE_ID = '00000000-0000-0000-0000-000000000001'
const DEFAULT_TABLES = [
  'venues',
  'staff',
  'shifts',
  'clock_events',
  'time_off_requests',
  'shift_swaps',
  'staff_availability',
]

function usage() {
  console.log(`
Usage:
  SUPABASE_SERVICE_ROLE_KEY=... npm run backup:venue
  SUPABASE_SERVICE_ROLE_KEY=... npm run backup:venue -- --venue-id <uuid> --label nomad

Options:
  --venue-id <uuid>       Venue to export. Defaults to Nomad.
  --label <name>          Folder label. Defaults to venue.
  --tables <a,b,c>        Comma-separated table list.
  --out <dir>             Backup root directory. Defaults to backups.
`)
}

function parseArgs(argv) {
  const args = {
    venueId: DEFAULT_VENUE_ID,
    label: 'venue',
    tables: DEFAULT_TABLES,
    outDir: 'backups',
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') return { ...args, help: true }
    if (arg === '--venue-id') args.venueId = argv[++i]
    else if (arg === '--label') args.label = argv[++i]
    else if (arg === '--tables') args.tables = argv[++i].split(',').map(s => s.trim()).filter(Boolean)
    else if (arg === '--out') args.outDir = argv[++i]
    else throw new Error(`Unknown argument: ${arg}`)
  }

  return args
}

async function readEnvFile(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8')
    return Object.fromEntries(
      raw
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#') && line.includes('='))
        .map(line => {
          const index = line.indexOf('=')
          return [line.slice(0, index), line.slice(index + 1)]
        })
    )
  } catch {
    return {}
  }
}

function csvEscape(value) {
  if (value == null) return ''
  if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function toCsv(rows) {
  if (!rows.length) return ''
  const columns = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach(key => set.add(key))
    return set
  }, new Set()))

  return [
    columns.map(csvEscape).join(','),
    ...rows.map(row => columns.map(column => csvEscape(row[column])).join(',')),
  ].join('\n')
}

async function fetchAll(queryFactory) {
  const pageSize = 1000
  const rows = []

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1
    const { data, error } = await queryFactory().range(from, to)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) break
  }

  return rows
}

async function exportTable(supabase, table, venueId) {
  if (table === 'venues') {
    return fetchAll(() => supabase.from(table).select('*').eq('id', venueId).order('id'))
  }

  return fetchAll(() => supabase.from(table).select('*').eq('venue_id', venueId).order('id'))
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    usage()
    return
  }

  const envFile = await readEnvFile('.env')
  const localEnvFile = await readEnvFile('.env.local')
  const fileEnv = { ...envFile, ...localEnvFile }
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || fileEnv.SUPABASE_URL || fileEnv.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) throw new Error('Missing SUPABASE_URL or VITE_SUPABASE_URL.')
  if (!serviceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY. Get it from Supabase Project Settings > API.')

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const safeLabel = args.label.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'venue'
  const backupDir = path.resolve(args.outDir, `${safeLabel}-${args.venueId}-${stamp}`)
  await mkdir(backupDir, { recursive: true })

  const manifest = {
    created_at: new Date().toISOString(),
    venue_id: args.venueId,
    supabase_url: supabaseUrl,
    tables: {},
  }

  for (const table of args.tables) {
    process.stdout.write(`Exporting ${table}... `)
    const rows = await exportTable(supabase, table, args.venueId)
    await writeFile(path.join(backupDir, `${table}.json`), JSON.stringify(rows, null, 2))
    await writeFile(path.join(backupDir, `${table}.csv`), toCsv(rows))
    manifest.tables[table] = rows.length
    console.log(`${rows.length} rows`)
  }

  await writeFile(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(`\nBackup written to ${backupDir}`)
}

main().catch(error => {
  console.error(error.message)
  process.exit(1)
})
