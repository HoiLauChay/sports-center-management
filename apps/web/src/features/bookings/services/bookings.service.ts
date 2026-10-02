import { loadCatalog } from '~/features/checkout/mocks/pricing';
import { ensureClassSeed } from '~/features/classes/mocks/classes';
import { mockErrors, mockRequest } from '~/lib/mock/errors';
import { toMinutes } from '~/lib/time';
import { computeSchedule, previewPackage } from '../mocks/schedule';
import type { PackagePreviewRequest } from '../types';

/**
 * Facility schedule and recurring-package preview. Mock until #103 and #138 ship (see `../mocks`); the facilities,
 * settings and membership data they rely on come from the real API.
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
};
