import React, { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'

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

// Auth
const LoginPage = lazy(() => import('./pages/LoginPage'))

// Landing (login)
const LandingPage = lazy(() => import('./pages/LandingPage'))

// Marketing page
const MarketingPage = lazy(() => import('./pages/marketing/MarketingPage'))

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

// ── Venue-scoped routes ─────────────────────────────────────────────────────

function VenueRoutes() {
  return (
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
  )
}

// ── App root ─────────────────────────────────────────────────────────────────

export default function App() {
  if (!isConfigured) return <SetupPage />

  return (
    <BrowserRouter>
      <UpdateBanner />
      <AuthProvider>
        <Suspense fallback={<FullPageLoader />}>
        <Routes>
          {/* Public: marketing homepage */}
          <Route path="/" element={<MarketingPage />} />

          {/* Public: allergen matrix (no auth required, accessible via QR code) */}
          <Route path="/allergens/:venueSlug" element={<AllergenPublicPage />} />

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
      </AuthProvider>
    </BrowserRouter>
  )
}
