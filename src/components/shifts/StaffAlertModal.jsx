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

// ── Alert tone ───────────────────────────────────────────────────────────────
// Urgent two-tone chime via Web Audio — no audio asset needed, works offline.
// Browsers allow this because the modal always follows a user tap (clock in /
// break end); if audio is blocked or unsupported it fails silently.
function playAlertTone() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const beep = (freq, at, dur) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = freq
      const t = ctx.currentTime + at
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + dur + 0.05)
    }
    beep(880, 0,    0.28)
    beep(660, 0.34, 0.28)
    beep(880, 0.68, 0.42)
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    setTimeout(() => { ctx.close().catch(() => {}) }, 2000)
  } catch { /* audio unavailable — alert still shows */ }
}

// ── Reason chips ─────────────────────────────────────────────────────────────
const LATE_REASONS    = ['Transport', 'Overslept', 'Personal', 'Other']
const BREAK_REASONS   = ['Service was busy', 'Lost track of time', 'Personal', 'Other']

function ReasonChips({ type, selected, onSelect }) {
  const reasons = type === 'late_clock_in' ? LATE_REASONS : BREAK_REASONS
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12px] font-medium" style={{ color: INK3 }}>
        Select a reason
      </p>
      <div className="flex flex-wrap gap-2">
        {reasons.map(r => (
          <button
            key={r}
            type="button"
            onClick={() => onSelect(selected === r ? null : r)}
            className="text-[13px] font-medium cursor-pointer transition-all duration-150"
            style={{
              border: `1.5px solid ${selected === r ? INK2 : LINE}`,
              background: selected === r ? INK : 'transparent',
              color: selected === r ? '#fff' : INK2,
              borderRadius: 20,
              padding: '6px 14px',
            }}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Manager PIN phase icons ───────────────────────────────────────────────────
function ShieldIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

// ── Manager PIN numpad ────────────────────────────────────────────────────────
function PinDots({ length, shake }) {
  return (
    <div
      className="flex gap-3 justify-center"
      style={{
        animation: shake ? 'pin-shake 0.4s ease' : 'none',
      }}
    >
      {[0, 1, 2, 3].map(i => (
        <div
          key={i}
          style={{
            width: 14, height: 14, borderRadius: '50%',
            background: i < length ? INK : 'transparent',
            border: `2px solid ${i < length ? INK : LINE}`,
            transition: 'background 0.12s, border-color 0.12s',
          }}
        />
      ))}
    </div>
  )
}

function ManagerNumpad({ pin, onChange }) {
  const handle = (digit) => {
    if (pin.length < 4) onChange(pin + digit)
  }
  const del = () => onChange(pin.slice(0, -1))

  const keyStyle = {
    width: '100%', aspectRatio: '1.3',
    background: '#f5f6f4',
    border: 'none',
    borderRadius: 12,
    fontSize: 22,
    fontWeight: 600,
    color: INK,
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 0.1s',
    fontFamily: 'inherit',
  }

  const rows = [['1','2','3'],['4','5','6'],['7','8','9']]
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {rows.map(row => (
        <div key={row[0]} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {row.map(d => (
            <button key={d} type="button" onPointerDown={() => handle(d)} style={keyStyle}>{d}</button>
          ))}
        </div>
      ))}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div />
        <button type="button" onPointerDown={() => handle('0')} style={keyStyle}>0</button>
        <button
          type="button"
          onPointerDown={del}
          style={{ ...keyStyle, fontSize: 18 }}
          aria-label="Delete"
        >⌫</button>
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
  scheduledTime,
  actualTime,
  breakStartTime,
  breakAllowanceMins = 30,
  takenMins,
  requireLateReason = true,
  requireManagerApproval = false,
  managers = [],
  onVerifyManagerPin,
  onAcknowledge,
}) {
  const tone = getTone(strikeCount)
  const [visible, setVisible] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [selectedReason, setSelectedReason] = useState(null)

  // Manager PIN phase state
  const [phase, setPhase] = useState('alert') // 'alert' | 'manager_pin'
  const [selectedManager, setSelectedManager] = useState(null)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinLoading, setPinLoading] = useState(false)
  const [shake, setShake] = useState(false)

  useEffect(() => {
    if (open) {
      setVisible(true)
      setSelectedReason(null)
      setPhase('alert')
      setSelectedManager(null)
      setPin('')
      setPinError('')
      playAlertTone()
      if (navigator.vibrate) { try { navigator.vibrate([200, 100, 200]) } catch { /* not supported */ } }
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
  const reasonMissing   = showReasonChips && !selectedReason

  const handleSubmitClick = () => {
    if (reasonMissing) return // a reason must be selected before continuing
    if (requireManagerApproval) {
      setPhase('manager_pin')
    } else {
      onAcknowledge(selectedReason)
    }
  }

  const handleManagerApprove = async () => {
    if (!selectedManager || pin.length !== 4 || pinLoading) return
    setPinLoading(true)
    setPinError('')
    const result = await onVerifyManagerPin(selectedManager.id, pin)
    setPinLoading(false)
    if (result.ok) {
      onAcknowledge(selectedReason)
    } else {
      setPin('')
      setPinError(result.error ?? 'Incorrect PIN, try again')
      setShake(true)
      setTimeout(() => setShake(false), 500)
    }
  }

  // Auto-submit when 4th digit is entered
  useEffect(() => {
    if (phase === 'manager_pin' && pin.length === 4) {
      handleManagerApprove()
    }
  }, [pin]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Shake animation keyframes */}
      <style>{`
        @keyframes pin-shake {
          0%,100% { transform: translateX(0) }
          20%      { transform: translateX(-6px) }
          40%      { transform: translateX(6px) }
          60%      { transform: translateX(-4px) }
          80%      { transform: translateX(4px) }
        }
      `}</style>

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

          {phase === 'alert' ? (
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
              <h1 className="text-[22px] font-semibold tracking-[-0.022em] leading-[1.2]" style={{ color: INK, margin: 0 }}>
                {heading}
              </h1>

              {/* Big mono number */}
              <div>
                <span className="font-mono text-[34px] font-medium leading-none" style={{ color: tone.fg }}>
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
                    <CompRow label="BREAK STARTED" value={breakStartTime}              tinted={false} tone={tone} />
                    <CompRow label="ALLOWANCE"     value={`${breakAllowanceMins} min`} tinted={false} tone={tone} />
                    <CompRow label="TAKEN"         value={`${takenMins} min`}          tinted={true}  tone={tone} />
                  </>
                )}
              </div>

              {/* Body line */}
              <p className="text-[13.5px] leading-relaxed" style={{ color: INK2, margin: 0 }}>
                {isLate
                  ? `Your shift starts at ${scheduledTime}. Any clock-in after your start time is logged as late.`
                  : `Your break allowance is ${breakAllowanceMins} minutes. Time over your allowance is logged on your timesheet.`
                }
              </p>

              {/* Escalation banner */}
              {showBanner && (
                <div
                  className="text-[13px] font-semibold"
                  style={{
                    borderRadius: 10,
                    padding: '10px 14px',
                    background: bannerSevere ? '#7a1d0c' : TONES.bad.bg,
                    color: bannerSevere ? '#fff' : TONES.bad.fg,
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
                <ReasonChips
                  type={type}
                  selected={selectedReason}
                  onSelect={setSelectedReason}
                />
              )}

              {/* CTA button — locked until a reason is selected when reasons are required */}
              <button
                type="button"
                onClick={handleSubmitClick}
                disabled={reasonMissing}
                className="w-full flex items-center justify-center gap-2 text-[15px] font-bold text-white bg-brand border-none cursor-pointer"
                style={{
                  height: 50, borderRadius: 13,
                  opacity: reasonMissing ? 0.4 : 1,
                  cursor: reasonMissing ? 'not-allowed' : 'pointer',
                }}
              >
                {requireManagerApproval ? (
                  <>
                    <ShieldIcon />
                    Show to Manager
                  </>
                ) : (
                  <>
                    <CheckIcon />
                    {isLate ? 'I understand' : 'End break now'}
                  </>
                )}
              </button>

              {/* Footnote */}
              <p className="font-mono text-center text-[11px]" style={{ color: INK3, margin: 0 }}>
                {requireManagerApproval
                  ? 'A manager on shift must approve this late clock-in.'
                  : 'Clock-in times are recorded on your timesheet.'
                }
              </p>
            </div>
          ) : (
            /* ── Phase 2: Manager PIN ─────────────────────────────────────── */
            <div className="px-5 pt-4 pb-2 flex flex-col gap-4">

              {/* Back button */}
              <button
                type="button"
                onClick={() => { setPhase('alert'); setPin(''); setPinError('') }}
                className="flex items-center gap-1 text-[13px] font-medium border-none bg-transparent cursor-pointer self-start"
                style={{ color: INK3, padding: 0 }}
              >
                <BackIcon /> Back
              </button>

              {/* Header */}
              <div className="flex flex-col gap-1">
                <p className="font-mono text-[11px] tracking-[0.12em] uppercase font-medium" style={{ color: tone.fg }}>
                  MANAGER APPROVAL
                </p>
                <h1 className="text-[20px] font-semibold tracking-[-0.02em] leading-[1.2]" style={{ color: INK, margin: 0 }}>
                  Hand to manager on shift
                </h1>
                <p className="text-[13px] leading-relaxed" style={{ color: INK2, marginTop: 2 }}>
                  The manager needs to select their name and enter their PIN to approve this late clock-in.
                </p>
              </div>

              {/* Manager list */}
              {managers.length === 0 ? (
                <div
                  className="text-[13px] text-center"
                  style={{ color: INK3, padding: '14px', background: LINE2, borderRadius: 10 }}
                >
                  No managers found for this venue.
                </div>
              ) : (
                <div className="flex flex-col" style={{ border: `1px solid ${LINE}`, borderRadius: 12, overflow: 'hidden' }}>
                  {managers.map((m, i) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { setSelectedManager(m); setPin(''); setPinError('') }}
                      className="flex items-center gap-3 text-left border-none cursor-pointer transition-colors"
                      style={{
                        padding: '11px 14px',
                        background: selectedManager?.id === m.id ? '#f0f7f3' : '#fff',
                        borderTop: i > 0 ? `1px solid ${LINE2}` : 'none',
                      }}
                    >
                      <div
                        style={{
                          width: 34, height: 34, borderRadius: '50%',
                          background: selectedManager?.id === m.id ? '#1a6644' : LINE2,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, fontWeight: 700, color: selectedManager?.id === m.id ? '#fff' : INK3,
                          flexShrink: 0,
                          overflow: 'hidden',
                        }}
                      >
                        {m.photo_url
                          ? <img src={m.photo_url} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : m.name.charAt(0).toUpperCase()
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold" style={{ color: INK, margin: 0 }}>{m.name}</p>
                        <p className="text-[11px] capitalize" style={{ color: INK3, margin: 0 }}>{m.role}</p>
                      </div>
                      {selectedManager?.id === m.id && (
                        <div style={{ color: '#1a6644' }}><CheckIcon /></div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* PIN entry — only shown once a manager is selected */}
              {selectedManager && (
                <div className="flex flex-col gap-3">
                  <p className="text-[12px] font-medium text-center" style={{ color: INK3 }}>
                    {selectedManager.name} — enter your PIN
                  </p>
                  <PinDots length={pin.length} shake={shake} />
                  {pinError && (
                    <p className="text-[12px] font-semibold text-center" style={{ color: TONES.bad.fg }}>
                      {pinError}
                    </p>
                  )}
                  <ManagerNumpad pin={pin} onChange={(p) => { setPinError(''); setPin(p) }} />
                  <button
                    type="button"
                    onClick={handleManagerApprove}
                    disabled={pin.length !== 4 || pinLoading}
                    className="w-full flex items-center justify-center gap-2 text-[15px] font-bold text-white border-none cursor-pointer"
                    style={{
                      height: 50, borderRadius: 13,
                      background: pin.length === 4 && !pinLoading ? '#1a6644' : LINE,
                      color: pin.length === 4 && !pinLoading ? '#fff' : INK3,
                      transition: 'background 0.15s',
                    }}
                  >
                    {pinLoading ? 'Verifying…' : 'Approve'}
                  </button>
                </div>
              )}

              <p className="font-mono text-center text-[11px]" style={{ color: INK3, margin: 0 }}>
                Manager approval is logged against this late clock-in.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
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
