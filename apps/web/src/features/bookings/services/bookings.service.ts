import type {
  ApiResponse,
  Booking,
  FacilityPackage,
  FacilitySchedule,
  ListMyBookingsQuery,
  Paginated,
} from '@sports-center/shared';
import { PAGINATION } from '@sports-center/shared';
import { loadCatalog } from '~/features/checkout/mocks/pricing';
import { ensureClassSeed } from '~/features/classes/mocks/classes';
import { privateApi } from '~/lib/http';
import { mockErrors, mockRequest } from '~/lib/mock/errors';
import { toMinutes } from '~/lib/time';
import { previewPackage } from '../mocks/schedule';
import type { PackagePreview, PackagePreviewRequest } from '../types';

/**
 * Facility schedule, recurring-package preview and bookings, all from the API except the counter package preview.
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

  /** `POST /facility-packages/preview` only accepts members, so the counter keeps the mock until #134 wires it. */
  previewPackageAtCounter: (request: PackagePreviewRequest) =>
    mockRequest(async () => {
      const { facilities, settings } = await loadCatalog();
      ensureClassSeed(facilities, settings);
      const facility = facilities.find((entry) => entry.id === request.facilityId);
      if (!facility) throw mockErrors.notFound('Không tìm thấy sân / phòng');
      const slots = Math.max(
        1,
        Math.round((toMinutes(request.endTime) - toMinutes(request.startTime)) / settings.slotDurationMinutes),
      );
      return previewPackage(facility, settings, request, facility.pricePerSlot, slots);
    }, 150),

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
