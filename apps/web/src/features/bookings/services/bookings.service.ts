import type { Account, ApiResponse, FacilitySchedule } from '@sports-center/shared';
import { loadCatalog } from '~/features/checkout/mocks/pricing';
import { actorOf } from '~/features/checkout/services/checkout.service';
import { ensureClassSeed } from '~/features/classes/mocks/classes';
import { privateApi } from '~/lib/http';
import { mockErrors, mockRequest } from '~/lib/mock/errors';
import { toMinutes } from '~/lib/time';
import { listBookingsOn, listMyBookings, listMyPackages, type ListBookingsQuery } from '../mocks/bookings';
import { previewPackage } from '../mocks/schedule';
import type { PackagePreview, PackagePreviewRequest } from '../types';

/**
 * Facility schedule, recurring-package preview and my bookings. The schedule and the member's package preview come from the
 * API; my bookings and the reception day list stay mock until #167 ships (see `../mocks`).
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

  listMine: (user: Account, query: ListBookingsQuery) => mockRequest(() => listMyBookings(actorOf(user), query)),

  listMyPackages: (user: Account) => mockRequest(() => listMyPackages(actorOf(user))),

  /** Reception desk: every confirmed booking of one day. */
  listOn: (date: string) => mockRequest(() => listBookingsOn(date)),
};
