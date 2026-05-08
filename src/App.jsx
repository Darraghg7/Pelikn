import React, { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Capacitor } from '@capacitor/core'

import { isConfigured }        from './lib/supabase'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { SessionProvider, useSession } from './contexts/SessionContext'
import { VenueProvider }       from './contexts/VenueContext'
import { ToastProvider }       from './components/ui/Toast'
import SetupPage               from './pages/SetupPage'
import AppShell                from './components/layout/AppShell'
import { FullPageLoader }      from './components/ui/LoadingSpinner'
import PlanGate                from './components/ui/PlanGate'
import UpdateBanner            from './components/ui/UpdateBanner'
import ErrorBoundary           from './components/ui/ErrorBoundary'
import { preloadAppRoutes }    from './lib/routePreload'

// Auth
const LoginPage = lazy(() => import('./pages/LoginPage'))

// Landing (login)
const LandingPage = lazy(() => import('./pages/LandingPage'))

// Marketing page
const MarketingPage = lazy(() => import('./pages/marketing/MarketingPage'))

// Privacy policy
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'))

// Signup flow
const SignupFlowPage = lazy(() => import('./pages/signup/SignupFlowPage'))

// Onboarding
const OnboardingPage = lazy(() => import('./pages/onboarding/OnboardingPage'))

// Staff management
const StaffPage = lazy(() => import('./pages/staff/StaffPage'))

// Dashboard (role-aware)
const DashboardPage = lazy(() => import('./pages/DashboardPage'))

// Fridge
const FridgeDashboardPage = lazy(() => import('./pages/fridge/FridgeDashboardPage'))
const FridgeLogFormPage   = lazy(() => import('./pages/fridge/FridgeLogFormPage'))
const FridgeHistoryPage   = lazy(() => import('./pages/fridge/FridgeHistoryPage'))

// Allergens
const AllergenRegistryPage = lazy(() => import('./pages/allergens/AllergenRegistryPage'))
const FoodItemFormPage     = lazy(() => import('./pages/allergens/FoodItemFormPage'))
const FoodItemDetailPage   = lazy(() => import('./pages/allergens/FoodItemDetailPage'))
const AllergenPublicPage   = lazy(() => import('./pages/allergens/AllergenPublicPage'))

// Cleaning
const CleaningPage = lazy(() => import('./pages/cleaning/CleaningPage'))

// Opening / Closing
const OpeningClosingPage = lazy(() => import('./pages/opening/OpeningClosingPage'))

// Rota + Timesheet
const RotaPage     = lazy(() => import('./pages/rota/RotaPage'))
const TimesheetPage = lazy(() => import('./pages/clockin/TimesheetPage'))

// Compliance
const DeliveryChecksPage    = lazy(() => import('./pages/deliveries/DeliveryChecksPage'))
const ProbeCalibrationPage  = lazy(() => import('./pages/probe/ProbeCalibrationPage'))
const CorrectiveActionsPage = lazy(() => import('./pages/corrective/CorrectiveActionsPage'))
const EHOAuditPage          = lazy(() => import('./pages/audit/EHOAuditPage'))
const CookingTempsPage      = lazy(() => import('./pages/cooking/CookingTempsPage'))
const HotHoldingPage        = lazy(() => import('./pages/hotholding/HotHoldingPage'))
const CoolingLogsPage       = lazy(() => import('./pages/cooling/CoolingLogsPage'))
const PestControlPage       = lazy(() => import('./pages/pestcontrol/PestControlPage'))

// Training
const TrainingPage = lazy(() => import('./pages/training/TrainingPage'))

// Waste
const WasteLogPage = lazy(() => import('./pages/waste/WasteLogPage'))

// Suppliers
const SupplierOrdersPage = lazy(() => import('./pages/orders/SupplierOrdersPage'))

// Time Off
const TimeOffPage = lazy(() => import('./pages/timeoff/TimeOffPage'))

// Settings
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'))

// Fitness to Work (SC7)
const FitnessPage = lazy(() => import('./pages/fitness/FitnessPage'))

