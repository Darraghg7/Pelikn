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

// Temporary animation preview — remove before shipping
const IconPreviewPage = lazy(() => import('./pages/IconPreviewPage'))

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
  try {
    return (
      Capacitor.isNativePlatform() ||
      window.Capacitor?.isNativePlatform?.() === true ||
      window.Capacitor?.getPlatform?.() === 'ios' ||
      window.Capacitor?.getPlatform?.() === 'android' ||
      window.location.protocol === 'capacitor:'
    )
  } catch {
    return false
  }
}

// ── Splash screen ────────────────────────────────────────────────────────────
// Rendered by React (not index.html) so the animation runs in the same
// compositing pipeline as the landing page — identical to the /icon-preview.
// index.html only provides a plain green background to prevent white flash
// during the ~50ms before React mounts.

// pk-* keyframes live in index.css — always in CSSOM before React renders.
// Injecting via <style> caused WKWebView to skip the splash (keyframes not
// parsed before the animation property was evaluated → forwards fill → opacity 0).

function SplashScreen() {
  const [mounted, setMounted] = React.useState(true)

  React.useEffect(() => {
    // Remove the HTML background-only div immediately — React takes over
    document.getElementById('pk-splash')?.remove()

    // Hide native Capacitor launch screen immediately (no fade — React splash takes over)
    const platform = window.Capacitor?.getPlatform?.()
    if (platform === 'ios' || platform === 'android') {
      import('@capacitor/splash-screen')
        .then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 0 }))
        .catch(() => {})
    }

    // Dispatch pk-splash-done at 2200ms (84% of 2600ms = when CSS fade begins)
    // LandingPage listens for this to start its entrance animations
    const evtTimer = window.setTimeout(
      () => window.dispatchEvent(new CustomEvent('pk-splash-done')),
      2200
    )
    // Unmount after the full 2.6s animation completes
    const rmTimer = window.setTimeout(() => setMounted(false), 2600)

    return () => { window.clearTimeout(evtTimer); window.clearTimeout(rmTimer) }
  }, [])

  if (!mounted) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'radial-gradient(120% 80% at 50% 35%, #2D4F45 0%, #2A4A40 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
      overflow: 'hidden', pointerEvents: 'none',
      animation: 'pk-splash-out 2.6s ease-out forwards',
      // DO NOT use willChange:'opacity' on position:fixed — known WebKit/WKWebView
      // bug causes composited fixed layers to be invisible on first paint.
      // translateZ(0) promotes to GPU layer safely without the opacity bug.
      transform: 'translateZ(0)',
    }}>
        {/* Halo */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 260, height: 260, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,.22) 0%, rgba(255,255,255,.06) 40%, transparent 70%)',
          willChange: 'transform, opacity',
          animation: 'pk-halo 0.9s cubic-bezier(.22,.9,.28,1) both',
        }} />
        {/* Icon — rises as solid white (GPU composited transform+opacity only) */}
        <div style={{
          position: 'relative', zIndex: 1,
          willChange: 'transform, opacity',
          animation: 'pk-icon-rise 0.5s 0.1s cubic-bezier(.22,.9,.28,1) both',
        }}>
          {/* Glow burst */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            width: 200, height: 200, marginTop: -100, marginLeft: -100,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(120,210,150,.7) 0%, rgba(80,180,120,.2) 45%, transparent 70%)',
            willChange: 'transform, opacity',
            animation: 'pk-glow-burst 1.0s 0.55s ease-out both',
          }} />
          <svg width="120" height="120" viewBox="0 0 218.749 224.045"
               style={{ display: 'block', overflow: 'visible' }}>
            <path fill="#fff" d="M111.581 104.182C96.2532 104.543 80.9327 105.088 65.6202 105.829C60.5271 106.056 45.127 107.88 41.575 105.113C40.7355 102.743 40.8666 103.955 41.3785 101.335C43.6299 98.8182 47.2266 98.3284 50.4259 98.659C63.5708 100.006 131.793 91.8746 139.38 94.6178C143.225 99.2529 133.006 106.588 129.368 111.762C114.802 132.477 110.197 170.39 77.5307 168.731C49.3708 165.694 45.8813 136.75 46.7483 115.308C70.6601 112.405 93.878 108.474 117.612 105.315C116.161 104.28 113.504 104.335 111.581 104.182Z"/>
            <path fill="#fff" d="M148.644 51.1993C183.239 49.7481 187.978 90.0071 164.264 109.344C142.392 127.174 130.764 152.291 163.008 168.658L160.027 168.645C139.961 168.474 133.495 157.422 134.31 138.44C137.83 118.498 152.458 110.25 164.662 95.8485C177.496 80.4735 167.956 55.9997 146.305 60.1389C135.522 62.1963 128.977 74.4423 123.111 82.935C119.461 82.935 115.959 83.1248 112.322 83.3085C122.658 68.6928 129.24 54.0955 148.644 51.1993Z"/>
          </svg>
        </div>
        {/* Letters — 0.04s stagger between each */}
        <div style={{ display: 'flex', overflow: 'hidden', height: 58, position: 'relative', zIndex: 1 }}>
          {['P','e','l','i','k','n'].map((ch, i) => (
            <span key={ch} style={{
              display: 'inline-block',
              fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
              fontWeight: 700, fontSize: 48, lineHeight: '58px',
              letterSpacing: '-0.01em', color: '#fff',
              willChange: 'transform, opacity',
              animation: `pk-ch 0.55s ${(0.10 + i * 0.04).toFixed(2)}s cubic-bezier(.22,.9,.28,1) both`,
            }}>{ch}</span>
          ))}
        </div>
        {/* Tagline */}
        <div style={{
          position: 'relative', zIndex: 1,
          fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
          fontSize: 11, fontWeight: 500,
          letterSpacing: '0.28em', textTransform: 'uppercase', color: '#fff',
          willChange: 'transform, opacity',
          animation: 'pk-tag 0.55s 0.55s cubic-bezier(.22,.9,.28,1) both',
        }}>Food Safety, Simplified</div>
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
      <SplashScreen />
      <UpdateBanner />
      <AuthProvider>
        <ErrorBoundary>
        <Suspense fallback={<FullPageLoader />}>
        <Routes>
          {/* Public web homepage; native app opens the login/app flow. */}
          <Route path="/" element={<RootRoute />} />

          {/* Public: allergen matrix (no auth required, accessible via QR code) */}
          <Route path="/allergens/:venueSlug" element={<AllergenPublicPage />} />

          {/* Temporary: icon animation preview */}
          <Route path="/icon-preview" element={<IconPreviewPage />} />

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
