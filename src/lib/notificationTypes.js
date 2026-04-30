export const NOTIFICATION_TYPES = [
  {
    id: 'temperature_alert',
    label: 'Temperature alerts',
    description: 'Fridge or food temperature readings outside the safe range.',
  },
  {
    id: 'late_clock_in',
    label: 'Late clock-ins',
    description: 'Staff clocking in more than 5 minutes after a scheduled shift starts.',
  },
  {
    id: 'early_clock_out',
    label: 'Early clock-outs',
    description: 'Staff clocking out before their scheduled shift ends.',
  },
  {
    id: 'corrective_action_logged',
    label: 'Corrective actions',
    description: 'New food safety or operational corrective actions.',
  },
  {
    id: 'time_off_request',
    label: 'New time-off requests',
    description: 'Staff requests that need manager approval.',
  },
  {
    id: 'time_off_decision',
    label: 'Time-off decisions',
    description: 'Approval or rejection updates for your own time-off requests.',
  },
  {
    id: 'rota_published',
    label: 'Rota published',
    description: 'A new rota has been published for a week you are scheduled.',
  },
  {
    id: 'shift_swap_request',
    label: 'Shift swap requests',
    description: 'New shift swap requests that need manager review.',
  },
  {
    id: 'shift_swap_decision',
    label: 'Shift swap decisions',
    description: 'Approval or rejection updates for your own shift swap requests.',
  },
]