// Clock In / Out
const ClockInPage = lazy(() => import('./pages/clockin/ClockInPage'))

// Noticeboard
const NoticeBoardPage = lazy(() => import('./pages/noticeboard/NoticeBoardPage'))

// HACCP
const HACCPPage = lazy(() => import('./pages/haccp/HACCPPage'))

// Suppliers (approved)
const SuppliersPage = lazy(() => import('./pages/suppliers/SuppliersPage'))

// EHO Mock Inspection
const EHOMockPage = lazy(() => import('./pages/eho/EHOMockPage'))

// Tasks (daily recurring + one-off)
const TasksPage = lazy(() => import('./pages/tasks/TasksPage'))

// Multi-venue overview dashboard
const OverviewPage = lazy(() => import('./pages/overview/OverviewPage'))

const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

// ── Guards ───────────────────────────────────────────────────────────────────

/** Require Supabase Auth session to access venue routes. */
function RequireVenueAuth({ children }) {
  const { user, authLoading } = useAuth()
  if (authLoading) return <FullPageLoader />
  if (!user) return <Navigate to="/login" replace />
  return children
}

/** Any authenticated staff (PIN session). */
function RequireAuth({ children }) {
  const { session, loading } = useSession()
  const { venueSlug } = useParams()
  if (loading) return <FullPageLoader />
  if (!session) return <Navigate to={`/v/${venueSlug}`} replace />
  return children
}

/** Manager-only pages. */
function RequireManager({ children }) {
  const { session, loading, isManager } = useSession()
  const { venueSlug } = useParams()
  if (loading) return <FullPageLoader />
  if (!session) return <Navigate to={`/v/${venueSlug}`} replace />
  if (!isManager) return <Navigate to={`/v/${venueSlug}/dashboard`} replace />
  return children
}

/** Pages accessible to managers OR staff with a specific permission. */
function RequirePermission({ permission, children }) {
  const { session, loading, isManager, hasPermission } = useSession()
  const { venueSlug } = useParams()
  if (loading) return <FullPageLoader />
  if (!session) return <Navigate to={`/v/${venueSlug}`} replace />
  if (!isManager && !hasPermission(permission)) return <Navigate to={`/v/${venueSlug}/dashboard`} replace />
  return children
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function wrap(Component, Guard = RequireAuth) {
  return (
    <Guard>
      <AppShell>
        <Component />
      </AppShell>
    </Guard>
  )
}

/** Like wrap(), but gates with a specific permission (managers always pass). */
function wrapPerm(Component, permission, feature) {
  const Guard = ({ children }) => <RequirePermission permission={permission}>{children}</RequirePermission>
  if (feature) return wrapPro(Component, Guard, feature)
  return wrap(Component, Guard)
}

/** Like wrap(), but gates the page behind PlanGate for Pro-only features. */
function wrapPro(Component, Guard = RequireAuth, feature) {
  return (
    <Guard>
      <AppShell>
        <PlanGate feature={feature}>
          <Component />
        </PlanGate>
      </AppShell>
    </Guard>
  )
}

// ── Landing route — redirect if already authenticated ────────────────────────

function LandingRoute() {
  const { user, venueSlug, authLoading } = useAuth()
  if (authLoading) return <FullPageLoader />
  // Supabase-authenticated manager — jump straight into the app
  if (user && venueSlug) return <Navigate to={`/v/${venueSlug}`} replace />
  // Staff with a saved PIN session — skip the landing page and go straight to
  // their venue's PIN login screen (SessionContext will restore their session)
  const staffToken = localStorage.getItem('pelikn_staff_token')
  const staffSlug  = localStorage.getItem('pelikn_venue_slug')
  if (staffToken && staffSlug) return <Navigate to={`/v/${staffSlug}`} replace />
  return <LandingPage />
}

// ── Legacy redirect: old paths → /v/default/... ─────────────────────────────

function LegacyRedirect() {
  const path = window.location.pathname
  return <Navigate to={`/v/default${path}`} replace />
}

function RootRoute() {
  const isCapacitorShell =
    Capacitor.isNativePlatform() ||
    window.location.protocol === 'capacitor:' ||
    window.Capacitor?.isNativePlatform?.() === true

  if (isCapacitorShell) return <LandingRoute />
  return <MarketingPage />
}

function isNativeShell() {
  return (
    Capacitor.isNativePlatform() ||
    window.location.protocol === 'capacitor:' ||
    window.Capacitor?.isNativePlatform?.() === true
  )
}

function BootHalo() {
  return (
    <div style={{
      position: 'absolute', top: '50%', left: '50%',
      width: 240, height: 240, borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.06) 40%, transparent 70%)',
      animation: 'pk-halo-bloom 0.9s cubic-bezier(.22,.9,.28,1) both, pk-halo-breathe 3.6s 0.9s ease-in-out infinite',
      pointerEvents: 'none',
    }} />
  )
}

