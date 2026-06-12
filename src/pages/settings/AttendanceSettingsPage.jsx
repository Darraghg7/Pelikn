import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { useAppSettings } from '../../hooks/useSettings'

const MC = {
  brand:  '#13362a', brandTint: '#eef4f0',
  good:   '#1a7a4c', goodBg: '#e3f0e7',
  warn:   '#a85d12', warnBg: '#fbeedc',
  bad:    '#b3331c', badBg:  '#fbeae6',
  ink:    '#0d1a14', ink2: '#3d4a44', ink3: '#76817b', ink4: '#b3b9b5',
  line:   '#e4e6e2', line2: '#eef0ec',
  paper:  '#ffffff', bg: '#f3f3ef',
}
const MONO = 'ui-monospace, SFMono-Regular, monospace'
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

function SubHeader({ title, onBack }) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 10,
      background: 'rgba(243,243,239,0.92)',
      backdropFilter: 'saturate(180%) blur(20px)',
      WebkitBackdropFilter: 'saturate(180%) blur(20px)',
      borderBottom: `1px solid ${MC.line}`,
      padding: '12px 16px 10px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        color: MC.brand, background: 'none', border: 'none',
        cursor: 'pointer', padding: '4px 0', fontFamily: SANS, fontSize: 15, fontWeight: 500,
      }}>
        <svg width="9" height="15" viewBox="0 0 9 15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 1L1.5 7.5 8 14"/>
        </svg>
        Settings
      </button>
      <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em', color: MC.ink }}>{title}</span>
      <span style={{ width: 70 }} />
    </div>
  )
}

function Toggle({ on, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      style={{
        width: 46, height: 28, borderRadius: 999, border: 'none', cursor: 'pointer', flexShrink: 0,
        background: on ? MC.brand : MC.line, position: 'relative', transition: 'background .18s', padding: 0,
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
          textTransform: 'uppercase', fontWeight: 600, padding: '18px 2px 7px',
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
    <div style={{ minHeight: '100vh', background: MC.bg, fontFamily: SANS }}>
      <SubHeader title="Attendance" onBack={() => navigate(vp('/settings/hub'))} />

      <div style={{ padding: '0 16px 96px', maxWidth: 480, margin: '0 auto' }}>

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
