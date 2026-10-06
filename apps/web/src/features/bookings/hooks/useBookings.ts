import type { FacilitySchedule } from '@sports-center/shared';
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
    })),
  });
  const schedules: Record<string, FacilitySchedule | undefined> = {};
  facilityIds.forEach((facilityId, index) => {
    schedules[facilityId] = results[index]?.data;
  });
  return {
    schedules,
    isLoading: results.some((result) => result.isPending),
    error: results.find((result) => result.error)?.error,
    refetch: () => results.forEach((result) => void result.refetch()),
  };
}

export function usePackagePreview(request: PackagePreviewRequest | null) {
  return useQuery({
    queryKey: ['facility-package-preview', request],
    queryFn: () => bookingsService.previewPackage(request!),
    enabled: Boolean(request),
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useMyBookings(query: { page: number; limit: number; status?: 'CONFIRMED' | 'CANCELLED' }) {
  const user = useCurrentUser();
  return useQuery({
    queryKey: ['bookings', 'mine', user.id, query],
    queryFn: () => bookingsService.listMine(user, query),
    placeholderData: keepPreviousData,
  });
}

export function useMyPackages() {
  const user = useCurrentUser();
  return useQuery({
    queryKey: ['bookings', 'packages', user.id],
    queryFn: () => bookingsService.listMyPackages(user),
  });
}
