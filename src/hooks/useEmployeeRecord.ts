import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '../contexts/SessionContext'
import { londonDateStr, londonWallTimeToInstant } from '../lib/time'
import {
  fetchStaffHeader,
  fetchHRDocuments,
  fetchDisciplinaryData,
  fetchStaffLeaveRequests,
  fetchStaffTrainingRecord,
  fetchStaffSessions,
} from '../lib/api/hr'

const STALE = 60_000

/**
 * EmployeeRecordPanel's six tabs, each independently cached by staffId.
 * Before this, every staff click and every tab switch refetched from
 * scratch — clicking through a few staff members in HR meant a fresh
 * network waterfall each time. React Query now holds each tab's data for
 * 60s, so revisiting a staff member (or flipping tabs) within that window
 * is instant.
 */

export function useStaffHeader(staffId: string | undefined) {
  const queryClient = useQueryClient()
  const queryKey = ['employee-record', staffId, 'header']
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchStaffHeader(staffId!),
    enabled: !!staffId,
    staleTime: STALE,
  })
  const reload = () => queryClient.invalidateQueries({ queryKey })
  return {
    staff: data?.staff ?? null,
    docsCount: data?.docsCount ?? 0,
    strikesCount: data?.strikesCount ?? 0,
    loading: isLoading,
    reload,
  }
}

export function useHRDocuments(staffId: string | undefined) {
  const queryClient = useQueryClient()
  const queryKey = ['employee-record', staffId, 'documents']
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchHRDocuments(staffId!),
    enabled: !!staffId,
    staleTime: STALE,
    placeholderData: [],
  })
  const reload = () => {
    queryClient.invalidateQueries({ queryKey })
    // Doc count lives on the header query — keep it in step.
    queryClient.invalidateQueries({ queryKey: ['employee-record', staffId, 'header'] })
  }
  return { docs: data ?? [], loading: isLoading, reload }
}

function deriveLateHistory(clockIns: { id: string; occurred_at: string }[], shifts: { shift_date: string; start_time: string }[]) {
  const shiftMap: Record<string, string> = {}
  shifts.forEach(s => { shiftMap[s.shift_date] = s.start_time })

  return clockIns.flatMap((ev) => {
    // Match the clock-in to its shift by UK calendar date, and compare against
    // the scheduled start read as UK wall-clock — not the device timezone.
    const date = londonDateStr(ev.occurred_at)
    const startTime = shiftMap[date]
    if (!startTime) return []
    const shiftStart = londonWallTimeToInstant(date, startTime)
    const clockedIn = new Date(ev.occurred_at)
    const msLate = clockedIn.getTime() - shiftStart.getTime()
    if (msLate <= 0) return []
    const minsLate = Math.floor(msLate / 60000)
    return [{ id: ev.id, occurred_at: ev.occurred_at, minsLate, secsLate: Math.floor(msLate / 1000), scheduledTime: startTime }]
  })
}

export function useDisciplinaryRecord(staffId: string | undefined, venueId: string | undefined) {
  const queryClient = useQueryClient()
  const queryKey = ['employee-record', staffId, 'disciplinary']
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchDisciplinaryData(staffId!, venueId!),
    enabled: !!staffId && !!venueId,
    staleTime: STALE,
  })

  const lateHistory = useMemo(() => (data ? deriveLateHistory(data.clockIns, data.shifts) : []), [data])
  const reload = () => {
    queryClient.invalidateQueries({ queryKey })
    queryClient.invalidateQueries({ queryKey: ['employee-record', staffId, 'header'] })
  }

  return {
    strikes: data?.strikes ?? [],
    formals: data?.formals ?? [],
    lateHistory,
    loading: isLoading,
    reload,
  }
}

export function useLeaveRequests(staffId: string | undefined) {
  const { data, isLoading } = useQuery({
    queryKey: ['employee-record', staffId, 'leave'],
    queryFn: () => fetchStaffLeaveRequests(staffId!),
    enabled: !!staffId,
    staleTime: STALE,
    placeholderData: [],
  })
  return { requests: data ?? [], loading: isLoading }
}

export function useStaffTrainingRecord(staffId: string | undefined) {
  const { data, isLoading } = useQuery({
    queryKey: ['employee-record', staffId, 'training'],
    queryFn: () => fetchStaffTrainingRecord(staffId!),
    enabled: !!staffId,
    staleTime: STALE,
  })
  return { certs: data?.certs ?? [], inductions: data?.inductions ?? [], loading: isLoading }
}

export function useStaffSessions(staffId: string | undefined) {
  const { session } = (useSession() ?? {}) as { session?: { token?: string } | null }
  const token = session?.token
  const queryClient = useQueryClient()
  const queryKey = ['employee-record', staffId, 'sessions']

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchStaffSessions(token!, staffId!),
    enabled: !!staffId && !!token,
    // Sessions are security-sensitive and change via out-of-band revokes
    // (another device signing out) — shorter staleTime than the other tabs.
    staleTime: 15_000,
  })

  const removeFromCache = (targetToken: string) => {
    queryClient.setQueryData<Awaited<ReturnType<typeof fetchStaffSessions>> | undefined>(queryKey, (prev) => {
      if (!prev) return prev
      return { ...prev, data: prev.data.filter((s: any) => s.token !== targetToken) }
    })
  }

  return { sessions: data?.data ?? [], error: data?.error, loading: isLoading, removeFromCache }
}
