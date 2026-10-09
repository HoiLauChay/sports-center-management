import type {
  ApiResponse,
  Booking,
  FacilityPackage,
  FacilitySchedule,
  ListMyBookingsQuery,
  Paginated,
} from '@sports-center/shared';
import { PAGINATION } from '@sports-center/shared';
import { privateApi } from '~/lib/http';
import type { PackagePreview, PackagePreviewRequest } from '../types';

/**
 * Facility schedule, recurring-package preview and bookings.
 */
export const bookingsService = {
  facilitySchedule: async (facilityId: string, date: string) => {
    const { data } = await privateApi.get<ApiResponse<FacilitySchedule>>(
      `/facilities/${encodeURIComponent(facilityId)}/schedule`,
      { params: { date } },
    );
    return data.result;
  },

  previewPackage: async (body: PackagePreviewRequest) => {
    const { data } = await privateApi.post<ApiResponse<PackagePreview>>('/facility-packages/preview', body);
    return data.result;
  },

  listMine: async (params: ListMyBookingsQuery) => {
    const { data } = await privateApi.get<ApiResponse<Paginated<Booking>>>('/me/bookings', { params });
    return data.result;
  },

  listMyPackages: async () => {
    const { data } = await privateApi.get<ApiResponse<FacilityPackage[]>>('/me/facility-packages');
    return data.result;
  },

  /** Reception desk: every confirmed booking of one day, earliest first. */
  listOn: async (date: string) => {
    const { data } = await privateApi.get<ApiResponse<Paginated<Booking>>>('/bookings', {
      params: { date, status: 'CONFIRMED', page: 1, limit: PAGINATION.MAX_LIMIT },
    });
    return data.result.items.sort((a, b) => a.startTime.localeCompare(b.startTime));
  },
};
