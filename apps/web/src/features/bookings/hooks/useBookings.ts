import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useCurrentUser } from '~/features/auth';
import { toApiError } from '~/lib/http-errors';
import { bookingsService } from '../services/bookings.service';
import type { FacilitySchedule, PackagePreviewRequest } from '../types';

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

/** Cancelling refunds into the wallet, so every view that shows money or availability is refreshed. */
function useRefreshAfterCancel() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['bookings'] });
    void queryClient.invalidateQueries({ queryKey: ['enrollments'] });
    void queryClient.invalidateQueries({ queryKey: ['wallet'] });
    void queryClient.invalidateQueries({ queryKey: ['orders'] });
    void queryClient.invalidateQueries({ queryKey: ['facility-schedule'] });
    void queryClient.invalidateQueries({ queryKey: ['classes'] });
  };
}

export function useCancelBooking() {
  const user = useCurrentUser();
  const { message } = App.useApp();
  const refresh = useRefreshAfterCancel();
  return useMutation({
    mutationFn: (id: string) => bookingsService.cancel(user, id),
    onSuccess: ({ refund }) => {
      refresh();
      message.success(refund.amount > 0 ? 'Đã hủy lượt đặt, tiền đã được hoàn về ví.' : 'Đã hủy lượt đặt.');
    },
    onError: (error) => message.error(toApiError(error).message),
  });
}

export function useCancelPackage() {
  const user = useCurrentUser();
  const { message } = App.useApp();
  const refresh = useRefreshAfterCancel();
  return useMutation({
    mutationFn: (id: string) => bookingsService.cancelPackage(user, id),
    onSuccess: ({ cancelledBookings, refundTotal }) => {
      refresh();
      message.success(`Đã hủy ${cancelledBookings} buổi${refundTotal > 0 ? ' và hoàn tiền về ví' : ''}.`);
    },
    onError: (error) => message.error(toApiError(error).message),
  });
}
