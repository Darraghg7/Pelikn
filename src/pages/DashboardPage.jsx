/**
 * DashboardPage — thin role router.
 * Managers → ManagerDashboard
 * Everyone else → StaffDashboardPage (My Shift view)
 */
import React from 'react'
import { useSession } from '../contexts/SessionContext'
import StaffDashboardPage  from './dashboard/StaffDashboardPage'
import ManagerDashboardPage from './dashboard/ManagerDashboardPage'

export default function DashboardPage() {
  const { isManager } = useSession()
  return isManager ? <ManagerDashboardPage /> : <StaffDashboardPage />
}
