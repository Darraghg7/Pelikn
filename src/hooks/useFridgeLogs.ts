import { useQuery } from '@tanstack/react-query'
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

export function useFridges(): { fridges: Fridge[]; loading: boolean; reload: () => void } {
  const { venueId } = useVenue()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['fridges', venueId],
    queryFn: () => fetchActiveFridges(venueId!),
    enabled: !!venueId,
    staleTime: 5 * 60_000,
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

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['todayCheckStatus', venueId],
    queryFn: () => fetchTodayCheckStatus(venueId!, isCheckRequired),
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
  reload: () => void
} {
  const { venueId } = useVenue()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['fridgeHistory', venueId, fridgeId, dateFrom, dateTo],
    queryFn: () => fetchFridgeHistory(venueId!, fridgeId, dateFrom, dateTo),
    enabled: !!venueId,
  })

  return { logs: (data ?? []) as FridgeLog[], loading: isLoading, reload: refetch }
}
