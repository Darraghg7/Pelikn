import React, { useEffect, useRef, useState } from 'react'

// ── Colour tokens (per spec — not in tailwind config) ────────────────────────
const TONES = {
  warn: {
    fg:       '#a85d12',
    bg:       '#fbeedc',
    soft:     '#fdf6ec',
    pips:     '#a85d12',
    hairline: '#a85d12',
  },
  bad: {
    fg:       '#b3331c',
    bg:       '#fbeae6',
    soft:     '#fdf3f0',
    pips:     '#b3331c',
    hairline: '#b3331c',
  },
  severe: {
    fg:       '#7a1d0c',
    bg:       '#f5dbd7',
    soft:     '#fdf0ed',
    pips:     '#7a1d0c',
    hairline: '#7a1d0c',
  },
}

const INK  = '#0d1a14'
const INK2 = '#3d4a44'
const INK3 = '#76817b'
const LINE = '#e4e6e2'
const LINE2 = '#eef0ec'

function getTone(strikeCount) {
  if (strikeCount >= 4) return TONES.severe
  if (strikeCount === 3) return TONES.bad
  return TONES.warn
}

// ── Icons ────────────────────────────────────────────────────────────────────
function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function ClockIcon({ color }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function CoffeeIcon({ color }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <line x1="6" y1="1" x2="6" y2="4" />
      <line x1="10" y1="1" x2="10" y2="4" />
      <line x1="14" y1="1" x2="14" y2="4" />
    </svg>
  )
}

// ── Strike pips ──────────────────────────────────────────────────────────────
function StrikePips({ count, tone }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4].map(n => (
        <div
          key={n}
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: n <= count ? tone.pips : LINE2,
            border: `1.5px solid ${n <= count ? tone.pips : LINE}`,
          }}
        />
      ))}
    </div>
  )
}

