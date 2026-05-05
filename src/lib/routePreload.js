const routeModules = [
  () => import('../pages/DashboardPage'),
  () => import('../pages/tasks/TasksPage'),
  () => import('../pages/settings/SettingsPage'),
  () => import('../pages/opening/OpeningClosingPage'),
  () => import('../pages/cleaning/CleaningPage'),
  () => import('../pages/fridge/FridgeDashboardPage'),
  () => import('../pages/rota/RotaPage'),
  () => import('../pages/clockin/TimesheetPage'),
  () => import('../pages/training/TrainingPage'),
  () => import('../pages/timeoff/TimeOffPage'),
  () => import('../pages/staff/StaffPage'),
]

const routeImportBySegment = {
  dashboard: () => import('../pages/DashboardPage'),
  tasks: () => import('../pages/tasks/TasksPage'),
  settings: () => import('../pages/settings/SettingsPage'),
  audit: () => import('../pages/audit/EHOAuditPage'),
  'opening-closing': () => import('../pages/opening/OpeningClosingPage'),
  fitness: () => import('../pages/fitness/FitnessPage'),
  fridge: () => import('../pages/fridge/FridgeDashboardPage'),
  'cooking-temps': () => import('../pages/cooking/CookingTempsPage'),
  'hot-holding': () => import('../pages/hotholding/HotHoldingPage'),
  'cooling-logs': () => import('../pages/cooling/CoolingLogsPage'),
  deliveries: () => import('../pages/deliveries/DeliveryChecksPage'),
  probe: () => import('../pages/probe/ProbeCalibrationPage'),
  allergens: () => import('../pages/allergens/AllergenRegistryPage'),
  cleaning: () => import('../pages/cleaning/CleaningPage'),
  corrective: () => import('../pages/corrective/CorrectiveActionsPage'),
  rota: () => import('../pages/rota/RotaPage'),
  timesheet: () => import('../pages/clockin/TimesheetPage'),
  training: () => import('../pages/training/TrainingPage'),
  'time-off': () => import('../pages/timeoff/TimeOffPage'),
  staff: () => import('../pages/staff/StaffPage'),
  suppliers: () => import('../pages/suppliers/SuppliersPage'),
  haccp: () => import('../pages/haccp/HACCPPage'),
  'eho-mock': () => import('../pages/eho/EHOMockPage'),
  'clock-in': () => import('../pages/clockin/ClockInPage'),
  noticeboard: () => import('../pages/noticeboard/NoticeBoardPage'),
  waste: () => import('../pages/waste/WasteLogPage'),
  orders: () => import('../pages/orders/SupplierOrdersPage'),
  overview: () => import('../pages/overview/OverviewPage'),
}

const loaded = new Set()

function warm(load) {
  if (!load || loaded.has(load)) return
  loaded.add(load)
  load().catch(() => loaded.delete(load))
}

export function preloadRoute(path) {
  const parts = String(path)
    .split('?')[0]
    .split('#')[0]
    .split('/')
    .filter(Boolean)
  const segment = parts[parts.length - 1]
  warm(routeImportBySegment[segment])
}

export function preloadAppRoutes() {
  const run = () => routeModules.forEach(warm)
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 1200 })
  } else {
    window.setTimeout(run, 250)
  }
}
