import type { FacilitySchedule, ListMyBookingsQuery } from '@sports-center/shared';
import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '~/features/auth';
import { bookingsService } from '../services/bookings.service';
import type { PackagePreviewRequest } from '../types';

export const scheduleQueryKey = (facilityId: string, date: string) => ['facility-schedule', facilityId, date] as const;

/** Schedules of several facilities for one day, one query each so grid rows fill in independently. */
export function useFacilitySchedules(facilityIds: string[], date: string) {
  const results = useQueries({
    queries: facilityIds.map((facilityId) => ({
      queryKey: scheduleQueryKey(facilityId, date),
      queryFn: () => bookingsService.facilitySchedule(facilityId, date),
      staleTime: 10_000,
      refetchInterval: 30_000,
      refetchOnWindowFocus: 'always',
    })),
  });
  const schedules: Record<string, FacilitySchedule | undefined> = {};
  facilityIds.forEach((facilityId, index) => {
    schedules[facilityId] = results[index]?.data;
  });
  return {
    schedules,
    isLoading: results.some((result) => result.isPending),
    isFetching: results.some((result) => result.isFetching),
    updatedAt:
      results.length && results.every((result) => result.dataUpdatedAt > 0)
        ? Math.min(...results.map((result) => result.dataUpdatedAt))
        : null,
    error: results.find((result) => result.error)?.error,
    refetch: () => results.forEach((result) => void result.refetch()),
  };
}

/** At the counter the preview is for the member buying (`accountId`), with that member's clashes. */
export function usePackagePreview(request: PackagePreviewRequest | null, accountId?: string) {
  return useQuery({
    queryKey: ['facility-package-preview', accountId, request],
    queryFn: () => bookingsService.previewPackage({ ...request!, ...(accountId && { buyer: { accountId } }) }),
    enabled: Boolean(request),
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useMyBookings(query: ListMyBookingsQuery) {
  const user = useCurrentUser();
  return useQuery({
    queryKey: ['bookings', 'mine', user.id, query],
    queryFn: () => bookingsService.listMine(query),
    placeholderData: keepPreviousData,
  });
}

export function useMyPackages() {
  const user = useCurrentUser();
  return useQuery({
    queryKey: ['bookings', 'packages', user.id],
    queryFn: bookingsService.listMyPackages,
  });
}

/** Confirmed bookings of one day for the reception desk. */
export function useBookingsOn(date: string) {
  return useQuery({
    queryKey: ['bookings', 'on', date],
    queryFn: () => bookingsService.listOn(date),
    refetchInterval: 30_000,
  });
}
