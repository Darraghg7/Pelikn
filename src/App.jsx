import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import { isConfigured }        from './lib/supabase'
import { SessionProvider, useSession } from './contexts/SessionContext'
import { ToastProvider }       from './components/ui/Toast'
import SetupPage               from './pages/SetupPage'
import AppShell                from './components/layout/AppShell'
import { FullPageLoader }      from './components/ui/LoadingSpinner'

// Auth
import LoginPage from './pages/LoginPage'

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

// Settings
import SettingsPage from './pages/settings/SettingsPage'

import NotFoundPage from './pages/NotFoundPage'

// ── Guards ───────────────────────────────────────────────────────────────────

/** Any authenticated user. */
function RequireAuth({ children }) {
  const { session, loading } = useSession()
  if (loading) return <FullPageLoader />
  if (!session) return <Navigate to="/" replace />
  return children
}

/** Manager-only pages. */
function RequireManager({ children }) {
  const { session, loading, isManager } = useSession()
  if (loading) return <FullPageLoader />
  if (!session) return <Navigate to="/" replace />
  if (!isManager) return <Navigate to="/dashboard" replace />
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

// ── Routes ───────────────────────────────────────────────────────────────────

function AppRoutes() {
  return (
    <Routes>
      {/* Public — login (staff picker) */}
      <Route path="/" element={<LoginPage />} />

      {/* Any authenticated user */}
      <Route path="/dashboard"         element={wrap(DashboardPage)} />
      <Route path="/fridge"            element={wrap(FridgeDashboardPage)} />
      <Route path="/fridge/log"        element={wrap(FridgeLogFormPage)} />
      <Route path="/fridge/history"    element={wrap(FridgeHistoryPage)} />
      <Route path="/allergens"         element={wrap(AllergenRegistryPage)} />
      <Route path="/allergens/:id"     element={wrap(FoodItemDetailPage)} />
      <Route path="/cleaning"          element={wrap(CleaningPage)} />
      <Route path="/opening-closing"   element={wrap(OpeningClosingPage)} />
      <Route path="/rota"              element={wrap(RotaPage)} />

      {/* Manager only */}
      <Route path="/allergens/new"      element={wrap(FoodItemFormPage,  RequireManager)} />
      <Route path="/allergens/:id/edit" element={wrap(FoodItemFormPage,  RequireManager)} />
      <Route path="/timesheet"          element={wrap(TimesheetPage,     RequireManager)} />
      <Route path="/settings"           element={wrap(SettingsPage,      RequireManager)} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

// ── App root ─────────────────────────────────────────────────────────────────

export default function App() {
  if (!isConfigured) return <SetupPage />

  return (
    <BrowserRouter>
      <SessionProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </SessionProvider>
    </BrowserRouter>
  )
}
