import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useVenue } from '../../contexts/VenueContext'
import { useAppSettings } from '../../hooks/useSettings'
import { useClockRules } from '../../hooks/useClockRules'
import SettingsSubHeader from '../../components/layout/SettingsSubHeader'
import Toggle from '../../components/ui/Toggle'
import Button from '../../components/ui/Button'
import { HOLIDAY_REGIONS } from '../../lib/holiday'
import { MONTH_NAMES, currentHolidayYear } from '../../lib/holidayYear'

/** @param {{ value: number, onChange: (n: number) => void, suffix?: string, min?: number, max?: number, step?: number }} props */
function Stepper({ value, onChange, suffix, min = 0, max = 99, step = 1 }) {
  const btn = (label, fn, disabled) => (
    <button
      onClick={fn}
      disabled={disabled}
      className={`w-[34px] h-[34px] rounded-control border border-charcoal/10 dark:border-white/10 flex items-center justify-center text-lg font-semibold transition-colors ${disabled ? 'bg-charcoal/5 dark:bg-white/5 text-charcoal/30 dark:text-white/30 cursor-default' : 'bg-white dark:bg-paperDark text-charcoal dark:text-white hover:bg-charcoal/[0.03]'}`}
    >{label}</button>
  )
  return (
    <div className="flex items-center gap-2 shrink-0">
      {btn('–', () => onChange(Math.max(min, value - step)), value <= min)}
      <span className="font-mono text-sm font-semibold text-charcoal dark:text-white min-w-[52px] text-center tabular-nums">{value}{suffix}</span>
      {btn('+', () => onChange(Math.min(max, value + step)), value >= max)}
    </div>
  )
}

