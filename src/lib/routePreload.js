// Warmed in the background on a cold start. Deliberately short: each entry
// drags in its transitive chunks too, so this list is worth far more bytes than
// it looks. Warming all eleven routes that used to be here pulled ~50 chunks /
// ~1.4 MB on every cold load — most of it for screens the session never opens.
// Everything else is warmed on navigation intent via preloadRoute().
const routeModules = [
  () => import('../pages/DashboardPage'),
  () => import('../pages/tasks/TasksPage'),
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

/**
 * True when speculative background downloads would cost the user more than they
 * save — a metered or slow connection. Warming a route is a bet that the user
 * will open it; on a kitchen's 4G that bet is paid for out of the bandwidth the
 * screen they *are* looking at needs to finish loading.
 *
 * `connection` is Chromium-only. Absent (Safari/iOS) we warm as before, since
 * guessing "slow" from nothing would penalise every iPhone on good WiFi.
 */
function shouldSkipSpeculativeLoads() {
  const c = navigator.connection
  if (!c) return false
  if (c.saveData) return true
  return ['slow-2g', '2g', '3g'].includes(c.effectiveType)
}

export function preloadAppRoutes() {
  if (shouldSkipSpeculativeLoads()) return
  const run = () => routeModules.forEach(warm)
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 1200 })
  } else {
    window.setTimeout(run, 250)
  }
}