// ── Heading copy ─────────────────────────────────────────────────────────────
function getHeading(type, strikeCount, minsOver) {
  if (type === 'late_clock_in') {
    if (strikeCount >= 4) return `${ordinal(strikeCount)} late clock-in — formal review`
    if (strikeCount === 3) return `Late again — ${minsOver >= 1 ? `${minsOver} minute${minsOver !== 1 ? 's' : ''}` : 'under a minute'}`
    return "You've clocked in late"
  }
  // break_overrun
  if (strikeCount >= 4) return `${ordinal(strikeCount)} break overrun — formal review`
  if (strikeCount === 3) return `Over again — ${minsOver >= 1 ? `${minsOver} minute${minsOver !== 1 ? 's' : ''}` : 'under a minute'} over`
  return "You've gone over your break"
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// ── Reason chips ─────────────────────────────────────────────────────────────
const LATE_REASONS    = ['Transport', 'Overslept', 'Personal', 'Other']
const BREAK_REASONS   = ['Service was busy', 'Lost track of time', 'Personal', 'Other']

function ReasonChips({ type, strikeCount, selected, onSelect }) {
  const reasons = type === 'late_clock_in' ? LATE_REASONS : BREAK_REASONS
  const optional = strikeCount <= 2
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12px] font-medium" style={{ color: INK3 }}>
        Add a reason{optional ? ' (optional)' : ''}
      </p>
      <div className="flex flex-wrap gap-2">
        {reasons.map(r => (
          <button
            key={r}
            type="button"
            onClick={() => onSelect(selected === r ? null : r)}
            style={{
              border: `1.5px solid ${selected === r ? INK2 : LINE}`,
              background: selected === r ? INK : 'transparent',
              color: selected === r ? '#fff' : INK2,
              borderRadius: 20,
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main modal ───────────────────────────────────────────────────────────────
export default function StaffAlertModal({
  open,
  type = 'late_clock_in',
  minsOver = 0,
  strikeCount = 1,
  scheduledTime,       // e.g. "07:00" — for late clock-in
  actualTime,          // e.g. "07:04" — for late clock-in
  breakStartTime,      // e.g. "13:00" — for break overrun
  breakAllowanceMins = 30,
  takenMins,           // e.g. 41 — for break overrun
  requireLateReason = true,
  onAcknowledge,       // (reason: string|null) => void
}) {
  const tone = getTone(strikeCount)
  const [visible, setVisible] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [selectedReason, setSelectedReason] = useState(null)
  const [shakeReason, setShakeReason] = useState(false)

  useEffect(() => {
    if (open) {
      setVisible(true)
      setSelectedReason(null)
      setShakeReason(false)
      requestAnimationFrame(() => setAnimating(true))
    } else if (visible) {
      setAnimating(false)
      const t = setTimeout(() => setVisible(false), 250)
      return () => clearTimeout(t)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // No Escape key close — intentionally non-dismissible
  if (!visible) return null

  const isLate  = type === 'late_clock_in'
  const heading = getHeading(type, strikeCount, minsOver)
  const eyebrow = isLate ? 'LATE CLOCK-IN' : 'BREAK OVERRUN'

  const showBanner   = strikeCount >= 3
  const bannerSevere = strikeCount >= 4

  const showReasonChips = requireLateReason
  const reasonRequired  = requireLateReason && strikeCount >= 3
  const submitDisabled  = reasonRequired && !selectedReason

  const handleSubmitClick = () => {
    if (submitDisabled) {
      setShakeReason(true)
      setTimeout(() => setShakeReason(false), 500)
      return
    }
    onAcknowledge(selectedReason)
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Scrim — no onClick, intentionally non-dismissible */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(9,18,13,0.55)',
          backdropFilter: 'blur(3px)',
          transition: 'opacity 0.25s',
          opacity: animating ? 1 : 0,
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 480,
          background: '#fff',
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 24px 60px rgba(9,18,13,0.4)',
          paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
          maxHeight: '92dvh',
          overflowY: 'auto',
          transition: 'transform 0.25s cubic-bezier(0.22,1,0.36,1), opacity 0.25s',
          transform: animating ? 'translateY(0)' : 'translateY(40px)',
          opacity: animating ? 1 : 0,
          zIndex: 10,
        }}
      >
        {/* Top accent hairline */}
        <div style={{ height: 4, background: tone.hairline, borderRadius: '24px 24px 0 0' }} />

        <div className="px-5 pt-4 pb-2 flex flex-col gap-4">

          {/* Icon + pips row */}
          <div className="flex items-start justify-between">
            <div
              style={{
                width: 56, height: 56, borderRadius: 14,
                background: tone.bg,
                border: `6px solid ${tone.soft}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                outline: `2px solid ${tone.fg}`,
                outlineOffset: 2,
              }}
            >
              {isLate
                ? <ClockIcon color={tone.fg} />
                : <CoffeeIcon color={tone.fg} />
              }
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <StrikePips count={strikeCount} tone={tone} />
              <p className="font-mono text-[11px] tracking-widest uppercase" style={{ color: INK3 }}>
                {ordinal(strikeCount)} in 30 days
              </p>
            </div>
          </div>

          {/* Eyebrow */}
          <p className="font-mono text-[11px] tracking-[0.12em] uppercase font-medium" style={{ color: tone.fg }}>
            {eyebrow}
          </p>

          {/* H1 */}
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.022em', color: INK, margin: 0, lineHeight: 1.2 }}>
            {heading}
          </h1>

          {/* Big mono number */}
          <div>
            <span className="font-mono" style={{ fontSize: 34, fontWeight: 500, color: tone.fg, lineHeight: 1 }}>
              {minsOver >= 1 ? `${minsOver} min` : '< 1 min'}
            </span>
            <span className="font-mono text-[13px] ml-2" style={{ color: INK3 }}>
              {isLate ? 'after your start time' : 'over your allowance'}
            </span>
          </div>

          {/* Comparison card */}
          <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, overflow: 'hidden' }}>
            {isLate ? (
              <>
                <CompRow label="SCHEDULED"  value={scheduledTime}  tinted={false} tone={tone} />
                <CompRow label="CLOCKED IN" value={actualTime}     tinted={true}  tone={tone} />
              </>
            ) : (
              <>
                <CompRow label="BREAK STARTED" value={breakStartTime}           tinted={false} tone={tone} />
                <CompRow label="ALLOWANCE"     value={`${breakAllowanceMins} min`} tinted={false} tone={tone} />
                <CompRow label="TAKEN"         value={`${takenMins} min`}        tinted={true}  tone={tone} />
              </>
            )}
          </div>

          {/* Body line */}
          <p style={{ fontSize: 13.5, color: INK2, lineHeight: 1.5, margin: 0 }}>
            {isLate
              ? `Your shift starts at ${scheduledTime}. Any clock-in after your start time is logged as late.`
              : `Your break allowance is ${breakAllowanceMins} minutes. Time over your allowance is logged on your timesheet.`
            }
          </p>

          {/* Escalation banner */}
          {showBanner && (
            <div
              style={{
                borderRadius: 10,
                padding: '10px 14px',
                background: bannerSevere ? '#7a1d0c' : TONES.bad.bg,
                color: bannerSevere ? '#fff' : TONES.bad.fg,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {bannerSevere
                ? 'Disciplinary review triggered'
                : 'Your manager has been notified'
              }
            </div>
          )}

          {/* Reason chips */}
          {showReasonChips && (
            <div
              style={{
                transition: 'transform 0.1s',
                transform: shakeReason ? 'translateX(0)' : undefined,
                animation: shakeReason ? 'shake-reason 0.45s ease' : undefined,
              }}
            >
              <style>{`
                @keyframes shake-reason {
                  0%,100% { transform: translateX(0); }
                  15%     { transform: translateX(-6px); }
                  30%     { transform: translateX(6px); }
                  45%     { transform: translateX(-4px); }
                  60%     { transform: translateX(4px); }
                  75%     { transform: translateX(-2px); }
                  90%     { transform: translateX(2px); }
                }
              `}</style>
              <ReasonChips
                type={type}
                strikeCount={strikeCount}
                selected={selectedReason}
                onSelect={setSelectedReason}
              />
              {submitDisabled && shakeReason && (
                <p style={{ fontSize: 12, color: '#b3331c', marginTop: 6, fontWeight: 500 }}>
                  Please select a reason to continue
                </p>
              )}
            </div>
          )}

          {/* Acknowledge button */}
          <button
            type="button"
            onClick={handleSubmitClick}
            style={{
              width: '100%',
              height: 50,
              borderRadius: 13,
              background: submitDisabled ? '#8a9e95' : '#13362a',
              color: '#fff',
              fontWeight: 700,
              fontSize: 15,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: submitDisabled ? 0.6 : 1,
            }}
          >
            <CheckIcon />
            {isLate ? 'I understand' : 'End break now'}
          </button>

          {/* Footnote */}
          <p className="font-mono text-center" style={{ fontSize: 11, color: INK3, margin: 0 }}>
            Clock-in times are recorded on your timesheet.
          </p>
        </div>
      </div>
    </div>
  )
}

function CompRow({ label, value, tinted, tone }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 14px',
        background: tinted ? tone.soft : 'transparent',
        borderTop: `1px solid ${LINE2}`,
      }}
    >
      <span className="font-mono text-[11px] tracking-widest uppercase" style={{ color: INK3 }}>
        {label}
      </span>
      <span
        className="font-mono text-[14px] font-medium tabular-nums"
        style={{ color: tinted ? tone.fg : INK }}
      >
        {value}
      </span>
    </div>
  )
}
