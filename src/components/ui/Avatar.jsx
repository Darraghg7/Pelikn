import React, { useState } from 'react'
import { initials } from '../../lib/names'
import { staffColour } from '../../lib/utils'
import { STAFF_COLOUR_PALETTE } from '../../lib/constants'
import { colors } from '../../lib/tokens'

/**
 * A person's avatar: their photo, or their initials on their rota colour.
 *
 * The colour is the same one the rota uses (the colour picked on the staff
 * form, or a fixed one worked out from their id), so a person looks the same
 * on every screen. Pass `colour` when the query has it, otherwise people with
 * a hand-picked colour fall back to their default one.
 *
 * Sizes (px): xs 28 · sm 32 · md 36 · lg 40 · xl 44 · 2xl 56
 *
 * Tones:
 *   person  (default) per-person rota colour
 *   neutral grey, for placeholders and people with no record
 *   onDark  white-on-glass, for avatars sitting on the brand-green cards
 *
 * Pass `decorative` when the person's name is already written next to the
 * avatar, so screen readers don't read the name twice.
 */

const SIZES = {
  xs:   'w-7 h-7 text-[11px]',
  sm:   'w-8 h-8 text-[12px]',
  md:   'w-9 h-9 text-[13px]',
  lg:   'w-10 h-10 text-[14px]',
  xl:   'w-11 h-11 text-[15px]',
  '2xl': 'w-14 h-14 text-[19px]',
}

const TONES = {
  person:  'bg-[var(--av-bg)] text-[var(--av-fg)] dark:bg-[var(--av-bg-dark)] dark:text-[var(--av-fg-dark)]',
  neutral: 'bg-line2 text-ink2 dark:bg-white/10 dark:text-white/80',
  onDark:  'bg-white/16 text-white',
}

/** Blend two #rrggbb colours; `amount` is how much of `b` to mix in. */
function mix(a, b, amount) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16)
  const ch = shift => {
    const ca = (pa >> shift) & 255, cb = (pb >> shift) & 255
    return Math.round(ca + (cb - ca) * amount)
  }
  return '#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')
}

function nameHash(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

/**
 * The person's base colour: rota colour, else derived from id, else from name.
 * @param {{ id?: string | null, colour?: string | null, name?: string | null }} person
 */
export function avatarBaseColour({ id, colour, name }) {
  if (colour && /^#[0-9a-f]{6}$/i.test(colour)) return colour
  if (id) return staffColour({ id })
  return STAFF_COLOUR_PALETTE[nameHash(name ?? '') % STAFF_COLOUR_PALETTE.length]
}

/**
 * Light tint + deep text in light mode; dark tint + pale text in dark mode.
 * @param {string} base
 * @returns {Record<string, string>}  CSS custom properties for the avatar's style
 */
export function avatarPalette(base) {
  return {
    '--av-bg':      mix(base, colors.paper, 0.84),
    '--av-fg':      mix(base, colors.print.ink, 0.45),
    '--av-bg-dark': mix(base, colors.paperDark, 0.72),
    '--av-fg-dark': mix(base, colors.paper, 0.55),
  }
}

/**
 * @param {object} props
 * @param {string | null} [props.name]
 * @param {string | null} [props.id]       staff id — picks the default colour
 * @param {string | null} [props.colour]   the staff member's saved rota colour
 * @param {string | null} [props.photoUrl]
 * @param {'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'} [props.size]
 * @param {'person' | 'neutral' | 'onDark'} [props.tone]
 * @param {boolean} [props.decorative]     name is shown next to it; hide from screen readers
 * @param {string} [props.className]
 * @param {import('react').ReactNode} [props.children]  overlays, e.g. a status dot
 */
export default function Avatar({
  name,
  id,
  colour,
  photoUrl,
  size = 'md',
  tone = 'person',
  decorative = false,
  className = '',
  children,
}) {
  // Remember which URL failed, so a new photo gets a fresh try
  const [failedUrl, setFailedUrl] = useState(null)
  const showPhoto = !!photoUrl && failedUrl !== photoUrl
  const a11y = decorative
    ? { 'aria-hidden': true }
    : { role: 'img', 'aria-label': name || 'Unknown person' }

  const base = `relative shrink-0 rounded-full inline-flex items-center justify-center select-none ${SIZES[size] ?? SIZES.md}`

  if (showPhoto) {
    return (
      <span className={`${base} ${className}`} {...a11y}>
        <img
          src={photoUrl}
          alt=""
          className="w-full h-full rounded-full object-cover"
          loading="lazy"
          onError={() => setFailedUrl(photoUrl)}
        />
        {children}
      </span>
    )
  }

  const style = tone === 'person' ? avatarPalette(avatarBaseColour({ id, colour, name })) : undefined
  return (
    <span
      className={`${base} font-mono font-semibold tracking-[0.02em] ${TONES[tone] ?? TONES.person} ${className}`}
      style={/** @type {import('react').CSSProperties} */ (style)}
      {...a11y}
    >
      {initials(name)}
      {children}
    </span>
  )
}
