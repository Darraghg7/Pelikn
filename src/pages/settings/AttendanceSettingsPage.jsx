import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { useAppSettings } from '../../hooks/useSettings'

// ── Design tokens ──────────────────────────────────────────────────────────
const MC = {
  brand:  '#13362a',
  good:   '#16a34a',
  warn:   '#d97706',
  ink:    '#111827', ink2: '#374151', ink3: '#6b7280', ink4: '#9ca3af',
  line:   '#e5e7eb', line2: '#f3f4f6',
  paper:  '#ffffff',
}
const MONO = 'ui-monospace, SFMono-Regular, monospace'

// ── Shared controls ────────────────────────────────────────────────────────
function Toggle({ on, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      style={{
        width: 46, height: 28, borderRadius: 999, border: 'none', cursor: 'pointer', flexShrink: 0,
        background: on ? MC.good : MC.line, position: 'relative', transition: 'background .18s', padding: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: on ? 21 : 3, width: 22, height: 22,
        borderRadius: 999, background: '#fff',
        boxShadow: '0 1px 3px rgba(9,18,13,0.25)', transition: 'left .18s',
      }} />
    </button>
  )
}

function Stepper({ value, onChange, suffix, min = 0, max = 99, step = 1 }) {
  const btn = (label, fn, disabled) => (
    <button
      onClick={fn}
      disabled={disabled}
      style={{
        width: 34, height: 34, borderRadius: 9, border: `1px solid ${MC.line}`,
        background: disabled ? MC.line2 : MC.paper,
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? MC.ink4 : MC.ink,
        fontSize: 18, fontWeight: 600,
        display: 'grid', placeItems: 'center', lineHeight: 1,
      }}
    >{label}</button>
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      {btn('–', () => onChange(Math.max(min, value - step)), value <= min)}
      <span style={{
        fontFamily: MONO, fontSize: 14, fontWeight: 600, color: MC.ink,
        minWidth: 52, textAlign: 'center', fontVariantNumeric: 'tabular-nums',
      }}>{value}{suffix}</span>
      {btn('+', () => onChange(Math.min(max, value + step)), value >= max)}
    </div>
  )
}

function Row({ label, sub, warnText, control, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px',
      borderTop: last === false ? `1px solid ${MC.line2}` : 'none',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: MC.ink, letterSpacing: '-0.005em' }}>{label}</div>
        {sub && <div style={{ fontSize: 11.5, color: MC.ink3, marginTop: 2, lineHeight: 1.4 }}>{sub}</div>}
        {warnText && (
          <div style={{
            fontFamily: MONO, fontSize: 10, color: MC.warn, marginTop: 4,
            textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600,
          }}>{warnText}</div>
        )}
      </div>
      {control}
    </div>
  )
}

function Group({ label, children, foot }) {
  return (
    <div>
      {label && (
        <div style={{
          fontFamily: MONO, fontSize: 10.5, color: MC.ink3, letterSpacing: '0.08em',
          textTransform: 'uppercase', fontWeight: 600, padding: '0 2px 7px',
        }}>{label}</div>
      )}
      <div style={{ background: MC.paper, border: `1px solid ${MC.line}`, borderRadius: 14, overflow: 'hidden' }}>
        {children}
      </div>
      {foot && (
        <div style={{ fontSize: 11.5, color: MC.ink3, padding: '8px 4px 0', lineHeight: 1.45 }}>{foot}</div>
      )}
    </div>
  )
}

