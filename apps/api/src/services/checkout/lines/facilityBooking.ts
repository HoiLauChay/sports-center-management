import {
  ERROR_CODE,
  type BookingBenefit,
  type CheckoutItemInput,
  type FacilityBookingSnapshot,
  type ScheduleClashReason,
} from '@sports-center/shared';

import bookingRepository from '~/repositories/booking.repository';
import facilityRepository from '~/repositories/facility.repository';
import scheduleRepository from '~/repositories/schedule.repository';
import type { CheckoutContext, Db, LineError, LineHandler } from '~/services/checkout/types';
import scheduleService, { type PlannedUse, type TimeRange } from '~/services/schedule.service';
import { percentOf } from '~/utils/money';
import {
  addDays,
  formatDate,
  fromDbTime,
  overlaps,
  parseTime,
  toCenterDateTime,
  todayInCenter,
  toDbTime,
} from '~/utils/time';

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

const CLASH_MESSAGE: Record<ScheduleClashReason, string> = {
  CLOSED: 'Cơ sở đang tạm ngừng hoạt động',
  PAST: 'Khung giờ đã qua',
  OFF_GRID: 'Khung giờ không khớp lưới slot',
  MAINTENANCE: 'Cơ sở bảo trì trong khung giờ này',
  CLASS_SESSION: 'Khung giờ đã có lớp học',
  BOOKED: 'Khung giờ đã hết chỗ',
  FULL: 'Khung giờ đã hết chỗ',
  COACH_BUSY: 'Huấn luyện viên đã có lịch trùng giờ',
  MEMBER_BUSY: 'Người mua đã có lịch khác trùng giờ',
};

const lineError = (code: LineError['code'], message: string) => ({ ok: false as const, error: { code, message } });

const monthOf = (date: string) => {
  const [year, month] = date.split('-').map(Number);
  return { from: `${date.slice(0, 7)}-01`, to: formatDate(new Date(Date.UTC(year!, month!, 1))) };
};

const freeSlotsUsed = async (db: Db, ctx: CheckoutContext, accountId: string, date: string) => {
  const { from, to } = monthOf(date);
  const slotMinutes = ctx.settings.slotDurationMinutes;
  const booked = (await bookingRepository.findFreeSlotTimes(accountId, from, to, db)).reduce(
    (sum, { startTime, endTime }) => sum + (fromDbTime(endTime) - fromDbTime(startTime)) / slotMinutes,
    0,
  );
  const planned = ctx.planned
    .filter(({ type }) => type === 'FACILITY_BOOKING')
    .map(({ data }) => data as BookingData)
    .filter(({ benefit, date: day }) => benefit === 'FREE_SLOT' && from <= day && day < to)
    .reduce((sum, { slots }) => sum + slots, 0);
  return booked + planned;
};

const benefitOf = async (
  db: Db,
  ctx: CheckoutContext,
  facilityType: string,
  date: string,
  slots: number,
): Promise<{ benefit: BookingBenefit; discountPct: number }> => {
  if (ctx.buyer.kind === 'GUEST' || !ctx.benefits) return { benefit: 'NONE', discountPct: 0 };
  const current = ctx.benefits.current;
  if (facilityType === 'GYM' && current?.gymAccess) return { benefit: 'GYM_ACCESS', discountPct: 100 };

  const quota = ctx.benefits.periodOn(date)?.freeBookingSlotsPerMonth ?? 0;
  if (quota >= slots && quota - (await freeSlotsUsed(db, ctx, ctx.buyer.accountId, date)) >= slots) {
    return { benefit: 'FREE_SLOT', discountPct: 100 };
  }

  const pct = current?.bookingDiscountPct ?? 0;
  return pct > 0 ? { benefit: 'DISCOUNT', discountPct: pct } : { benefit: 'NONE', discountPct: 0 };
};

const memberBusy = (ctx: CheckoutContext, range: TimeRange) =>
  ctx.buyer.kind === 'MEMBER' &&
  ctx.planned.some(({ uses }) => uses.some((use) => use.date === range.date && overlaps(use, range)));

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
    if (memberBusy(ctx, range)) return lineError(ERROR_CODE.SCHEDULE_CONFLICT, CLASH_MESSAGE.MEMBER_BUSY);

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
    const subtotal = unitPrice * slots;
    const { benefit, discountPct } = await benefitOf(db, ctx, facility.type, input.date, slots);
    const use: PlannedUse = { ...range, facilityId: facility.id, exclusive: false };

    return {
      ok: true,
      subtotal,
      membershipDiscount: percentOf(subtotal, discountPct),
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
