import { format } from 'date-fns'
import { staffColour } from './utils'

const C = {
  charcoal:  '#1a1a18',
  cream:     '#f5f4f1',
  accent:    '#c94f2a',
  border:    '#e5e3df',
  muted:     '#a09e9a',
  closedBg:  '#f2f1ee',
  rowAlt:    'rgba(26,26,24,0.018)',
  white:     '#ffffff',
}

const DPR      = 2
const PAD      = 24
const NAME_W   = 152
const DAY_W    = 104
const HDR_H    = 72
const DAY_HDR_H = 50
const CHIP_H   = 18
const CHIP_GAP = 4
const CHIP_PAD = 10
const FOOTER_H = 32

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

function rgba(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

/**
 * Renders the rota as a canvas element and returns it.
 * Pass the result to toBlob() or toDataURL() for sharing/download.
 */
export function buildRotaCanvas({ venueName, weekStart, days, shifts, staff, closedDays = [], closedDates = new Set() }) {
  // Pre-index shifts by "staffId:date"
  const shiftIndex = {}
  for (const sh of shifts) {
    const key = `${sh.staff_id}:${sh.shift_date}`
    if (!shiftIndex[key]) shiftIndex[key] = []
    shiftIndex[key].push(sh)
  }

  // Row heights — each row is tall enough to fit the staff member's busiest day
  const rowHeights = staff.map(s => {
    const maxShifts = Math.max(1, ...days.map(d => {
      const key = `${s.id}:${format(d, 'yyyy-MM-dd')}`
      return (shiftIndex[key] ?? []).length
    }))
    return CHIP_PAD * 2 + maxShifts * CHIP_H + (maxShifts - 1) * CHIP_GAP
  })

  const totalStaffH = rowHeights.reduce((a, b) => a + b, 0)
  const W = PAD * 2 + NAME_W + DAY_W * 7
  const H = PAD + HDR_H + DAY_HDR_H + totalStaffH + FOOTER_H + PAD

  const canvas = document.createElement('canvas')
  canvas.width  = W * DPR
  canvas.height = H * DPR

  const ctx = canvas.getContext('2d')
  ctx.scale(DPR, DPR)

  // ── Background ──────────────────────────────────────────────────────────────
  ctx.fillStyle = C.white
  ctx.fillRect(0, 0, W, H)

  // ── Header bar ──────────────────────────────────────────────────────────────
  ctx.fillStyle = C.charcoal
  ctx.fillRect(0, 0, W, PAD + HDR_H)

  // "Pelikn" label
  ctx.fillStyle = C.accent
  ctx.font = `700 11px system-ui,-apple-system,sans-serif`
  ctx.fillText('PELIKN', PAD + 4, PAD + 16)

  // Venue name
  ctx.fillStyle = C.cream
  ctx.font = `700 18px system-ui,-apple-system,sans-serif`
  // Truncate venue name if too long
  const maxNameW = W - PAD * 2 - 100
  let nameText = venueName || 'Rota'
  ctx.font = `700 18px system-ui,-apple-system,sans-serif`
  while (nameText.length > 4 && ctx.measureText(nameText).width > maxNameW) {
    nameText = nameText.slice(0, -1)
  }
  if (nameText !== (venueName || 'Rota')) nameText += '…'
  ctx.fillText(nameText, PAD + 4, PAD + 38)

  // Week label
  ctx.fillStyle = rgba(C.cream, 0.55)
  ctx.font = `400 12px system-ui,-apple-system,sans-serif`
  ctx.fillText(`Rota — Week of ${format(weekStart, 'EEE d MMM yyyy')}`, PAD + 4, PAD + 58)

  // Shift count top-right
  if (shifts.length > 0) {
    ctx.fillStyle = rgba(C.cream, 0.3)
    ctx.font = `400 11px system-ui,-apple-system,sans-serif`
    ctx.textAlign = 'right'
    ctx.fillText(`${shifts.length} shift${shifts.length !== 1 ? 's' : ''}`, W - PAD - 4, PAD + 38)
    ctx.textAlign = 'left'
  }

  const tableTop  = PAD + HDR_H
  const tableLeft = PAD
  const tableW    = NAME_W + DAY_W * 7

  // ── Day header row ──────────────────────────────────────────────────────────
  // Background
  ctx.fillStyle = rgba(C.charcoal, 0.04)
  ctx.fillRect(tableLeft, tableTop, tableW, DAY_HDR_H)

  // "STAFF" column label
  ctx.fillStyle = rgba(C.charcoal, 0.35)
  ctx.font = `600 9px system-ui,-apple-system,sans-serif`
  ctx.fillText('STAFF', tableLeft + 12, tableTop + DAY_HDR_H / 2 + 4)

  days.forEach((d, i) => {
    const dateStr  = format(d, 'yyyy-MM-dd')
    const isClosed = closedDays.includes(i) || closedDates.has(dateStr)
    const x = tableLeft + NAME_W + i * DAY_W

    if (isClosed) {
      ctx.fillStyle = rgba(C.charcoal, 0.06)
      ctx.fillRect(x, tableTop, DAY_W, DAY_HDR_H)
    }

    const dimmed = isClosed ? 0.25 : 0.5
    ctx.fillStyle = rgba(C.charcoal, dimmed)
    ctx.font = `600 9px system-ui,-apple-system,sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(DAYS[i], x + DAY_W / 2, tableTop + 17)

    ctx.fillStyle = isClosed ? rgba(C.charcoal, 0.25) : C.charcoal
    ctx.font = `500 13px system-ui,-apple-system,sans-serif`
    ctx.fillText(format(d, 'd MMM'), x + DAY_W / 2, tableTop + 35)

    if (isClosed) {
      ctx.fillStyle = rgba(C.charcoal, 0.2)
      ctx.font = `600 8px system-ui,-apple-system,sans-serif`
      ctx.fillText('CLOSED', x + DAY_W / 2, tableTop + 46)
    }

    ctx.textAlign = 'left'
  })

  // Border below day header
  ctx.strokeStyle = C.border
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(tableLeft, tableTop + DAY_HDR_H)
  ctx.lineTo(tableLeft + tableW, tableTop + DAY_HDR_H)
  ctx.stroke()

  // ── Staff rows ──────────────────────────────────────────────────────────────
  let rowY = tableTop + DAY_HDR_H

  staff.forEach((s, si) => {
    const rowH = rowHeights[si]

    // Alternating row tint
    if (si % 2 === 1) {
      ctx.fillStyle = C.rowAlt
      ctx.fillRect(tableLeft, rowY, tableW, rowH)
    }

    // Staff name
    ctx.fillStyle = C.charcoal
    ctx.font = `500 12px system-ui,-apple-system,sans-serif`
    // Truncate if needed
    let nameStr = s.name ?? ''
    const nameMaxW = NAME_W - 24
    while (nameStr.length > 3 && ctx.measureText(nameStr).width > nameMaxW) {
      nameStr = nameStr.slice(0, -1)
    }
    if (nameStr !== (s.name ?? '')) nameStr += '…'
    ctx.fillText(nameStr, tableLeft + 12, rowY + CHIP_PAD + CHIP_H / 2 + 4)

    // Role label
    const roleStr = (s.job_role ?? s.role ?? '').toUpperCase().slice(0, 16)
    if (roleStr) {
      ctx.fillStyle = C.muted
      ctx.font = `500 9px system-ui,-apple-system,sans-serif`
      ctx.fillText(roleStr, tableLeft + 12, rowY + CHIP_PAD + CHIP_H / 2 + 16)
    }

    // Day cells
    days.forEach((d, di) => {
      const dateStr  = format(d, 'yyyy-MM-dd')
      const isClosed = closedDays.includes(di) || closedDates.has(dateStr)
      const cellX    = tableLeft + NAME_W + di * DAY_W
      const dayShifts = shiftIndex[`${s.id}:${dateStr}`] ?? []

      if (isClosed) {
        ctx.fillStyle = rgba(C.charcoal, 0.04)
        ctx.fillRect(cellX, rowY, DAY_W, rowH)
      }

      const chipW = DAY_W - 12
      const chipX = cellX + 6
      const color = staffColour(s)

      dayShifts.forEach((sh, shi) => {
        const chipY = rowY + CHIP_PAD + shi * (CHIP_H + CHIP_GAP)

        ctx.fillStyle = color
        roundRect(ctx, chipX, chipY, chipW, CHIP_H, 5)
        ctx.fill()

        const timeStr = `${sh.start_time?.slice(0, 5) ?? ''}–${sh.end_time?.slice(0, 5) ?? ''}`
        ctx.fillStyle = 'rgba(255,255,255,0.95)'
        ctx.font = `600 11px system-ui,-apple-system,sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(timeStr, chipX + chipW / 2, chipY + 14)

        ctx.textAlign = 'left'
      })
    })

    // Row bottom border
    ctx.strokeStyle = C.border
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(tableLeft, rowY + rowH)
    ctx.lineTo(tableLeft + tableW, rowY + rowH)
    ctx.stroke()

    rowY += rowH
  })

  // ── Vertical dividers ───────────────────────────────────────────────────────
  // After name column
  ctx.strokeStyle = C.border
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(tableLeft + NAME_W, tableTop)
  ctx.lineTo(tableLeft + NAME_W, rowY)
  ctx.stroke()

  // Between day columns
  for (let i = 1; i < 7; i++) {
    const x = tableLeft + NAME_W + i * DAY_W
    ctx.strokeStyle = rgba(C.border, 0.6)
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(x, tableTop)
    ctx.lineTo(x, rowY)
    ctx.stroke()
  }

  // Outer border around table
  ctx.strokeStyle = C.border
  ctx.lineWidth = 1
  roundRect(ctx, tableLeft, tableTop, tableW, rowY - tableTop, 6)
  ctx.stroke()

  // ── Footer ──────────────────────────────────────────────────────────────────
  ctx.fillStyle = rgba(C.charcoal, 0.25)
  ctx.font = `400 10px system-ui,-apple-system,sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText('Generated by Pelikn', W / 2, rowY + FOOTER_H / 2 + 4)
  ctx.textAlign = 'left'

  return canvas
}

/**
 * Exports the rota as an image. On mobile with Web Share API, opens the OS
 * share sheet (user can pick WhatsApp). Falls back to a file download.
 */
export async function shareRotaImage({ venueName, weekStart, days, shifts, staff, closedDays, closedDates }) {
  const canvas = buildRotaCanvas({ venueName, weekStart, days, shifts, staff, closedDays, closedDates })

  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) { reject(new Error('Canvas export failed')); return }

      const weekLabel = format(weekStart, 'yyyy-MM-dd')
      const filename  = `rota-${weekLabel}.png`

      // Web Share API — supported on modern mobile browsers
      if (navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: 'image/png' })] })) {
        try {
          await navigator.share({
            files: [new File([blob], filename, { type: 'image/png' })],
            title: `Rota — Week of ${format(weekStart, 'EEE d MMM yyyy')}`,
          })
          resolve('shared')
          return
        } catch (err) {
          if (err.name !== 'AbortError') {
            // Fall through to download
          } else {
            resolve('cancelled')
            return
          }
        }
      }

      // Fallback: download the image
      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href     = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      resolve('downloaded')
    }, 'image/png')
  })
}