function BootIcon({ size = 130 }) {
  const uid = React.useId().replace(/:/g, '')
  const bowlPath   = "M111.581 104.182C96.2532 104.543 80.9327 105.088 65.6202 105.829C60.5271 106.056 45.127 107.88 41.575 105.113C40.7355 102.743 40.8666 103.955 41.3785 101.335C43.6299 98.8182 47.2266 98.3284 50.4259 98.659C63.5708 100.006 131.793 91.8746 139.38 94.6178C143.225 99.2529 133.006 106.588 129.368 111.762C114.802 132.477 110.197 170.39 77.5307 168.731C49.3708 165.694 45.8813 136.75 46.7483 115.308C70.6601 112.405 93.878 108.474 117.612 105.315C116.161 104.28 113.504 104.335 111.581 104.182Z"
  const pestlePath = "M148.644 51.1993C183.239 49.7481 187.978 90.0071 164.264 109.344C142.392 127.174 130.764 152.291 163.008 168.658L160.027 168.645C139.961 168.474 133.495 157.422 134.31 138.44C137.83 118.498 152.458 110.25 164.662 95.8485C177.496 80.4735 167.956 55.9997 146.305 60.1389C135.522 62.1963 128.977 74.4423 123.111 82.935C119.461 82.935 115.959 83.1248 112.322 83.3085C122.658 68.6928 129.24 54.0955 148.644 51.1993Z"
  return (
    <svg width={size} height={size} viewBox="0 0 218.749 224.045" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <clipPath id={`pkclip-${uid}`} clipPathUnits="userSpaceOnUse">
          <rect x="0" y="0" width="220" height="225" style={{
            transformBox: 'fill-box',
            transformOrigin: 'center bottom',
            animation: 'pk-icon-rise 1.2s 0.1s cubic-bezier(.22,.9,.28,1.06) both',
          }} />
        </clipPath>
      </defs>
      <g clipPath={`url(#pkclip-${uid})`}>
        <path d={bowlPath}   fill="#ffffff" />
        <path d={pestlePath} fill="#ffffff" />
      </g>
    </svg>
  )
}

