/**
 * Widget Registry — thin index.
 * Each widget lives in its own file; this module re-exports them all
 * and defines the registry metadata used by the dashboard.
 */
import { lazy } from 'react'

// Lazy-loaded so a login only downloads the code for the widgets a venue
// actually has enabled, instead of bundling all 11 into the dashboard chunk.
const ComplianceScoreWidget = lazy(() => import('./ComplianceScoreWidget'))
const FridgeAlertsWidget = lazy(() => import('./FridgeAlertsWidget'))
const CleaningOverdueWidget = lazy(() => import('./CleaningOverdueWidget'))
const StaffOnShiftWidget = lazy(() => import('./StaffOnShiftWidget'))
const OpenActionsWidget = lazy(() => import('./OpenActionsWidget'))
const ExpiringTrainingWidget = lazy(() => import('./ExpiringTrainingWidget'))
const TodaysDeliveriesWidget = lazy(() => import('./TodaysDeliveriesWidget'))
const WeeklyLabourWidget = lazy(() => import('./WeeklyLabourWidget'))
const PendingSwapsWidget = lazy(() => import('./PendingSwapsWidget'))
const ProbeCalDueWidget = lazy(() => import('./ProbeCalDueWidget'))
const StaffNotificationsWidget = lazy(() => import('./StaffNotificationsWidget'))

export {
  ComplianceScoreWidget,
  FridgeAlertsWidget,
  CleaningOverdueWidget,
  StaffOnShiftWidget,
  OpenActionsWidget,
  ExpiringTrainingWidget,
  TodaysDeliveriesWidget,
  WeeklyLabourWidget,
  PendingSwapsWidget,
  ProbeCalDueWidget,
  StaffNotificationsWidget,
}

/* ═══════════════════════════════════════════════════════════════════════════
   REGISTRY — maps widget IDs to components + metadata
   ═══════════════════════════════════════════════════════════════════════════ */

export const WIDGET_REGISTRY = {
  compliance_score:   { id: 'compliance_score',   label: 'Compliance Score',      description: 'Overall compliance percentage based on all checks', component: ComplianceScoreWidget },
  fridge_alerts:      { id: 'fridge_alerts',      label: 'Fridge Status',         description: 'Today\'s readings, out-of-range alerts, unchecked fridges', component: FridgeAlertsWidget },
  cleaning_overdue:   { id: 'cleaning_overdue',   label: 'Cleaning',              description: 'Number of overdue cleaning tasks', component: CleaningOverdueWidget },
  staff_on_shift:     { id: 'staff_on_shift',     label: 'Staff On Shift',        description: 'Who\'s working today with shift times', component: StaffOnShiftWidget },
  open_actions:       { id: 'open_actions',       label: 'Open Actions',          description: 'Unresolved corrective actions by severity', component: OpenActionsWidget },
  expiring_training:  { id: 'expiring_training',  label: 'Training Expiry',       description: 'Staff certificates expiring within 30 days', component: ExpiringTrainingWidget },
  todays_deliveries:  { id: 'todays_deliveries',  label: 'Today\'s Deliveries',   description: 'Delivery checks logged today with pass/fail', component: TodaysDeliveriesWidget },
  weekly_labour:      { id: 'weekly_labour',      label: 'Weekly Labour Cost',    description: 'Total wage bill from this week\'s rota', component: WeeklyLabourWidget },
  pending_swaps:          { id: 'pending_swaps',          label: 'Swap Requests',         description: 'Pending shift swap requests awaiting approval', component: PendingSwapsWidget },
  probe_calibration:      { id: 'probe_calibration',      label: 'Probe Calibration',     description: 'Days since last calibration and recent failures', component: ProbeCalDueWidget },
  staff_notifications:    { id: 'staff_notifications',    label: 'Staff Notifications',   description: 'Pending leave requests, shift swaps, and training sign-offs', component: StaffNotificationsWidget },
}

export const DEFAULT_WIDGETS = [
  'compliance_score',
  'fridge_alerts',
  'cleaning_overdue',
  'staff_on_shift',
  'staff_notifications',
]

export const ALL_WIDGET_IDS = Object.keys(WIDGET_REGISTRY)
