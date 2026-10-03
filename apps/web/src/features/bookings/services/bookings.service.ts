import type { Account } from '@sports-center/shared';
import { loadCatalog } from '~/features/checkout/mocks/pricing';
import { actorOf } from '~/features/checkout/services/checkout.service';
import { ensureClassSeed } from '~/features/classes/mocks/classes';
import { walletService } from '~/features/wallet/services/wallet.service';
import { mockErrors, mockRequest } from '~/lib/mock/errors';
import { toMinutes } from '~/lib/time';
import {
  cancelBooking,
  cancelPackage,
  listMyBookings,
  listMyPackages,
  type ListBookingsQuery,
} from '../mocks/bookings';
import { computeSchedule, previewPackage } from '../mocks/schedule';
import type { PackagePreviewRequest } from '../types';

const balanceOfMine = (user: Account) => (accountId: string) =>
  accountId === user.id ? walletService.balanceOfMine() : walletService.balanceOfMember(accountId);

/**
 * Facility schedule, recurring-package preview, my bookings and cancellation. Mock until #103, #112, #133 and #138
 * ship (see `../mocks`); the facilities, settings and membership data they rely on come from the real API.
 */
export const bookingsService = {
  /** `GET /facilities/{id}/schedule?date=` */
  facilitySchedule: (facilityId: string, date: string) =>
    mockRequest(async () => {
      const { facilities, settings } = await loadCatalog();
      ensureClassSeed(facilities, settings);
      const facility = facilities.find((entry) => entry.id === facilityId);
      if (!facility) throw mockErrors.notFound('Không tìm thấy sân / phòng');
      return computeSchedule(facility, settings, date);
    }, 150),

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