/** @param {{ label: string, sub?: string, warnText?: string, control: React.ReactNode, last?: boolean }} props */
function Row({ label, sub, warnText, control, last }) {
  return (
    <div className={`flex items-center gap-3 px-[15px] py-[13px] ${last === false ? 'border-t border-charcoal/6 dark:border-white/8' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-charcoal dark:text-white tracking-[-0.005em]">{label}</div>
        {sub && <div className="text-caption text-charcoal/50 dark:text-white/40 mt-0.5 leading-[1.4]">{sub}</div>}
        {warnText && (
          <div className="font-mono text-micro text-warning mt-1 uppercase tracking-[0.04em] font-semibold">{warnText}</div>
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
        <div className="font-mono text-micro font-semibold tracking-[0.08em] uppercase text-charcoal/50 dark:text-white/40 px-0.5 pt-[18px] pb-1.5">{label}</div>
      )}
      <div className="bg-white dark:bg-paperDark border border-charcoal/10 dark:border-white/10 rounded-card overflow-hidden">
        {children}
      </div>
      {foot && (
        <div className="text-caption text-charcoal/50 dark:text-white/40 px-1 pt-2 leading-[1.45]">{foot}</div>
      )}
    </div>
  )
}

/**
 * Where staff can clock in (157): a GPS fence around the venue and/or one
 * clock-in tablet. Both are off until switched on; with both on, the tablet
 * alone decides and GPS isn't asked for.
 */
function ClockPlaceGroups() {
  const {
    rules, available, thisIsTablet,
    saveLocationRule, saveVenuePoint, saveRadius,
    registerThisDevice, saveDeviceRule, forgetDevice,
  } = useClockRules()
  const [busy, setBusy] = React.useState(false)
  const hasPoint = rules.latitude != null && rules.longitude != null
  const hasTablet = !!rules.device_id

  const run = async (fn) => {
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
  }

  if (!available) return null

  return (
    <>
      <Group
        label="Clock-in location"
        foot={rules.require_location
          ? `Staff can only clock in or out within ${rules.radius_m} m of the saved spot — inside the venue, not the car park. Breaks aren't checked. They'll be asked to share their location.`
          : 'Off — staff can clock in from anywhere.'}
      >
        <Row
          label="Only at the venue"
          sub="Uses the phone's GPS when staff clock in or out"
          control={<Toggle aria-label="Only at the venue" checked={rules.require_location} disabled={busy} onChange={(v) => run(() => saveLocationRule(v))} />}
        />
        <Row
          label="Venue spot"
          sub={hasPoint ? 'Saved. Stand inside the venue to update it.' : 'Not set. Stand inside the venue and tap Set.'}
          last={false}
          control={(
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(saveVenuePoint)}>
              {hasPoint ? 'Update' : 'Set'}
            </Button>
          )}
        />
        <Row
          label="How close"
          sub="Smaller keeps the car park out; larger forgives weak GPS indoors"
          last={false}
          control={<Stepper value={rules.radius_m} onChange={(v) => run(() => saveRadius(v))} suffix=" m" min={25} max={200} step={25} />}
        />
      </Group>

      <Group
        label="Clock-in tablet"
        foot={rules.require_device
          ? `Staff can only clock in or out on ${rules.device_name || 'the tablet'}. Breaks aren't checked. With this on, GPS isn't checked — the tablet is the place.`
          : 'Off — staff can clock in from any device.'}
      >
        <Row
          label="Only on the venue tablet"
          sub={hasTablet ? 'Staff sign in on the tablet with their PIN' : 'Set up the tablet first'}
          control={<Toggle aria-label="Only on the venue tablet" checked={rules.require_device} disabled={busy || !hasTablet} onChange={(v) => run(() => saveDeviceRule(v))} />}
        />
        <Row
          label={hasTablet ? (thisIsTablet ? 'This device is the tablet' : (rules.device_name || 'Venue tablet')) : 'Use this device as the tablet'}
          sub={hasTablet
            ? (thisIsTablet ? 'Leave it signed in at the venue.' : 'Set up on another device. Using this one instead replaces it.')
            : 'Do this on the tablet that will stay at the venue.'}
          last={false}
          control={(
            <div className="flex gap-2 shrink-0">
              {hasTablet && (
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(forgetDevice)}>Remove</Button>
              )}
              {!thisIsTablet && (
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(registerThisDevice)}>
                  {hasTablet ? 'Use this' : 'Use this device'}
                </Button>
              )}
            </div>
          )}
        />
      </Group>
    </>
  )
}

export default function AttendanceSettingsPage() {
  const navigate = useNavigate()
  const { venueSlug } = useVenue()
  const settings = useAppSettings()

  const {
    lateGraceMins, breakDurationMins, breakOverrunGraceMins, cleanupMinutes,
    requireLateReason, requireManagerApprovalForLate, notifyManagerAtStrike, disciplinaryAtStrike,
    countingWindowDays, pushToManager, maxStaffOffEnabled, maxStaffOffCount, holidayRegion, holidayYearStartMonth, allowUnpaidLeave,
    saveLateGraceMins, saveBreakDuration, saveBreakOverrunGraceMins, saveCleanupMinutes,
    saveRequireLateReason, saveRequireManagerApprovalForLate, saveNotifyManagerAtStrike, saveDisciplinaryAtStrike,
    saveCountingWindowDays, savePushToManager, saveMaxStaffOffEnabled, saveMaxStaffOffCount, saveHolidayRegion, saveHolidayYearStartMonth, saveAllowUnpaidLeave,
  } = settings

  const vp = (path) => `/v/${venueSlug}${path}`

  return (
    <div>
      <SettingsSubHeader title="Attendance" onBack={() => navigate(vp('/settings/hub'))} />

      <div className="pb-24 max-w-[480px] mx-auto">

        <ClockPlaceGroups />

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
            control={<Toggle aria-label="Require a reason" checked={requireLateReason} onChange={saveRequireLateReason} />}
          />
          <Row
            label="Require manager approval"
            sub="Manager must enter their PIN to dismiss the late alert"
            last={false}
            control={<Toggle aria-label="Require manager approval" checked={requireManagerApprovalForLate} onChange={saveRequireManagerApprovalForLate} />}
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
            control={<Toggle aria-label="Push to manager" checked={pushToManager} onChange={savePushToManager} />}
          />
        </Group>

        <Group
          label="Unpaid leave"
          foot={allowUnpaidLeave
            ? 'Staff choose annual leave or unpaid leave when they ask for time off. Unpaid leave never needs holiday pay.'
            : 'Staff ask for time off as annual leave. On the timesheet you choose for each booking: pay it as holiday, or mark it unpaid.'}
        >
          <Row
            label="Staff can request unpaid leave"
            sub="Off: you decide on the timesheet"
            control={<Toggle aria-label="Staff can request unpaid leave" checked={allowUnpaidLeave} onChange={saveAllowUnpaidLeave} />}
          />
        </Group>

        <Group
          label="Time off"
          foot={maxStaffOffEnabled
            ? `Staff booking a day that already has ${maxStaffOffCount} off will see a warning, but can still submit — useful if it's been pre-cleared with you.`
            : 'Off — staff can request any day off with no staffing-limit warning.'}
        >
          <Row
            label="Limit staff off per day"
            sub="Warn when too many are off at once"
            control={<Toggle aria-label="Limit staff off per day" checked={maxStaffOffEnabled} onChange={saveMaxStaffOffEnabled} />}
          />
          {maxStaffOffEnabled && (
            <Row
              label="Max staff off at once"
              last={false}
              control={<Stepper value={maxStaffOffCount} onChange={saveMaxStaffOffCount} min={1} max={20} />}
            />
          )}
        </Group>

        <Group
          label="Holiday rules"
          foot={holidayRegion === 'ni'
            ? 'Northern Ireland: zero-hours staff get 5.6 weeks a year, each week worth their average week over the last 12 weeks they worked.'
            : holidayRegion === 'gb'
              ? 'England, Scotland and Wales: zero-hours staff build up holiday at 12.07% of the hours they work.'
              : 'Holiday for zero-hours staff is worked out differently in Northern Ireland. Choose where this venue is to see their balances.'}
        >
          <div className="px-[15px] py-[13px]">
            <div className="text-sm font-medium text-charcoal dark:text-white tracking-[-0.005em]">Where is this venue?</div>
            <div className="flex gap-2 flex-wrap mt-2.5" role="radiogroup" aria-label="Where is this venue?">
              {HOLIDAY_REGIONS.map(r => (
                <Button
                  key={r.value}
                  size="sm"
                  variant={holidayRegion === r.value ? 'primary' : 'secondary'}
                  role="radio"
                  aria-checked={holidayRegion === r.value}
                  onClick={() => saveHolidayRegion(r.value)}
                >
                  {r.label}
                </Button>
              ))}
            </div>
          </div>
          <Row
            label="Holiday year starts in"
            sub={`This holiday year: ${currentHolidayYear(holidayYearStartMonth).label}`}
            last={false}
            control={(
              <select
                value={holidayYearStartMonth}
                onChange={e => saveHolidayYearStartMonth(Number(e.target.value))}
                aria-label="Holiday year starts in"
                className="shrink-0 h-[34px] px-2.5 rounded-control border border-charcoal/10 dark:border-white/10 bg-white dark:bg-paperDark text-sm font-medium text-charcoal dark:text-white focus:outline-none focus:ring-2 focus:ring-charcoal/20 dark:focus:ring-white/20"
              >
                {MONTH_NAMES.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
              </select>
            )}
          />
        </Group>

      </div>
    </div>
  )
}
