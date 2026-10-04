import type { Account, FacilitySchedule as ApiFacilitySchedule, ApiResponse } from '@sports-center/shared';
import { loadCatalog } from '~/features/checkout/mocks/pricing';
import { actorOf } from '~/features/checkout/services/checkout.service';
import { ensureClassSeed } from '~/features/classes/mocks/classes';
import { walletService } from '~/features/wallet/services/wallet.service';
import { privateApi } from '~/lib/http';
import { mockErrors, mockRequest } from '~/lib/mock/errors';
import { toMinutes } from '~/lib/time';
import {
  cancelBooking,
  cancelPackage,
  listMyBookings,
  listMyPackages,
  type ListBookingsQuery,
} from '../mocks/bookings';
import { previewPackage } from '../mocks/schedule';
import type { FacilitySchedule, PackagePreviewRequest } from '../types';

const balanceOfMine = (user: Account) => (accountId: string) =>
  accountId === user.id ? walletService.balanceOfMine(accountId) : walletService.balanceOfMember(accountId);

/**
 * Facility schedules use the real API (#103). Package preview, bookings and cancellation
 * remain mocked until their respective endpoints ship.
 */
export const bookingsService = {
  /** `GET /facilities/{id}/schedule?date=` */
  facilitySchedule: async (facilityId: string, date: string): Promise<FacilitySchedule> => {
    const { data } = await privateApi.get<ApiResponse<ApiFacilitySchedule>>(
      `/facilities/${encodeURIComponent(facilityId)}/schedule`,
      { params: { date } },
    );
    return {
      ...data.result,
      slots: data.result.slots.map((slot) => ({
        ...slot,
        status: slot.status === 'AVAILABLE' && slot.booked > 0 ? 'PARTIAL' : slot.status,
      })),
    };
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

  cancel: (user: Account, id: string) =>
    mockRequest(async () => {
      const { settings } = await loadCatalog();
      return cancelBooking(actorOf(user), id, settings, balanceOfMine(user));
    }, 350),

  cancelPackage: (user: Account, id: string) =>
    mockRequest(async () => {
      const { settings } = await loadCatalog();
      return cancelPackage(actorOf(user), id, settings, balanceOfMine(user));
    }, 350),
};