// ── AttendanceSettingsPage ─────────────────────────────────────────────────
export default function AttendanceSettingsPage() {
  const navigate = useNavigate()
  const { venueSlug } = useVenue()
  const settings = useAppSettings()

  const {
    lateGraceMins, breakDurationMins, breakOverrunGraceMins, cleanupMinutes,
    requireLateReason, notifyManagerAtStrike, disciplinaryAtStrike,
    countingWindowDays, pushToManager,
    saveLateGraceMins, saveBreakDuration, saveBreakOverrunGraceMins, saveCleanupMinutes,
    saveRequireLateReason, saveNotifyManagerAtStrike, saveDisciplinaryAtStrike,
    saveCountingWindowDays, savePushToManager,
  } = settings

  const vp = (path) => `/v/${venueSlug}${path}`

  return (
    <div style={{ padding: '16px 16px 96px', maxWidth: 480, margin: '0 auto' }}>

      {/* Back button */}
      <button
        onClick={() => navigate(vp('/settings'))}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16,
          background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
          color: MC.brand, fontSize: 14, fontWeight: 500,
        }}
      >
        <svg width="7" height="12" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(180deg)' }}>
          <path d="M1 1l4 4-4 4"/>
        </svg>
        Settings
      </button>

      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.025em', margin: 0, color: MC.ink }}>Attendance</h1>
        <div style={{ fontSize: 12.5, color: MC.ink3, marginTop: 4 }}>Clock-in & break rules</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Late clock-in */}
        <Group
          label="Late clock-in"
          foot={lateGraceMins === 0
            ? 'Grace is off — any clock-in after the scheduled start counts as late.'
            : `Staff have ${lateGraceMins} min after their start before they're marked late.`}
        >
          <Row
            label="Grace period"
            sub="Minutes after start before 'late'"
            control={<Stepper value={lateGraceMins} onChange={saveLateGraceMins} suffix=" min" max={30} />}
          />
          <Row
            label="Require a reason"
            sub="Staff pick a reason when late"
            last={false}
            control={<Toggle on={requireLateReason} onClick={() => saveRequireLateReason(!requireLateReason)} />}
          />
        </Group>

        {/* Breaks */}
        <Group
          label="Breaks"
          foot={`Returning more than ${breakOverrunGraceMins} min past the ${breakDurationMins}-min allowance is logged as an overrun.`}
        >
          <Row
            label="Break allowance"
            control={<Stepper value={breakDurationMins} onChange={saveBreakDuration} suffix=" min" step={5} max={90} />}
          />
          <Row
            label="Overrun grace"
            sub="Before an overrun is flagged"
            last={false}
            control={<Stepper value={breakOverrunGraceMins} onChange={saveBreakOverrunGraceMins} suffix=" min" max={20} />}
          />
        </Group>

        {/* Clock-out grace */}
        <Group
          label="Clock-out"
          foot={cleanupMinutes === 0 ? 'No grace — clock-outs must match the scheduled end exactly.' : `Clock-outs within ${cleanupMinutes} min of the scheduled end won't show as a discrepancy.`}
        >
          <Row
            label="Cleanup grace"
            sub="Minutes past shift end before flagged"
            control={<Stepper value={cleanupMinutes} onChange={saveCleanupMinutes} suffix=" min" step={15} max={60} />}
          />
        </Group>

        {/* Escalation */}
        <Group
          label="Escalation"
          foot={`Counted over a rolling ${countingWindowDays}-day window. ${notifyManagerAtStrike}${notifyManagerAtStrike === 1 ? 'st' : notifyManagerAtStrike === 2 ? 'nd' : 'rd'} offence notifies the manager; ${disciplinaryAtStrike}th triggers a disciplinary review.`}
        >
          <Row
            label="Notify manager at"
            sub="Repeat offences before alert"
            control={
              <Stepper
                value={notifyManagerAtStrike}
                onChange={(v) => saveNotifyManagerAtStrike(Math.min(v, disciplinaryAtStrike - 1))}
                suffix="rd"
                min={2}
                max={5}
              />
            }
          />
          <Row
            label="Disciplinary at"
            sub="Offences before formal review"
            last={false}
            control={
              <Stepper
                value={disciplinaryAtStrike}
                onChange={(v) => saveDisciplinaryAtStrike(Math.max(v, notifyManagerAtStrike + 1))}
                suffix="th"
                min={3}
                max={6}
              />
            }
          />
          <Row
            label="Counting window"
            last={false}
            control={<Stepper value={countingWindowDays} onChange={saveCountingWindowDays} suffix=" days" step={5} min={7} max={90} />}
          />
          <Row
            label="Push to manager"
            sub="Send a notification on escalation"
            last={false}
            control={<Toggle on={pushToManager} onClick={() => savePushToManager(!pushToManager)} />}
          />
        </Group>

      </div>
    </div>
  )
}