function BootIntro() {
  const [mounted, setMounted] = React.useState(true)

  // Runs synchronously after DOM mutation but before browser paint.
  // On web this removes the element before the user ever sees it.
  React.useLayoutEffect(() => {
    if (!isNativeShell()) setMounted(false)
  }, [])

  React.useEffect(() => {
    if (!mounted) return

    let removeTimer
    let cancelled = false

    // Hide the native Capacitor splash so our web animation shows through
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return
        import('@capacitor/splash-screen')
          .then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 180 }))
          .catch(() => {})
      })
    })

    removeTimer = window.setTimeout(() => setMounted(false), 2920)

    return () => {
      cancelled = true
      window.clearTimeout(removeTimer)
    }
  }, [mounted])

  if (!mounted) return null

  const settleAt  = 1.30
  const wordStart = 1.10
  const tagDelay  = wordStart + 6 * 0.07 + 0.30

  return (
    <div className="pelikn-boot-intro" aria-hidden="true">
      <div style={{ position: 'relative', width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <BootHalo />
        <div style={{
          position: 'relative', zIndex: 1,
          animation: `pk-icon-settle 0.5s ${settleAt}s cubic-bezier(.34,1.56,.64,1) both, pk-icon-breathe 4s ${settleAt + 0.5}s ease-in-out infinite`,
        }}>
          <BootIcon size={130} />
        </div>
      </div>

      <div style={{ display: 'flex', overflow: 'hidden', height: 56 }}>
        {'Pelikn'.split('').map((ch, i) => (
          <span key={i} style={{
            display: 'inline-block',
            fontFamily: '-apple-system, system-ui, sans-serif',
            fontWeight: 700, fontSize: 46, lineHeight: '56px',
            letterSpacing: '-0.01em', color: '#ffffff',
            animation: `pk-letter-rise 0.65s ${wordStart + i * 0.07}s cubic-bezier(.22,.9,.28,1) both`,
          }}>{ch}</span>
        ))}
      </div>

      <div style={{
        fontFamily: '-apple-system, system-ui, sans-serif',
        fontSize: 12, fontWeight: 500, letterSpacing: '0.32em',
        textTransform: 'uppercase', color: '#ffffff',
        opacity: 0,
        animation: `pk-tag-fade 0.7s ${tagDelay}s cubic-bezier(.22,.9,.28,1) both`,
      }}>
        Food Safety, Simplified
      </div>
    </div>
  )
}

// ── Venue-scoped routes ─────────────────────────────────────────────────────

function VenueRoutes() {
  return (
    <ErrorBoundary>
    <VenueProvider>
      <SessionProvider>
        <ToastProvider>
          <Routes>
            {/* Staff PIN login — publicly accessible, no Supabase Auth needed.
                venues + staff tables have public_read RLS policies. */}
            <Route index element={<LoginPage />} />

            {/* Onboarding wizard — shown once after signup */}
            <Route path="setup" element={wrap(OnboardingPage, RequireManager)} />

            {/* Multi-venue overview — manager only, requires cross-venue access */}
            <Route path="overview"          element={wrap(OverviewPage, RequireManager)} />

            {/* Any authenticated user */}
            <Route path="dashboard"         element={wrap(DashboardPage)} />
            <Route path="tasks"             element={wrap(TasksPage)} />
            <Route path="clock-in"          element={wrapPro(ClockInPage,    RequireAuth, 'clock-in')} />
            <Route path="noticeboard"       element={wrapPro(NoticeBoardPage, RequireAuth, 'noticeboard')} />
            <Route path="fridge"            element={wrap(FridgeDashboardPage)} />
            <Route path="fridge/log"        element={wrap(FridgeLogFormPage)} />
            <Route path="fridge/history"    element={wrap(FridgeHistoryPage)} />
            <Route path="allergens"         element={wrap(AllergenRegistryPage)} />
            <Route path="allergens/:id"     element={wrap(FoodItemDetailPage)} />
            <Route path="cleaning"          element={wrap(CleaningPage)} />
            <Route path="opening-closing"   element={wrap(OpeningClosingPage)} />
            <Route path="rota"              element={wrapPro(RotaPage,    RequireAuth, 'rota')} />
            <Route path="time-off"          element={wrapPro(TimeOffPage, RequireAuth, 'time-off')} />

            {/* Manager only */}
            <Route path="haccp"              element={wrapPro(HACCPPage,            RequireManager, 'haccp')} />
            <Route path="suppliers"          element={wrap(SuppliersPage,          RequireManager)} />
            <Route path="eho-mock"           element={wrapPro(EHOMockPage,         RequireManager, 'eho-mock')} />
            <Route path="fitness"            element={wrap(FitnessPage,            RequireManager)} />
            <Route path="cooking-temps"      element={wrapPerm(CookingTempsPage,   'log_temps')} />
            <Route path="hot-holding"        element={wrapPerm(HotHoldingPage,     'log_temps')} />
            <Route path="cooling-logs"       element={wrapPerm(CoolingLogsPage,    'log_temps')} />
            <Route path="pest-control"       element={wrap(PestControlPage,        RequireManager)} />
            <Route path="allergens/new"      element={wrapPerm(FoodItemFormPage,   'manage_allergens')} />
            <Route path="allergens/:id/edit" element={wrapPerm(FoodItemFormPage,   'manage_allergens')} />
            <Route path="timesheet"          element={wrapPerm(TimesheetPage,      'view_timesheet', 'timesheet')} />
            <Route path="deliveries"         element={wrapPerm(DeliveryChecksPage, 'log_deliveries')} />
            <Route path="probe"              element={wrap(ProbeCalibrationPage,   RequireManager)} />
            <Route path="corrective"         element={wrap(CorrectiveActionsPage,  RequireManager)} />
            <Route path="audit"              element={wrap(EHOAuditPage,           RequireManager)} />
            <Route path="training"           element={wrapPerm(TrainingPage,       'manage_training', 'training')} />
            <Route path="waste"              element={wrapPerm(WasteLogPage,       'log_waste', 'waste')} />
            <Route path="orders"             element={wrapPerm(SupplierOrdersPage, 'log_deliveries', 'orders')} />
            <Route path="settings"           element={wrap(SettingsPage,           RequireManager)} />
            <Route path="staff"             element={wrap(StaffPage,              RequireManager)} />

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ToastProvider>
      </SessionProvider>
    </VenueProvider>
    </ErrorBoundary>
  )
}

// ── Query client ────────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

// ── App root ─────────────────────────────────────────────────────────────────

export default function App() {
  React.useEffect(() => {
    if (isConfigured) preloadAppRoutes()
  }, [])

  if (!isConfigured) return <SetupPage />

  return (
    <QueryClientProvider client={queryClient}>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <BootIntro />
      <UpdateBanner />
      <AuthProvider>
        <ErrorBoundary>
        <Suspense fallback={<FullPageLoader />}>
        <Routes>
          {/* Public web homepage; native app opens the login/app flow. */}
          <Route path="/" element={<RootRoute />} />

          {/* Public: allergen matrix (no auth required, accessible via QR code) */}
          <Route path="/allergens/:venueSlug" element={<AllergenPublicPage />} />

          {/* Public: privacy policy */}
          <Route path="/privacy" element={<PrivacyPolicyPage />} />

          {/* Sign up */}
          <Route path="/signup" element={<SignupFlowPage />} />

          {/* Login — redirects to venue if already authenticated */}
          <Route path="/login" element={<LandingRoute />} />

          {/* Venue-scoped app — PIN login is public; inner routes need RequireAuth */}
          <Route path="/v/:venueSlug/*" element={<VenueRoutes />} />

          {/* Legacy redirects for old bookmarks */}
          <Route path="/dashboard"       element={<LegacyRedirect />} />
          <Route path="/fridge"          element={<LegacyRedirect />} />
          <Route path="/fridge/*"        element={<LegacyRedirect />} />
          <Route path="/allergens"       element={<LegacyRedirect />} />
          <Route path="/allergens/*"     element={<LegacyRedirect />} />
          <Route path="/cleaning"        element={<LegacyRedirect />} />
          <Route path="/opening-closing" element={<LegacyRedirect />} />
          <Route path="/rota"            element={<LegacyRedirect />} />
          <Route path="/time-off"        element={<LegacyRedirect />} />
          <Route path="/timesheet"       element={<LegacyRedirect />} />
          <Route path="/deliveries"      element={<LegacyRedirect />} />
          <Route path="/probe"           element={<LegacyRedirect />} />
          <Route path="/corrective"      element={<LegacyRedirect />} />
          <Route path="/audit"           element={<LegacyRedirect />} />
          <Route path="/training"        element={<LegacyRedirect />} />
          <Route path="/waste"           element={<LegacyRedirect />} />
          <Route path="/orders"          element={<LegacyRedirect />} />
          <Route path="/settings"        element={<LegacyRedirect />} />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
    </QueryClientProvider>
  )
}
