import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useVenue } from '../contexts/VenueContext'
import { isCheckRequired } from '../lib/temperatureChecks'
import {
  fetchActiveFridges,
  fetchFridgeDashboard,
  fetchTodayCheckStatus,
  fetchFridgeMatrix,
  fetchFridgeHistory,
} from '../lib/api/fridges'
import type { Fridge, FridgeTodayStatus, FridgeLog } from '../types'

const FRIDGES_STALE_MS = 5 * 60_000

// The page's fridge list, shared — today's status reads it from the same
// cache instead of fetching the list a second time.
function loadSharedFridges(queryClient: QueryClient, venueId: string) {
  return queryClient.fetchQuery({
    queryKey: ['fridges', venueId],
    queryFn: () => fetchActiveFridges(venueId),
    staleTime: FRIDGES_STALE_MS,
  })
}

export function useFridges(): { fridges: Fridge[]; loading: boolean; reload: () => void } {
  const { venueId } = useVenue()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['fridges', venueId],
    queryFn: () => fetchActiveFridges(venueId!),
    enabled: !!venueId,
    staleTime: FRIDGES_STALE_MS,
  })

  return { fridges: (data ?? []) as Fridge[], loading: isLoading, reload: refetch }
}

export function useFridgeDashboard(): { data: unknown[]; loading: boolean; reload: () => void } {
  const { venueId } = useVenue()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['fridgeDashboard', venueId],
    queryFn: () => fetchFridgeDashboard(venueId!),
    enabled: !!venueId,
  })

  return { data: (data ?? []) as unknown[], loading: isLoading, reload: refetch }
}

export function useTodayCheckStatus(): { status: FridgeTodayStatus[]; loading: boolean; reload: () => void } {
  const { venueId } = useVenue()
  const queryClient = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['todayCheckStatus', venueId],
    queryFn: () => fetchTodayCheckStatus(venueId!, isCheckRequired, () => loadSharedFridges(queryClient, venueId!)),
    enabled: !!venueId,
  })

  return { status: (data ?? []) as FridgeTodayStatus[], loading: isLoading, reload: refetch }
}

export function useFridgeMatrix(dateFrom: string, dateTo: string): {
  fridges: Fridge[]
  matrix: Record<string, unknown>
  loading: boolean
  reload: () => void
} {
  const { venueId } = useVenue()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['fridgeMatrix', venueId, dateFrom, dateTo],
    queryFn: () => fetchFridgeMatrix(venueId!, dateFrom, dateTo),
    enabled: !!venueId && !!dateFrom && !!dateTo,
  })

  return {
    fridges: ((data as { fridges?: Fridge[] })?.fridges ?? []),
    matrix: ((data as { matrix?: Record<string, unknown> })?.matrix ?? {}),
    loading: isLoading,
    reload: refetch,
  }
}

export function useFridgeHistory(fridgeId: string, dateFrom: string, dateTo: string): {
  logs: FridgeLog[]
  loading: boolean
  isError: boolean
  reload: () => void
} {
  const { venueId } = useVenue()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['fridgeHistory', venueId, fridgeId, dateFrom, dateTo],
    queryFn: () => fetchFridgeHistory(venueId!, fridgeId, dateFrom, dateTo),
    enabled: !!venueId,
  })

  return { logs: (data ?? []) as FridgeLog[], loading: isLoading, isError, reload: refetch }
}
