import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'

import { isConfigured }        from './lib/supabase'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { SessionProvider, useSession } from './contexts/SessionContext'
import { VenueProvider }       from './contexts/VenueContext'
import { ToastProvider }       from './components/ui/Toast'
import SetupPage               from './pages/SetupPage'
import AppShell                from './components/layout/AppShell'
import { FullPageLoader }      from './components/ui/LoadingSpinner'

// Auth
import LoginPage from './pages/LoginPage'

// Landing (login)
import LandingPage from './pages/LandingPage'

// Marketing page
import MarketingPage from './pages/marketing/MarketingPage'

// Dashboard (role-aware)
import DashboardPage from './pages/DashboardPage'

// Fridge
import FridgeDashboardPage from './pages/fridge/FridgeDashboardPage'
import FridgeLogFormPage   from './pages/fridge/FridgeLogFormPage'
import FridgeHistoryPage   from './pages/fridge/FridgeHistoryPage'

// Allergens
import AllergenRegistryPage from './pages/allergens/AllergenRegistryPage'
import FoodItemFormPage     from './pages/allergens/FoodItemFormPage'
import FoodItemDetailPage   from './pages/allergens/FoodItemDetailPage'

// Cleaning
import CleaningPage from './pages/cleaning/CleaningPage'

// Opening / Closing
import OpeningClosingPage from './pages/opening/OpeningClosingPage'

// Rota + Timesheet
import RotaPage     from './pages/rota/RotaPage'
import TimesheetPage from './pages/clockin/TimesheetPage'

// Compliance
import DeliveryChecksPage    from './pages/deliveries/DeliveryChecksPage'
import ProbeCalibrationPage  from './pages/probe/ProbeCalibrationPage'
import CorrectiveActionsPage from './pages/corrective/CorrectiveActionsPage'
import EHOAuditPage          from './pages/audit/EHOAuditPage'
import CookingTempsPage      from './pages/cooking/CookingTempsPage'
import HotHoldingPage        from './pages/hotholding/HotHoldingPage'
import CoolingLogsPage       from './pages/cooling/CoolingLogsPage'
import PestControlPage       from './pages/pestcontrol/PestControlPage'

// Training
import TrainingPage from './pages/training/TrainingPage'

// Waste
import WasteLogPage from './pages/waste/WasteLogPage'

// Suppliers
import SupplierOrdersPage from './pages/orders/SupplierOrdersPage'

// Time Off
import TimeOffPage from './pages/timeoff/TimeOffPage'

// Settings
import SettingsPage from './pages/settings/SettingsPage'

// Fitness to Work (SC7)
import FitnessPage from './pages/fitness/FitnessPage'

// Clock In / Out
import ClockInPage from './pages/clockin/ClockInPage'

// Noticeboard
import NoticeBoardPage from './pages/noticeboard/NoticeBoardPage'

// HACCP
import HACCPPage from './pages/haccp/HACCPPage'

// Suppliers (approved)
import SuppliersPage from './pages/suppliers/SuppliersPage'

// EHO Mock Inspection
import EHOMockPage from './pages/eho/EHOMockPage'

// Tasks (daily recurring + one-off)
import TasksPage from './pages/tasks/TasksPage'

import NotFoundPage from './pages/NotFoundPage'

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

// ── Landing route — redirect if already authenticated ────────────────────────

function LandingRoute() {
  const { user, venueSlug, authLoading } = useAuth()
  if (authLoading) return <FullPageLoader />
  if (user && venueSlug) return <Navigate to={`/v/${venueSlug}`} replace />
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
            {/* Login page for this venue */}
            <Route index element={<LoginPage />} />

            {/* Any authenticated user */}
            <Route path="dashboard"         element={wrap(DashboardPage)} />
            <Route path="tasks"             element={wrap(TasksPage)} />
            <Route path="clock-in"          element={wrap(ClockInPage)} />
            <Route path="noticeboard"       element={wrap(NoticeBoardPage)} />
            <Route path="fridge"            element={wrap(FridgeDashboardPage)} />
            <Route path="fridge/log"        element={wrap(FridgeLogFormPage)} />
            <Route path="fridge/history"    element={wrap(FridgeHistoryPage)} />
            <Route path="allergens"         element={wrap(AllergenRegistryPage)} />
            <Route path="allergens/:id"     element={wrap(FoodItemDetailPage)} />
            <Route path="cleaning"          element={wrap(CleaningPage)} />
            <Route path="opening-closing"   element={wrap(OpeningClosingPage)} />
            <Route path="rota"              element={wrap(RotaPage)} />
            <Route path="time-off"          element={wrap(TimeOffPage)} />

            {/* Manager only */}
            <Route path="haccp"              element={wrap(HACCPPage,              RequireManager)} />
            <Route path="suppliers"          element={wrap(SuppliersPage,          RequireManager)} />
            <Route path="eho-mock"           element={wrap(EHOMockPage,            RequireManager)} />
            <Route path="fitness"            element={wrap(FitnessPage,            RequireManager)} />
            <Route path="cooking-temps"      element={wrap(CookingTempsPage,       RequireManager)} />
            <Route path="hot-holding"        element={wrap(HotHoldingPage,         RequireManager)} />
            <Route path="cooling-logs"       element={wrap(CoolingLogsPage,        RequireManager)} />
            <Route path="pest-control"       element={wrap(PestControlPage,        RequireManager)} />
            <Route path="allergens/new"      element={wrap(FoodItemFormPage,       RequireManager)} />
            <Route path="allergens/:id/edit" element={wrap(FoodItemFormPage,       RequireManager)} />
            <Route path="timesheet"          element={wrap(TimesheetPage,          RequireManager)} />
            <Route path="deliveries"         element={wrap(DeliveryChecksPage,     RequireManager)} />
            <Route path="probe"              element={wrap(ProbeCalibrationPage,   RequireManager)} />
            <Route path="corrective"         element={wrap(CorrectiveActionsPage,  RequireManager)} />
            <Route path="audit"              element={wrap(EHOAuditPage,           RequireManager)} />
            <Route path="training"           element={wrap(TrainingPage,           RequireManager)} />
            <Route path="waste"              element={wrap(WasteLogPage,           RequireManager)} />
            <Route path="orders"             element={wrap(SupplierOrdersPage,     RequireManager)} />
            <Route path="settings"           element={wrap(SettingsPage,           RequireManager)} />

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
      <AuthProvider>
        <Routes>
          {/* Public: marketing homepage */}
          <Route path="/" element={<MarketingPage />} />

          {/* Login — redirects to venue if already authenticated */}
          <Route path="/login" element={<LandingRoute />} />

          {/* Venue-scoped app — requires Supabase Auth */}
          <Route path="/v/:venueSlug/*" element={
            <RequireVenueAuth>
              <VenueRoutes />
            </RequireVenueAuth>
          } />

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
      </AuthProvider>
    </BrowserRouter>
  )
}
