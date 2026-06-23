import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { useAppSettings } from '../../hooks/useSettings'
import SettingsSubHeader from '../../components/layout/SettingsSubHeader'
import Toggle from '../../components/ui/Toggle'

function Stepper({ value, onChange, suffix, min = 0, max = 99, step = 1 }) {
  const btn = (label, fn, disabled) => (
    <button
      onClick={fn}
      disabled={disabled}
      className={`w-[34px] h-[34px] rounded-[9px] border border-charcoal/10 flex items-center justify-center text-lg font-semibold transition-colors ${disabled ? 'bg-charcoal/5 text-charcoal/30 cursor-default' : 'bg-white text-charcoal hover:bg-charcoal/[0.03]'}`}
    >{label}</button>
  )
  return (
    <div className="flex items-center gap-2 shrink-0">
      {btn('–', () => onChange(Math.max(min, value - step)), value <= min)}
      <span className="font-mono text-sm font-semibold text-charcoal min-w-[52px] text-center tabular-nums">{value}{suffix}</span>
      {btn('+', () => onChange(Math.min(max, value + step)), value >= max)}
    </div>
  )
}

function Row({ label, sub, warnText, control, last }) {
  return (
    <div className={`flex items-center gap-3 px-[15px] py-[13px] ${last === false ? 'border-t border-charcoal/6' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-charcoal tracking-[-0.005em]">{label}</div>
        {sub && <div className="text-[11.5px] text-charcoal/50 mt-0.5 leading-[1.4]">{sub}</div>}
        {warnText && (
          <div className="font-mono text-[10px] text-warning mt-1 uppercase tracking-[0.04em] font-semibold">{warnText}</div>
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
        <div className="font-mono text-[10.5px] font-semibold tracking-[0.08em] uppercase text-charcoal/50 px-0.5 pt-[18px] pb-1.5">{label}</div>
      )}
      <div className="bg-white dark:bg-[#1e1e1e] border border-charcoal/10 rounded-[14px] overflow-hidden">
        {children}
      </div>
      {foot && (
        <div className="text-[11.5px] text-charcoal/50 px-1 pt-2 leading-[1.45]">{foot}</div>
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
    <div className="min-h-screen bg-surface">
      <SettingsSubHeader title="Attendance" onBack={() => navigate(vp('/settings/hub'))} />

      <div className="px-4 pb-24 max-w-[480px] mx-auto">

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
            control={<Toggle checked={requireLateReason} onChange={saveRequireLateReason} />}
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
            control={<Toggle checked={pushToManager} onChange={savePushToManager} />}
          />
        </Group>

      </div>
    </div>
  )
}
