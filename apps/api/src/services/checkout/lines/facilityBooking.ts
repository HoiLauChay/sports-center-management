import {
  ERROR_CODE,
  type BookingBenefit,
  type CheckoutItemInput,
  type FacilityBookingSnapshot,
} from '@sports-center/shared';

import bookingRepository from '~/repositories/booking.repository';
import facilityRepository from '~/repositories/facility.repository';
import scheduleRepository from '~/repositories/schedule.repository';
import { priceBookings } from '~/services/checkout/lines/bookingPricing';
import { busyInOrder, CLASH_MESSAGE, lineError } from '~/services/checkout/lines/shared';
import type { LineHandler } from '~/services/checkout/types';
import scheduleService, { type PlannedUse } from '~/services/schedule.service';
import { addDays, parseTime, toCenterDateTime, todayInCenter, toDbTime } from '~/utils/time';

type BookingInput = Extract<CheckoutItemInput, { type: 'FACILITY_BOOKING' }>;

interface BookingData {
  facilityId: string;
  date: string;
  start: number;
  end: number;
  slots: number;
  unitPrice: number;
  benefit: BookingBenefit;
}

export const facilityBookingHandler: LineHandler<BookingInput, BookingData, FacilityBookingSnapshot> = {
  type: 'FACILITY_BOOKING',
  guestAllowed: true,
  needsScheduleLock: true,

  lockTargets: (input) => ({ facilities: [input.facilityId] }),

  prepare: async (db, ctx, input) => {
    const facility = await facilityRepository.findById(input.facilityId, db);
    if (!facility) return lineError(ERROR_CODE.NOT_FOUND, 'Cơ sở không tồn tại');

    const range = { date: input.date, start: parseTime(input.startTime), end: parseTime(input.endTime) };
    const lastDay = addDays(todayInCenter(ctx.now), ctx.settings.maxAdvanceBookingDays);
    if (input.date > lastDay) {
      return lineError(ERROR_CODE.VALIDATION, `Chỉ được đặt trước tối đa ${ctx.settings.maxAdvanceBookingDays} ngày`);
    }
    if (busyInOrder(ctx, [range])) return lineError(ERROR_CODE.SCHEDULE_CONFLICT, CLASH_MESSAGE.MEMBER_BUSY);

    const [clash] = await scheduleService.findConflicts(db, {
      ranges: [range],
      facility: { id: facility.id, exclusive: false },
      accountId: ctx.buyer.kind === 'MEMBER' ? ctx.buyer.accountId : undefined,
      planned: ctx.planned.flatMap(({ uses }) => uses),
      now: ctx.now,
    });
    if (clash) return lineError(ERROR_CODE.SCHEDULE_CONFLICT, CLASH_MESSAGE[clash.reason]);

    const slots = (range.end - range.start) / ctx.settings.slotDurationMinutes;
    const unitPrice = Number(facility.pricePerSlot);
    const [priced] = await priceBookings(db, ctx, facility, [{ date: input.date, slots }]);
    const { subtotal, discount, discountPct, benefit } = priced!;
    const use: PlannedUse = { ...range, facilityId: facility.id, exclusive: false };

    return {
      ok: true,
      subtotal,
      membershipDiscount: discount,
      snapshot: {
        title: facility.name,
        startAt: toCenterDateTime(range.date, range.start).toISOString(),
        endAt: toCenterDateTime(range.date, range.end).toISOString(),
        discountPct,
        facilityName: facility.name,
        sportNames: facility.sports.map(({ sport }) => sport.name),
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        slots,
        pricePerSlot: unitPrice,
        benefit,
      },
      data: { facilityId: facility.id, ...range, slots, unitPrice, benefit },
      uses: [use],
    };
  },

  verify: async (tx, _ctx, { data }) => {
    const [facility, , , maintenances] = await scheduleRepository.findFacilityUsage(data.facilityId, [data.date], tx);
    if (!facility || facility.deletedAt || !facility.isActive) {
      return { code: ERROR_CODE.SCHEDULE_CONFLICT, message: CLASH_MESSAGE.CLOSED };
    }
    const startAt = toCenterDateTime(data.date, data.start);
    const endAt = toCenterDateTime(data.date, data.end);
    return maintenances.some((item) => item.startAt < endAt && startAt < item.endAt)
      ? { code: ERROR_CODE.SCHEDULE_CONFLICT, message: CLASH_MESSAGE.MAINTENANCE }
      : null;
  },

  fulfill: async (tx, ctx, { data }, orderItemId) => {
    const booking = await bookingRepository.create(
      {
        facilityId: data.facilityId,
        accountId: ctx.buyer.kind === 'MEMBER' ? ctx.buyer.accountId : null,
        orderItemId,
        bookingDate: new Date(data.date),
        startTime: toDbTime(data.start),
        endTime: toDbTime(data.end),
        unitPrice: data.unitPrice,
        benefit: data.benefit,
      },
      tx,
    );
    return { refId: booking.id };
  },
};
