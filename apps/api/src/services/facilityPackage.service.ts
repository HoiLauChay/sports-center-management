import {
  ERROR_CODE,
  type FacilityPackagePreview,
  type FacilityPackagePreviewBody,
  type ScheduleClashReason,
} from '@sports-center/shared';

import { prisma } from '~/configs/db';
import { HTTP_STATUS } from '~/constants/httpStatus';
import { toFacilityPackageResponse } from '~/mappers/booking.mapper';
import bookingRepository from '~/repositories/booking.repository';
import { ErrorWithStatus } from '~/rules/error';
import { buildContext } from '~/services/checkout/context';
import { planPackage } from '~/services/checkout/lines/facilityPackage';
import { loadHeldLines } from '~/services/checkout/prepareOrder';
import { formatTime } from '~/utils/time';

type Conflict = NonNullable<FacilityPackagePreview['bookings'][number]['conflict']>;

const CONFLICT_OF: Record<ScheduleClashReason, Conflict> = {
  BOOKED: 'BOOKED',
  FULL: 'BOOKED',
  MEMBER_BUSY: 'BOOKED',
  CLASS_SESSION: 'CLASS',
  MAINTENANCE: 'MAINTENANCE',
  CLOSED: 'CLOSED',
  PAST: 'CLOSED',
  OFF_GRID: 'CLOSED',
  COACH_BUSY: 'CLOSED',
};

class FacilityPackageService {
  listMine = async (accountId: string) =>
    (await bookingRepository.findPackagesByAccount(accountId)).map(toFacilityPackageResponse);

  preview = async (actor: { id: string; role: 'MEMBER' }, body: FacilityPackagePreviewBody) => {
    const ctx = await buildContext(prisma, actor, undefined);
    await loadHeldLines(prisma, ctx);
    const plan = await planPackage(prisma, ctx, body);
    if (!plan) {
      throw new ErrorWithStatus({
        status: HTTP_STATUS.NOT_FOUND,
        code: ERROR_CODE.NOT_FOUND,
        message: 'Cơ sở không tồn tại',
      });
    }

    const unitPrice = Number(plan.facility.pricePerSlot);
    const slots = (plan.sessions[0]!.end - plan.sessions[0]!.start) / ctx.settings.slotDurationMinutes;
    return {
      bookings: plan.sessions.map(({ date, start, end, clash }) => ({
        date,
        startTime: formatTime(start),
        endTime: formatTime(end),
        available: !clash,
        ...(clash && { conflict: CONFLICT_OF[clash] }),
      })),
      isValid: plan.sessions.every(({ clash }) => !clash),
      unitPrice,
      basePrice: unitPrice * slots * plan.sessions.length,
    } satisfies FacilityPackagePreview;
  };
}

export default new FacilityPackageService();
