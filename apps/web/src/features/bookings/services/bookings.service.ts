import type { Account, ApiResponse, FacilitySchedule } from '@sports-center/shared';
import { loadCatalog } from '~/features/checkout/mocks/pricing';
import { actorOf } from '~/features/checkout/services/checkout.service';
import { ensureClassSeed } from '~/features/classes/mocks/classes';
import { privateApi } from '~/lib/http';
import { mockErrors, mockRequest } from '~/lib/mock/errors';
import { toMinutes } from '~/lib/time';
import { listBookingsOn, listMyBookings, listMyPackages, type ListBookingsQuery } from '../mocks/bookings';
import { previewPackage } from '../mocks/schedule';
import type { PackagePreviewRequest } from '../types';

/**
 * Facility schedule, recurring-package preview and my bookings. The facility schedule comes from the API; the rest is mock until
 * #112, #133 and #138 ship (see `../mocks`); the facilities, settings and membership data they rely on come from the real API.
 */
export const bookingsService = {
  facilitySchedule: async (facilityId: string, date: string) => {
    const { data } = await privateApi.get<ApiResponse<FacilitySchedule>>(
      `/facilities/${encodeURIComponent(facilityId)}/schedule`,
      { params: { date } },
    );
    return data.result;
  },

  /** `POST /facility-packages/preview` */
  previewPackage: (request: PackagePreviewRequest) =>
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

  listMine: (user: Account, query: ListBookingsQuery) => mockRequest(() => listMyBookings(actorOf(user), query)),

  listMyPackages: (user: Account) => mockRequest(() => listMyPackages(actorOf(user))),

  /** Reception desk: every confirmed booking of one day. */
  listOn: (date: string) => mockRequest(() => listBookingsOn(date)),
};
