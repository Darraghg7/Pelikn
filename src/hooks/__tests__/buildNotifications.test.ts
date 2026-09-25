import { describe, it, expect } from 'vitest'
import { buildNotifications, type NotificationData } from '../useNotifications'

// Friday 25 Sep 2026, 11:00 local. Timestamps below carry no zone so they are
// read as local time too, keeping these tests independent of the machine TZ.
const NOW = new Date(2026, 8, 25, 11, 0, 0)

function data(over: Partial<NotificationData> = {}): NotificationData {
  return {
    break_duration_mins: null,
    closed_days: null,
    swaps_pending: 0,
    time_off_pending: 0,
    shifts_today: [],
    clock_ins_today: [],
    breaks_today: [],
    task_templates: [],
    task_completions_yesterday: [],
    shifts_30d: [],
    clock_ins_30d: [],
    fridge_logs_today: [],
    fridges: [],
    training: [],
    cleaning_tasks: [],
    venue_closures: [],
    cleaning_last: [],
    actions_open: [],
    // A recent calibration so the "never calibrated" nag stays out of the way.
    probe_last: [{ calibrated_at: '2026-09-20T09:00:00' }],
    clock_edit_pending: [],
    hour_edits: [],
    ...over,
  }
}

const ids = (d: NotificationData) => buildNotifications(d, NOW).map(n => n.id)

describe('buildNotifications', () => {
  it('is empty when nothing needs attention', () => {
    expect(ids(data())).toEqual([])
  })

  it('nags about probes that were never calibrated', () => {
    expect(ids(data({ probe_last: [] }))).toEqual(['probe-never'])
  })

  it('counts pending swaps and time off', () => {
    const out = buildNotifications(data({ swaps_pending: 2, time_off_pending: 1 }), NOW)
    expect(out.map(n => n.message)).toEqual([
      '2 shift swap requests pending',
      '1 time-off request awaiting approval',
    ])
  })

  it('flags a clock-in a minute or more after the shift start', () => {
    const out = buildNotifications(data({
      shifts_today: [
        { staff_id: 'a', start_time: '09:00:00' },
        { staff_id: 'b', start_time: '09:00:00' },
      ],
      clock_ins_today: [
        { staff_id: 'a', occurred_at: '2026-09-25T09:01:30', staff: { name: 'Ana' } },
        { staff_id: 'b', occurred_at: '2026-09-25T09:00:59', staff: { name: 'Ben' } },
      ],
    }), NOW)
    expect(out).toHaveLength(1)
    expect(out[0].message).toBe('Late clock-in today: Ana')
  })

  it('uses the venue break length for overdue breaks', () => {
    const d = data({
      break_duration_mins: '45',
      breaks_today: [{ staff_id: 'a', event_type: 'break_start', occurred_at: '2026-09-25T10:20:00', staff: { name: 'Ana' } }],
    })
    expect(ids(d)).toEqual([]) // 40 min in, allowed 45
    d.break_duration_mins = '30'
    expect(ids(d)).toEqual(['overdue-break'])
  })

  it('does not nag about cleaning on a closed day', () => {
    const d = data({
      cleaning_tasks: [{ id: 't1', title: 'Deep clean', frequency: 'daily' }],
      cleaning_last: [],
    })
    expect(ids(d)).toEqual(['cleaning-overdue'])
    d.closed_days = JSON.stringify([4]) // Monday = 0, so Friday = 4
    expect(ids(d)).toEqual([])
  })

  it('reads only the latest completion per task', () => {
    const d = data({
      cleaning_tasks: [{ id: 't1', title: 'Deep clean', frequency: 'daily' }],
      cleaning_last: [{ cleaning_task_id: 't1', completed_at: '2026-09-25T08:00:00' }],
    })
    expect(ids(d)).toEqual([])
  })

  it('shows pending hour edit requests instead of the legacy edit log', () => {
    const d = data({
      clock_edit_pending: [{ staff: { name: 'Ana' } }],
      hour_edits: [{ staff_name: 'Ben' }],
    })
    expect(ids(d)).toEqual(['hour-edit-requests'])
    d.clock_edit_pending = []
    expect(ids(d)).toEqual(['hour-edits'])
  })

  it('sorts critical before warning before info', () => {
    const out = buildNotifications(data({
      hour_edits: [{ staff_name: 'Ben' }],
      swaps_pending: 1,
      actions_open: [{ title: 'Broken freezer', severity: 'critical' }],
    }), NOW)
    expect(out.map(n => n.severity)).toEqual(['critical', 'warning', 'info'])
  })

  it('ignores explained fridge exceedances', () => {
    const fridge = { name: 'Walk-in', min_temp: 0, max_temp: 5 }
    const d = data({
      fridge_logs_today: [
        { fridge_id: 'f1', temperature: 9, exceedance_reason: 'delivery', fridge },
        { fridge_id: 'f1', temperature: 9, exceedance_reason: null, fridge },
      ],
    })
    const out = buildNotifications(d, NOW)
    expect(out[0].message).toBe('1 temp reading out of range: Walk-in')
  })
})
